# Event Planner AI Assistant

A Next.js school project for Novavents. The standalone page at `/` and compact page at `/embed` share an always-open chat. Both use the same server-side `POST /api/chat` route. The student handles publication.

Repository: https://github.com/iceyatom/Event-Planner-AI-Assistant

Google Sites destination: https://sites.google.com/view/novavents/

Production app: https://event-planner-ai-assistant.vercel.app/

Embed URL: https://event-planner-ai-assistant.vercel.app/embed

## Run the free demo

Use Node 22.x and npm. In this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000 or http://127.0.0.1:3000/embed. Existing `.env.local` files should not be overwritten. Defaults are `CHAT_ENABLED=false`, `DEMO_MODE=true`. No account or secret is needed for the labeled sample responses. The demo is deterministic and has a limited vocabulary; it is not evidence of live-model quality.

Try “Plan a two-hour school fundraiser for 40 guests.” Then “Actually make it indoors for 120 guests.” The sample summarizes the known facts, gives three event directions (each with a sample venue or company name), and recommends the Essential package, then Signature after the revision. Replies never include prices; package details come from `src/data/facts.json`.

## Modes

| CHAT_ENABLED | DEMO_MODE | Behavior |
| --- | --- | --- |
| false | true | Clearly labeled offline sample; no OpenAI/store calls |
| false | false | Chat disabled; endpoint returns 503 |
| true | false | Live, only with key, approved model, and durable quota store |
| true | true | Explicit demo mode takes priority; no paid calls |

Only the exact string `true` enables a flag. Never silently fall back to demo when live calls fail. Keep preview deployments in demo mode without production credentials.

## Implementation

- `src/components/Chat.tsx`: keyboard-friendly UI, plain text transcript, copy fallback, request lock, clear/cancel, loading/errors. No browser storage or cookies. `credentials: 'omit'` on same-origin API requests.
- `src/data/facts.json`: small, editable source of approved facts. No school policies or real vendor prices are assumed. Update and redeploy after teacher review.
- `src/lib/server/input.ts`: strict JSON validation, streamed 32 KB cap, 2,000-character new message, 12 prior user/assistant messages. Rejects roles, tools, and configuration injection.
- `src/lib/server/model.ts`: official OpenAI SDK / Responses; fixed approved `gpt-5.6-luna`, reasoning `none`, `store:false`, 800 output tokens, empty tools, zero retries, 25-second timeout. Server-controlled configuration only. Structured text output provides numeric inputs to the arithmetic renderer.
- `src/lib/server/quota.ts`: one atomic durable Redis Lua reservation before each paid attempt. UTC day limit 100, UTC month limit 500; sliding per-IP burst 30/60 seconds by default. Global caps can be lowered by configuration, never raised above the approved values. Uses Redis time, checks month boundaries, and fails closed on malformed replies, timeout, or missing configuration.
- `src/lib/planner.ts`: validates structured output and renders the reply: clarifying questions, three options, the recommended Novavents package (with its inclusions from `facts.json`), agenda timing and next steps. There are no price fields; live prose remains AI generated and needs review.
- `next.config.ts`: HTTP CSP on `/embed`, no X-Frame-Options. Blank ancestor configuration permits only same-origin frames. Google Sites uses a changing `*.googleusercontent.com` wrapper, so that one constrained wildcard is supported in `FRAME_ANCESTORS` alongside exact HTTPS origins.

The 6,000-token input ceiling uses a deliberately conservative UTF-8 byte upper bound plus framing allowance. It includes instructions, facts, output schema and messages. Old exchanges are dropped first, with a visible notice; if the new input still cannot fit, the server returns 400. Some multilingual or long messages below 2,000 characters may be rejected rather than exceeding the ceiling. This is not a precise tokenizer. No previous response ID, conversation store, or hidden model history is used.

The client keeps the displayed transcript in tab memory. At most the latest 12 messages are sent, and the server may trim further. Cleared or forgotten constraints must be supplied again. Clear cancels the UI request; an already-reserved model attempt can still finish and count toward the limit.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

Browser tests use installed Chrome in headless mode and a localhost demo server. If Chrome is absent, install Chrome or change the Playwright channel to an installed supported browser. No live API calls occur in automated tests. Tests use mocked model HTTP responses and execute the actual quota Lua in a Redis emulator; production Upstash integration remains a launch check. See `REVIEW.md` for results and limitations.

For a live smoke test after private credential configuration and store provisioning, follow `DEPLOYMENT.md`. The opt-in script makes two calls through the app endpoint and prints only operational results. It is intentionally excluded from automated tests and CI.

## Privacy and scope

Use fictional event details. In live mode, messages and recent context go to OpenAI. Estimates need checking. `store:false` does not promise zero provider retention. This app has no transcript database and logs only request IDs, status, timing and token usage. The quota store contains expiring counters and HMAC-derived IP identifiers, not messages or raw IPs. Hosting and model providers have their own infrastructure logs and retention controls.

Version one has no bookings, payments, invitations, calendar access, browsing, uploads or database of chat transcripts. The assistant stays within the iframe; it cannot float over the surrounding Google Sites page. Framing restrictions and CORS do not authenticate users or protect the budget. A public endpoint can exhaust the shared allowance even without using the UI.

Setup, exact environment variables, costs, publishing, embedding, shutdown and rollback are in `DEPLOYMENT.md`.
