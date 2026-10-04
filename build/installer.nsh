; Borometer - a damage meter for Throne and Liberty
; Copyright (C) 2026 B0R0AK
; SPDX-License-Identifier: GPL-3.0-or-later
;
; The installer in the app's clothes. electron-builder includes this file
; ahead of its own pages, so everything defined at the top level here is in
; place when the pages are built.
;
; Saved as UTF-8 WITH a byte order mark: NSIS reads a file without one in
; the system code page, and every umlaut below would come out wrong.
;
; The pictures (installerSidebar.bmp, uninstallerSidebar.bmp,
; installerHeader.bmp) are drawn by scripts/build-installer-art.mjs.

; ---------- colours ----------
; Every page stands on --comb and writes in --text, the pair the pictures
; stand on, so a picture has no edge against its page. MUI_BGCOLOR and
; MUI_TEXTCOLOR are what Modern UI gives the welcome and finish pages and
; the band at the top of the inner pages; the rest - the inner pages' body,
; the frame around them, the button row - is coloured by the functions
; further down, from the same tokens.
!define MUI_BGCOLOR 0F0A05     ; --comb
!define MUI_TEXTCOLOR F4ECE1   ; --text: 16.82:1 on --comb

; The quieter inks and the surfaces, measured like styles.css measures them.
!define BORO_DIM   B3A189      ; --dim: header subtitle, space notes, the
                               ; field label. 7.86:1 on --comb
!define BORO_FAINT A08D74      ; --dimmer: the version line by the buttons.
                               ; 6.15:1 on --comb
!define BORO_WELL  0A0603      ; --field-bg: the folder field. --text on it
                               ; 17.24:1
!define BORO_EDGE  616668      ; --ctl-edge (198,214,226 at .45) on --comb:
                               ; the folder field's ring. 3.39:1 on --comb,
                               ; 3.47:1 on the well - WCAG's 3:1 for the
                               ; boundary of a control
!define BORO_RIDGE 2E2110      ; --ridge: the two hairlines (under the header,
                               ; over the buttons). 1.26:1 - a seam, it bounds
                               ; no control
; Progress bar messages take a COLORREF, 0x00BBGGRR.
!define BORO_CR_AMBER 0x001E79C8 ; --amber, the fill: bars in the app are
                                 ; amber. 5.21:1 on its track, 5.83:1 on --comb
!define BORO_CR_RAISE 0x00081721 ; --raise, the track: 1.12:1 on --comb, a
                                 ; groove you see without it shouting

; The details log of the progress page: --dim on the well, 8.05:1. Modern UI
; turns this into InstallColors, which NSIS applies when it builds the list.
; electron-builder keeps the log folded away; this is for the day it is not.
!define MUI_INSTFILESPAGE_COLORS "B3A189 0A0603"

; The frame (title bar, button row, header texts, hairlines) is set once,
; when the window is built.
!ifndef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_GUIINIT boroFrame
!else
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.boroFrame

  ; The uninstaller's progress page has no show hook (see "the dark pages"
  ; below), so it is coloured by the first thing that runs on it: this
  ; hidden section, which comes ahead of electron-builder's uninstall
  ; section because this file is included first, and sections run in
  ; order. Only the uninstaller gets one - in the installer,
  ; electron-builder addresses its section by index. Silent uninstalls (an
  ; update runs one) have no page.
  Section "-un.boroDarkProgress"
    IfSilent +2
      Call un.boroPage
  SectionEnd
!endif

