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
