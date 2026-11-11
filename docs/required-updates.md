# Astral required updates

Applies to Picker, Core V2 Lite and Clipper. Implemented locally; not deployed.

Run `npm run release` in any of the three products. Before the existing release
workflow starts, it asks for 1) Normal (Enter default), 2) Obligatoria or Q) Cancel.
Mandatory sets `minimumVersion` to the release version. Normal retains any
previous mandatory minimum; it does not unlock obsolete clients.

For automation use `npm run release -- --required` or `--optional`. Without a
terminal an explicit flag is required. `npm run release -- --dry-run` previews
the question without building, modifying files or publishing. The wrapper sets
`ASTRAL_REQUIRED_UPDATE=1` or `0` only for its child workflow, overriding inherited
values. Existing version questions, checks and publication approvals remain.
Picker's `npm run publish:update` also opens this assistant. `release:execute`
is the internal underlying workflow, not the normal operator entry point.

Core/Picker record the floor in `release-policy.json`; commit it with the release.
Clipper carries it in the candidate without modifying its clean checkout, and
production promotion retains the previous signed minimum. Its release command
still creates a candidate requiring owner approval, not an immediate promotion.

Picker: `npm run build` prepares `release/latest.yml` automatically. An already
built, matching release can be marked with `node scripts/update-policy.mjs --required`.
Core: the production compile/build workflow prepares `release/latest.yml`.
Clipper: `scripts/release-candidate.mjs` adds the minimum to the candidate; the
existing production promotion process signs the entire manifest including it.
Promotion also preserves the previous signed minimum. Do not manually edit the
signed envelope. Installer bytes are uploaded and verified before the manifest.

Clients compare numeric versions, block the workspace below the minimum, and
retain a known requirement across download failures, restarts and stale/optional
manifests. Installations at or above the minimum remain usable. With no known
requirement, a failed startup network check does not manufacture a new block.
The update screen offers retry/install and window close, never a continue action.
Dev remains usable; production behavior must be tested in isolated packaged apps.

Core requires its existing Discord authentication to retrieve its update feed;
the login flow stays available before the workspace gate. Clipper blocks new
captures (including tray and automatic startup), keeps existing save/stop actions
available, and requires capture to stop before installing. Existing clips and
settings are preserved. This change does not start or stop audio/capture for tests.

Rollout limitation: currently installed builds that predate this mechanism cannot
be made to enforce it retroactively. First distribute the supporting client
versions; then use the required flag for subsequent releases. Do not advertise
universal enforcement for older clients.

Validation: shared policy and mocked Core/Picker updater tests are in
`tools-dev/test-required-updates.mjs`; Clipper includes signed-manifest, restart,
error and renderer tests in its own test suite. No production manifest was
changed and no installed app, live capture, audio route or user settings were
modified. Real packaged UI/installer validation remains outstanding.
