# Spatial audio repository audit

## Provenance

- Repository: `dungnotnull/game-3d-audio-spatial-config-agent-skill`
- Audited commit: `5ee5ba39162934a656db22a9669cd6a9f228e3c0`
- Commit date: 2026-07-29
- License: MIT. Retain the upstream `LICENSE` if code is copied or distributed.
- Location: `tools-dev/vendor/game-3d-audio-spatial-config-agent-skill`

Everything in `tools-dev` is development-only and excluded by the Picker package guard.

## Verified locally

- Python 3.12.14, isolated through `tools-dev/.runtime`.
- 55 upstream engine/profile tests passed.
- Engine coverage reported by upstream tests: 94%; profiles: 100%.
- A Warzone + Generic IEM report was generated successfully.

Run again with:

```powershell
npm run audit:spatial
```

Or choose another built-in profile:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools-dev/run-spatial-audit.ps1 -Game cs2 -Headphones hd560s
```

## Technical finding

This is a deterministic heuristic/report engine, not a measurement-based headphone optimizer or an HRTF renderer.

- `optimize_for_cues()` uses fixed cue bands. Its `game` argument does not alter the generated bands.
- Headphone response measurements are not consumed. Headphone type only adds 0.5 dB to every cue band for open-back models.
- ITD, ILD, and front/back values are analytic approximations; no HRIR/HRTF impulse dataset is convolved with audio.
- The spatial score rewards configured booleans such as enabled HRTF, elevation, distance, and room reverb. It does not measure in-game localization performance.
- Built-in game advice and headphone notes are curated constants and can become stale.

For Warzone + Generic IEM, the upstream EQ was:

| Type | Frequency | Gain | Q |
|---|---:|---:|---:|
| Low shelf | 80 Hz | -3.0 dB | 0.6 |
| PK | 375 Hz | +2.0 dB | 1.5 |
| PK | 750 Hz | +2.0 dB | 1.5 |
| PK | 1500 Hz | +2.0 dB | 1.5 |
| PK | 3000 Hz | +2.0 dB | 1.5 |
| PK | 6000 Hz | +2.0 dB | 1.5 |
| High shelf | 10000 Hz | -1.0 dB | 0.7 |

Astral AutoEQ instead corrects a real measurement toward V2/V3/V5 targets with independently optimized PK filters. These outputs solve different problems and must not be merged blindly.

## Approved role inside Astral

Use the upstream project for:

- research notes and game-setting comparisons;
- structured metadata about game audio engines;
- experimental cue-band overlays evaluated against Astral targets;
- test/report architecture ideas;
- offline tune design experiments.

Do not use it to:

- replace Astral AutoEQ;
- automatically write Equalizer APO files used by customers;
- select Windows spatial backends without game-specific listening validation;
- alter 7.1/16ch endpoint routing;
- claim measured improvements in localization from its score alone.

Any future promotion into production requires an Astral-owned algorithm, measurement-based comparison, listening tests, and TypeScript implementation. Python and the upstream repository remain development-only.

