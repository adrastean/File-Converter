!macro customInstall
  DetailPrint "LibreOffice kuruluyor..."

  File /oname=$PLUGINSDIR\LibreOffice.msi "${BUILD_RESOURCES_DIR}\LibreOffice.msi"

  ExecWait '"$SYSDIR\msiexec.exe" /i "$PLUGINSDIR\LibreOffice.msi" ALLUSERS=1 /qn /norestart'
!macroend