; ---------- words ----------
; 1033 English, 1031 German. The installer speaks whichever of the two
; Windows speaks, and English everywhere else (installerLanguages in
; electron-builder.yml). The voice is the app's: short, direct, "du".
!ifndef BUILD_UNINSTALLER
  LangString boroWelcomeTitle 1033 "Set up Borometer"
  LangString boroWelcomeTitle 1031 "Borometer einrichten"
  LangString boroWelcomeText 1033 "Borometer reads the combat log that Throne and Liberty writes itself - and nothing else. No access to the game, no account, no telemetry.$\r$\n$\r$\nThis puts Borometer in your user folder, with a Start menu entry and a desktop shortcut. Your settings stay where they are, so an older Borometer hands everything over.$\r$\n$\r$\nClick Next to continue."
  LangString boroWelcomeText 1031 "Borometer liest die Kampflog-Datei, die Throne and Liberty selbst schreibt – und sonst nichts. Kein Zugriff aufs Spiel, kein Konto, keine Telemetrie.$\r$\n$\r$\nBorometer kommt in deinen Benutzerordner, dazu ein Eintrag im Startmenü und eine Verknüpfung auf dem Desktop. Deine Einstellungen bleiben, wo sie sind – ein älteres Borometer gibt alles weiter.$\r$\n$\r$\nKlick auf Weiter."
  LangString boroFinishTitle 1033 "Borometer is ready"
  LangString boroFinishTitle 1031 "Borometer ist bereit"
  LangString boroFinishText 1033 "In the game, add $\"Combat Meter$\" to the ring menu once (Settings, Shortcuts, Ring Menu) and activate it from there. From then on the game writes a log at the end of every fight.$\r$\n$\r$\nIn Borometer, switch on Live - every pull shows up shortly after it ends."
  LangString boroFinishText 1031 "Im Spiel einmal den Kampfmesser ins Ringmenü legen (Einstellungen, Tastenkürzel, Ringmenü) und einschalten. Ab dann schreibt das Spiel bei jedem Kampfende ein Log.$\r$\n$\r$\nIn Borometer Live einschalten – jeder Pull erscheint kurz nach dem Kampf."
  LangString boroRunText 1033 "Start Borometer now"
  LangString boroRunText 1031 "Borometer jetzt starten"
!else
  LangString boroUnWelcomeTitle 1033 "Remove Borometer"
  LangString boroUnWelcomeTitle 1031 "Borometer entfernen"
  LangString boroUnWelcomeText 1033 "This removes Borometer from this computer: the program, its Start menu entry and the desktop shortcut.$\r$\n$\r$\nYour settings (%APPDATA%\Borometer) and saved fights (Documents\Borometer) stay where they are, so a new install picks them up again.$\r$\n$\r$\nClose Borometer first, then click Next."
  LangString boroUnWelcomeText 1031 "Das entfernt Borometer von diesem Computer: das Programm, den Eintrag im Startmenü und die Verknüpfung auf dem Desktop.$\r$\n$\r$\nDeine Einstellungen (%APPDATA%\Borometer) und gespeicherten Kämpfe (Dokumente\Borometer) bleiben, wo sie sind – eine neue Installation findet sie wieder.$\r$\n$\r$\nSchließ Borometer vorher, dann klick auf Weiter."
  LangString boroUnFinishTitle 1033 "Borometer is removed"
  LangString boroUnFinishTitle 1031 "Borometer ist entfernt"
  LangString boroUnFinishText 1033 "The program is gone. Your settings and saved fights are still here, in case you come back:$\r$\n$\r$\n%APPDATA%\Borometer$\r$\nDocuments\Borometer$\r$\n$\r$\nIf you want them gone too, delete these two folders by hand."
  LangString boroUnFinishText 1031 "Das Programm ist weg. Deine Einstellungen und gespeicherten Kämpfe liegen noch da, falls du wiederkommst:$\r$\n$\r$\n%APPDATA%\Borometer$\r$\nDokumente\Borometer$\r$\n$\r$\nWenn auch sie weg sollen, lösch die beiden Ordner von Hand."
!endif

