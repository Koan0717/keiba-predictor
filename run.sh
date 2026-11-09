#!/bin/sh
# ==============================================================================
# Keiba Vision — 起動スクリプト (Linux / macOS)
# Supports: Chimera Linux (musl libc), Arch Linux (glibc), Ubuntu, Fedora, etc.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "Keiba Vision"
echo "OS環境判定中..."
echo "=========================================================="

# Check Java runtime
if command -v java >/dev/null 2>&1; then
    JAVA_VER=$(java -version 2>&1 | head -n 1)
    echo "  検出された Java: $JAVA_VER"
else
    echo "[エラー] Java が見つかりませんでした。"
    echo "【Chimera Linux の場合】: apk add openjdk21-jre"
    echo "【Arch Linux の場合】   : pacman -S jre21-openjdk"
    exit 1
fi

# Detect musl libc (Chimera Linux)
if ldd /usr/bin/java 2>&1 | grep -q "musl"; then
    echo "  Chimera Linux (musl libc) 環境を検出し最適化しました。"
else
    echo "  標準 Linux (glibc / Arch Linux 等) 環境で実行します。"
fi

# Check executable permission of gradlew
if [ ! -x "./gradlew" ]; then
    chmod +x ./gradlew
fi

echo "----------------------------------------------------------"
echo "起動しています..."
echo "ブラウザで http://localhost:8080 を開きます"
echo "（停止するには Ctrl + C を押してください）"
echo "----------------------------------------------------------"

exec ./gradlew run --console=plain
