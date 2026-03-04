const fs = require('fs');
const path = require('path');

// ============================================================
// 0. 🎭 Persona Manager (人格與身份管理 - 支援多 Golem 實體)
// ============================================================

class PersonaManager {
    constructor() {
        // Fallback for global usage, though golems should use getForContext
    }

    _getPersonaPath(userDataDir) {
        if (!userDataDir) return path.join(process.cwd(), 'golem_persona.json');
        return path.join(userDataDir, 'persona.json');
    }

    _load(userDataDir) {
        const filePath = this._getPersonaPath(userDataDir);
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {
            console.error(`人格讀取失敗 (${filePath}):`, e);
        }
        return {
            aiName: "Golem",
            userName: "Traveler",
            currentRole: "一個擁有長期記憶與自主意識的 AI 助手",
            tone: "預設口氣",
            skills: [],
            isNew: true
        };
    }

    save(userDataDir, data) {
        const filePath = this._getPersonaPath(userDataDir);
        // Ensure directory exists
        if (userDataDir && !fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    setName(userDataDir, type, name) {
        const data = this._load(userDataDir);
        if (type === 'ai') data.aiName = name;
        if (type === 'user') {
            data.userName = name;
            data.isNew = false;
        }
        this.save(userDataDir, data);
        return name;
    }

    setRole(userDataDir, roleDescription) {
        const data = this._load(userDataDir);
        data.currentRole = roleDescription;
        this.save(userDataDir, data);
    }

    get(userDataDir) {
        return this._load(userDataDir);
    }

    exists(userDataDir) {
        return fs.existsSync(this._getPersonaPath(userDataDir));
    }
}

module.exports = new PersonaManager();