; ---------- the dark pages ----------
; NSIS builds the inner pages from dialog templates in Windows' own colours.
; SetCtlColors recolours a control, but only for as long as that control
; lives, and every page is a new dialog - so each page is recoloured as it
; is shown. The buttons stay Windows buttons: NSIS cannot restyle them
; cleanly. Everything around them is dark.
;
; Where each page gets its call (electron-builder's page order is fixed):
;   directory             .onVerifyInstDir. The page has no show hook of its
;                         own here: electron-builder declares its install
;                         mode page between the welcome page and it - never
;                         shown (customInstallMode below), but still
;                         declared - and that page takes any show hook
;                         defined before it. NSIS
;                         calls .onVerifyInstDir while it builds the page
;                         (and on every edit of the path), so the page is
;                         dark before it is drawn.
;   install files         MUI_PAGE_CUSTOMFUNCTION_SHOW, via
;                         customPageAfterChangeDir
;   uninstall files       a hidden section that runs first (top of this
;                         file): the same install mode page is declared in
;                         front of it, and there is no other hook. The section
;                         starts the moment the page is up.
!macro boroDarkFunctions UN

  ; The frame: the dialog behind the pages and the button row, the title
  ; bar, the header's subtitle, the version line and the two hairlines.
  Function ${UN}boroFrame
    Push $0
    SetCtlColors $HWNDPARENT ${MUI_TEXTCOLOR} ${MUI_BGCOLOR}
    ; the header title keeps --text (Modern UI sets it); the subtitle says
    ; less, so it is the secondary ink
    GetDlgItem $0 $HWNDPARENT 1038
    SetCtlColors $0 ${BORO_DIM} ${MUI_BGCOLOR}
    ; "Borometer 1.x" by the buttons. 1256 is drawn over 1028, a disabled
    ; twin Windows embosses in white and grey whatever it is told - a
    ; bright halo round the words on --comb. The twin loses its text;
    ; Modern UI only ever writes to 1256.
    GetDlgItem $0 $HWNDPARENT 1256
    SetCtlColors $0 ${BORO_FAINT} transparent
    GetDlgItem $0 $HWNDPARENT 1028
    SetCtlColors $0 ${BORO_FAINT} transparent
    SendMessage $0 ${WM_SETTEXT} 0 "STR:"
    ; the etched lines: 1036 under the header, 1035 over the buttons on the
    ; inner pages, 1045 the same line across the full width on welcome and
    ; finish. Etched lines are drawn white and grey whatever colour they
    ; are given - a light seam on --comb - so each becomes a flat --ridge
    ; hairline instead.
    Push 1036
    Call ${UN}boroRidge
    Push 1035
    Call ${UN}boroRidge
    Push 1045
    Call ${UN}boroRidge
    ; the title bar: dark, and on Windows 11 in --comb with --text. Both
    ; are documented DWM attributes; an older Windows ignores the ones it
    ; does not know. 20 DWMWA_USE_IMMERSIVE_DARK_MODE, 35 DWMWA_CAPTION_COLOR,
    ; 36 DWMWA_TEXT_COLOR (COLORREF 0x00BBGGRR).
    System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 35, *i 0x00050A0F, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 36, *i 0x00E1ECF4, i 4)'
    Pop $0
  FunctionEnd

  ; An etched line of the frame, by control id on the stack, turned into a
  ; plain static (SS_LEFT, no text) without its static edge, so it fills
  ; with the colour it is given.
  Function ${UN}boroRidge
    Exch $0
    Push $1
    GetDlgItem $0 $HWNDPARENT $0
    ${If} $0 <> 0
      System::Call 'user32::GetWindowLongW(p r0, i -16) i .r1'
      IntOp $1 $1 & 0xFFFFFFE0          ; clear SS_TYPEMASK: SS_ETCHEDHORZ -> SS_LEFT
      System::Call 'user32::SetWindowLongW(p r0, i -16, i r1)'
      System::Call 'user32::GetWindowLongW(p r0, i -20) i .r1'
      IntOp $1 $1 & 0xFFFDFFFF          ; clear WS_EX_STATICEDGE
      System::Call 'user32::SetWindowLongW(p r0, i -20, i r1)'
      ; SWP_NOSIZE|NOMOVE|NOZORDER|NOACTIVATE|FRAMECHANGED: apply the new edge
      System::Call 'user32::SetWindowPos(p r0, p 0, i 0, i 0, i 0, i 0, i 0x37)'
      SetCtlColors $0 ${BORO_RIDGE} ${BORO_RIDGE}
    ${EndIf}
    Pop $1
    Pop $0
  FunctionEnd

  ; The page on show: its ground and every control on it, by kind. Texts in
  ; --text on --comb (opaque, not transparent: the status line of the
  ; progress page is rewritten all the time, and a transparent one would
  ; pile the texts on top of each other). Fields in the well. Checkboxes
  ; and radio buttons lose their theme: with visual styles on, Windows
  ; paints their label black whatever colour the page asks for. The
  ; progress bar loses its theme too, the only way it takes colours. Push
  ; buttons stay as they are.
  Function ${UN}boroPage
    ; before the window exists (a silent uninstall) there is nothing to
    ; colour, and a FindWindow on no parent would find other programs'
    ; dialogs
    ${If} $HWNDPARENT = 0
      Return
    ${EndIf}
    Push $0
    Push $1
    Push $2
    Push $3
    FindWindow $0 "#32770" "" $HWNDPARENT
    ${If} $0 <> 0
      SetCtlColors $0 ${MUI_TEXTCOLOR} ${MUI_BGCOLOR}
      StrCpy $1 0
      ${Do}
        FindWindow $1 "" "" $0 $1
        ${If} $1 = 0
          ${Break}
        ${EndIf}
        System::Call 'user32::GetClassNameW(p r1, w .r2, i 64)'
        ${If} $2 == "Static"
          SetCtlColors $1 ${MUI_TEXTCOLOR} ${MUI_BGCOLOR}
        ${ElseIf} $2 == "Edit"
          SetCtlColors $1 ${MUI_TEXTCOLOR} ${BORO_WELL}
        ${ElseIf} $2 == "Button"
          System::Call 'user32::GetWindowLongW(p r1, i -16) i .r3'
          IntOp $3 $3 & 0xF
          ; BS_CHECKBOX 2, AUTOCHECKBOX 3, RADIOBUTTON 4, 3STATE 5,
          ; AUTO3STATE 6, AUTORADIOBUTTON 9
          ${If} $3 = 2
          ${OrIf} $3 = 3
          ${OrIf} $3 = 4
          ${OrIf} $3 = 5
          ${OrIf} $3 = 6
          ${OrIf} $3 = 9
            System::Call 'uxtheme::SetWindowTheme(p r1, w " ", w " ")'
            SetCtlColors $1 ${MUI_TEXTCOLOR} ${MUI_BGCOLOR}
          ${EndIf}
        ${ElseIf} $2 == "msctls_progress32"
          System::Call 'uxtheme::SetWindowTheme(p r1, w " ", w " ")'
          SendMessage $1 0x0409 0 ${BORO_CR_AMBER}   ; PBM_SETBARCOLOR
          SendMessage $1 0x2001 0 ${BORO_CR_RAISE}   ; PBM_SETBKCOLOR
        ${EndIf}
      ${Loop}
      ; repaint the page and everything on it (it may already be on screen:
      ; the uninstaller's progress page is); RDW_INVALIDATE|ERASE|ALLCHILDREN
      System::Call 'user32::RedrawWindow(p r0, p 0, p 0, i 0x85)'
    ${EndIf}
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd

!macroend

; (A macro, not top-level functions: this file comes before LogicLib and
; MUI2 are included; the macros are expanded where the pages are built.)
!macro boroDirectoryFunctions
  ; The directory page on top of the common pass. The two space notes take
  ; the secondary ink. The group box around the field becomes a plain label:
  ; a group box's caption ignores colours under visual styles, and without
  ; them its frame is etched in white - a light seam either way. The label
  ; takes the box's words, font and place in the z-order (right before the
  ; field, which is where a screen reader looks for the field's name) and
  ; sits flush with the field. And the field loses the border Windows 11
  ; draws around it, near-white on --comb, for a 1px ring in the app's
  ; control edge around a pad in the well; the field itself sits inside,
  ; its text centred.
  Function boroDirectoryPage
    ${If} $HWNDPARENT = 0
      Return
    ${EndIf}
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $7
    Push $8
    Push $9
    Push $R0
    Push $R1
    Push $R2
    FindWindow $0 "#32770" "" $HWNDPARENT
    GetDlgItem $1 $0 1020                   ; the group box
    ; .onVerifyInstDir runs on every edit of the path too: the page is done
    ; once its group box is hidden
    System::Call 'user32::IsWindowVisible(p r1) i .r2'
    ${If} $1 <> 0
    ${AndIf} $2 <> 0
      Call boroPage
      GetDlgItem $2 $0 1023                 ; space required
      SetCtlColors $2 ${BORO_DIM} ${MUI_BGCOLOR}
      GetDlgItem $2 $0 1024                 ; space available
      SetCtlColors $2 ${BORO_DIM} ${MUI_BGCOLOR}

      ; the field's rectangle and the box's top, in the page's coordinates
      GetDlgItem $3 $0 1019                 ; the folder field
      System::Call '*(i,i,i,i) p .r4'
      System::Call 'user32::GetWindowRect(p r3, p r4)'
      System::Call 'user32::MapWindowPoints(p 0, p r0, p r4, i 2)'
      System::Call '*$4(i .r5, i .r6, i .r7, i .r8)'   ; left, top, right, bottom
      System::Call 'user32::GetWindowRect(p r1, p r4)'
      System::Call 'user32::MapWindowPoints(p 0, p r0, p r4, i 2)'
      System::Call '*$4(i, i .r9)'                     ; box top
      System::Free $4
      IntOp $7 $7 - $5                                 ; field width
      IntOp $8 $8 - $6                                 ; field height
      SendMessage $3 ${WM_GETFONT} 0 0 $R1             ; the page's font

      ; the label, from the box's top down to the field
      IntOp $R0 $6 - $9
      IntOp $R0 $R0 - 2
      System::Call 'user32::GetWindowTextW(p r1, w .r2, i ${NSIS_MAX_STRLEN})'
      ; WS_CHILD|WS_VISIBLE, a plain left-aligned static
      System::Call 'user32::CreateWindowExW(i 0, w "Static", w r2, i 0x50000000, i r5, i r9, i r7, i R0, p r0, p 0, p 0, p 0) p .r4'
      SendMessage $4 ${WM_SETFONT} $R1 1
      SetCtlColors $4 ${BORO_DIM} ${MUI_BGCOLOR}
      ; right after the box in z-order, so right before the field;
      ; SWP_NOSIZE|NOMOVE|NOACTIVATE
      System::Call 'user32::SetWindowPos(p r4, p r1, i 0, i 0, i 0, i 0, i 0x13)'
      ShowWindow $1 ${SW_HIDE}

      ; the ring, where the field was. WS_CHILD|WS_VISIBLE|WS_CLIPSIBLINGS:
      ; clipping keeps it from painting over what lies above it.
      System::Call 'user32::CreateWindowExW(i 0, w "Static", w "", i 0x54000000, i r5, i r6, i r7, i r8, p r0, p 0, p 0, p 0) p .r4'
      SetCtlColors $4 ${BORO_EDGE} ${BORO_EDGE}
      System::Call 'user32::SetWindowPos(p r4, p r3, i 0, i 0, i 0, i 0, i 0x13)'
      ; the pad, 1px inside it; put right behind the field after the ring
      ; was, so it lies between the two
      IntOp $R0 $5 + 1
      IntOp $R2 $6 + 1
      IntOp $2 $7 - 2
      IntOp $9 $8 - 2
      System::Call 'user32::CreateWindowExW(i 0, w "Static", w "", i 0x54000000, i R0, i R2, i r2, i r9, p r0, p 0, p 0, p 0) p .r4'
      SetCtlColors $4 ${MUI_TEXTCOLOR} ${BORO_WELL}
      System::Call 'user32::SetWindowPos(p r4, p r3, i 0, i 0, i 0, i 0, i 0x13)'

      ; the field without its border (WS_EX_CLIENTEDGE off) ...
      System::Call 'user32::GetWindowLongW(p r3, i -20) i .r2'
      IntOp $2 $2 & 0xFFFFFDFF
      System::Call 'user32::SetWindowLongW(p r3, i -20, i r2)'
      ; ... one line of its font high (tmHeight, the first field of
      ; TEXTMETRICW, 60 bytes) ...
      System::Call 'user32::GetDC(p r3) p .r2'
      System::Call 'gdi32::SelectObject(p r2, p R1) p .r4'
      System::Alloc 64
      Pop $9
      System::Call 'gdi32::GetTextMetricsW(p r2, p r9)'
      System::Call '*$9(i .R0)'
      System::Free $9
      System::Call 'gdi32::SelectObject(p r2, p r4)'
      System::Call 'user32::ReleaseDC(p r3, p r2)'
      ; ... 6px in from the ring's sides and centred in its height.
      ; SWP_NOZORDER|NOACTIVATE|FRAMECHANGED
      IntOp $R2 $8 - $R0
      IntOp $R2 $R2 / 2
      IntOp $R2 $R2 + $6
      IntOp $4 $5 + 6
      IntOp $2 $7 - 12
      System::Call 'user32::SetWindowPos(p r3, p 0, i r4, i R2, i r2, i R0, i 0x34)'
    ${EndIf}
    Pop $R2
    Pop $R1
    Pop $R0
    Pop $9
    Pop $8
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd

  Function .onVerifyInstDir
    Call boroDirectoryPage
  FunctionEnd
!macroend

; ---------- welcome ----------
; electron-builder's assisted installer has no welcome page of its own; this
; is the one place the sidebar picture gets a page to stand on.
!macro customWelcomePage
  !insertmacro boroDarkFunctions ""
  !insertmacro boroDirectoryFunctions

  !define MUI_WELCOMEPAGE_TITLE "$(boroWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(boroWelcomeText)"
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ---------- install mode ----------
; Always for the current user, never elevated: Borometer lives in the user
; folder (the welcome page says so, perMachine: false says so), and a page
; asking "anyone who uses this computer, or only me?" contradicted both.
; electron-builder runs this in front of its install mode page, installer
; and uninstaller alike; with the flag set that page takes the per-user
; branch and skips itself. An update over a per-user install takes the same
; branch, as it did before.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; ---------- install files ----------
; right in front of the progress page
!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW boroPage
!macroend

; ---------- finish ----------
; The same page electron-builder builds (StartApp is its function, copied as
; it stands), with our words - and the run checkbox made readable. With
; visual styles on, Windows paints a checkbox's label black whatever colour
; the page asks for, and black on --comb is not there at all. Switching the
; theme off for that one control lets SetCtlColors reach it.
!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "$(boroFinishTitle)"
  !define MUI_FINISHPAGE_TEXT "$(boroFinishText)"
  ; with the run checkbox below it, Modern UI's default text box holds
  ; three lines and cut off the second paragraph ("press Live logging");
  ; the large one moves the checkbox down and makes room
  !define MUI_FINISHPAGE_TEXT_LARGE
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "$(boroRunText)"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW boroFinishShow
  !insertmacro MUI_PAGE_FINISH

  ; after the page: MUI_PAGE_FINISH declares $mui.FinishPage.Run, and a
  ; function above it could not name the variable yet
  Function boroFinishShow
    StrCpy $0 $mui.FinishPage.Run
    System::Call 'uxtheme::SetWindowTheme(p r0, w " ", w " ")'
    SetCtlColors $0 ${MUI_TEXTCOLOR} ${MUI_BGCOLOR}
  FunctionEnd
!macroend

; ---------- uninstaller ----------
; Modern UI's welcome page, as electron-builder would insert it, in the
; app's words - what goes, what stays - and the dark functions for the
; uninstaller's other pages.
!macro customUnWelcomePage
  !insertmacro boroDarkFunctions "un."
  !define MUI_WELCOMEPAGE_TITLE "$(boroUnWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(boroUnWelcomeText)"
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

; electron-builder inserts this right before its MUI_UNPAGE_FINISH, so the
; defines land on that page: done, and where the kept files are.
!macro customUninstallPage
  !define MUI_FINISHPAGE_TITLE "$(boroUnFinishTitle)"
  !define MUI_FINISHPAGE_TEXT "$(boroUnFinishText)"
!macroend
