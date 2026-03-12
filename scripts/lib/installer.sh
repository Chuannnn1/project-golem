#!/bin/bash

# ─── Step 1: File Integrity ───
step_check_files() {
    echo -e "  🔍 檢查核心檔案完整性..."
    log "Checking core files"

    local missing=0
    local checked=0
    local files=(index.js skills.js package.json dashboard.js memory.html)

    for file in "${files[@]}"; do
        checked=$((checked + 1))
        if [ ! -f "$SCRIPT_DIR/$file" ]; then
            echo -e "    ${RED}✖${NC} 缺失: ${BOLD}$file${NC}"
            missing=1
            log "MISSING: $file"
        else
            echo -e "    ${GREEN}✔${NC} $file"
        fi
    done

    if [ $missing -eq 1 ]; then
        echo ""
        echo -e "  ${RED}${BOLD}❌ 嚴重錯誤：核心檔案不完整！${NC}"
        echo -e "  ${RED}   請確認已正確解壓縮 V9.0 zip 檔到此目錄。${NC}"
        echo -e "  ${DIM}   目前目錄: $SCRIPT_DIR${NC}"
        log "FATAL: Core files missing"
        exit 1
    fi
    echo -e "  ${GREEN}  ✅ 檔案完整性檢查通過 (${checked}/${#files[@]})${NC}"
    echo ""
}

# ─── Step 2: Env Check ───
step_check_env() {
    echo -e "  📄 檢查環境設定檔..."
    log "Checking .env"

    if [ ! -f "$DOT_ENV_PATH" ]; then
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$DOT_ENV_PATH"
            echo -e "    ${YELLOW}ℹ${NC}  已從範本 ${BOLD}.env.example${NC} 建立 ${BOLD}.env${NC}"
            log "Created .env from example"
        else
            echo -e "    ${YELLOW}ℹ${NC}  找不到 .env.example，將建立基本 .env 檔案"
            cat > "$DOT_ENV_PATH" << 'ENVEOF'
TG_AUTH_MODE=ADMIN
# Golem Setup will be handled via Web Dashboard
DASHBOARD_PORT=3000
ENABLE_WEB_DASHBOARD=true
ENVEOF
            echo -e "    ${GREEN}✔${NC}  已建立基本 .env 設定檔"
            log "Created basic .env"
        fi
    else
        echo -e "    ${GREEN}✔${NC}  .env 檔案已存在"
    fi
    echo ""
}

# ─── Step 3: Config Wizard (simplified — Bot configs now in Web Dashboard) ───
config_wizard() {
    # 自動啟用 Web Dashboard，不顯示任何資訊
    update_env "ENABLE_WEB_DASHBOARD" "true"
    ENABLE_WEB_DASHBOARD="true"
}

# ─── Step 3.5: Golems Config Wizard (已遷移至 Web Dashboard) ───
golems_wizard() {
    echo ""
    box_top
    box_line_colored "  ${BOLD}${CYAN}🌐 Golem 多機配置 → 已遷移至 Web Dashboard${NC}"
    box_sep
    box_line_colored "  ${DIM}現在可直接透過 Web Dashboard 新增並管理 Golem 實體：${NC}"
    box_line_colored ""
    box_line_colored "  ${GREEN}1.${NC} 啟動系統:  ${BOLD}./setup.sh --start${NC}"
    box_line_colored "  ${GREEN}2.${NC} 開啟瀏覽器: ${BOLD}http://localhost:${DASHBOARD_PORT:-3000}${NC}"
    box_line_colored "  ${GREEN}3.${NC} 點擊「新增 Golem」填入 Token 即可啟動"
    box_line_colored ""
    box_line_colored "  ${DIM}golems.json 仍可手動編輯，格式不變。${NC}"
    box_bottom
    echo ""
    read -r -p "  按 Enter 返回主選單..."
}



