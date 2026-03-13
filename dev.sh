#!/bin/bash

# ==========================================
# Project Golem - Developer Toolkit (dev.sh)
# ==========================================

readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly LIB_DIR="$SCRIPT_DIR/scripts/lib"

# Load colors and utils
[ -f "$LIB_DIR/colors.sh" ] && source "$LIB_DIR/colors.sh"
[ -f "$LIB_DIR/utils.sh" ] && source "$LIB_DIR/utils.sh"
[ -f "$LIB_DIR/ui_components.sh" ] && source "$LIB_DIR/ui_components.sh"
[ -f "$LIB_DIR/system_check.sh" ] && source "$LIB_DIR/system_check.sh"
[ -f "$LIB_DIR/installer.sh" ] && source "$LIB_DIR/installer.sh"
[ -f "$LIB_DIR/docker_manager.sh" ] && source "$LIB_DIR/docker_manager.sh"

ensure_test_env() {
    if [ ! -f "$SCRIPT_DIR/node_modules/.bin/jest" ]; then
        echo -e "${YELLOW}⚠️  偵測到測試環境不完整 (找不到 Jest)${NC}"
        local os=$(os_detect)
        echo -e "   作業系統環境: ${CYAN}${os}${NC}"
        echo ""
        if confirm_action "是否要執行一鍵安裝以修復測試環境？(npm install)"; then
            run_full_install
        else
            echo -e "   ${RED}✖ 測試已取消。請先安裝依賴項。${NC}"
            return 1
        fi
    fi
    return 0
}

show_help() {
    echo -e "${BOLD}Project Golem Developer Toolkit${NC}"
    echo "Usage: ./dev.sh [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --test        執行所有單元測試 (Jest)"
    echo "  --test-sec    僅執行安全性過濾測試"
    echo "  --build       建置 Web Dashboard (Next.js)"
    echo "  --setup       一鍵部署開發環境 (Complete Setup)"
    echo "  --doctor      執行系統診斷工具"
    echo "  --clean       清理所有 node_modules 與建置快取"
    echo "  --help, -h    顯示此說明"
    echo ""
}

show_dev_menu() {
    check_status
    clear; echo ""
    box_header_dashboard
    echo -ne "  ${BOLD}${MAGENTA}🛠  開發者工具箱 (Dev Toolkit)${NC} ${DIM}• 核心版本: ${NC}${CYAN}v${GOLEM_VERSION}${NC}"
    echo ""
    echo ""
    
    local options=(
        "Test|🧪 執行全系統單元測試 (Run All Tests)"
        "TestSec|🛡️  僅執行安全性過濾測試 (Security Scan Only)"
        "Build|🏗️  建置 Web Dashboard (Next.js Build)"
        "Setup|⚙️  一鍵部署開發環境 (Complete Setup)"
        "Doctor|🏥 執行系統深度診斷 (Run Doctor)"
        "Clean|🧹 執行深度清理 (Deep Clean - node_modules)"
        "Quit|🚪 退出介面 (Exit)"
    )

    prompt_singleselect "請選擇開發操作：" "${options[@]}"
    local choice="$SINGLESELECT_RESULT"

    case "$choice" in
        "Test")    
            if ensure_test_env; then
                echo -e "${CYAN}🧪 執行測試中...${NC}"; npm test
            fi
            echo ""; read -r -p "  按 Enter 返回選單..."; show_dev_menu ;;
        "TestSec") 
            if ensure_test_env; then
                echo -e "${CYAN}🛡️  安全性掃描中...${NC}"; npm run test:security
            fi
            echo ""; read -r -p "  按 Enter 返回選單..."; show_dev_menu ;;
        "Build")   echo -e "${CYAN}🏗️  建置 Dashboard 中...${NC}"; npm run build; echo ""; read -r -p "  按 Enter 返回選單..."; show_dev_menu ;;
        "Setup")   run_full_install; echo ""; read -r -p "  按 Enter 返回選單..."; show_dev_menu ;;
        "Doctor")  npm run doctor; echo ""; read -r -p "  按 Enter 返回選單..."; show_dev_menu ;;
        "Clean")
            if confirm_action "確定要進行深度清理嗎？這將刪除所有依賴包。"; then
                echo -e "${YELLOW}🧹 執行中...${NC}"
                rm -rf node_modules package-lock.json
                rm -rf web-dashboard/node_modules web-dashboard/.next web-dashboard/out
                echo -e "${GREEN}✅ 清理完成。${NC}"
            fi
            sleep 1; show_dev_menu ;;
        "Quit")    echo -e "  ${GREEN}👋 關閉開發模式，再見！${NC}"; exit 0 ;;
        *)         show_dev_menu ;;
    esac
}

case "${1:-}" in
    --test)
        if ensure_test_env; then
            echo -e "${CYAN}🧪 正在執行全系統單元測試...${NC}"
            npm test
        fi ;;
    --test-sec)
        if ensure_test_env; then
            echo -e "${CYAN}🛡️  正在執行安全性巡檢測試...${NC}"
            npm run test:security
        fi ;;
    --build)
        echo -e "${CYAN}🏗️  正在建置 Web Dashboard...${NC}"
        npm run build ;;
    --setup)
        run_full_install ;;
    --doctor)
        npm run doctor ;;
    --clean)
        echo -e "${YELLOW}🧹 執行深度清理...${NC}"
        rm -rf node_modules package-lock.json
        rm -rf web-dashboard/node_modules web-dashboard/.next web-dashboard/out
        echo -e "${GREEN}✅ 清理完成。${NC}" ;;
    --help|-h)
        show_help ;;
    "")
        show_dev_menu ;;
    *)
        echo -e "${RED}錯誤: 未知的選項 $1${NC}"
        show_help
        exit 1 ;;
esac
