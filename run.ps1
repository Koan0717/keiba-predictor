# ==============================================================================
# Keiba Vision AI — Windows PowerShell Launcher
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🏇 Keiba Vision AI (Apple Liquid Glass Edition)" -ForegroundColor Cyan
Write-Host "Windows PowerShell Launcher" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check Java
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Java が見つかりませんでした。" -ForegroundColor Red
    Write-Host "Java 21 (Temurin / OpenJDK) をインストールしてください: https://adoptium.net/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

$javaVer = java -version 2>&1 | Select-Object -First 1
Write-Host "[OK] Detected: $javaVer" -ForegroundColor Green

Write-Host "----------------------------------------------------------"
Write-Host "🚀 サーバーを起動します (http://localhost:8080)" -ForegroundColor Green
Write-Host "ブラウザが自動的に開きます。停止は Ctrl + C です。"
Write-Host "----------------------------------------------------------"

./gradlew.bat run --console=plain
