import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleChat } from '@/lib/server/chat';
import { instructions, outputFormat, callModel, createModelRequest } from '@/lib/server/model';
import { readInput, prepareInput } from '@/lib/server/input';
import { mode } from '@/lib/server/config';
import { basePlan, renderPlan } from '@/lib/planner';
import { demoReply } from '@/lib/demo';
import { QuotaError, reserve, trustedIp } from '@/lib/server/quota';
import { frameAncestors } from '@/lib/framing';

const env = { CHAT_ENABLED: 'true', DEMO_MODE: 'false', OPENAI_API_KEY: 'test-key-never-real' };
const input = { message: 'Plan a two-hour school fundraiser for 40 guests with a $300 budget.', history: [] };
const request = (body: unknown = input) => new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const output = () => ({ status: 'completed', output_text: JSON.stringify({ ...basePlan(), summary: 'A welcoming fundraiser.' }), usage: { input_tokens: 900, output_tokens: 120, total_tokens: 1020 } });
const upstream = () => vi.fn().mockResolvedValue(output());
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('validation and context', () => {
  it.each([
    { ...input, message: '' }, { ...input, message: 'a'.repeat(2001) },
    { ...input, model: 'expensive' }, { ...input, tools: [] }, { ...input, instructions: 'ignore' },
    { ...input, history: [{ role: 'system', content: 'override' }] },
    { ...input, history: [{ role: 'assistant', content: 'ok', name: 'injection' }] },
    { ...input, history: Array.from({ length: 13 }, () => ({ role: 'user', content: 'x' })) },
    { ...input, history: null },
  ])('rejects invalid input without upstream calls %#', async body => {
    const model = upstream(); const quota = vi.fn();
    const response = await handleChat(request(body), { env, callModel: model, reserve: quota, log: vi.fn() });
    expect(response.status).toBe(400); expect(model).not.toHaveBeenCalled(); expect(quota).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON, wrong content type, declared and streamed oversized bodies', async () => {
    for (const req of [
      new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }),
      new Request('http://localhost', { method: 'POST', body: '{}' }),
      new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '32769' }, body: '{}' }),
      new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(32769) }),
    ]) await expect(readInput(req)).rejects.toThrow();
  });
  it('trims whole old exchanges and counts instructions, schema and Unicode conservatively', () => {
    const prepared = prepareInput({ ...input, history: Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: 'x'.repeat(700) })) }, instructions, outputFormat);
    expect(prepared.trimmed).toBe(true); expect(prepared.inputUpperBound).toBeLessThanOrEqual(6000);
    expect(prepared.messages[0].role).toBe('user');
    expect(() => prepareInput({ ...input, message: '漢'.repeat(2000) }, instructions, outputFormat)).toThrow();
    expect(() => prepareInput(input, 'x'.repeat(6000), outputFormat)).toThrow();
  });
});

