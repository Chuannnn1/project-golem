#!/bin/bash

# 這是專為 macOS/Linux 設計的雙擊啟動捷徑 (Mac 使用者可直接雙擊此 .command 檔)
cd "$(dirname "$0")"

if [ ! -f "./setup.sh" ]; then
    echo "❌ 找不到 setup.sh，請確認檔案解壓縮完整且您在正確的目錄下執行。"
    sleep 3
    exit 1
fi

chmod +x ./setup.sh

# 啟動魔法模式，確保後續操作無痛且自動排除 Port 佔用
export GOLEM_MAGIC_MODE=true

if [ ! -f ".env" ] || [ ! -d "node_modules" ]; then
    echo "✨ 偵測到環境未完全建立，即將啟動 Project Golem 全自動部署助手..."
    ./setup.sh --magic
else
    # 已經安裝過，直接略過選單啟動系統
    echo "🚀 正在快速啟動 Project Golem..."
    ./setup.sh --start
fi
