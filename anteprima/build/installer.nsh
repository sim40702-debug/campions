; Aggiunte al programma di installazione di Windows (electron-builder le inserisce da solo:
; questo file deve chiamarsi build/installer.nsh).

; Pagina di benvenuto prima della licenza (non compare durante un aggiornamento)
!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Disinstallazione: chiede se cancellare anche le impostazioni salvate.
; Durante un aggiornamento (pulsante "Aggiorna") non chiede niente e le impostazioni restano.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Vuoi cancellare anche le impostazioni salvate del gioco (qualità grafica, moto scelta, punto di partenza)?$\r$\n$\r$\nScegli No se pensi di reinstallare il gioco." /SD IDNO IDNO mrwTieniDati
      ; Electron salva sempre i dati nella cartella dell'utente, anche se il gioco e' installato per tutti
      SetShellVarContext current
      RMDir /r "$APPDATA\MOTO RACING WORLD - Anteprima Ticino"
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
      !endif
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
    mrwTieniDati:
  ${endif}
!macroend
