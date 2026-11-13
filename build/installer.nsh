; ---------------------------------------------------------------
; 萌萌音乐 · 安装向导完成页扩展
; electron-builder 默认已经有一个「运行 萌萌音乐」复选框，这里再加一个
; 「访问项目仓库」复选框（MUI2 的 SHOWREADME 默认就是勾选状态），
; 点「完成」时会一并打开 GitHub 仓库页面。
; 只在安装程序里生效，卸载程序不受影响。
; ---------------------------------------------------------------

!ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_SHOWREADME "https://github.com/LHX1925/mm-music-site/"
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "访问项目仓库（完成后自动打开）"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "mmOpenRepository"

  Function mmOpenRepository
    ExecShell "open" "https://github.com/LHX1925/mm-music-site/"
  FunctionEnd
!endif
