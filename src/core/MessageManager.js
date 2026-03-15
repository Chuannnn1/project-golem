const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ============================================================
// 📨 Message Manager (雙模版訊息切片器)
// ============================================================
class MessageManager {
    static async send(ctx, text, options = {}) {
        if (!text) return;
        const MAX_LENGTH = ctx.platform === 'telegram' ? 4000 : 1900;
        const chunks = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= MAX_LENGTH) { chunks.push(remaining); break; }
            let splitIndex = remaining.lastIndexOf('\n', MAX_LENGTH);
            if (splitIndex === -1) splitIndex = MAX_LENGTH;
            chunks.push(remaining.substring(0, splitIndex));
            remaining = remaining.substring(splitIndex).trim();
        }

        for (const chunk of chunks) {
            // ✅ [Fix] 同步廣播到 Web Dashboard
            try {
                const dashboard = require('../../dashboard');
                if (dashboard && dashboard.webServer) {
                    // 嘗試從 ctx 提取 GolemId 進行歸類，確保思考中訊息能被正確消除
                    const golemId = (ctx.instance && ctx.instance.golemConfig) ? ctx.instance.golemConfig.id : 'golem_A';
                    
                    const payload = {
                        time: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
                        msg: `[${golemId}] ${chunk}`,
                        type: 'agent',
                        golemId
                    };
                    if (options && options.reply_markup && options.reply_markup.inline_keyboard) {
                        payload.type = 'approval';
                        payload.actionData = options.reply_markup.inline_keyboard[0];
                    }
                    dashboard.webServer.broadcastLog(payload);
                }
            } catch (e) {
                // 忽略 Dashboard 未載入的錯誤
            }

            try {
                if (ctx.platform === 'telegram') {
                    await ctx.instance.sendMessage(ctx.chatId, chunk, options);
                } else if (ctx.platform === 'discord') {
                    const channel = await ctx.instance.channels.fetch(ctx.chatId);
                    const dcOptions = { content: chunk };
                    if (options.reply_markup && options.reply_markup.inline_keyboard) {
                        const row = new ActionRowBuilder();
                        options.reply_markup.inline_keyboard[0].forEach(btn => {
                            row.addComponents(new ButtonBuilder().setCustomId(btn.callback_data).setLabel(btn.text).setStyle(ButtonStyle.Primary));
                        });
                        dcOptions.components = [row];
                    }
                    await channel.send(dcOptions);
                }
            } catch (e) { console.error(`[MessageManager] 發送失敗:`, e.message); }
        }
    }
}

module.exports = MessageManager;
