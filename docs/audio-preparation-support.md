# Audio preparation: support codes

Source of truth: `shared/audio-errors.ts`. Messages are localized through `src/i18n/audio-preparation.ts`.

| Code | Internal reason | User message |
| --- | --- | --- |
| AA-100 | UNKNOWN | No se pudo completar la preparaciÃ³n del audio. Reintenta o abre un ticket de soporte. |
| AA-101 | COSMIC_INSTALL_BUSY | Hay otra preparaciÃ³n de Cosmic en curso. Espera y reintenta. |
| AA-102 | COSMIC_LOCK_RECOVERY_REQUIRED | Una instalaciÃ³n interrumpida de Cosmic necesita recuperaciÃ³n. Abre un ticket de soporte. |
| AA-103 | AMBIGUOUS_RECONCILIATION | La configuraciÃ³n de Cosmic contiene un bloque que no se pudo actualizar con seguridad. Adjunta config.txt en un ticket. |
| AA-201 | AUTO_EQ_TARGET_MISSING | Falta un target de ecualizaciÃ³n necesario. Reintenta la actualizaciÃ³n de audio. |
| AA-202 | AUTO_EQ_MEASUREMENT_INVALID | La mediciÃ³n de tus audÃ­fonos no se puede leer o no tiene suficientes datos. |
| AA-203 | AUTO_EQ_TARGET_INVALID | Un target de ecualizaciÃ³n tiene datos invÃ¡lidos o insuficientes. |
| AA-204 | HEADPHONE_SELECTION_REQUIRED | No se pudo identificar de forma Ãºnica tu selecciÃ³n anterior. Selecciona tus audÃ­fonos en AutoEQ. |
| AA-301 | APO_CHAIN_UNCONFIRMED | No se pudo verificar la cadena de procesamiento del cable de 16 canales. Abre un ticket con este cÃ³digo. |
| AA-302 | LOUDNESS_READBACK_FAILED | No se pudo confirmar Loudness EQ en el cable de 16 canales. |
| AA-401 | RELAY_ROUTE_UNCONFIRMED | La entrada de audio o la salida de audÃ­fonos no estÃ¡ lista. Revisa Enrutamiento de audio y reintenta. |
| AA-402 | AUDIO_PREPARATION_BUSY | La preparaciÃ³n del audio sigue en curso. Espera antes de cambiar los ajustes. |
| AA-501 | PREPARATION_INTERRUPTED | La preparaciÃ³n anterior se interrumpiÃ³. Reintenta para verificarla y continuar. |
| AA-205 | AUTO_EQ_OUTPUT_INVALID | La EQ generada no pasÃ³ la validaciÃ³n. Se conservÃ³ tu EQ anterior. |
| AA-207 | AUTO_EQ_BUSY | Wait for the current EQ generation to finish, then retry. |
| AA-206 | AUTO_EQ_ROLLBACK_INCOMPLETE | La recuperaciÃ³n de EQ necesita asistencia. Abre un ticket antes de cambiar perfiles. |
| AA-303 | AUDIO_CONFIG_INVALID | La configuraciÃ³n de audio apunta a archivos ausentes o invÃ¡lidos. Abre un ticket de soporte. |
| AA-403 | RELAY_INSTALL_REQUIRED | Falta el motor de audio. InstÃ¡lalo para continuar. |
| AA-404 | RELAY_RESTART_REQUIRED | Windows necesita reiniciarse para terminar la instalaciÃ³n del motor de audio. |
| AA-405 | RELAY_STARTUP_CONFLICT | Hay otra configuraciÃ³n de inicio que requiere revisiÃ³n. Abre un ticket de soporte. |
| AA-406 | RELAY_CONFIGURATION_CHANGED | No se pudo conservar la ruta de audio anterior. Revisa Enrutamiento de audio y reintenta. |
| AA-304 | LOUDNESS_WRITE_OR_RESTART_FAILED | Windows no pudo aplicar Loudness EQ o reconectar el cable. Reintenta o abre un ticket. |
| AA-407 | LOUDNESS_RELAY_RESTART_FAILED | El cable cambiÃ³, pero Relay no pudo reconectarse. Revisa Enrutamiento de audio. |