step_install_core() {
    echo -e "  📦 安裝核心依賴..."
    echo -e "  ${DIM}  (puppeteer, blessed, gemini-ai, discord.js ...)${NC}"
    log "Installing core dependencies"
    
    local arch=$(uname -m)
    local os=$(os_detect)
    local npm_flags="--no-fund --no-audit"
    
    # ─── 架構優化 (ARM64 / Apple Silicon) ───
    if [[ "$arch" == "arm64" ]] || [[ "$arch" == "aarch64" ]]; then
        ui_info "偵測到 ARM64 架構 (${arch})，正在調整安裝策略..."
        if [[ "$os" == "linux" ]] || [[ "$os" == "wsl" ]]; then
            # Linux ARM64 上的 Puppeteer 預設下載 amd64 Chromium 會失敗
            ui_warn "Linux ARM64 環境建議使用系統 Chromium 以確保相容性。"
            echo -e "  ${DIM}提示: sudo apt install chromium-browser -y${NC}"
            export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
        fi
    fi

    if ! run_quiet_step "npm install 安裝中" npm install $npm_flags; then
        echo -e "  ${YELLOW}💡 可能原因:${NC}"
        echo -e "     • 網路連線問題 → 請確認網路是否正常"
        echo -e "     • Node.js 版本不符 → 需要 v20+ (目前: $(node -v 2>/dev/null || echo N/A))"
        echo -e "     • 權限問題 → 嘗試 ${BOLD}sudo npm install${NC}"
        if [[ "$arch" == "arm64" ]]; then
            echo -e "     • ${CYAN}ARM64 相容性${NC} → 嘗試安裝系統級編譯工具 (build-essential/python3)"
        fi
        echo -e "  ${DIM}  詳細日誌: $LOG_FILE${NC}"
        log "FATAL: npm install failed"
        exit 1
    fi

    # 確保 TUI 套件存在
    if [ ! -d "$SCRIPT_DIR/node_modules/blessed" ]; then
        ui_info "補安裝 blessed 介面庫..."
        run_quiet_step "安裝 blessed 套件" npm install blessed blessed-contrib express $npm_flags
    fi
    ui_success "核心依賴安裝完成\n"
}

step_install_dashboard() {
    echo -e "  🌐 設定 Web Dashboard..."
    log "Setting up dashboard"
    [ -f "$DOT_ENV_PATH" ] && source "$DOT_ENV_PATH" 2>/dev/null
    if [ "$ENABLE_WEB_DASHBOARD" != "true" ]; then
        echo -e "    ${DIM}⏩ Dashboard 已停用，跳過安裝${NC}\n"; return
    fi
    if [ ! -d "$SCRIPT_DIR/web-dashboard" ]; then
        ui_warn "找不到 web-dashboard 目錄，自動停用 Dashboard"
        update_env "ENABLE_WEB_DASHBOARD" "false"
        echo ""
        return
    fi

    echo -e "    ${CYAN}偵測到 Dashboard 模組，開始安裝...${NC}"

    pushd "$SCRIPT_DIR/web-dashboard" > /dev/null
    
    if ! run_quiet_step "安裝 Dashboard 依賴" npm install --no-fund --no-audit; then
        ui_error "Dashboard 依賴安裝失敗"
        update_env "ENABLE_WEB_DASHBOARD" "false"
        log "Dashboard deps install failed"
        popd > /dev/null
        echo ""
        return
    fi

    if ! run_quiet_step "建置 Dashboard (Next.js Build)" npm run build; then
        ui_error "Dashboard 建置失敗"
        update_env "ENABLE_WEB_DASHBOARD" "false"
        log "Dashboard build failed"
    else
        ui_success "Dashboard 建置完成"
        update_env "ENABLE_WEB_DASHBOARD" "true"
        log "Dashboard build succeeded"
    fi
    
    popd > /dev/null
    echo ""
}

