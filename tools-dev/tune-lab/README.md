# Astral Tune Lab

Development-only real-time audio inspection surface. This directory is excluded from the Picker package by the existing electron-builder allowlist and package validation.

## Run

From `AstralAudioPicker`:

```powershell
npm run lab:tune
```

Open `http://127.0.0.1:4178`, choose the exact WASAPI output endpoint and press **Capture device**. `Cable Input 7.1` or `CABLE In 16ch` appears when that endpoint is enabled in Windows. The launcher starts and stops the native helper together with Vite.

**Screen mix** remains an explicit fallback using the Windows/Chromium share dialog. **Demo signal** only validates the 16-channel visualization without a capture source.

## Measurement boundary

- The native helper uses WASAPI loopback for the exact render endpoint selected in the UI and preserves its reported channel count.
- The optional browser adapter captures the Windows/Chromium loopback mix, which generally exposes stereo.
- The 16-channel demo is explicitly synthetic.
- Events are signal classes (transient, broadband burst, low-frequency masking), not claims about enemies, distance, occlusion, or game state.
- Calibration tones are restricted to one selected channel, 80–2000 Hz, no louder than -18 dB and no longer than 3 seconds. The UI uses 500 Hz, -24 dB and 1.2 seconds.
- A/B sessions save the native multichannel stream as WAV and sample analysis metrics at 10 Hz.
- The masking audit compares measured 40–280 Hz energy against the 1.2–6.5 kHz cue band. It is a signal relationship, not a perceptual localization score.

## Workflow

1. Select and capture the exact WASAPI endpoint.
2. Open **Calibration**, test one channel at a time and confirm the observed positions.
3. Open **A/B Sessions**, record the same controlled passage as session A, change the tune manually, then record session B.
4. Inspect **Masking** during playback and use the measured B-A comparison.
5. Open **Reports** to export the methodology, timelines, events, summaries and WAV paths.

Native WAV recordings are stored under `tools-dev\tune-lab\sessions`.

The lab never writes Equalizer APO configuration or applies tunes automatically.
