// ============================================================
// 🛡️ Security Manager (安全審計)
// ============================================================
// ==================== [KERNEL PROTECTED START] ====================
class SecurityManager {
    constructor() {
        this.SAFE_COMMANDS = ['ls', 'dir', 'pwd', 'date', 'echo', 'cat', 'grep', 'find', 'whoami', 'tail', 'head', 'df', 'free', 'Get-ChildItem', 'Select-String', 'golem-check'];
        this.BLOCK_PATTERNS = [/rm\s+-rf\s+\//, /rd\s+\/s\s+\/q\s+[c-zC-Z]:\\$/, />\s*\/dev\/sd/, /:(){:|:&};:/, /mkfs/, /Format-Volume/, /dd\s+if=/, /chmod\s+[-]x\s+/];
    }
    assess(cmd) {
        const safeCmd = (cmd || "").trim();
        if (this.BLOCK_PATTERNS.some(regex => regex.test(safeCmd))) return { level: 'BLOCKED', reason: '毀滅性指令' };

        // ✨ [v9.1] 增強檢查：若包含串聯、管線符號 (; | && ||)、重導向 (> <) 或子殼層執行 ($() ``) 則升級為 WARNING，避免惡意指令直通
        if (/([;&|><`])|\$\(/.test(safeCmd)) {
            return { level: 'WARNING', reason: '包含管線、重導向或子系統呼叫等複雜操作，需確認' };
        }

        const baseCmd = safeCmd.split(/\s+/)[0];

        // ✨ [v9.1] 讀取使用者設定的白名單 (環境變數)
        const userWhitelist = (process.env.COMMAND_WHITELIST || "")
            .split(',')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0);

        if (this.SAFE_COMMANDS.includes(baseCmd) || userWhitelist.includes(baseCmd)) return { level: 'SAFE' };
        const dangerousOps = ['rm', 'mv', 'chmod', 'chown', 'sudo', 'su', 'reboot', 'shutdown', 'npm uninstall', 'Remove-Item', 'Stop-Computer'];
        if (dangerousOps.includes(baseCmd)) return { level: 'DANGER', reason: '高風險操作' };
        return { level: 'WARNING', reason: '需確認' };
    }
}
// ==================== [KERNEL PROTECTED END] ====================

module.exports = SecurityManager;
