class CommandHandler {
    static async execute(ctx, normalActions, controller, brain, dispatchFn) {
        if (!normalActions || normalActions.length === 0) return;

        // ✨ [v9.1] 整合行動產線：將一般任務執行丟入 ActionQueue
        // 注意：這裡假設我們從某處能取得與本回合指令對應的 actionQueue 和 convoManager
        // 為了最小侵入性，我們透過 brain 物件往上追溯，或在 Golem 架構中取得
        let actionQueue = null;
        let convoManager = null;

        try {
            const { getOrCreateGolem } = require('../../../index');
            const instance = getOrCreateGolem(controller.golemId);
            actionQueue = instance.actionQueue;
            convoManager = instance.convoManager;
        } catch (e) {
            console.warn('[CommandHandler] 無法取得雙產線系統，退回單產線模式', e.message);
        }

        const runLogic = async () => {
            let result;
            try {
                result = await controller.runSequence(ctx, normalActions);
            } catch (err) {
                console.error('[CommandHandler] runSequence 拋出例外:', err);
                await ctx.reply(`❌ **指令執行失敗**\n\`\`\`\n${err.message}\n\`\`\``, { parse_mode: 'Markdown' });
                return;
            }

            if (!result) return;

            // 1. 處理需要外部審批的情況
            if (typeof result === 'object') {
                if (result.status === 'PENDING_APPROVAL') {
                    const cmdBlock = result.cmd ? `\n\`\`\`shell\n${result.cmd}\n\`\`\`` : "";
                    await ctx.reply(
                        `⚠️ ${result.riskLevel === 'DANGER' ? '🔴 危險指令' : '🟡 警告'}${cmdBlock}\n\n${result.reason}`,
                        {
                            parse_mode: 'Markdown',
                            disable_web_page_preview: true,
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '✅ 批准', callback_data: `APPROVE_${result.approvalId}` },
                                    { text: '❌ 拒絕', callback_data: `DENY_${result.approvalId}` }
                                ]]
                            }
                        }
                    );
                    return;
                } else {
                    console.warn('[CommandHandler] 未知的 Object 回傳狀態:', result);
                    return;
                }
            }

            // 2. 處理正常的執行回報 (String Observation)
            if (typeof result === 'string') {
                const failedSteps = result
                    .split('\n\n----------------\n\n')
                    .filter(block => block.includes('[Step') && block.includes(' Failed]'));

                if (failedSteps.length > 0) {
                    const errorSummary = failedSteps.map(block => {
                        const cmdMatch = block.match(/cmd:\s*(.+)/);
                        const errMatch = block.match(/Error:\n([\s\S]+)/);
                        const cmd = cmdMatch ? cmdMatch[1].trim() : '（未知指令）';
                        const errMsg = errMatch ? errMatch[1].trim().slice(0, 300) : block.trim().slice(0, 300);
                        return `🔴 \`${cmd}\`\n\`\`\`\n${errMsg}\n\`\`\``;
                    }).join('\n\n');

                    await ctx.reply(
                        `❌ **指令執行失敗 (${failedSteps.length} 個步驟)**\n\n${errorSummary}`,
                        { parse_mode: 'Markdown' }
                    );
                }

                // 無論成功或失敗，都將完整觀察結果送給大腦分析（讓 AI 知道發生什麼事並作出回應）
                if (ctx.sendTyping) await ctx.sendTyping();
                const feedbackPrompt = `[System Observation]\n${result}\n\nPlease reply to user naturally using [GOLEM_REPLY].`;

                // ✨ [v9.1] 產線串接：將 Observation 放入對話產線
                if (convoManager) {
                    await convoManager.enqueue(ctx, feedbackPrompt, { isPriority: true, bypassDebounce: true });
                } else {
                    // Fallback 對話發送
                    const finalRes = await brain.sendMessage(feedbackPrompt);
                    await dispatchFn(ctx, finalRes, brain, controller);
                }
            }
        };

        if (actionQueue) {
            // ✨ [v9.1] 插隊系統：如果 Action Queue 正在忙碌，則攔截任務並詢問是否優先
            if (actionQueue.isProcessing || actionQueue.queue.length >= 1) {
                const { v4: uuidv4 } = require('uuid');
                const queueApprovalId = uuidv4();

                controller.pendingTasks.set(queueApprovalId, {
                    type: 'QUEUE_APPROVAL',
                    ctx,
                    runLogic,
                    timestamp: Date.now()
                });

                const msg = await ctx.reply(
                    `🚨 **產線壅塞中**\n目前系統正在執行其他行動任務 (等待佇列: \`${actionQueue.queue.length}\`)。\n\n請問是否要將此新任務 **插隊 (優先執行)**？`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '⬆️ 插隊優先', callback_data: `PRIORITY_${queueApprovalId}` },
                                { text: '⬇️ 正常排隊', callback_data: `APPEND_${queueApprovalId}` }
                            ]]
                        }
                    }
                );

                // 30 秒後自動排入隊尾
                setTimeout(async () => {
                    const task = controller.pendingTasks.get(queueApprovalId);
                    if (task && task.type === 'QUEUE_APPROVAL') {
                        controller.pendingTasks.delete(queueApprovalId);
                        console.log(`⏳ [CommandHandler] 任務 ${queueApprovalId} 等待逾時，自動正常排入隊尾。`);

                        try {
                            // 嘗試移除按鈕並更新文字
                            if (ctx.platform === 'telegram' && msg && msg.message_id) {
                                await ctx.instance.editMessageText(
                                    `🚨 **產線壅塞中**\n目前行動佇列繁忙。\n\n*(預設) 已將此任務自動排入隊尾。*`,
                                    {
                                        chat_id: ctx.chatId,
                                        message_id: msg.message_id,
                                        parse_mode: 'Markdown',
                                        reply_markup: { inline_keyboard: [] }
                                    }
                                ).catch(() => { });
                            }
                        } catch (e) {
                            console.warn("無法更新 Timeout 訊息:", e.message);
                        }

                        actionQueue.enqueue(ctx, runLogic, { isPriority: false });
                    }
                }, 30000);

            } else {
                // 如果佇列空閒，直接加入
                await actionQueue.enqueue(ctx, runLogic, { isPriority: false });
            }
        } else {
            // 退火單產線執行
            await runLogic();
        }
    }
}

module.exports = CommandHandler;