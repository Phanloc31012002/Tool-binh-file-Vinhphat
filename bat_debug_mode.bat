@echo off
chcp 65001 >nul
title Bat PlayerDebugMode cho CEP
echo.
echo Dang bat PlayerDebugMode (cho phep chay extension chua ky)...
echo.

REM Bat cho nhieu phien ban CSXS (Illustrator 2024-2026)
reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1

echo Xong! Da bat PlayerDebugMode cho CSXS.9 -> CSXS.12
echo.
echo Chi can chay file nay 1 LAN duy nhat.
echo Sau do dung install.bat de cai panel.
echo.
pause