## Diagnostic files

- `%LOCALAPPDATA%\AstralAudio\post-update\post-update.json`: app version, current stage and verified stages.
- `%LOCALAPPDATA%\AstralAudio\post-update\failures.jsonl`: failed stage and underlying filesystem/generation detail.
- `%LOCALAPPDATA%\AstralAudio\post-update\<version>\`: original config/EQ backups, Relay XML when connected, snapshot, APO and LEQ verification, and configuration errors.
- `%LOCALAPPDATA%\AstralAudio\eq-transactions\`: write-ahead journal and previous EQ contents.
- `%LOCALAPPDATA%\AstralAudio\last-autoeq-error.json`: selected measurement and target/measurement failure details.

Copy details copies only product, support code, internal reason, stage and timestamp. It does not upload logs or send Discord messages. The Discord button opens the Astral server; a ticket channel URL has not been configured.

## Behavior

First installation records a baseline without migrating previous customer settings. Existing installation evidence is captured before legacy migrations run. A different app version triggers the staged workflow after account/Cosmic readiness. A completed version does not re-enable LEQ on every launch.

Every update explicitly reapplies `enabled: true` on the verified 16-channel endpoint, even when the initial read already reports enabled. The release-time setting is preserved. A failed write, reconnect or readback prevents completion; a previously enabled flag cannot bypass that failure. A later app version performs this activation again.

Retries revalidate prerequisites. Snapshot and verified EQ checkpoints are reused; content is checked against its manifest. A user correction has a separate journal, preserving the original backup. Completion is persisted only after the final checks.

APO preparation resolves both Cable Input 7.1 and CABLE In 16ch by their exact names and VB-Audio adapter, including disabled devices. It checks registered Equalizer APO components, original pre/post effects and LFX/GFX slots. Missing or partial endpoint registration is automatically repaired with the installed Equalizer APO CLSIDs and each endpoint's own original effects. Unavailable or ambiguous endpoints, missing registered DLLs and unrecoverable/incompatible originals stop with specific support codes. LEQ is enabled only on 16ch after both chains pass.

Relay verification checks API connection, selected input/output presence in its inventory, and preservation of route, gain, mute and engine settings. This is configuration verification, not an acoustic or loopback measurement. Silence is not proof of a fault. Windows per-application routing is not rewritten.

Cosmic locks now contain an owner PID and token. A confirmed exited owner can be quarantined safely. Empty locks left by older releases cannot establish ownership; AA-102 requests support instead of deleting a possibly live lock.

## Validation and release boundary

Diagnostics includes **Repair APO / Loudness EQ**, which runs the same automatic repair as update preparation. The selector is a fallback after failure, not a prerequisite. A repair does not regenerate EQ, change endpoint names/defaults, enable the inactive profile cable, or mark an update migration complete.

Before writes, the helper compares the live registry against the inspected state. It flushes a write-ahead journal under `%LOCALAPPDATA%\AstralAudio\apo-repair`, preserves the Equalizer APO version-2 uninstall metadata, writes only the required FxProperties/Child APOs values, and reads them back. On failure it restores only its changed values; conflicting external edits stop recovery. An interrupted journal is recovered before a new attempt. There are no ownership/ACL changes, global audio-service restarts or substitutions from another endpoint. The active affected endpoint is restarted through PnP; disabled endpoints retain their state. Relay must confirm route, gains, mute, edition, sample rate and buffers on two consecutive reads before restart completion.

Support codes: AA-305 missing/ambiguous cable; AA-306 missing APO component registration; AA-307 unknown/incompatible original effects; AA-308 repair verification failure; AA-309 concurrent device change; AA-310 rollback needs support; AA-311 endpoint restart failure; AA-312 elevation failure. Full automatic-update failures retain the underlying cause in failures.jsonl. Manual repair records its result in the repair history. Registration verification is not an acoustic proof of DSP operation.

### AA-307: explicit empty original-effects backup

An upgrade from 3.1.18 can stop on a cable with valid Equalizer APO LFX/GFX slots, a version-2 Child APOs backup containing `!VALUE` in all five effect slots, and empty `PreMixChild` / `PostMixChild`. This proves an empty saved chain, not that the DLLs are missing or that the original effects were lost. Retrying 3.1.18 cannot provision this case.

The repair now provisions the Windows Loudness effects already used by Astral's `SetLoudness.ps1`, only for the exact VB-Audio cable identities and this explicit empty-backup shape. Inventory must confirm both standard CLSIDs are registered as audio processing objects and resolve to the existing Windows System32 `WMALFXGFXDSP.dll`. This check is independent of the other cable. Foreign child processors, missing/corrupt backups, partial original chains and additional modern processors remain blocked.

Only the two child-effect references are needed for the reported state. The original `!VALUE` uninstall metadata, unrelated binary settings and endpoint enable/disable state are preserved. Chain verification recognizes the provisioned pair using the same narrowly scoped checks; a flag alone does not make the chain valid. The existing transaction journal, rollback, endpoint restart policy and Relay recovery still apply. Subsequent LEQ activation/readback remains required. Regression: `node tools-dev/apo-empty-originals-smoke.cjs`.

Reference contract: [Equalizer APO DeviceAPOInfo](https://raw.githubusercontent.com/mirror/equalizerapo/master/DeviceAPOInfo.cpp), installation version 2, LFX/GFX slots and original-effect child registration. Implementation does not bundle upstream source.

Validation: `node tools-dev/apo-repair-smoke.cjs --registry` exercises the actual PowerShell write/rollback/recovery core in isolated HKCU fixtures; `apo-orchestration-smoke.cjs`, `audio-repair-smoke.cjs`, `audio-preparation-smoke.cjs`, `relay-restart-settled-smoke.cjs` and UI tests cover both cables, no-op behavior, migration gating and EN/ES controls. Live repair on the development PC restored the missing 16ch APO, preserved disabled 7.1, enabled LEQ with its release time intact, and retained the Relay route/gains/mute/settings. Evidence: output/apo-live-1794944046030.

Run `npm run typecheck`, `node tools-dev/post-update-smoke.cjs`, `node tools-dev/audio-preparation-smoke.cjs`, `node tools-dev/preparation-ui.cjs`, and the existing audio-upgrade/game-selection tests. Hardware writes, engine restarts and downloads in the new pipeline tests are mocked. The APO reader has also been checked read-only on the development PC.

Before production, test an actual packaged update on an existing installation (including a deliberately disabled LEQ) and a fresh-install VM. Confirm UAC, endpoint reconnection and audible playback. No production release is represented by passing the isolated tests.

### Cosmic disconnected despite valid installation checks

On 2026-11-17, read-only inspection found valid APO registration but no Cosmic/Equalizer APO modules in audiodg and no recent Cosmic heartbeat. After the user restarted audio, audiodg loaded EqualizerAPO.dll, WMALFXGFXDSP.dll and Cosmic.dll. A new heartbeat acknowledged revision 1203 and reported advancing audio blocks and nonzero input/output. This demonstrates recovery after restart on this PC; it does not establish which prior update operation left the engine unloaded or prove the cause on other PCs.

Diagnostics now checks live Cosmic activity when Cosmic is selected. It verifies the heartbeat PID against audiodg processes actually loading the configured DLL, advancing blocks across two observations, the current settings fingerprint/revision, processing state and enabled modules. Silence and inaccessible process information remain unconfirmed; offline and stale processing require attention instead of an all-verified summary. The shipped DLL can report `audioService: false` inside audiodg, so this diagnostic verifies the process independently rather than trusting that flag. Checks are read-only and never initialize the settings file, switch endpoints or restart audio. A positive result is runtime DSP evidence, not an acoustic headphone measurement.

Regression: `node tools-dev/cosmic-runtime-smoke.cjs`. Optional `--read-live` uses the current playback without emitting test audio. Live read-only verification returned `cosmicRuntimeConfirmed` after the user's restart. Included in release 3.1.21 alongside the qualified Cosmic endpoint reconciliation fix and the distinction between Loudness EQ reads and writes. This release does not claim to resolve every reported disconnected-engine case.
