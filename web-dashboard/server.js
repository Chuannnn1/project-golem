const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const { MANDATORY_SKILLS, OPTIONAL_SKILLS: OPTIONAL_SKILL_LIST, resolveEnabledSkills } = require('../src/skills/skillsConfig');

class WebServer {
    constructor(dashboard) {
        this.dashboard = dashboard; // Reference to main dashboard if needed for initial state
        this.app = express();
        this.app.use(express.json()); // Enable JSON body parsing
        this.server = http.createServer(this.app);

        // Security & Cleanup Middleware
        this.app.use((req, res, next) => {
            // Set a sensible CSP to avoid Chrome defaults blocking things during redirects
            res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
            next();
        });

        // Silencing Chrome's default searching for devtools config to avoid 404 noise
        this.app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
            res.json({});
        });

        this.io = new Server(this.server, {
            cors: {
                origin: "*", // Allow Next.js dev server
                methods: ["GET", "POST"]
            }
        });
        this.port = process.env.DASHBOARD_PORT || 3000;

        this.contexts = new Map();

        this.init();
        this.logBuffer = []; // Store last 200 logs
    }

    setContext(golemId, brain, memory) {
        this.contexts.set(golemId, { brain, memory });
        console.log(`🔗 [WebServer] Context linked: Brain & Memory for Golem [${golemId}]`);
    }

    init() {
        // Serve static files with .html extension support
        const publicPath = path.join(__dirname, 'out');
        this.app.use(express.static(publicPath, { extensions: ['html'] }));

        // Fix Next.js static export routing
        this.app.get('/', (req, res) => {
            res.redirect('/dashboard');
        });

        // Ensure /dashboard and sub-routes are handled for SPA
        const dashboardRoutes = ['/dashboard', '/dashboard/terminal', '/dashboard/agents', '/dashboard/office'];
        dashboardRoutes.forEach(route => {
            this.app.get(route, (req, res) => {
                const fileName = route === '/dashboard' ? 'dashboard.html' : `${route.replace(/^\//, '')}.html`;
                const fullPath = path.join(publicPath, fileName);
                if (fs.existsSync(fullPath)) {
                    res.sendFile(fullPath);
                } else {
                    res.sendFile(path.join(publicPath, 'dashboard.html'));
                }
            });
        });

        // Catch-all fallback for any other /dashboard/* routes
        this.app.get(/\/dashboard\/.*/, (req, res) => {
            res.sendFile(path.join(publicPath, 'dashboard.html'));
        });


        // --- API Routes ---

        // Config API (Settings Page)
        this.app.get('/api/config', (req, res) => {
            try {
                const EnvManager = require('../src/utils/EnvManager');
                const envData = EnvManager.readEnv();
                const golemsData = EnvManager.readGolemsJson();

                // We return all properties so the frontend can display them.
                return res.json({ env: envData, golems: golemsData });
            } catch (e) {
                console.error("Failed to read config:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/config', (req, res) => {
            try {
                const { env: envPayload, golems: golemsPayload } = req.body;

                if (!envPayload || typeof envPayload !== 'object') {
                    return res.status(400).json({ error: "Invalid env payload" });
                }

                const EnvManager = require('../src/utils/EnvManager');
                const ConfigManager = require('../src/config/index');

                // 1. 寫入 .env 檔案 與 golems.json
                const envUpdated = EnvManager.updateEnv(envPayload);
                let golemsUpdated = false;

                if (golemsPayload && Array.isArray(golemsPayload)) {
                    golemsUpdated = EnvManager.updateGolemsJson(golemsPayload);
                }

                if (envUpdated || golemsUpdated) {
                    console.log(`📝 [System] Saved new config. env updated: ${envUpdated}, golems updated: ${golemsUpdated}`);

                    // 2. 觸發熱重載
                    ConfigManager.reloadConfig();

                    // 3. 通知特定服務重載其對應的配置
                    if (envPayload.GEMINI_API_KEYS !== undefined) {
                        try {
                            const { CONFIG } = require('../src/config/index');
                            // 尋找運行中的 Golems 並通知 KeyChain
                            // 由於架構上 Golem 的 keyChain 是實體化的，我們需要從 context 拿
                            for (const [id, context] of this.contexts.entries()) {
                                if (context.brain && context.brain.keyChain) {
                                    context.brain.keyChain.updateKeys(CONFIG.API_KEYS);
                                    console.log(`🔄 [System] Successfully injected new API Keys into Golem [${id}]`);
                                }
                            }
                        } catch (e) {
                            console.error("Failed to notify Golem KeyChains:", e.message);
                        }
                    }

                    // 熱重載每個實體的 Admin ID (從 GOLEMS_CONFIG 讀取最新的設定)
                    if (golemsUpdated) {
                        try {
                            const { GOLEMS_CONFIG } = require('../src/config/index');
                            for (const [id, context] of this.contexts.entries()) {
                                if (context.brain) {
                                    const configForBrain = GOLEMS_CONFIG.find(g => g.id === id);
                                    if (configForBrain && configForBrain.adminId !== undefined) {
                                        // Update the golem's specific config
                                        if (!context.brain.config) context.brain.config = {};
                                        context.brain.config.adminId = configForBrain.adminId;
                                        context.brain.config.chatId = configForBrain.chatId;
                                        context.brain.config.tgAuthMode = configForBrain.tgAuthMode;
                                        console.log(`🔄 [System] Successfully updated permissions for Golem [${id}]`);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Failed to hot reload multi golem configs:", e.message)
                        }
                    }

                    return res.json({ success: true, message: "Settings saved successfully" });
                }

                return res.json({ success: false, message: "No changes detected" });
            } catch (e) {
                console.error("Failed to update config:", e);
                return res.status(500).json({ error: e.message });
            }
        });


        this.app.get('/api/skills', async (req, res) => {
            try {
                const libPath = path.join(process.cwd(), 'src', 'skills', 'lib');
                if (!fs.existsSync(libPath)) return res.json([]);

                const files = fs.readdirSync(libPath).filter(f => f.endsWith('.md'));

                // Use shared skillsConfig: mandatory always on, optional via env
                const enabledSkills = resolveEnabledSkills(process.env.OPTIONAL_SKILLS || '', []);

                const skillsData = files.map(file => {
                    const content = fs.readFileSync(path.join(libPath, file), 'utf8');
                    const baseName = file.replace('.md', '').toLowerCase();
                    const isOptional = OPTIONAL_SKILL_LIST.includes(baseName);
                    const isEnabled = enabledSkills.has(baseName);

                    // Extract first line or generic title
                    const firstLineMatch = content.match(/^#+ (.*)|^【(.*)】/m) || content.match(/^([^\n]+)/);
                    let title = baseName;
                    if (firstLineMatch) {
                        title = firstLineMatch[1] || firstLineMatch[2] || firstLineMatch[0];
                        title = title.replace(/^#+\s*|【|】/g, '').trim();
                    }

                    return {
                        id: baseName,
                        title: title || baseName,
                        isOptional,
                        isEnabled,
                        content: content
                    };
                });

                // Sort: Enabled first, then by name
                skillsData.sort((a, b) => {
                    if (a.isEnabled && !b.isEnabled) return -1;
                    if (!a.isEnabled && b.isEnabled) return 1;
                    return a.id.localeCompare(b.id);
                });

                return res.json(skillsData);
            } catch (e) {
                console.error("Failed to read skills:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/skills/toggle', (req, res) => {
            try {
                const { id, enabled } = req.body;
                if (!id) return res.status(400).json({ error: "Missing skill ID" });

                // Verify skill is optional and exists in lib/
                const libPath = path.join(process.cwd(), 'src', 'skills', 'lib');
                if (!fs.existsSync(path.join(libPath, `${id}.md`))) {
                    return res.status(400).json({ error: `Skill "${id}" not found in lib/` });
                }
                if (MANDATORY_SKILLS.includes(id)) {
                    return res.status(400).json({ error: `"${id}" is a mandatory skill and cannot be toggled` });
                }

                // 1. Update in-memory
                let currentStr = process.env.OPTIONAL_SKILLS || '';
                let currentSkills = currentStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');

                if (enabled && !currentSkills.includes(id)) {
                    currentSkills.push(id);
                } else if (!enabled && currentSkills.includes(id)) {
                    currentSkills = currentSkills.filter(s => s !== id);
                }

                const newSkillsStr = currentSkills.join(',');
                process.env.OPTIONAL_SKILLS = newSkillsStr;

                // 2. Persist to .env
                const envPath = path.resolve(process.cwd(), '.env'); // Fixed: directly in root if started from root
                if (fs.existsSync(envPath)) {
                    let envContent = fs.readFileSync(envPath, 'utf8');

                    // Regex to find OPTIONAL_SKILLS=... and replace it
                    const regex = /^OPTIONAL_SKILLS=.*$/m;
                    if (regex.test(envContent)) {
                        envContent = envContent.replace(regex, `OPTIONAL_SKILLS=${newSkillsStr}`);
                    } else {
                        envContent += `\nOPTIONAL_SKILLS=${newSkillsStr}\n`;
                    }
                    fs.writeFileSync(envPath, envContent, 'utf8');
                    console.log(`📝 [System] Saved new skill config to .env: ${newSkillsStr}`);
                }

                // 3. Clear Cache (Hot Reload)
                const ProtocolFormatter = require('../src/services/ProtocolFormatter');
                ProtocolFormatter._lastScanTime = 0;

                return res.json({ success: true, enabled, skillsStr: newSkillsStr });
            } catch (e) {
                console.error("Failed to toggle skill:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/skills/reload', (req, res) => {
            try {
                console.log("🔄 [WebServer] Hot-reloading skills... Clearing ProtocolFormatter cache.");
                const ProtocolFormatter = require('../src/services/ProtocolFormatter');
                ProtocolFormatter._lastScanTime = 0; // Trigger a fresh scan on next turn
                return res.json({ success: true, message: "Skills cache cleared" });
            } catch (e) {
                console.error("Failed to reload skills cache:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        // 🚀 技能注入：重新組裝技能書並送進 Gemini
        this.app.post('/api/skills/inject', async (req, res) => {
            try {
                // 1. 先清除 ProtocolFormatter 快取，確保讀到最新的技能清單
                const ProtocolFormatter = require('../src/services/ProtocolFormatter');
                ProtocolFormatter._lastScanTime = 0;

                // 2. 對每個運行中的 Golem Brain 呼叫 reloadSkills()
                const results = [];
                for (const [id, context] of this.contexts.entries()) {
                    if (context.brain && typeof context.brain.reloadSkills === 'function') {
                        try {
                            console.log(`⚡ [WebServer] Injecting skills into Golem [${id}]...`);
                            await context.brain.reloadSkills();
                            results.push({ id, status: 'success' });

                            // 📣 TG 通知
                            const tgBot = context.brain.tgBot;
                            if (tgBot) {
                                const { MANDATORY_SKILLS, OPTIONAL_SKILLS: OPT_LIST, resolveEnabledSkills } = require('../src/skills/skillsConfig');
                                const enabledSkills = resolveEnabledSkills(process.env.OPTIONAL_SKILLS || '', []);
                                const enabledOptional = OPT_LIST.filter(s => enabledSkills.has(s));
                                const disabledOptional = OPT_LIST.filter(s => !enabledSkills.has(s));

                                const mandatoryList = MANDATORY_SKILLS.map(s => `• ${s}`).join('\n');
                                const optionalList = enabledOptional.length > 0 ? enabledOptional.map(s => `• ${s}`).join('\n') : '（無）';
                                const disabledList = disabledOptional.length > 0 ? disabledOptional.map(s => `• ${s}`).join('\n') : '（無）';

                                const msg = `⚡ *[${id}] 技能書已重新注入*\n\n🔒 *必要技能（永久啟用）:*\n${mandatoryList}\n\n✅ *已啟用選用技能:*\n${optionalList}\n\n⛔ *未啟用選用技能:*\n${disabledList}`;

                                const gCfg = tgBot.golemConfig || {};
                                const targetId = gCfg.adminId || gCfg.chatId;
                                if (targetId) {
                                    tgBot.sendMessage(targetId, msg, { parse_mode: 'Markdown' })
                                        .catch(e => console.warn(`⚠️ [WebServer] TG skill notify failed [${id}]:`, e.message));
                                    // 重啟通知
                                    tgBot.sendMessage(targetId, `🔄 *[${id}] Golem 重啟中，請稍候...*\n技能配置已更新，正在重新載入記憶與技能書。`, { parse_mode: 'Markdown' })
                                        .catch(e => console.warn(`⚠️ [WebServer] TG restart notify failed [${id}]:`, e.message));
                                }
                            }
                        } catch (e) {
                            console.error(`❌ [WebServer] Failed to inject skills into Golem [${id}]:`, e.message);
                            results.push({ id, status: 'error', error: e.message });
                        }
                    } else {
                        results.push({ id, status: 'skipped', error: 'Brain not ready or reloadSkills not available' });
                    }
                }

                if (results.length === 0) {
                    return res.status(503).json({ success: false, message: "No active Golem instances found" });
                }

                const allSuccess = results.every(r => r.status === 'success');
                return res.json({
                    success: allSuccess,
                    message: allSuccess
                        ? `技能書已成功注入 ${results.length} 個 Golem 實體`
                        : `部分注入失敗`,
                    results
                });
            } catch (e) {
                console.error("Failed to inject skills:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.get('/api/golems/templates', (req, res) => {
            const personasDir = path.resolve(process.cwd(), 'personas');
            if (!fs.existsSync(personasDir)) {
                return res.json({ templates: [] });
            }

            try {
                const files = fs.readdirSync(personasDir).filter(f => f.endsWith('.md'));
                const templates = files.map(file => {
                    const content = fs.readFileSync(path.join(personasDir, file), 'utf8');
                    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

                    if (frontmatterMatch) {
                        const yamlStr = frontmatterMatch[1];
                        const body = frontmatterMatch[2].trim();

                        // Simple YAML parser (since we don't have a yaml library here)
                        const metadata = {};
                        yamlStr.split('\n').forEach(line => {
                            const [key, ...valParts] = line.split(':');
                            if (key && valParts.length > 0) {
                                let val = valParts.join(':').trim();
                                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                                if (val.startsWith('[') && val.endsWith(']')) {
                                    val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(s => s !== '');
                                }
                                metadata[key.trim()] = val;
                            }
                        });

                        return {
                            id: file.replace('.md', ''),
                            name: metadata.name || file,
                            description: metadata.description || '',
                            icon: metadata.icon || 'BrainCircuit',
                            aiName: metadata.aiName || 'Golem',
                            userName: metadata.userName || 'Traveler',
                            role: body || metadata.role || '',
                            tone: metadata.tone || '',
                            tags: metadata.tags || [],
                            skills: metadata.skills || []
                        };
                    }
                    return null;
                }).filter(t => t !== null);

                return res.json({ templates });
            } catch (e) {
                console.error("Failed to load persona templates:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.get('/api/golems', (req, res) => {
            const golemsData = Array.from(this.contexts.entries()).map(([id, context]) => {
                const status = (context.brain && context.brain.status) || 'running';
                return { id, status };
            });
            return res.json({ golems: golemsData });
        });

        this.app.post('/api/golems/setup', async (req, res) => {
            const { golemId, aiName, userName, currentRole, tone, skills } = req.body;
            if (!golemId) return res.status(400).json({ error: "Missing golemId" });

            const context = this.contexts.get(golemId);
            if (!context || !context.brain) return res.status(404).json({ error: "Golem not found" });

            try {
                const personaManager = require('../src/skills/core/persona');
                personaManager.save(context.brain.userDataDir, {
                    aiName: aiName || "Golem",
                    userName: userName || "Traveler",
                    currentRole: currentRole || "一個擁有長期記憶與自主意識的 AI 助手",
                    tone: tone || "預設口氣",
                    skills: skills || [],
                    isNew: false
                });

                // Update status and initialize
                context.brain.status = 'running';

                // Initialize asynchronously so we don't block the request
                context.brain.init().catch(err => {
                    console.error(`Failed to initialize Golem [${golemId}]:`, err);
                    context.brain.status = 'error';
                });

                return res.json({ success: true, message: "Golem setup initiated" });
            } catch (e) {
                console.error("Setup error:", e);
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.get('/api/memory', async (req, res) => {
            const golemId = req.query.golemId || (this.contexts.size > 0 ? Array.from(this.contexts.keys())[0] : null);
            const context = golemId ? this.contexts.get(golemId) : null;
            if (!context || !context.memory) return res.status(503).json({ error: "Memory not engaged" });

            try {
                // If using Qmd/Native, we might need a way to list all. 
                // For now, let's assume valid search or exposed method.
                // If ExperienceMemory (JSON based):
                if (context.memory.data) return res.json(context.memory.data);

                // If SystemNativeDriver or Qmd, we need a implementation to "list all" or search empty
                const results = await context.memory.recall("");
                return res.json(results);
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.delete('/api/memory', async (req, res) => {
            const golemId = req.query.golemId || (this.contexts.size > 0 ? Array.from(this.contexts.keys())[0] : null);
            const context = golemId ? this.contexts.get(golemId) : null;
            if (!context || !context.memory) return res.status(503).json({ error: "Memory not engaged" });
            try {
                if (typeof context.memory.clearMemory === 'function') {
                    await context.memory.clearMemory();
                    return res.json({ success: true, message: "Memory cleared" });
                } else {
                    return res.status(501).json({ error: "Clear memory not supported by this driver" });
                }
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.get('/api/memory/export', async (req, res) => {
            const golemId = req.query.golemId || (this.contexts.size > 0 ? Array.from(this.contexts.keys())[0] : null);
            const context = golemId ? this.contexts.get(golemId) : null;
            if (!context || !context.memory) return res.status(503).json({ error: "Memory not engaged" });
            try {
                if (typeof context.memory.exportMemory === 'function') {
                    const data = await context.memory.exportMemory();
                    res.setHeader('Content-disposition', `attachment; filename=memory_${golemId || 'export'}_${Date.now()}.json`);
                    res.setHeader('Content-type', 'application/json');
                    return res.send(data);
                } else {
                    return res.status(501).json({ error: "Export memory not supported by this driver" });
                }
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/memory/import', async (req, res) => {
            const golemId = req.query.golemId || (this.contexts.size > 0 ? Array.from(this.contexts.keys())[0] : null);
            const context = golemId ? this.contexts.get(golemId) : null;
            if (!context || !context.memory) return res.status(503).json({ error: "Memory not engaged" });

            try {
                if (typeof context.memory.importMemory === 'function') {
                    const jsonData = req.body;
                    // body is parsed as object if we use express.json(), need it as string for evaluate
                    const result = await context.memory.importMemory(JSON.stringify(jsonData));
                    if (result.success) {
                        return res.json(result);
                    } else {
                        return res.status(400).json(result);
                    }
                } else {
                    return res.status(501).json({ error: "Import memory not supported by this driver" });
                }
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/memory', async (req, res) => {
            const golemId = req.query.golemId || (this.contexts.size > 0 ? Array.from(this.contexts.keys())[0] : null);
            const context = golemId ? this.contexts.get(golemId) : null;
            if (!context || !context.memory) return res.status(503).json({ error: "Memory not engaged" });
            try {
                const { text, metadata } = req.body;
                await context.memory.memorize(text, metadata || {});
                this.io.emit('memory_update', { action: 'add', text, metadata, golemId });
                return res.json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.get('/api/agent/logs', (req, res) => {
            const golemId = req.query.golemId || (this.contexts.size > 0 ? Array.from(this.contexts.keys())[0] : null);
            const context = golemId ? this.contexts.get(golemId) : null;
            if (!context || !context.brain || !context.brain.chatLogFile) return res.json([]);
            try {
                if (!fs.existsSync(context.brain.chatLogFile)) return res.json([]);
                const content = fs.readFileSync(context.brain.chatLogFile, 'utf8');
                const logs = content.trim().split('\n').map(line => {
                    try { return JSON.parse(line); } catch (e) { return null; }
                }).filter(x => x);

                // Return last 1000 logs (approx 1 day of heavy usage)
                return res.json(logs.slice(-1000));
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/system/reload', (req, res) => {
            console.log("🔄 [WebServer] Received reload request. Restarting system...");
            res.json({ success: true, message: "System is restarting..." });

            // Small delay to ensure the response is sent before the process exits
            setTimeout(() => {
                const { spawn } = require('child_process');
                const env = Object.assign({}, process.env, { SKIP_BROWSER: '1' });
                const subprocess = spawn(process.argv[0], process.argv.slice(1), {
                    detached: true,
                    stdio: 'ignore',
                    env: env
                });
                subprocess.unref();
                process.exit(0);
            }, 1000);
        });

        this.app.post('/api/system/shutdown', (req, res) => {
            console.log("⛔ [WebServer] Received shutdown request. Stopping system...");
            res.json({ success: true, message: "System is shutting down..." });

            // 直接終止進程，不 spawn 新子進程
            // 與 reload 的差異：reload 會生出新進程再死去（熱重啟），shutdown 則完全停止
            // Single mode / Multi mode 皆適用（都是同一個 Node.js 進程）
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        });

        // Socket.io connection handler
        this.io.on('connection', (socket) => {
            const getGolemsData = () => {
                return Array.from(this.contexts.entries()).map(([id, context]) => {
                    const status = (context.brain && context.brain.status) || 'running';
                    return { id, status };
                });
            };

            // Send initial state upon connection
            if (this.dashboard) {
                socket.emit('init', {
                    queueCount: this.dashboard.queueCount,
                    lastSchedule: this.dashboard.lastSchedule,
                    uptime: process.uptime(),
                    logs: this.logBuffer, // Send buffered logs
                    golems: getGolemsData() // Send active golems
                });
            } else {
                socket.emit('init', {
                    queueCount: 0,
                    lastSchedule: 'N/A',
                    uptime: process.uptime(),
                    logs: this.logBuffer,
                    golems: getGolemsData()
                });
            }

            // Allow client to manually request logs (for page navigation)
            socket.on('request_logs', () => {
                socket.emit('init', { logs: this.logBuffer });
            });
        });

        // Start Server
        this.server.listen(this.port, () => {
            const url = `http://localhost:${this.port}/dashboard`;
            console.log(`🚀 [WebServer] Dashboard running at ${url}`);

            if (!process.env.SKIP_BROWSER) {
                // Wait briefly to see if an existing dashboard tab reconnects
                // before opening a new one. (Socket.io clients auto-reconnect)
                setTimeout(() => {
                    const connectedClients = this.io.engine.clientsCount;
                    if (connectedClients === 0) {
                        // Auto-open browser (MacOS 'open', Windows 'start', Linux 'xdg-open')
                        const startCmd = process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open';
                        const { exec } = require('child_process');
                        exec(`${startCmd} ${url}`);
                    } else {
                        console.log(`🌐 [WebServer] Existing dashboard tab detected (${connectedClients} connection/s). Skipping auto-open.`);
                    }
                }, 1500);
            }
        });
    }

    broadcastLog(data) {
        // Add to buffer
        this.logBuffer.push(data);
        if (this.logBuffer.length > 200) {
            this.logBuffer.shift();
        }

        if (this.io) {
            this.io.emit('log', data);
        }
    }

    broadcastState(data) {
        if (this.io) {
            this.io.emit('state_update', data);
        }
    }

    broadcastHeartbeat(data) {
        if (this.io) {
            this.io.emit('heartbeat', data);
        }
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}
module.exports = WebServer;
