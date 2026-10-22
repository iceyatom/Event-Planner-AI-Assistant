import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { limit } from './config';

// One atomic Redis EVAL: sliding IP window and both global counters are checked
// before any reservation. Failed upstream calls still consume a reservation.
export const RESERVE_LUA = `
local clock = redis.call('TIME')
local now = tonumber(clock[1])
local monthStart = tonumber(ARGV[1])
local monthEnd = tonumber(ARGV[2])
if now < monthStart or now >= monthEnd then return {0, 'clock', 1} end
local dayKey = KEYS[1] .. ':day:' .. math.floor(now / 86400)
local monthKey = KEYS[1] .. ':month:' .. monthStart
local ipKey = KEYS[2]
local daily = tonumber(redis.call('GET', dayKey) or '0')
local monthly = tonumber(redis.call('GET', monthKey) or '0')
if daily >= tonumber(ARGV[3]) then return {0, 'daily', 86400 - now % 86400} end
if monthly >= tonumber(ARGV[4]) then return {0, 'monthly', monthEnd - now} end
local window = tonumber(ARGV[6])
redis.call('ZREMRANGEBYSCORE', ipKey, '-inf', now - window)
if redis.call('ZCARD', ipKey) >= tonumber(ARGV[5]) then return {0, 'burst', window} end
redis.call('INCR', dayKey)
redis.call('EXPIRE', dayKey, 172800)
redis.call('INCR', monthKey)
redis.call('EXPIREAT', monthKey, monthEnd + 86400)
redis.call('ZADD', ipKey, now, ARGV[7])
redis.call('EXPIRE', ipKey, window + 1)
return {1, 'ok', 0}
`;
export class QuotaError extends Error {
  constructor(public retryAfter: number, public kind: string) { super('Limit reached'); }
}

export function quotaCommand(ip: string, env: Record<string, string | undefined>, now = new Date()) {
  if (!env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32) throw new Error('Missing quota configuration');
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000;
  const digest = createHmac('sha256', env.IP_HASH_SECRET).update(ip).digest('hex');
  return ['EVAL', RESERVE_LUA, '2', '{event-planner}:quota', `{event-planner}:ip:${digest}`,
    String(monthStart), String(monthEnd),
    String(limit(env.DAILY_REQUEST_LIMIT, 400, 400)), String(limit(env.MONTHLY_REQUEST_LIMIT, 2000, 2000)),
    String(limit(env.IP_BURST_LIMIT, 30, 100)), String(limit(env.IP_BURST_WINDOW_SECONDS, 60, 3600)), randomUUID()];
}

export function trustedIp(request: Request, env: Record<string, string | undefined>) {
  // Vercel overwrites this header. Never trust a client x-forwarded-for value.
  // A localhost live smoke test shares one bucket. Other platforms fail closed.
  if (env.VERCEL !== '1') {
    if (env.NODE_ENV !== 'production') return 'local-development';
    throw new Error('Unsupported proxy');
  }
  const ip = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (!ip || !isIP(ip)) throw new Error('Missing trusted IP');
  return ip;
}

export async function reserve(request: Request, env: Record<string, string | undefined> = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || new URL(url).protocol !== 'https:') throw new Error('Missing quota store');
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(quotaCommand(trustedIp(request, env), env)),
    signal: AbortSignal.timeout(3000), cache: 'no-store', redirect: 'error',
  });
  if (!response.ok) throw new Error('Quota store unavailable');
  const body = await response.json();
  const result = body.result;
  if (body.error || !Array.isArray(result) || result.length !== 3) throw new Error('Invalid quota response');
  if (result[0] === 1 && result[1] === 'ok' && result[2] === 0) return;
  if (result[0] === 0 && ['daily', 'monthly', 'burst'].includes(result[1]) && Number.isSafeInteger(result[2]) && result[2] > 0) throw new QuotaError(result[2], result[1]);
  throw new Error('Quota unavailable');
}
