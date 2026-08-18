; Custom NSIS uninstaller script for WingetInterfaceAndMore
; This script provides robust cleanup with timeout handling

; Uninstaller section
Section "Uninstall"
    SetDetailsPrint textonly
    DetailPrint "Preparing to uninstall..."
    SetDetailsPrint listonly
    
    ; Close any running instances first
    DetailPrint "Checking for running instances..."
    nsExec::ExecToLog 'taskkill /F /IM "winget-interface.exe" /T'
    Pop $0
    
    ; Wait a moment for processes to close
    Sleep 1000
    
    ; Remove application files with timeout
    DetailPrint "Removing application files..."
    SetOutPath "$TEMP"
    
    ; Try standard removal first
    RMDir /r "$INSTDIR"
    
    ; If standard removal fails, use force cleanup with timeout
    ${If} ${FileExists} "$INSTDIR\*.*"
        DetailPrint "Standard removal incomplete, forcing cleanup..."
        nsExec::ExecToLog 'cmd.exe /c "timeout /t 2 /nobreak >nul && if exist "$INSTDIR" rd /s /q "$INSTDIR""'
        Pop $0
    ${EndIf}
    
    ; Remove shortcuts
    DetailPrint "Removing shortcuts..."
    Delete "$SMPROGRAMS\WinGet Web Interface.lnk"
    Delete "$DESKTOP\WinGet Web Interface.lnk"
    
    ; Remove registry keys
    DetailPrint "Cleaning registry..."
    DeleteRegKey HKCU "Software\WingetWebInterface"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WingetWebInterface"
    
    ; Final cleanup check with aggressive retry
    ${If} ${FileExists} "$INSTDIR\*.*"
        DetailPrint "Retrying folder removal..."
        Sleep 1000
        RMDir /r /REBOOTOK "$INSTDIR"
    ${EndIf}
    
    DetailPrint "Uninstallation complete!"
    
SectionEnd
