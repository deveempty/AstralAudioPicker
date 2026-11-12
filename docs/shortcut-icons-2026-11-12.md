# Shortcut icon refresh

Local change, not published. Read-only inspection of installed Picker 3.1.7 found the new supplied icon in the executable. The Start Menu shortcut still references that unchanged executable path, allowing Explorer to reuse its old image.

The package now includes `branding/shortcut-${version}.ico` alongside the existing runtime icon. The NSIS custom install hook updates only existing Start Menu/Desktop shortcuts to the versioned resource, keeps their app identity, and sends targeted shell notifications. It does not recreate shortcuts the user removed or clear the global Windows icon cache.

TypeScript and the package allowlist validator pass. NSIS compilation and actual Windows shortcut refresh remain to be verified before release. No installed files or user shortcuts changed.

Published 3.1.8 on 2026-11-12 with explicit authorization. Source commit 4a50bd8. minimumVersion remains 3.1.7. Typecheck, obfuscated build, NSIS compilation and artifact allowlist passed. Packaged shortcut-3.1.8.ico matches the supplied source icon byte for byte. R2 manifest and full installer downloaded and matched local SHA256. Installer SHA256: 5BB942A2F70523F23582B322C6A8987C4288B2691038D2E42ED3254B255EC7DE. No installer execution or live Explorer refresh test; earlier local-only notes above are superseded by this publication receipt.