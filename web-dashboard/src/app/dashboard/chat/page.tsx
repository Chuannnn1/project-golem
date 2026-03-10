"use client";

import React, { useState, useEffect, useRef } from "react";
import { useGolem } from "@/components/GolemContext";
import { socket } from "@/lib/socket";
import { User, Bot, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Typewriter } from "@/components/Typewriter";

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    isSystem: boolean;
    actionData?: any;
    isHistory?: boolean;
    isThinking?: boolean;
}

export default function DirectChatPage() {
    const { activeGolem, isSingleNode } = useGolem();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [completedTypingMsgs, setCompletedTypingMsgs] = useState<Set<string>>(new Set());
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // We can optionally fetch logs history here later if needed
        // For now let's just listen to live socket events.

        socket.on("log", (data: any) => {
            const isThinkingMessage = data.type === 'thinking';

            if (isThinkingMessage || data.type === 'agent' || data.type === 'approval' || data.msg.includes('[MultiAgent]') || data.msg.includes('[User]')) {
                let rawMsg = data.msg;

                if (rawMsg.startsWith('[MultiAgent]')) {
                    rawMsg = rawMsg.replace('[MultiAgent]', '').trim();
                }

                let sender = "System";
                let content = rawMsg;
                let isSystem = true;

                const match = rawMsg.match(/\[(.*?)\]\s*([\s\S]*)/);
                if (match) {
                    sender = match[1];
                    content = match[2] || " ";
                    isSystem = !(sender === 'User' || sender === 'WebUser');
                }

                setMessages((prev) => {
                    // ── [v9.1.10] 思考中訊息管理 ──
                    // 如果新的資料是正式回覆，則先移除該 Golem 舊有的「思考中」訊息
                    let filtered = prev;
                    if (!isThinkingMessage && (sender !== 'User' && sender !== 'WebUser')) {
                        filtered = prev.filter(m => !(m.isThinking && m.sender === sender));
                    }

                    return [...filtered.slice(-1000), {
                        id: isThinkingMessage ? `thinking-${sender}-${Date.now()}` : (Date.now().toString() + Math.random()),
                        sender,
                        content,
                        timestamp: data.time || new Date().toLocaleTimeString(),
                        isSystem,
                        actionData: data.actionData,
                        isThinking: isThinkingMessage
                    }];
                });
            }
        });

        return () => {
            socket.off("log");
        };
    }, []);

    // ── [v9.1.9] Fetch Chat History on mount or active Golem change ──
    useEffect(() => {
        if (!activeGolem) return;

        let isMounted = true;
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/chat/history?golemId=${activeGolem}`);
                const data = await res.json();
                if (data.success && data.history && isMounted) {
                    const parsedHistory = data.history.map((h: any) => {
                        let rawMsg = h.msg;
                        if (rawMsg.startsWith('[MultiAgent]')) rawMsg = rawMsg.replace('[MultiAgent]', '').trim();
                        let sender = "System";
                        let content = rawMsg;
                        const match = rawMsg.match(/\[(.*?)\]\s*([\s\S]*)/);
                        if (match) {
                            sender = match[1];
                            content = match[2] || " ";
                        }
                        return {
                            id: h.time + Math.random().toString(),
                            sender,
                            content,
                            timestamp: h.time,
                            isSystem: !(sender === 'User' || sender === 'WebUser'),
                            actionData: h.actionData,
                            isHistory: true
                        };
                    });

                    setMessages(parsedHistory);
                    setCompletedTypingMsgs(new Set(parsedHistory.map((m: any) => m.id)));
                }
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            }
        };
        fetchHistory();

        return () => { isMounted = false; };
    }, [activeGolem]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleTypingComplete = (id: string) => {
        setCompletedTypingMsgs((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    // Calculate which messages are allowed to type/show
    const isMessageRendered = (index: number) => {
        // A message is rendered if it's the first message, OR 
        // if user message, it's always rendered immediately,
        // if system message, it renders if the previous message has finished typing.
        for (let i = 0; i < index; i++) {
            const prevMsg = messages[i];
            if (prevMsg.isSystem && !completedTypingMsgs.has(prevMsg.id)) {
                return false; // A previous system message is still typing
            }
        }
        return true;
    };

    const handleAction = async (callbackData: string) => {
        if (!activeGolem) return;
        setIsSending(true);
        try {
            await fetch('/api/chat/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ golemId: activeGolem, callback_data: callbackData })
            });
        } catch (e) {
            console.error("Failed to send action:", e);
        } finally {
            setIsSending(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !activeGolem) return;

        const val = input.trim();
        setInput("");
        setIsSending(true);

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ golemId: activeGolem, message: val })
            });
        } catch (e) {
            console.error("Failed to send message:", e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 p-6 max-h-screen">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                        直接交談 (Direct Chat)
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        與目前活躍的 Golem ({activeGolem || "未選擇"}) 進行對話測試。不須透過外部通訊軟體。
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-gray-950 rounded-xl border border-gray-800">
                {/* Chat window */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-600 italic">
                            請在下方輸入訊息開始交談...
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            if (!isMessageRendered(index)) return null;

                            const isUser = msg.sender === 'User' || msg.sender === 'WebUser';
                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex flex-col max-w-[80%]",
                                        msg.isSystem ? "mr-auto items-start text-left" : isUser ? "ml-auto items-end" : "mr-auto"
                                    )}
                                >
                                    {(msg.sender !== 'System' || msg.isThinking) && (
                                        <div className={cn("flex items-center space-x-2 mb-1", isUser && "flex-row-reverse space-x-reverse")}>
                                            <div className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center border flex-shrink-0",
                                                isUser ? "bg-blue-900 border-blue-700" : "bg-cyan-900 border-cyan-700"
                                            )}>
                                                {isUser ? <User className="w-3 h-3 text-blue-300" /> : <Bot className="w-3 h-3 text-cyan-300" />}
                                            </div>
                                            <span className={cn("text-xs font-bold", isUser ? "text-blue-400" : "text-cyan-400")}>{msg.sender}</span>
                                            <span className="text-[10px] text-gray-600">{msg.timestamp}</span>
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            "p-3 rounded-2xl text-sm whitespace-pre-wrap break-words inline-block shadow-sm transition-all duration-200",
                                            msg.isThinking
                                                ? "animate-pulse bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50 text-gray-500 italic backdrop-blur-sm" :
                                                msg.isSystem
                                                    ? "bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-tl-none text-gray-300 shadow-indigo-500/5"
                                                    : isUser
                                                        ? "bg-gradient-to-br from-blue-600/20 to-indigo-600/20 text-blue-100 border border-blue-500/30 rounded-tr-none shadow-blue-500/10"
                                                        : "bg-gradient-to-br from-cyan-600/20 to-teal-600/20 text-cyan-100 border border-cyan-500/30 rounded-tl-none shadow-cyan-500/10"
                                        )}
                                    >
                                        {msg.isThinking ? "思考中..." : (msg.isSystem && !msg.isHistory ?
                                            <Typewriter content={msg.content.replace(/\n{2,}/g, '\n\n').trim()} onComplete={() => handleTypingComplete(msg.id)} />
                                            : msg.content.replace(/\n{2,}/g, '\n\n').trim())}
                                    </div>
                                    {msg.actionData && Array.isArray(msg.actionData) && (!msg.isSystem || msg.isHistory || completedTypingMsgs.has(msg.id)) && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {msg.actionData.map((btn: any, idx: number) => {
                                                const isApprove = btn.text.includes('批准') || btn.text.includes('Approve');
                                                const isDeny = btn.text.includes('拒絕') || btn.text.includes('Reject') || btn.text.includes('Deny');

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleAction(btn.callback_data)}
                                                        className={cn(
                                                            "px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border flex items-center gap-2 transform active:scale-95 shadow-lg",
                                                            isApprove
                                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                                                : isDeny
                                                                    ? "bg-rose-500/10 border-rose-500/50 text-rose-400 hover:bg-rose-500 hover:text-white"
                                                                    : "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                                                        )}
                                                    >
                                                        {btn.text}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Input area */}
                <div className="p-3 border-t border-gray-800 bg-gray-900/50">
                    <div className="relative flex items-center">
                        <textarea
                            className="flex-1 max-h-32 min-h-[44px] bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 pr-12 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 resize-none transition-all"
                            placeholder={activeGolem ? `傳送訊息給 ${activeGolem}...` : "請先選擇一個 Golem..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={!activeGolem || isSending}
                            rows={1}
                            style={{ height: "auto" }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!activeGolem || !input.trim() || isSending}
                            className={cn(
                                "absolute right-2 p-2 rounded-md transition-all flex items-center justify-center",
                                (!activeGolem || !input.trim() || isSending)
                                    ? "text-gray-600 bg-transparent"
                                    : "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
                            )}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
