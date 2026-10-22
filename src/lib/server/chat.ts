import 'server-only';
import { randomUUID } from 'node:crypto';
import { mode } from './config';
import { readInput, prepareInput, contextUsage, InputError } from './input';
import { instructions, outputFormat, callModel, createModelRequest } from './model';
import { QuotaError, reserve } from './quota';
import { demoReply } from '../demo';
import { compactReply, renderPlan } from '../planner';

type Dependencies = { env: Record<string, string | undefined>; reserve: typeof reserve; callModel: typeof callModel; log: (metadata: Record<string, unknown>) => void };
export async function handleChat(request: Request, overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = { env: process.env, reserve, callModel, log: metadata => console.info(JSON.stringify(metadata)), ...overrides };
  const started = Date.now();
  const requestId = randomUUID();
  const reply = (body: unknown, status: number, retryAfter?: number) => {
    deps.log({ requestId, status, latencyMs: Date.now() - started });
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } });
  };
  try {
    const input = await readInput(request);
    const activeMode = mode(deps.env);
    if (activeMode === 'disabled') return reply({ error: 'Chat is currently turned off. Please try again later.' }, 503);
    // Past replies go back to the AI without their repeated boilerplate, leaving more room for the conversation.
    const history = input.history.map(m => m.role === 'assistant' ? { ...m, content: compactReply(m.content) } : m);
    const prepared = prepareInput({ ...input, history }, instructions, outputFormat);
    const usage = (text: string) => contextUsage([...prepared.messages, { role: 'assistant', content: compactReply(text) }], instructions, outputFormat);
    if (activeMode === 'demo') {
      const text = demoReply({ message: input.message, history: prepared.messages.slice(0, -1) });
      return reply({ reply: text, mode: 'demo', contextTrimmed: prepared.trimmed, contextUsed: usage(text) }, 200);
    }
    if (!deps.env.OPENAI_API_KEY) throw new Error('Missing live configuration');
    createModelRequest(prepared.messages, deps.env); // Validate config before reserving.
    await deps.reserve(request, deps.env);
    const result = await deps.callModel(prepared.messages, deps.env);
    if (result.usage) deps.log({ requestId, inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens, totalTokens: result.usage.total_tokens });
    if (result.status !== 'completed' || !result.output_text?.trim()) throw new Error('No complete output');
    const text = renderPlan(JSON.parse(result.output_text));
    return reply({ reply: text, mode: 'live', contextTrimmed: prepared.trimmed, contextUsed: usage(text) }, 200);
  } catch (error) {
    if (error instanceof InputError) return reply({ error: 'Please send a shorter message (up to 2,000 characters) with valid chat history. Large context or unsupported fields are not accepted.' }, 400);
    if (error instanceof QuotaError) return reply({ error: error.kind === 'burst' ? 'This network has sent several requests. Wait a moment and try again.' : 'The shared demo usage limit has been reached. Please return later.' }, 429, error.retryAfter);
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) return reply({ error: 'The AI service is busy. Please wait before trying again.' }, 429, 60);
    return reply({ error: 'The planner is temporarily unavailable. Your message was not replaced with a demo answer. Please try again later.' }, 503);
  }
}
