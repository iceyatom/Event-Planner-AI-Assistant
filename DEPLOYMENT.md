# Deployment and embedding

Status: the student has deployed the chatbot at https://event-planner-ai-assistant.vercel.app/. The Google Sites framing fix in this checkout is pending review and publication. The student handles sign-ins, billing, account connections, secrets, GitHub/Vercel publication and Google Sites publication.

## 1. Review and account preparation

1. Read `REVIEW.md`, run the demo, and review the code. Supply the class rubric, demo date, approved facts and school rules in `src/data/facts.json`. Empty arrays mean no evidence has been supplied.
2. Sign into GitHub and confirm access to https://github.com/iceyatom/Event-Planner-AI-Assistant. Sign into Vercel and OpenAI privately. Never paste keys in chat, GitHub issues or source files.
3. Use an OpenAI project-specific API key. Configure the intended USD 5/month spend ceiling and earlier alerts in the account's available billing controls. Verify what is an enforced cap versus an alert; account enforcement may lag. The app independently limits attempts.
4. Confirm model availability in that OpenAI project. Official documentation checked 2026-10-11 lists `gpt-5.6-luna`, Responses, structured outputs and reasoning effort `none`. No model substitution is automatic. A different model needs renewed price/support review and the student's agreement before updating the server allowlist.

## 2. Durable quota store and cost approval

Proposed store: **Upstash Redis Free**, provisioned by the student. Its pricing page checked 2026-10-11 lists $0, 256 MB, 500,000 commands/month and 10 GB bandwidth. Pay-as-you-go is a separate paid plan at $0.20 per 100,000 commands plus applicable storage/other charges. Do not upgrade or attach billing without reviewing current terms and getting agreement. This code does not create an account, database or subscription.

1. In the Upstash console, create a Redis database on the **Free** plan in a region near Vercel. Review displayed charges before creation. Do not use an anonymous temporary database that expires after a few days.
2. Keep eviction disabled. The store must preserve counters durably; do not clear, reset, replace or restore it during an active quota period. A reset destroys enforcement history. If data is lost, disable live chat until the period ends or counters can be restored safely.
3. Copy its REST endpoint and read/write REST token privately into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The read-only token cannot reserve attempts. The token needs EVAL and the commands used in the Lua script (TIME, GET, INCR, EXPIRE, EXPIREAT, ZREMRANGEBYSCORE, ZCARD, ZADD).
4. Generate `IP_HASH_SECRET` privately: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Paste the result into the secret field, not chat. Use at least 32 characters and preserve it across deployments so IP windows stay consistent.
5. Every production instance must share this one database and its fixed `{event-planner}` namespace. Never shard counters per instance, region, deployment or browser. Preview deployments must use demo mode or isolated test credentials, not a way to bypass production limits.
6. Start with 30 requests per 60-second sliding window for each IP. Many students may share one school IP; test at school and adjust `IP_BURST_LIMIT` up to 100 if needed. Global limits are 400/day and 2,000/month. UTC, not local midnight, resets the global periods.

Each accepted attempt executes multiple Redis commands within a single EVAL. At 2,000 attempts, normal classroom use should fit well within the Free tier. Denied traffic also reaches the store; abuse and unrelated database usage can exhaust the Free tier. If storage is unavailable or its response is ambiguous, the app refuses paid calls. Upstream failures and timed-out requests keep their reservations; there is no refund or automatic retry.

## 3. Publish code to GitHub when ready

The repository is already connected to the supplied remote. Review what will be published first:

```powershell
git status --short
git diff --check
git diff
git check-ignore .env.local
```

Review untracked source files too; ordinary `git diff` does not show them. Then, after approving publication yourself:

```powershell
git add .gitignore .env.example AGENTS.md package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.ts playwright.config.ts src tests scripts README.md DEPLOYMENT.md REVIEW.md
git diff --cached --check
git diff --cached
git commit -m "Build event planner with demo mode and durable live quotas"
git push origin HEAD
```

Never stage `.env.local`, provider tokens or generated logs. The existing instruction document stays as supplied. If working on a branch, open/review a pull request and merge into the chosen production branch before production deployment.

## 4. Import into Vercel

