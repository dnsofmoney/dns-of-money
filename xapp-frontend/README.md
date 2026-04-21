# DNS of Money xApp

The React + Vite + TypeScript shell that runs inside Xaman (formerly XUMM).
Follows the `xaman-xapp-frontend` skill — see that skill for the non-negotiables.

## Quick start

```bash
cd xapp-frontend
npm install
cp .env.example .env.local     # edit VITE_API_BASE_URL if needed
npm run dev                    # http://localhost:5173
```

Backend must be running separately (FAS stack, `uvicorn app.obsidian_app:build_app`).

## Architecture in one picture

```
Xaman WebView  ── xAppToken (OTT) ──►  xapp-frontend  ── POST /xapp/ott ──►  FAS backend
                                                                                 │
                                                                                 │ GET /platform/xapp/ott/{token}
                                                                                 │ (with XUMM_API_SECRET)
                                                                                 ▼
                                                                             Xaman Platform API
                                                                                 │
Xaman WebView  ◄── {jwt, context} ──  xapp-frontend  ◄── {jwt, context} ────────┘
                │
                └── Authorization: Bearer <jwt> ──► FAS backend  (for every subsequent call)
```

The Xaman API **secret** never touches the browser. See non-negotiable #3/#6 in the skill.

## Project layout

```
xapp-frontend/
├── index.html                      # transparent bg inline, loads xumm.min.js from CDN
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .env.example                    # commit this
├── .env.local                      # gitignored, edit per machine
└── src/
    ├── main.tsx                    # React root, wraps App in XamanProvider
    ├── App.tsx                     # demo UI: session panel + JWT round-trip test
    ├── index.css                   # CSS vars (--xapp-*) for theming
    ├── vite-env.d.ts
    ├── xaman/
    │   ├── XamanProvider.tsx       # context + OTT→backend boot flow
    │   ├── useXaman.ts             # re-export of the hook
    │   ├── sdk.ts                  # window.xumm wrapper — ONLY file allowed to touch it
    │   └── types.ts                # OttContext, XamanSession, SignRequestResult
    └── api/
        └── client.ts               # JWT-aware fetch wrapper (useApiClient)
```

## Environment variables

Only `VITE_*` vars reach the browser. Anything else is silently dropped by Vite.

| Var                   | Where                            | Example                                |
| --------------------- | -------------------------------- | -------------------------------------- |
| `VITE_API_BASE_URL`   | `xapp-frontend/.env.local`       | `http://localhost:8000`                |
| `XUMM_API_KEY`        | FAS stack `.env` (and SSM in prod)| `<your-xaman-api-key>` (UUID from apps.xaman.dev)|
| `XUMM_API_SECRET`     | FAS stack `.env` (and SSM in prod)| **never in chat, never in this repo**  |
| `XAPP_JWT_SECRET`     | FAS stack `.env` (optional)      | any 32+ char random string             |

If `XAPP_JWT_SECRET` is unset, the backend falls back to signing with `XUMM_API_SECRET`
for convenience in local dev. In production, set a dedicated `XAPP_JWT_SECRET`.

## apps.xaman.dev sandbox registration — checklist

The Xaman developer portal registration is a manual step — it can't be done via API.
If you've already registered the sandbox xApp (you have), confirm these settings match
what the OTT flow expects.

Log in at **https://apps.xaman.dev** with the account that owns the DNS of Money xApp.

### xApp identity

| Field                  | Value                                              |
| ---------------------- | -------------------------------------------------- |
| Name                   | `DNS of Money`                                     |
| Short name / slug      | `dnsofmoney` (used in `xapp://dnsofmoney` deep links)|
| Category               | `Payments` or `Identity`                           |
| Icon                   | DNS of Money logo (square, ≥ 512×512 PNG)          |
| Description            | "Register your pay: alias and send to human-readable payment names on XRPL." |

### URLs

