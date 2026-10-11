import 'server-only';
import type { Mode } from '../contracts';
export function mode(env: Record<string, string | undefined> = process.env): Mode {
  if (env.DEMO_MODE === 'true' || (env.DEMO_MODE === undefined && env.CHAT_ENABLED !== 'true')) return 'demo';
  return env.CHAT_ENABLED === 'true' ? 'live' : 'disabled';
}
export function limit(raw: string | undefined, fallback: number, ceiling: number) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) throw new Error('Invalid configuration');
  return value;
}