1. Select Add New > Project > Import Git Repository. Approve GitHub access yourself and choose `iceyatom/Event-Planner-AI-Assistant`.
2. Framework: **Next.js**. Root: repository root. Node: **22.x**. Install: `npm ci`. Build: `npm run build`. Keep Next.js output defaults; do not select static export.
3. Keep preview protection enabled where appropriate. Do not expose production credentials to untrusted preview branches. Vercel Hobby may suit an eligible personal, noncommercial school project; confirm current terms and limits before accepting any paid plan.
4. Add environment variables below in the correct scope. Start Production with `CHAT_ENABLED=false` and `DEMO_MODE=true`. Previews should remain demo-only with no live credentials.
5. Deploy only after your review. The stable production domain is `https://event-planner-ai-assistant.vercel.app`. Use that domain, never a branch preview or deployment-specific hostname, for embedding.

| Variable | Value / purpose |
| --- | --- |
| `OPENAI_API_KEY` | Private project key; server only |
| `OPENAI_MODEL` | `gpt-5.6-luna`; other values fail closed |
| `CHAT_ENABLED` | `false` until launch checks pass |
| `DEMO_MODE` | `true` for offline samples; `false` for live or fully disabled mode |
| `UPSTASH_REDIS_REST_URL` | Private HTTPS REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Private read/write token |
| `IP_HASH_SECRET` | Private random value of at least 32 characters |
| `DAILY_REQUEST_LIMIT` | `400` maximum; may be lowered |
| `MONTHLY_REQUEST_LIMIT` | `2000` maximum; may be lowered |
| `IP_BURST_LIMIT` | `30` by default; 1–100 |
| `IP_BURST_WINDOW_SECONDS` | `60` by default; 1–3600 |
| `FRAME_ANCESTORS` | Space-separated HTTPS frame sources; for Google Sites use `https://sites.google.com`, which automatically includes Google's changing embed wrappers |

Do not prefix secrets with `NEXT_PUBLIC_`. Vercel supplies `VERCEL=1` and overwrites the trusted client IP header. Production deployments elsewhere fail closed until a separate trusted-proxy integration is reviewed. Local `next dev` live smoke tests use a single shared development IP bucket.

**Environment changes require a new deployment.** Updating Vercel settings alone does not change already-running deployments. Framing configuration is emitted at build time. Redeploy and confirm which environment and commit produced the active production deployment. The route's 40-second hosting timeout accommodates a 3-second store timeout and a 25-second OpenAI timeout; the browser stops waiting at 35 seconds.

## 5. Verify framing before live launch

The default is deliberately `frame-ancestors 'self'`, so cross-origin embedding initially fails closed. The published Novavents site references Google's `www.gstatic.com` intermediate embed frame and an `N-atari-embeds.googleusercontent.com` inner frame. The numeric subdomain changes between page loads, so a single exact wrapper origin cannot work. The narrowly permitted CSP wildcard `https://*.googleusercontent.com` is required for Google's generated wrapper; it also permits other subdomains of that user-content domain to frame `/embed`, so keep the public chat quotas enabled.

1. Open the public production standalone page signed out. It must work without Vercel authentication. Adjust only the necessary production protection setting. Never put a bypass secret into a URL or embed code.
2. Set the Production `FRAME_ANCESTORS` value in Vercel to `https://sites.google.com`, then deploy this code. The header automatically includes Google's intermediate `www.gstatic.com` frame and changing `*.googleusercontent.com` wrapper. The app accepts only this one wildcard pattern; other entries must be exact HTTPS origins.
3. In Google Sites at https://sites.google.com/view/novavents/, open the editor, choose **Insert > Embed > By URL**, enter the stable production `/embed` URL, and size the panel around 700 px tall and the full content width. If Google Sites still rejects the URL during insertion, use **Embed code** with the iframe snippet below. The code tab does not override the CSP; step 2 is still required.
4. Publish/republish Google Sites when ready. In Chrome DevTools on the **published** page, inspect the frame tree (Application > Frames or the Elements iframe hierarchy), the blocked iframe request and the Console's CSP messages. Record every actual intermediate frame origin and add any additional exact HTTPS origins to `FRAME_ANCESTORS`. Redeploy Vercel and republish Sites as needed. Opening an editor preview is not equivalent to inspecting the published page.
5. Confirm `/embed` has an HTTP `Content-Security-Policy` header containing the full observed chain and **no** `X-Frame-Options: DENY` or `SAMEORIGIN`, including headers added by any proxy. All ancestors must pass CSP. If Google produces an opaque/sandboxed ancestor, investigate the actual frame behavior instead of weakening the policy blindly.
6. Test the actual published iframe signed out, on a phone, and on the school network. Confirm sending, multiline input, internal transcript scrolling, Clear, Copy/fallback, and the standalone link. Browser storage and third-party cookies must not be required. CORS is unnecessary because the iframe calls its own origin's `/api/chat`.

