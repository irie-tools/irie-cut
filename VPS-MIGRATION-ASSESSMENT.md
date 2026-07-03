# Irie Cut VPS Migration Assessment

Date: 2026-07-03

## Verdict

Moving Irie Cut out of Vercel is practical. The editor itself is a static Vite SPA after build, so the core app can live on the VPS with the rest of the media group. The only real migration work is replacing Vercel Functions for the optional AI endpoints:

- `POST /api/ai-copy`
- `POST /api/ai-image`
- `POST /api/ai-transcribe`

Everything else is client-side: timeline state, media storage, preview, export, captions, and project persistence all run in the browser.

## Current source truth

- GitHub repo: `corey470/irie-cut`
- Current public URL in docs: `https://irie-cut.vercel.app`
- Build output: `apps/web/dist`
- Root Vercel config:
  - builds `apps/web`
  - serves `apps/web/dist`
  - rewrites SPA routes to `index.html`
  - hosts root `/api/*` as Vercel Functions
- Optional AI keys currently documented as Vercel env vars.

## Media House fit

The Media House model is the right boundary for this move. It says:

- Irie Cut is the Cut room and THE editor.
- No repo merges.
- Rooms stay standalone.
- The shell only health-checks and opens room URLs.

Live VPS findings:

- `/opt/irie/apps/irie-media-house` exists and `irie-media-house.service` is active.
- The service is currently running on `127.0.0.1:4290`.
- The public API is locked by the house key, which is correct.
- The VPS Media House checkout is currently `ahead 5` of `origin/main`; reconcile that repo before editing its room registry/docs.
- `CUT_URL=` is disabled in `/opt/irie/secrets/irie-media-house.env`, so the House uses the production door for Cut.
- `CUT_PROD_URL` is not set in the live env, so the registry falls back to `https://irie-cut.vercel.app`.

After Irie Cut moves, Media House only needs `CUT_PROD_URL` repointed to the new Cloudflare/VPS hostname. No code merge is needed.

## Recommended target shape

Use a standalone VPS lane:

- app dir: `/opt/irie/apps/irie-cut`
- service: `irie-cut.service`
- origin: `http://127.0.0.1:<port>` (pick an unused port)
- public host: likely `cut.iriemediastudio.com` or `iriecut.iriemediastudio.com`
- routing: Cloudflare Tunnel + optional Cloudflare Access if this should be private before launch
- backup: NAS backup for deploy artifacts and env file, not for browser IndexedDB projects

Recommended runtime pattern:

1. Build the web app into `apps/web/dist`.
2. Serve `dist` with a small Node service.
3. Add API routes in that service for `/api/ai-copy`, `/api/ai-image`, and `/api/ai-transcribe`.
4. Keep SPA fallback: every non-API path returns `index.html`.
5. Store API keys in `/opt/irie/secrets/irie-cut.env`.

This keeps the editor standalone and removes Vercel without changing the product surface.

## Key risk

The VPS default `node` is currently v18.19.1 and `bun` was not found in the read-only check. Local Irie Cut uses Bun/Vite 8. The safest deployment is either:

- build locally or in GitHub Actions, then sync only `apps/web/dist` plus the VPS server files, or
- install/pin Bun or a newer Node toolchain on the VPS before building there.

Do not assume the VPS can run `bun install && bun run build` until the runtime is installed and verified.

## AI endpoint migration

The current `/api` files are TypeScript Vercel handlers. They are dependency-free, which is good, but Node cannot run those `.ts` files directly without a build step.

Best migration path:

- Extract shared provider logic into plain TypeScript/JavaScript modules, or port the handlers to a small VPS API module.
- Keep the same client URLs (`/api/ai-copy`, `/api/ai-image`, `/api/ai-transcribe`) so `apps/web/src/lib/ai.ts` does not need product-level changes.
- Update user-facing error copy so it no longer says AI only runs on Vercel.
- Remove Vercel-specific body-size assumptions from docs. Keep chunking in `audio-prep.ts`; it still protects the server and providers.

## Migration sequence

1. Choose final hostname and port.
2. Add an Irie Cut VPS server and deployment docs/scripts in this repo.
3. Verify local production mode:
   - build `apps/web/dist`
   - serve it through the VPS-style server
   - hit `/`, an editor route, and `/api/ai-*` with missing-env checks
4. Push GitHub.
5. Deploy to `/opt/irie/apps/irie-cut`.
6. Add `/opt/irie/secrets/irie-cut.env` with AI keys and port.
7. Install/enable `irie-cut.service`.
8. Add Cloudflare Tunnel route for the chosen host.
9. Verify:
   - local origin returns `200`
   - public host returns the SPA
   - `/api/ai-*` returns either real provider output or clean `503` when keys are absent
   - import `.iriepromo.json` still works
   - export still works in the browser
10. Update Media House:
   - set `CUT_PROD_URL=<new host>` in `/opt/irie/secrets/irie-media-house.env`
   - restart `irie-media-house.service`
   - verify the Cut room opens the new door
11. After proof, update README/ARCHITECTURE from Vercel-current to VPS-current.
12. Only then disconnect or retire the Vercel deployment.

## Things not to do

- Do not merge Irie Cut into Media House.
- Do not make Media House serve Irie Cut's code.
- Do not remove Vercel docs before the VPS host is live and verified.
- Do not claim production moved until Cloudflare, the local origin, and Media House all point to the new host.

## Open decisions

- Final public hostname.
- Whether the new Irie Cut host should be public or Cloudflare Access-gated at first.
- Whether AI keys should be installed on the VPS immediately or AI should remain disabled for the first static cutover.
- Whether builds happen on GitHub/local machine or directly on the VPS after installing Bun/newer Node.
