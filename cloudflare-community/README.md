# Community service

Community uses the existing Audio Worker, `ASTRAL_BOT` identity verification and private `AUDIO_BUCKET`. D1 (`COMMUNITY_DB`) stores listings, favorites, reports and per-user quotas. R2 stores bounded, immutable Cosmic parameter payloads under `community-private/`. The legacy API-key file route must deny that prefix, including encoded paths. `install-community.ps1` adds this guard and the authenticated API router together.

## Local verification

From Picker:

```powershell
npm run typecheck
node --test tools-dev/test-community.mjs
```

Tests use temporary control files, in-memory SQLite and a simulated R2/auth service. They do not contact Discord, Cloudflare or live audio devices.

## Deployment (separate authorized release step)

1. In the existing `AstralAudio/cloudflare-worker` directory, use the authenticated Cloudflare account to create D1: `npx wrangler d1 create astral-audio-community`. Verify the intended account first with `npx wrangler whoami`.
2. Run `install-community.ps1 -DatabaseId <returned-id>` from this directory. This integrates the module and adds the real D1 binding; it does not publish anything. Without `-DatabaseId`, it only integrates source.
3. From the Worker directory, run `npx wrangler d1 migrations apply astral-audio-community --remote`, then `npx wrangler deploy`.
4. Verify using a normal Discord-authorized Picker session. Local test mode deliberately refuses remote Community requests. Check publish, favorites from a second account, apply, undo and removal. Exercise an inactive Cosmic route and a disconnected audio engine.
5. Package/release Picker only after those checks and release authorization. No changes to installers, AT payloads, DLLs or update artifacts are part of this integration.

Until the D1 binding and migration exist, Community returns unavailable. No mock profiles are presented as live data.

## Contracts

- `GET /community/profiles?tab=explore|saved|mine&search=...&game=...&page=0`: 24 profiles per page plus `more`. Search is literal; SQL inputs are bound.
- `POST /community/profiles`: metadata, UUID idempotency key and strict `astral-community-cosmic` v1/stateVersion 3 payload (50 finite values in [0,1]). Author is derived only from the verified Discord identity. Max body 16 KiB, 20 new publications/user/hour, 120 mutations/user/hour.
- `GET /community/profiles/:id`: validated payload and SHA-256; never an arbitrary URL or local path.
- `PUT|DELETE /community/profiles/:id/favorite`: per-account reference, no local download.
- `POST /community/profiles/:id/report`: bounded reason, one report/user/profile.
- `DELETE /community/profiles/:id`: owner-only soft removal. Already applied settings are unaffected.

Electron owns network/auth and retrieves payloads in memory. It validates payload and hash before activating the existing Cosmic route and writes through `PluginControlStore`. It never opens a save/import dialog and never adds a downloaded JSON to the user's named preset library. A single `community-undo.json` preserves the immediately previous state; stale undo cannot replace later edits. Confirmation requires fresh Windows audio-service evidence matching the expected fingerprint and revision; otherwise UI states that settings are saved but audio is unconfirmed.

Publishing snapshots current settings by revision or reads a selected named preset internally. No account credentials, HWIDs or device paths are included in the published payload. Favorites are held in D1. The service has no edit-in-place API: existing publications are immutable; remove and republish creates a new ID.

## Moderation and maintenance

Reports are stored for operator review in `community_reports`. Review them with authenticated D1 tooling; use `UPDATE community_profiles SET status='hidden' WHERE id=?` for a reviewed takedown and `status='published'` to restore it. There is deliberately no unauthenticated moderation endpoint and no automatic takedown based on report count.

R2 and D1 are not a distributed transaction. R2 is written first, then D1 inserts the listing. A failed D1 insert can leave an unlisted object; it is never exposed by the catalog. Maintenance can compare keys with `community_profiles.object_key` and remove only confirmed unreferenced objects after a retention window. Do not bulk-delete the `community-private` prefix. Soft-removed profile payloads remain for recovery pending a retention policy.

## Application counter

Run install-community.ps1 to copy 0002_applications.sql, then apply remote D1 migrations before deploying the updated Worker. Existing profiles begin at zero; earlier applications are not backfilled. POST /community/profiles/:id/applied accepts a UUID requestId after a successful managed settings write. Repeated receipt IDs per user are deduplicated; separate applications count separately. Counts are authenticated client reports, not server proof of audible processing. Failed telemetry does not fail or undo an applied profile. New clients accept older catalog responses without a count for rolling deployments.

Publication limit: at most five published profiles per owner, enforced atomically. Removing a publication frees a slot; existing excess publications are not deleted automatically.
