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

        // --- 全自動執行的開關 (最高層級) ---
        if (process.env.GOLEM_AUTO_APPROVE_ALL === 'true') {
            return { level: 'SAFE' };
        }

        // 依然阻擋重導向 (> <) 與子殼層 ($() ``) 因為過於複雜且具破壞性
        if (/([><`])|\$\(/.test(safeCmd)) {
            return { level: 'WARNING', reason: '包含重導向或子系統呼叫等複雜操作，需確認' };
        }

        // ✨ [v9.1] 讀取使用者設定的白名單 (環境變數)
        const userWhitelist = (process.env.COMMAND_WHITELIST || "")
            .split(',')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0);

        const dangerousOps = ['rm', 'mv', 'chmod', 'chown', 'sudo', 'su', 'reboot', 'shutdown', 'npm uninstall', 'Remove-Item', 'Stop-Computer'];

        // 處理解析複合指令 (&&, ||, ;, |)
        if (/([;&|])/.test(safeCmd)) {
            // 用正規表達式將指令以 &&, ||, ;, | 切割
            const subCmds = safeCmd.split(/[;&|]+/).map(c => c.trim()).filter(c => c.length > 0);

            let allSafe = true;
            for (const sub of subCmds) {
                const subBaseCmd = sub.split(/\s+/)[0];

                // 在毀滅清單/高危險操作
                if (dangerousOps.includes(subBaseCmd)) return { level: 'DANGER', reason: '高風險操作' };

                // 檢查是否所有小指令都在白名單中
                if (!userWhitelist.includes(subBaseCmd)) {
                    allSafe = false;
                    break;
                }
            }

            if (allSafe) return { level: 'SAFE' };
            return { level: 'WARNING', reason: '複合指令中包含非信任授權的指令，需確認' };
        }

        const baseCmd = safeCmd.split(/\s+/)[0];
        const trustSystem = process.env.GOLEM_TRUST_SYSTEM_COMMANDS === 'true';

        // 1. Check user-defined whitelist
        if (userWhitelist.includes(baseCmd)) return { level: 'SAFE' };

        // 2. Check system safety library (only if enabled)
        if (trustSystem && this.SAFE_COMMANDS.includes(baseCmd)) return { level: 'SAFE' };

        // 這些危險指令會直接進 DANGER
        if (dangerousOps.includes(baseCmd)) return { level: 'DANGER', reason: '高風險操作' };

        return { level: 'WARNING', reason: '需確認' };
    }
}
// ==================== [KERNEL PROTECTED END] ====================

module.exports = SecurityManager;
