import { beforeEach, expect, it } from 'vitest';
import Redis from 'ioredis-mock';
import { quotaCommand } from '@/lib/server/quota';
const redis = new Redis();
const env = { IP_HASH_SECRET: 'a'.repeat(32), IP_BURST_LIMIT: '100' };
async function run(ip: string, extra = {}) {
  const command = quotaCommand(ip, { ...env, ...extra });
  return await redis.eval(command[1], Number(command[2]), ...command.slice(3)) as [number, string, number];
}
beforeEach(async () => { await redis.flushall(); });
it('executes the production Lua for concurrent attempts without exceeding daily limit', async () => {
  const results = await Promise.all(Array.from({ length: 150 }, (_, i) => run(`ip-${i}`)));
  expect(results.filter(r => r[0] === 1)).toHaveLength(100);
  expect(results.filter(r => r[1] === 'daily')).toHaveLength(50);
});
it('enforces the month independently and denied bursts consume no global attempts', async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => run('school', { IP_BURST_LIMIT: '3' })));
  expect(results.filter(r => r[0] === 1)).toHaveLength(3);
  expect(results.filter(r => r[1] === 'burst')).toHaveLength(17);
  const other = await Promise.all(Array.from({ length: 10 }, (_, i) => run(`other-${i}`, { MONTHLY_REQUEST_LIMIT: '5' })));
  expect(other.filter(r => r[0] === 1)).toHaveLength(2);
  expect(other.filter(r => r[1] === 'monthly')).toHaveLength(8);
});
it('does not put raw IPs into keys and refuses increased global caps', () => {
  expect(quotaCommand('192.0.2.1', env).join(' ')).not.toContain('192.0.2.1');
  expect(() => quotaCommand('ip', { ...env, DAILY_REQUEST_LIMIT: '101' })).toThrow();
});
