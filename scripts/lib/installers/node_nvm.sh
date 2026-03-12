#!/bin/bash

# ─── NVM & Node.js Installer ───

install_nvm_node() {
    ui_info "正在嘗試自動安裝 NVM (Node Version Manager)..."
    
    # 執行 NVM 安裝腳本
    if ! curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash; then
        ui_error "NVM 安裝腳本執行失敗。"
        return 1
    fi

    # 嘗試為當前 Session 載入 NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    if ! command -v nvm &>/dev/null; then
        ui_error "無法載入 NVM，請嘗試重啟終端機後再次執行。"
        return 1
    fi

    ui_success "NVM 安裝成功！正在安裝 Node.js LTS 版本..."
    if nvm install --lts && nvm use --lts; then
        ui_success "Node.js $(node -v) 安裝完成！"
        return 0
    else
        ui_error "Node.js 安裝失敗。"
        return 1
    fi
}
