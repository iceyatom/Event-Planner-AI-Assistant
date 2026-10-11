# Local review results

Reviewed 11 October 2026. The app is prepared locally in the supplied repository. No commit, push, Vercel deployment or Google Sites publication was performed. The student privately configured an OpenAI key and Upstash Redis after reviewing the demo.

## Delivered

- Next.js App Router pages `/` and `/embed`, plus Node `POST /api/chat`.
- Responsive Novavents interface with three starters, transcript, Send, Clear chat, Copy plan/fallback, standalone link, loading and safe errors.
- Explicit offline demo mode; live calls disabled by default. No cookies, browser storage or transcript database.
- Official OpenAI SDK integration with the requested model and parameters; structured plan output and arithmetic calculated in code.
- Strict body/history validation, conservative 6,000-token input bound and visible history-trimming notice.
- Atomic durable quota integration: global 100/day and 500/month, IP sliding window, reservation before upstream call, fail closed on store errors.
- Exact-origin CSP configuration, editable facts, setup instructions, opt-in live smoke script, shutdown and rollback guide.

## Checks completed

| Check | Result |
| --- | --- |
| Dependency installation | Passed; npm lockfile present |
| Type checking | Passed (`next typegen` and `tsc --noEmit`) |
| ESLint | Passed, no findings |
| Production build | Passed; `/`, `/embed`, `/api/chat` emitted as dynamic routes |
| Server/planner automated tests | 35 passed |
| Headless Chrome browser tests | 4 passed |
| Two-request live smoke through localhost | Passed; both Responses calls returned complete live plans and HTTP 200 |
| Live Upstash quota integration | Passed for the two smoke requests; read-only check found 2 daily and 2 monthly reservations |
| Production dependency audit | 0 vulnerabilities reported by `npm audit --omit=dev` |
| Full development dependency audit | 9 advisories: 5 high, 4 moderate; see below |
| Local desktop/mobile screenshots | Visually inspected; 320px embed has no horizontal overflow |
| Git whitespace check | Passed for tracked diffs; implementation files remain uncommitted |

The server tests cover invalid/oversized JSON, injected roles/configuration, too much history, context trimming, disabled/missing-key modes, reserve-before-call ordering, safe metadata logging, store errors, rate limits, empty/incomplete/malformed output, exact request parameters, no SDK retries, and a simulated 25-second timeout. Planner checks cover fundraiser/revision behavior, honest demo limitations, two-question structure, integer-currency totals, over-budget reporting and invalid numbers.

Concurrency tests execute the **production Lua script** in `ioredis-mock`'s Lua runtime: 150 simultaneous attempts accept exactly 100; burst-denied requests do not consume global capacity; monthly enforcement is independently tested with a lower configured cap. The two-request live smoke also exercised the provisioned Upstash REST store and confirmed both reservations. High-volume concurrency was tested locally in the emulator, not against the provisioned service.

Browser tests cover desktop interaction, Enter/Shift+Enter, revisions, copy fallback, Clear, loading, disabled Send during requests, error recovery, context notices, literal rendering of HTML/script-looking input and output, 320px standalone/embed widths, and disabled storage/cookies. A fake sentinel key set only in the test server was absent from page HTML and loaded client scripts. Real keys were neither requested nor used.

The Windows sandbox prevented Next.js from resolving the project path and prevented Vitest from accessing its temporary files. Those checks succeeded when run with approved execution outside the sandbox. Browser checks used installed headless Chrome. Test-owned servers were stopped by Playwright after the run.

## Tested versions

Node 22.20.0; npm 11.6.1; Next.js 16.4.0; React and React DOM 19.3.0; OpenAI SDK 7.32.0; TypeScript 6.0.3; Zod 4.6.6; ESLint 9.39.5 and eslint-config-next 16.4.0; Vitest 5.0.3; Playwright 1.64.0; ioredis-mock 8.13.1. Exact resolved dependencies are recorded in `package-lock.json`.

Next.js generated the repository's `AGENTS.md` during the local dev run; retain it with the source so future edits follow the installed framework documentation.

## Review findings and limits

1. **Development dependency advisories remain.** The audit attributes high-severity findings to the `braces` → `micromatch` → `fast-glob` → Next ESLint chain, and moderate findings to `sprintf-js` → Fengari → ioredis-mock. Registry checks returned braces 3.0.3 and sprintf-js 1.1.3 as latest, both within the reported affected ranges. Automatic proposed fixes downgrade major dependencies; no forced downgrade was applied. These tools process local lint patterns or the fixed test Lua, not public chat input, and production dependencies have zero reported findings. Recheck before publishing and update supported upstream packages when patches are available. ESLint 9 also emitted a support/deprecation notice during installation.
2. **Live-model quality needs human review.** The account successfully used `gpt-5.6-luna` with structured output twice. The smoke script deliberately printed no transcript, so the actual wording, constraint retention, and usefulness of those replies have not been reviewed. Automated responses remain mocked, and the offline demo is deterministic.
3. **Framing is deliberately incomplete until observed.** Blank `FRAME_ANCESTORS` defaults to `'self'`. The actual published Google Sites iframe chain must be inspected; production origins are not guessed. Follow `DEPLOYMENT.md` before expecting a cross-origin embed to load.
4. **Input counting trades capacity for safety.** UTF-8 bytes plus schema/instruction/framing allowances overestimate ordinary input tokens. Long or multilingual input may be rejected below the character limit. Older constraints can be dropped and must be restated when the UI warns.
5. **Public access can consume the shared allowance.** CSP and same-origin fetch are browser controls, not authentication. Distributed visitors can exhaust daily/monthly quotas, and denied traffic still uses hosting/store resources. No new paid anti-abuse service was added.
6. **Arithmetic is calculated; factual accuracy still needs review.** The server computes budget multiplication/sums and agenda elapsed times from validated numbers. It cannot guarantee that AI-proposed unit prices, activities, or free-text claims are correct. The UI labels estimates and unapproved assumptions.

## Pending before publication/live use

- Student review of this demo and code; class rubric, approved facts and demo date.
- Confirm account budget controls and review actual live plan quality in the UI. The private key, provisioned store and two-call live smoke are complete.
- School shared-IP threshold review and production store integration after deployment.
- GitHub publication and Vercel import/deployment authorized and performed by the student.
- Stable public production URL, signed-out access and deployment configuration verification.
- Exact Google Sites ancestor chain, CSP deployment, actual published desktop/mobile embed test and school-network check.
- Human screen-reader and real-device checks; local browser automation is not a full accessibility certification.

## Cost and shutdown

Automated tests used no live API calls. The explicitly identified live smoke used two paid attempts: 460 input / 507 output tokens, then 1,025 input / 488 output tokens. That is about **$0.0015 total** at current standard token rates, subject to actual billing details. Both attempts returned HTTP 200 and consumed one daily and monthly reservation each. The temporary live localhost server was stopped after verification. Using the conservative reserve gives about **$1.25/month at 500 live attempts**, excluding hosting, storage and taxes. The student reports choosing Upstash Free; we did not inspect the account's plan or billing state. Detailed calculations and official sources are in `DEPLOYMENT.md`.

To stop paid calls: set `CHAT_ENABLED=false` and redeploy. Leave `DEMO_MODE=true` for samples, or set it to `false` to disable chat entirely. Revoke the dedicated OpenAI key for immediate shutdown of existing deployments. Roll back to a known-good Vercel deployment or revert and redeploy; separately rotate any exposed credentials and preserve quota counters.