| Setting                | Dev value                              | Prod value                        |
| ---------------------- | -------------------------------------- | --------------------------------- |
| xApp URL               | your tunnel URL (see below)            | `https://xapp.dnsofmoney.com`     |
| Privacy policy         | `https://dnsofmoney.com/privacy`       | same                              |
| Terms of service       | `https://dnsofmoney.com/terms`         | same                              |

### Permissions / features

- [x] **OTT payload delivery** — required; this is what gives us the `xAppToken`.
- [x] **Create payloads (via API)** — required for sign requests (mint, send).
- [ ] **Push notifications** — not needed for MVP.
- [ ] **Background TX subscription** — not needed yet.

### Dev tunnel setup (for the xApp URL during development)

Xaman's WebView can't reach `localhost` directly. You need a public HTTPS URL that
tunnels to your local Vite server.

**Option A — cloudflared (no signup):**
```bash
npm run dev                            # starts Vite on http://localhost:5173
cloudflared tunnel --url http://localhost:5173
# → https://random-words-here.trycloudflare.com
```

**Option B — ngrok:**
```bash
ngrok http 5173
# → https://xxxx-xx-xx-xx.ngrok-free.app
```

Paste the HTTPS URL into **xApp URL** on apps.xaman.dev and hit Save.
The backend also needs to be reachable from Xaman — run a second tunnel for port 8000
and set `VITE_API_BASE_URL` in `xapp-frontend/.env.local` to that URL.

### Put the API key + secret in the right places

Find your API key + secret on apps.xaman.dev → your xApp → API credentials.
The key is UUID-format and treated as public by Xaman; the secret is what actually
gates platform API calls and must never leave the backend.

**Backend** (`financial-autonomy-stack/.env`):
```dotenv
XUMM_API_KEY=<paste the API key UUID from apps.xaman.dev>
XUMM_API_SECRET=<paste the secret from apps.xaman.dev — never commit, never in chat>
XAPP_JWT_SECRET=<optional: 32+ char random string; if unset, falls back to XUMM_API_SECRET>
```

**Frontend** (`xapp-frontend/.env.local`):
```dotenv
VITE_API_BASE_URL=http://localhost:8000   # or your backend tunnel URL
```

There is no `VITE_XUMM_API_KEY` or `VITE_XUMM_API_SECRET`. The frontend has no business
knowing either — the SDK auto-associates the session with the xApp it was launched from.

### Testing without Xaman — xAppBuilder

XRPL Labs ships a sandbox called **xAppBuilder** inside the Xaman app itself
(Settings → Advanced → xAppBuilder). Point it at your tunnel URL; it boots your
xApp with a test OTT so you can iterate without publishing.

## Running end-to-end locally

1. Start the backend:
   ```bash
   cd financial-autonomy-stack
   uvicorn app.obsidian_app:build_app --factory --reload --port 8000
   ```

2. Start the frontend:
   ```bash
   cd dns-of-money/xapp-frontend
   npm run dev
   ```

3. Expose both via tunnels, register in xAppBuilder, boot — the session panel
   should show your account/network and **Ping /xapp/me** should return JSON.

## Smoke test — without Xaman

You can verify the backend route compiles + responds by hitting `/xapp/debug/env`:
```bash
curl http://localhost:8000/xapp/debug/env
# → {"xumm_api_key_set": true, "xumm_api_secret_set": true, "xapp_jwt_secret_set": true}
```