# ─── Clean Init ───
run_clean_init() {
    echo ""
    box_top
    box_line_colored "  ${BOLD}${RED}⚠️  警告：這將會刪除所有本地資料！${NC}                      "
    box_line_colored "  ${DIM}即將刪除：node_modules、記憶資料、logs 等目錄${NC}        "
    box_bottom
    echo ""
    if ! confirm_action "確定要執行完全初始化嗎？"; then
        echo -e "  ${DIM}已取消初始化。${NC}\n"
        sleep 1
        return
    fi

    # ✅ 優先停止系統服務再刪除資源
    stop_system false

    echo -e "  ${CYAN}🧹 正在清理系統資料...${NC}"
    log "Running clean init - stopping system and deleting directories"
    
    # 刪除各項目錄
    rm -rf "$SCRIPT_DIR/node_modules" "$SCRIPT_DIR/package-lock.json"
    echo -e "    ${GREEN}✔${NC} 刪除主程式依賴 (node_modules)"
    
    if [ -d "$SCRIPT_DIR/web-dashboard" ]; then
        rm -rf "$SCRIPT_DIR/web-dashboard/node_modules" "$SCRIPT_DIR/web-dashboard/package-lock.json" "$SCRIPT_DIR/web-dashboard/.next" "$SCRIPT_DIR/web-dashboard/out"
        echo -e "    ${GREEN}✔${NC} 刪除 Dashboard 依賴與建置快取"
    fi
    
    local mem_dir="${USER_DATA_DIR:-./golem_memory}"
    # Resolving if it's relative
    if [[ "$mem_dir" == ./* ]]; then
        mem_dir="$SCRIPT_DIR/${mem_dir#./}"
    elif [[ "$mem_dir" != /* ]]; then
        mem_dir="$SCRIPT_DIR/$mem_dir"
    fi
    rm -rf "$mem_dir"
    echo -e "    ${GREEN}✔${NC} 刪除 Golem 記憶資料庫"
    
    # Logs directory
    rm -rf "$SCRIPT_DIR/logs"
    echo -e "    ${GREEN}✔${NC} 刪除系統日誌 (logs)"
    
    echo -e "  ${GREEN}✅ 清理完成！請重新啟動或進行手動配置。${NC}"
    sleep 2
    
    # recreate log dir since we just deleted it
    mkdir -p "$SCRIPT_DIR/logs"
}

# ─── Full Install ───
run_full_install() {
    timer_start
    local total_steps=6
    log "Full install started"

    echo -e "  ${BOLD}${CYAN}📦 開始完整安裝流程${NC}"
    echo -e "  ${DIM}$(pick_tagline)${NC}"
    echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Step 1: Check files
    progress_bar 1 $total_steps "檢查核心檔案"
    echo ""
    step_check_files

    # Step 2: Check env
    progress_bar 2 $total_steps "檢查環境設定"
    echo ""
    step_check_env

    # Step 3: Configure .env (Gemini Keys + System Options)
    progress_bar 3 $total_steps "配置環境變數"
    echo ""
    config_wizard

    # Step 4: Install core deps
    progress_bar 4 $total_steps "安裝核心依賴"
    echo ""
    step_install_core

    # Step 5: Install dashboard
    progress_bar 5 $total_steps "安裝 Dashboard"
    echo ""
    step_install_dashboard

    # Step 6: Health check + Done
    progress_bar 6 $total_steps "健康檢查 & 完成"
    echo ""
    check_status
    run_health_check

    local elapsed; elapsed=$(timer_elapsed)
    log "Full install completed in $elapsed"
    step_final "$elapsed"
}


step_final() {
    local elapsed="${1:-}"
    clear; echo ""
    box_top
    box_line_colored "  ${GREEN}${BOLD}🎉 部署成功！${NC}"
    box_line_colored "  ${GREEN}${BOLD}   Golem v${GOLEM_VERSION} (Titan Chronos) 已就緒${NC}"
    box_sep
    [ -n "$elapsed" ] && box_line_colored "  ⏱️  安裝耗時: ${CYAN}${elapsed}${NC}"
    box_line_colored "  📋 安裝日誌: ${DIM}${LOG_FILE}${NC}"
    box_bottom
    echo -e "\n  ${YELLOW}系統將在 5 秒後自動啟動... (按 Ctrl+C 取消)${NC}\n"

        # Animated countdown
    local secs=5
    while [ $secs -gt 0 ]; do
        local bar_w=20
        local filled=$(( (5 - secs) * bar_w / 5 ))
        local empty=$((bar_w - filled))
        local bar=""
        for ((i = 0; i < filled; i++)); do bar+="█"; done
        for ((i = 0; i < empty; i++)); do bar+="░"; done
        printf "\r  ${CYAN}[${bar}]${NC} ⏳ ${BOLD}${secs}${NC} 秒... "
        sleep 1
        secs=$((secs - 1))
    done

    # Fill the bar completely
    printf "\r  ${GREEN}[████████████████████]${NC} 🚀 啟動中...   \n"
    echo ""
    launch_system
}
