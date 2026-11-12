# Shortcut icon refresh

Local change, not published. Read-only inspection of installed Picker 3.1.7 found the new supplied icon in the executable. The Start Menu shortcut still references that unchanged executable path, allowing Explorer to reuse its old image.

The package now includes `branding/shortcut-${version}.ico` alongside the existing runtime icon. The NSIS custom install hook updates only existing Start Menu/Desktop shortcuts to the versioned resource, keeps their app identity, and sends targeted shell notifications. It does not recreate shortcuts the user removed or clear the global Windows icon cache.

TypeScript and the package allowlist validator pass. NSIS compilation and actual Windows shortcut refresh remain to be verified before release. No installed files or user shortcuts changed.