The OTT endpoint itself needs a real Xaman OTT — fake tokens will 400 with
`OTT_INVALID_OR_CONSUMED` (Xaman's API rejects them upstream).

## Deploying to Vercel (production)

The production target is **`https://xapp.dnsofmoney.com`**, served from Vercel,
paired with the backend at `https://api.dnsofmoney.com`.

### One-time setup

1. **Push the code.** `xapp-frontend/` lives inside the `dns-of-money` repo.
   Commit and push it:
   ```bash
   cd dns-of-money
   git add xapp-frontend
   git commit -m "feat(xapp): vite frontend + OTT exchange"
   git push origin main
   ```

2. **Import the project on Vercel.**
   - https://vercel.com/new → pick the `dns-of-money` repo.
   - **Root Directory**: `xapp-frontend` (critical — this is a monorepo subdir).
   - Framework Preset should auto-detect as **Vite**. If not, pick it manually.
   - Build Command, Output Directory, Install Command are all read from
     `vercel.json` — leave the defaults alone.

3. **Set the env var** (Project Settings → Environment Variables):

   | Name                 | Value                          | Environments              |
   | -------------------- | ------------------------------ | ------------------------- |
   | `VITE_API_BASE_URL`  | `https://api.dnsofmoney.com`   | Production, Preview       |

   No other env vars. **Never** add `VITE_XUMM_API_SECRET` or any secret to
   Vercel — the Xaman secret lives on the backend only (non-negotiable #6).

4. **Custom domain**: Project Settings → Domains → Add `xapp.dnsofmoney.com`.
   Vercel will give you either:
   - a CNAME target (e.g. `cname.vercel-dns.com`) if `dnsofmoney.com` is
     managed elsewhere (Cloudflare, Route53, etc.), or
   - nameservers to delegate the whole domain.

   CNAME path (most common):
   ```
   Type    Name    Value
   CNAME   xapp    cname.vercel-dns.com.
   ```

   Wait for DNS to propagate (usually under 5 minutes) — Vercel auto-issues
   a Let's Encrypt cert once it sees the record.

5. **Update apps.xaman.dev**: change the xApp URL to `https://xapp.dnsofmoney.com`
   once the custom domain is live. The `*.vercel.app` URL still works as a fallback
   but won't match in production.

6. **Update backend CORS**. Add the Vercel origin(s) to the FAS stack before
   the first real session:
   ```dotenv
   # financial-autonomy-stack/.env
   XAPP_ALLOWED_ORIGINS=https://xapp.dnsofmoney.com,https://dns-of-money-xapp.vercel.app
   ```
   (The second origin covers the free *.vercel.app preview URL while you're
   still iterating. Drop it once you're cutover.)

### How deploys work from here

- **Push to `main`** → Vercel builds and promotes to `xapp.dnsofmoney.com` automatically.
- **Open a PR** → Vercel builds a preview and comments the URL on the PR. Handy for
  sandbox testing: register the preview URL in a second sandbox xApp on apps.xaman.dev
  if you want to isolate preview from prod.
- **Rollback**: Vercel dashboard → Deployments → pick an older build → Promote to Production.

### What `vercel.json` does

The committed `vercel.json` already configures:
- **CSP** — only `xumm.app` (for the CDN SDK) and `api.dnsofmoney.com` (backend)
  are allowed as external origins. If you change the backend host, update the
  `connect-src` directive.
- **Cache headers** — `/assets/*` is immutable-cached for a year (Vite hashes
  filenames on build), `index.html` is no-cache so deploys land instantly.
- **Hardening** — HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  Referrer-Policy, and a tight Permissions-Policy.

### Smoke-test after deploy

1. Visit `https://xapp.dnsofmoney.com` in a browser (not Xaman) — you should see the
   "Booting Xaman session…" message, then an error "Missing xAppToken query param…".
   That's the correct behaviour outside Xaman — it confirms the build shipped and
   the transparent-background SPA boots.
2. Open xAppBuilder in Xaman, point at `xapp.dnsofmoney.com`, launch. The session
   panel should populate and **Ping /xapp/me** should return `{success: true, data: {...}}`.
3. Check headers:
   ```bash
   curl -I https://xapp.dnsofmoney.com
   ```
   You should see the CSP, HSTS, and `cache-control: no-cache, no-store, must-revalidate`.

## Related skills

- `xaman-xapp-frontend` — this frontend (you are here)
- `xaman-platform-client` — backend counterpart (OTT exchange, payload create, webhook verify)
- `xapp-mint-flow` — Phase 2 alias mint flow (composes this + founding-tier-enforcer)
- `xapp-send-flow` — resolver + payment flow
- `vite-xapp-build-deploy` — Vercel config, CSP headers, preview deploys
- `xapp-debugging-toolkit` — xAppBuilder, OTT Replay, common failure modes
