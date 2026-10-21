// Explicit opt-in. Uses the app endpoint, so quota reservations and all controls
// apply. Makes exactly two paid attempts; never reads or prints an API key.
const target = process.env.SMOKE_BASE_URL;
if (process.env.CONFIRM_LIVE_SMOKE !== 'yes' || !target) {
  console.error('Set CONFIRM_LIVE_SMOKE=yes and SMOKE_BASE_URL to your app URL. This runs two live attempts (estimated under $0.005 total).');
  process.exit(1);
}
const url = new URL(target);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use HTTPS for the published app.');
const history = [];
for (const message of ['Plan a two-hour school fundraiser for 40 guests.', 'Actually make it indoors for 120 guests.']) {
  const response = await fetch(new URL('/api/chat', url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history }), signal: AbortSignal.timeout(35000) });
  if (!response.ok) { console.error(`Smoke test failed safely: HTTP ${response.status}. Inspect operational server logs.`); process.exit(1); }
  const data = await response.json();
  if (data.mode !== 'live' || !data.reply) { console.error('Not a live response. No live smoke pass recorded.'); process.exit(1); }
  history.push({ role: 'user', content: message }, { role: 'assistant', content: data.reply });
  console.log(JSON.stringify({ status: 'live response received', attempt: history.length / 2, contextTrimmed: data.contextTrimmed }));
}
console.log('Two live responses received. Review the same two prompts manually for quality; record token usage from server metadata. Transcripts were not printed or saved.');
