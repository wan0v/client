@echo off
setlocal
set SCRIPT_DIR=%~dp0
set OUT_DIR=%SCRIPT_DIR%..\..\..\..\build\native

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo Building screen-capture.exe (MSVC)...
cl.exe /EHsc /O2 /Fe:"%OUT_DIR%\screen-capture.exe" "%SCRIPT_DIR%main.cpp" /link d3d11.lib dxgi.lib

if %ERRORLEVEL% neq 0 (
    echo Build FAILED
    exit /b 1
)
echo Built: %OUT_DIR%\screen-capture.exe