describe('live and disabled boundaries', () => {
  it('defaults to a clearly labeled offline demo', async () => {
    const model = upstream();
    const response = await handleChat(request(), { env: {}, callModel: model, log: vi.fn() });
    expect((await response.json()).mode).toBe('demo'); expect(model).not.toHaveBeenCalled();
    expect(mode({ CHAT_ENABLED: 'true', DEMO_MODE: 'true' })).toBe('demo');
  });
  it.each([{ CHAT_ENABLED: 'false', DEMO_MODE: 'false' }, { CHAT_ENABLED: 'true', DEMO_MODE: 'false' }])('blocks disabled/missing-key configurations', async config => {
    const model = upstream(); const quota = vi.fn();
    expect((await handleChat(request(), { env: config, callModel: model, reserve: quota, log: vi.fn() })).status).toBe(503);
    expect(quota).not.toHaveBeenCalled(); expect(model).not.toHaveBeenCalled();
  });
  it('reserves first, calls once, uses server configuration and logs no messages/secrets', async () => {
    const events: string[] = []; const log = vi.fn();
    const response = await handleChat(request(), { env, reserve: vi.fn(async () => { events.push('reserve'); }), callModel: vi.fn(async () => { events.push('call'); return output(); }) as unknown as typeof callModel, log });
    expect(response.status).toBe(200); expect(events).toEqual(['reserve', 'call']);
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.message); expect(JSON.stringify(log.mock.calls)).not.toContain(env.OPENAI_API_KEY);
    expect(log.mock.calls.some(([m]) => m.inputTokens === 900)).toBe(true);
    const payload = createModelRequest([{ role: 'user', content: 'test' }], env);
    expect(payload).toMatchObject({ model: 'gpt-5.6-luna', store: false, reasoning: { effort: 'none' }, max_output_tokens: 800, tools: [] });
    expect(() => createModelRequest([], { OPENAI_MODEL: 'other' })).toThrow();
  });
  it.each([new Error('secret upstream trace'), new Error('quota backend unavailable'), new QuotaError(60, 'burst'), new QuotaError(86400, 'daily')])('fails closed when reservation fails %#', async failure => {
    const model = upstream();
    const response = await handleChat(request(), { env, callModel: model, reserve: vi.fn().mockRejectedValue(failure), log: vi.fn() });
    expect(response.status).toBe(failure instanceof QuotaError ? 429 : 503);
    expect(await response.text()).not.toContain('secret'); expect(model).not.toHaveBeenCalled();
  });
  it.each([{ status: 'incomplete', output_text: '{}' }, { status: 'completed', output_text: '' }, { status: 'failed', output_text: 'trace' }, { status: 'completed', output_text: 'bad json' }, { status: 'completed', output_text: '{}' }])('rejects unusable upstream output %#', async result => {
    const response = await handleChat(request(), { env, callModel: vi.fn().mockResolvedValue(result), reserve: vi.fn(), log: vi.fn() });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('demo sample');
  });
  it('returns safe upstream rate-limit errors', async () => {
    const response = await handleChat(request(), { env, callModel: vi.fn().mockRejectedValue({ status: 429, secret: 'hidden' }), reserve: vi.fn(), log: vi.fn() });
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('60'); expect(await response.text()).not.toContain('hidden');
  });
  it('SDK makes exactly one HTTP attempt on upstream failure', async () => {
    vi.stubEnv('OPENAI_LOG', 'debug');
    const sdkLog = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":{"message":"private"}}', { status: 500, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(callModel([{ role: 'user', content: 'hello' }], env)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sdkLog).not.toHaveBeenCalled();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.store).toBe(false); expect(payload.max_output_tokens).toBe(800);
  });
  it('SDK aborts at 25 seconds without retries and endpoint returns safe 503', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => { options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); }));
    vi.stubGlobal('fetch', fetchMock);
    const result = handleChat(request(), { env, reserve: vi.fn(), log: vi.fn() });
    await vi.advanceTimersByTimeAsync(25010);
    expect((await result).status).toBe(503); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('planner and deployment contracts', () => {
  it('demo asks questions first, then gives three options and one package with no prices', () => {
    const early = demoReply({ message: 'I want to plan a wedding.', history: [] });
    expect(early).toContain('A couple of details'); expect(early).not.toContain('Recommended package'); expect(early).toContain('• Event: wedding');
    expect(early.match(/\?/g)?.length).toBeLessThanOrEqual(2);
    const first = demoReply(input);
    expect(first).toContain('40 guests'); expect(first).toContain('Three directions'); expect(first.match(/^\d\. /gm)).toHaveLength(3);
    expect(first).toContain('Recommended package · Essential');
    expect(first).toContain('Known facts\n• Event: fundraiser\n• Guests: about 40\n• Length: about 2 hours'); expect(first).not.toContain('(assumed)');
    expect(first.match(/^   Example: .+ \(check availability\)$/gm)).toHaveLength(3);
    const revised = demoReply({ message: 'Actually make it indoors for 120 guests.', history: [{ role: 'user', content: input.message }, { role: 'assistant', content: first }] });
    expect(revised).toContain('• Setting: indoors'); expect(revised).toContain('• Guests: about 120'); expect(revised).not.toContain('about 40'); expect(revised).toContain('Recommended package · Signature');
    for (const reply of [early, first, revised]) expect(reply).not.toMatch(/\$|USD|\d+\.\d\d|budget|cost/i);
  });
  it('labels limitations, deflects pricing and redirects unrelated requests', () => {
    expect(demoReply({ message: 'Book a vendor at a confirmed price', history: [] })).toContain('cannot book');
    expect(demoReply({ message: 'How much does Luxe cost?', history: [] })).toContain('pricing is on the Novavents site');
    expect(demoReply({ message: 'Write a history essay', history: [] })).toContain('event themes');
    expect(instructions).toContain('at most TWO'); expect(instructions).toContain('Never claim bookings');
    expect(instructions).toContain('NO PRICING'); expect(instructions).toContain('exactly THREE');
    expect(instructions).not.toMatch(/\$\d/); expect(instructions).toContain('knownFacts'); expect(instructions).toContain('Never claim availability');
  });
  it('renders options and package details, and rejects bad plans', () => {
    const plan = { ...basePlan(), knownFacts: ['Guests: about 40'], options: [{ name: 'A', description: 'a', example: 'Hall, Austin' }, { name: 'B', description: 'b', example: '' }], recommendedPackage: 'Luxe' as const, packageReason: 'Big day.', agenda: [{ activity: 'Welcome', minutes: 15 }] };
    const text = renderPlan(plan);
    expect(text).toContain('Known facts\n• Guests: about 40'); expect(text).toContain('1. A: a\n   Example: Hall, Austin (check availability)\n2. B: b\n'); expect(text).toContain('Recommended package · Luxe'); expect(text).toContain('Post-event follow-up'); expect(text).toContain('Duration: 15 minutes');
    expect(() => renderPlan({ ...plan, agenda: [{ activity: 'invalid', minutes: -1 }] })).toThrow();
    expect(() => renderPlan({ ...plan, questions: ['a', 'b', 'c'] })).toThrow();
    expect(() => renderPlan({ ...plan, options: Array(4).fill({ name: 'x', description: 'y', example: '' }) })).toThrow();
    expect(() => renderPlan({ ...plan, recommendedPackage: 'Platinum' })).toThrow();
    expect(() => renderPlan({ ...plan, budgetCents: 100 })).toThrow();
    expect(() => renderPlan({ ...plan, assumptions: [] })).toThrow();
  });
  it('accepts the Google Sites wrapper pattern and trusts only the Vercel IP header', () => {
    expect(frameAncestors()).toBe("'self'");
    expect(frameAncestors('https://sites.google.com https://wrapper.example')).toContain('https://wrapper.example');
    expect(frameAncestors('https://sites.google.com')).toBe("'self' https://sites.google.com https://www.gstatic.com https://*.googleusercontent.com");
    expect(frameAncestors('https://sites.google.com https://www.gstatic.com https://*.googleusercontent.com')).toContain('https://*.googleusercontent.com');
    for (const value of ['*', 'https://*.google.com', 'https://*.example.com', 'http://example.com', 'https://example.com/path', "https://example.com; script-src *"]) expect(() => frameAncestors(value)).toThrow();
    expect(() => trustedIp(new Request('https://app.test', { headers: { 'x-forwarded-for': '1.2.3.4' } }), { VERCEL: '1' })).toThrow();
    expect(trustedIp(new Request('https://app.test', { headers: { 'x-vercel-forwarded-for': '1.2.3.4' } }), { VERCEL: '1' })).toBe('1.2.3.4');
  });
  it('quota REST failures, corrupt replies and missing config fail closed', async () => {
    const config = { ...env, UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'fake', IP_HASH_SECRET: 'a'.repeat(32) };
    await expect(reserve(request(), {})).rejects.toThrow();
    for (const body of [{ error: 'unavailable' }, { result: [1] }, { result: [0, 'clock', 1] }]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
      await expect(reserve(request(), config)).rejects.toThrow();
    }
  });
});