If the **By URL** tab continues to reject the site, use **Embed code**:

```html
<iframe
  src="https://event-planner-ai-assistant.vercel.app/embed"
  title="Event Planner Assistant"
  width="100%"
  height="700"
  style="border:0"
  loading="lazy"
></iframe>
```

Also add a normal Google Sites button linking to `https://event-planner-ai-assistant.vercel.app/`. Google Sites controls the outer frame size. This is an always-open panel inside that frame, not a floating widget across the outer site.

## 6. Live smoke test and cost estimate

After store integration and private key setup, set `CHAT_ENABLED=true`, `DEMO_MODE=false`, and redeploy (or restart local development). Confirm the active configuration. The following explicit smoke test makes **two live model attempts**, each subject to the durable quota, with no retries:

```powershell
$env:SMOKE_BASE_URL = 'https://event-planner-ai-assistant.vercel.app'
$env:CONFIRM_LIVE_SMOKE = 'yes'
npm run smoke:live
Remove-Item Env:CONFIRM_LIVE_SMOKE
Remove-Item Env:SMOKE_BASE_URL
```

Use the local base URL for local `next dev` if desired. The script does not bypass Vercel login or expose tokens. If a deployment is protected, fix production access rather than passing a bypass key. Stop on any 400/429/503 or demo response; diagnose configuration without looping through more paid calls. Record the two requests' token totals from server metadata, not message content. Account-specific access and structured-output compatibility are not verified until this succeeds. Manually assess plan quality and honesty with the acceptance prompts; successful HTTP responses alone do not establish quality.

Rates verified 2026-10-11: input $0.20/million, output $1.20/million; cache writes can cost 1.25× ordinary input. Typical 2,000 input + 500 output tokens cost about $0.001 per reply. At 6,000 input + 800 output, ordinary pricing is $0.00216; using the cache-write input premium gives $0.00246. Round up to **$0.0025/attempt**, at most **$1.00/day (400 attempts)** and **$5.00/month (2,000 attempts)**, or **under $0.005 for the two-call smoke test**, before taxes and future price changes. Hosting/storage are separate. No paid tools are enabled. This estimate is not a billing guarantee; compare early live usage with it without spending just to reach a test count.

## 7. Disable and recover

- To stop paid calls but retain the sample demo: `CHAT_ENABLED=false`, `DEMO_MODE=true`, then **redeploy**.
- To turn off the chat endpoint: `CHAT_ENABLED=false`, `DEMO_MODE=false`, then **redeploy**.
- For immediate shutdown, revoke the dedicated OpenAI project key as well. Existing deployments and in-flight requests may otherwise keep using their old configuration. Review deployment-specific URLs; promoting a new build does not necessarily remove old deployments.
- Revoke/rotate leaked OpenAI or Redis credentials separately; rolling back source code does not revoke a key. Do not delete quota counters during recovery.
- Restore a known-good Vercel deployment, or revert the faulty Git commit and deploy again. Keep live chat disabled while fixing issues. A rollback can restore old environment settings: verify the flags and keys before restoring traffic.
- After the class demo, disable live access and redeploy. Retain a labeled offline demo and screenshots for the class presentation.

## Primary references

- [OpenAI model, pricing and capabilities](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI text generation](https://developers.openai.com/api/docs/guides/text)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Upstash REST API](https://upstash.com/docs/redis/features/restapi)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel trusted request headers](https://vercel.com/docs/headers/request-headers)
- [Vercel Hobby eligibility](https://vercel.com/docs/plans/hobby)
- [Google Sites embedding](https://support.google.com/sites/answer/90569)
