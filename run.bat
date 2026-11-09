@echo off
chcp 65001 >nul
title Keiba Vision

echo ==========================================================
echo Keiba Vision
echo ==========================================================

where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Java が見つかりませんでした。
    echo Oracle OpenJDK または Eclipse Temurin (Java 17/21) をインストールしてください。
    echo https://adoptium.net/
    pause
    exit /b 1
)

echo [OK] Java runtime detected.
echo [INFO] Starting Keiba Vision...
echo [INFO] Opening http://localhost:8080 in your default browser...
echo.

if exist "gradlew.bat" (
    call gradlew.bat run --console=plain
) else (
    echo [ERROR] gradlew.bat が見つかりません。
    pause
)
