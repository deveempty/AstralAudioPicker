; Refresh only shortcuts that exist. Preserve the user's decision to remove one.
; A versioned icon path prevents Explorer from reusing the previous EXE icon.
!macro customInstall
  ${if} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\branding\shortcut-${VERSION}.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    System::Call 'shell32::SHChangeNotify(i 0x2000, i 0x5, w "$newStartMenuLink", p 0)'
  ${endIf}
  ${if} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\branding\shortcut-${VERSION}.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'shell32::SHChangeNotify(i 0x2000, i 0x5, w "$newDesktopLink", p 0)'
  ${endIf}
!macroend

!macro customUnInit
 ${ifNot} ${isUpdated}
  InitPluginsDir
  CopyFiles /SILENT "$INSTDIR\resources\scripts\RemoveRelayStartup.ps1" "$PLUGINSDIR\RemoveRelayStartup.ps1"
  CopyFiles /SILENT "$INSTDIR\resources\scripts\RelayStartup.ps1" "$PLUGINSDIR\RelayStartup.ps1"
 ${endIf}
!macroend

!macro customUnInstall
 ${ifNot} ${isUpdated}
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\RemoveRelayStartup.ps1" -AppExecutable "$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
 ${endIf}
!macroend
