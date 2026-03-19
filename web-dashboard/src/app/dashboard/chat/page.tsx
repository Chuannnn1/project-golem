"use client";

import React, { useState, useEffect, useRef, useCallback, DragEvent, ClipboardEvent } from "react";
import { useGolem } from "@/components/GolemContext";
import { socket } from "@/lib/socket";
import { User, Bot, Send, X, FileText, Paperclip, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Typewriter } from "@/components/Typewriter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    isSystem: boolean;
    actionData?: any;
    isHistory?: boolean;
    isThinking?: boolean;
    attachments?: {
        url: string;
        mimeType: string;
        name?: string;
    }[];
}

export default function DirectChatPage() {
    const { activeGolem, isSingleNode } = useGolem();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [completedTypingMsgs, setCompletedTypingMsgs] = useState<Set<string>>(new Set());
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{ name: string, base64: string, type: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    useEffect(() => {
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
                        isThinking: isThinkingMessage,
                        // 同時相容後端廣播的 attachments[]（複數）和舊版的 attachment（單數）
                        attachments: data.attachments
                            ? data.attachments
                            : (data.attachment ? [data.attachment] : undefined)
                    }];
                });
            }
        });

        return () => {
            socket.off("log");
        };
    }, []);

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
                            isHistory: true,
                            attachments: h.attachments
                                ? h.attachments
                                : (h.attachment ? [h.attachment] : undefined)
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

    const isMessageRendered = (index: number) => {
        for (let i = 0; i < index; i++) {
            const prevMsg = messages[i];
            if (prevMsg.isSystem && !completedTypingMsgs.has(prevMsg.id)) {
                return false;
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

    const attachFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            setSelectedFile({
                name: file.name,
                base64: (event.target?.result as string).split(',')[1],
                type: file.type || 'application/octet-stream'
            });
        };
        reader.readAsDataURL(file);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        attachFile(file);
        // Reset input value to allow selecting same file again
        e.target.value = '';
    };

    // ── Drag & Drop Handlers ──────────────────────────────────────────────────
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;
        const file = e.dataTransfer.files?.[0];
        if (file) attachFile(file);
    };

    // ── Clipboard Paste Handler ───────────────────────────────────────────────
    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    attachFile(file);
                    return;
                }
            }
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || !activeGolem) return;

        const val = input.trim();
        setInput("");
        setIsSending(true);

        try {
            let attachmentInfo = null;
            
            if (selectedFile) {
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: selectedFile.name,
                        base64Data: selectedFile.base64
                    })
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    attachmentInfo = {
                        path: uploadData.path,
                        url: uploadData.url,
                        mimeType: selectedFile.type
                    };
                }
                setSelectedFile(null);
            }

            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    golemId: activeGolem, 
                    message: val,
                    attachment: attachmentInfo
                })
            });
        } catch (e) {
            console.error("Failed to send message:", e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background p-6 max-h-screen">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">
                        直接交談 (Direct Chat)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        與目前活躍的 Golem ({activeGolem || "未選擇"}) 進行對話測試。不須透過外部通訊軟體。
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-card rounded-xl border border-border">
                {/* Chat window */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground/60 italic">
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
                                                isUser ? "bg-blue-600/10 border-blue-500/20" : "bg-primary/10 border-primary/20"
                                            )}>
                                                {isUser ? <User className="w-3 h-3 text-blue-600 dark:text-blue-300" /> : <Bot className="w-3 h-3 text-primary" />}
                                            </div>
                                            <span className={cn("text-xs font-bold", isUser ? "text-blue-600 dark:text-blue-400" : "text-primary")}>{msg.sender}</span>
                                            <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            "p-3 rounded-2xl text-sm whitespace-pre-wrap break-words inline-block shadow-sm transition-all duration-200",
                                            msg.isThinking
                                                ? "animate-pulse bg-secondary border border-border text-muted-foreground italic backdrop-blur-sm" :
                                                msg.isSystem
                                                    ? "bg-secondary/50 border border-border rounded-tl-none text-foreground/90 shadow-sm"
                                                    : isUser
                                                        ? "bg-blue-600/10 text-blue-900 dark:text-blue-100 border border-blue-500/20 rounded-tr-none shadow-sm"
                                                        : "bg-primary/10 text-foreground font-medium border border-primary/20 rounded-tl-none shadow-sm"
                                        )}
                                    >
                                        {/* ── 附件顯示：支援從 Gemini 回傳的多個附件 ── */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="mb-2 flex flex-col gap-2">
                                                {msg.attachments.map((att, attIdx) => (
                                                    (att.mimeType || "").startsWith('image/') ? (
                                                        <img
                                                            key={attIdx}
                                                            src={att.url}
                                                            alt="attachment"
                                                            className="max-w-full max-h-64 rounded-lg border border-border shadow-sm cursor-zoom-in hover:scale-[1.01] transition-transform"
                                                            onClick={() => window.open(att.url, '_blank')}
                                                        />
                                                    ) : (
                                                        <a
                                                            key={attIdx}
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg border border-border w-fit hover:bg-secondary transition-colors"
                                                        >
                                                            <FileText size={20} className="text-primary flex-shrink-0" />
                                                            <div className="overflow-hidden">
                                                                <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{att.name || att.url.split('/').pop()}</p>
                                                                <p className="text-[10px] text-primary/60 font-medium">點擊下載</p>
                                                            </div>
                                                        </a>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                        {msg.isThinking ? "思考中..." : (msg.isSystem && !msg.isHistory ?
                                            <Typewriter content={msg.content.replace(/\n{2,}/g, '\n\n').trim()} onComplete={() => handleTypingComplete(msg.id)} />
                                            : (msg.isSystem ?
                                                <div className="prose dark:prose-invert prose-sm max-w-none prose-p:m-0 prose-headings:my-1 prose-pre:my-1 prose-pre:bg-zinc-950 dark:prose-pre:bg-gray-950 prose-pre:border prose-pre:border-border dark:prose-pre:border-gray-800 prose-ul:list-disc prose-ul:ml-4 prose-ol:list-decimal prose-ol:ml-4 prose-li:m-0 leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content.replace(/\n{2,}/g, '\n\n').trim()}
                                                    </ReactMarkdown>
                                                </div>
                                                : msg.content.replace(/\n{2,}/g, '\n\n').trim()
                                            ))}
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
                                                            "px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border flex items-center gap-2 transform active:scale-95 shadow-md",
                                                            isApprove
                                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                                                : isDeny
                                                                    ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                                                    : "bg-secondary border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
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

                {/* Input area — supports drag & drop onto this zone */}
                <div
                    className={cn(
                        "relative p-3 border-t border-border bg-card/50 transition-colors duration-150",
                        isDragging && "bg-primary/5 border-primary/40"
                    )}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {/* Drag overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-b-xl border-2 border-dashed border-primary/60 bg-primary/10 backdrop-blur-sm pointer-events-none">
                            <UploadCloud size={28} className="text-primary animate-bounce" />
                            <p className="text-sm font-semibold text-primary">放開以上傳檔案</p>
                        </div>
                    )}

                    {/* Selected file preview */}
                    {selectedFile && (
                        <div className="mb-3 flex items-center p-2 bg-secondary/50 border border-border rounded-lg relative group w-fit">
                            {selectedFile.type.startsWith('image/') ? (
                                <img 
                                    src={`data:${selectedFile.type};base64,${selectedFile.base64}`} 
                                    alt="preview" 
                                    className="h-16 w-16 object-cover rounded border border-border"
                                />
                            ) : (
                                <div className="h-16 w-16 flex items-center justify-center bg-primary/10 rounded border border-border text-primary">
                                    <FileText size={32} />
                                </div>
                            )}
                            <button 
                                onClick={() => setSelectedFile(null)}
                                className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                                <X size={12} />
                            </button>
                            <div className="ml-3 pr-2">
                                <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{selectedFile.name}</p>
                                <p className="text-[10px] text-primary/60 font-medium">檔案已就緒</p>
                            </div>
                        </div>
                    )}

                    <div className="relative flex items-center gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            accept="*/*" 
                            className="hidden" 
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!activeGolem || isSending}
                            className="p-2.5 rounded-lg bg-secondary/80 border border-border text-muted-foreground hover:text-primary hover:bg-secondary transition-all"
                            title="上傳附件（或將檔案拖曳至此）"
                        >
                            <Paperclip size={20} />
                        </button>
                        
                        <div className="relative flex-1 flex items-center">
                            <textarea
                                className="flex-1 max-h-32 min-h-[44px] bg-secondary/50 border border-border rounded-lg px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none transition-all"
                                placeholder={activeGolem ? `傳送訊息給 ${activeGolem}… 可拖曳或 ⌘V 貼入圖片` : "請先選擇一個 Golem..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                onPaste={handlePaste}
                                disabled={!activeGolem || isSending}
                                rows={1}
                                style={{ height: "auto" }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!activeGolem || (!input.trim() && !selectedFile) || isSending}
                                className={cn(
                                    "absolute right-2 p-2 rounded-md transition-all flex items-center justify-center",
                                    (!activeGolem || (!input.trim() && !selectedFile) || isSending)
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
        </div>
    );
}
