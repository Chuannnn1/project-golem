"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { socket } from "@/lib/socket";

interface LogMessage {
    time: string;
    msg: string;
    type: 'general' | 'chronos' | 'queue' | 'agent' | 'error' | 'memory';
    raw?: string;
}

export function LogStream({ className, types, autoScroll = true }: { className?: string, types?: string[], autoScroll?: boolean }) {
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        socket.on("init", (data: any) => {
            if (data.logs && Array.isArray(data.logs)) {
                setLogs(data.logs);
            }
        });

        socket.on("log", (data: LogMessage) => {
            setLogs((prev) => [...prev.slice(-199), data]); // Keep last 200 logs
        });

        // Explicitly request logs on mount (handles navigation)
        socket.emit("request_logs");

        return () => {
            socket.off("log");
            socket.off("init");
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogColor = (type: LogMessage['type']) => {
        switch (type) {
            case 'error': return 'text-destructive';
            case 'agent': return 'text-primary font-semibold';
            case 'chronos': return 'text-muted-foreground italic';
            case 'queue': return 'text-primary/70';
            case 'memory': return 'text-muted-foreground';
            default: return 'text-foreground';
        }
    };

    return (
        <div className={cn("bg-card border border-border rounded-md p-4 font-mono text-xs h-full flex flex-col", className)}>
            <div className="flex-1 overflow-y-auto space-y-1" ref={scrollRef}>
                {logs.filter(log => !types || types.includes(log.type)).map((log, i) => {
                    // Aggressive regex to catch both ISO and Local timestamps if they leak into msg
                    const isoRegex = /^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/;
                    const localRegex = /^\[\d{2}:\d{2}:\d{2}\]/;
                    
                    let trimmedMsg = log.msg.trim();
                    let displayTime = log.time;
                    let displayMsg = log.msg;

                    // 1. Try ISO Match
                    const isoMatch = trimmedMsg.match(isoRegex);
                    if (isoMatch) {
                        try {
                            const date = new Date(isoMatch[1]);
                            if (!isNaN(date.getTime())) {
                                displayTime = date.toLocaleTimeString('zh-TW', { 
                                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
                                });
                                trimmedMsg = trimmedMsg.replace(isoRegex, "").trim();
                            }
                        } catch (e) {}
                    }
                    
                    // 2. Secondary check: if message starts with another timestamp [HH:mm:ss], strip it
                    if (trimmedMsg.match(localRegex)) {
                        trimmedMsg = trimmedMsg.replace(localRegex, "").trim();
                    }
                    
                    // 3. Final display message (strip redundant level tags if they are already at the start)
                    displayMsg = trimmedMsg;

                    return (
                        <div key={i} className="flex border-b border-dashed border-border pb-1 mb-1 last:border-0">
                            <span className="text-muted-foreground mr-2 flex-shrink-0">[{displayTime}]</span>
                            <span className={cn(getLogColor(log.type), "break-words")}>
                                {displayMsg}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
