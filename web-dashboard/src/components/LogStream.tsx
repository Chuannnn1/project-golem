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
            case 'error': return 'text-red-500';
            case 'agent': return 'text-cyan-400';
            case 'chronos': return 'text-yellow-400';
            case 'queue': return 'text-purple-400';
            case 'memory': return 'text-[#dfe6e9]';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className={cn("bg-black border border-gray-800 rounded-md p-4 font-mono text-xs h-full flex flex-col", className)}>
            <div className="flex-1 overflow-y-auto space-y-1" ref={scrollRef}>
                {logs.filter(log => !types || types.includes(log.type)).map((log, i) => (
                    <div key={i} className="flex border-b border-dashed border-gray-800 pb-1 mb-1 last:border-0">
                        <span className="text-[#feca57] mr-2">[{log.time}]</span>
                        <span className={cn(getLogColor(log.type), "break-words")}>
                            {log.msg}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
