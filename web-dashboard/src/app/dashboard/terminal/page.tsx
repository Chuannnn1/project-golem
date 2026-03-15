"use client";

import { useEffect, useState } from "react";
import { Terminal as TerminalIcon, AlertTriangle } from "lucide-react";
import { LogStream } from "@/components/LogStream";
import { MetricCard } from "@/components/MetricCard";
import { socket } from "@/lib/socket";
import { cn } from "@/lib/utils";

export default function TerminalPage() {
    const [metrics, setMetrics] = useState({
        uptime: "0h 0m",
        queueCount: 0,
        lastSchedule: "N/A",
        memUsage: 0,
    });

    const [memHistory, setMemHistory] = useState<{ time: string; value: number }[]>([]);
    const [hoveredPoint, setHoveredPoint] = useState<{ time: string; value: number; x: number; y: number } | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        // Sync current state immediately (handles race condition)
        setIsConnected(socket.connected);

        socket.on("init", (data: any) => {
            setMetrics((prev) => ({ ...prev, ...data }));
        });

        socket.on("state_update", (data: any) => {
            setMetrics((prev) => ({ ...prev, ...data }));
        });

        socket.on("heartbeat", (data: any) => {
            const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
            setMetrics((prev) => ({
                ...prev,
                uptime: data.uptime,
                memUsage: data.memUsage,
            }));

            setMemHistory((prev) => {
                const newData = [...prev, { time: timeStr, value: parseFloat(data.memUsage.toFixed(1)) }];
                return newData.slice(-60); // Keep last 60 seconds
            });
        });

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("init");
            socket.off("state_update");
            socket.off("heartbeat");
        };
    }, []);

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (memHistory.length < 2) return;
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        // Use relative mouse position within the element
        const mouseX = e.clientX - rect.left;
        const width = rect.width;

        // Scale mouseX to match the 1000-unit viewBox width
        const viewBoxX = (mouseX / width) * 1000;

        const index = Math.round((mouseX / width) * (memHistory.length - 1));
        const safeIndex = Math.max(0, Math.min(memHistory.length - 1, index));
        const point = memHistory[safeIndex];

        const max = Math.max(100, ...memHistory.map(m => m.value)) * 1.2;
        const y = 100 - (point.value / max) * 100;

        // Store coordinates relative to viewBox (1000x100)
        setHoveredPoint({ ...point, x: (safeIndex / (memHistory.length - 1)) * 1000, y });
    };

    return (
        <div className="h-full flex flex-col bg-background font-sans selection:bg-primary/30">
            {/* Header bar */}
            <div className="border-b border-border bg-card/80 backdrop-blur-md p-4 flex items-center justify-between shadow-sm flex-none sticky top-0 z-50">
                <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
                        <TerminalIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-foreground tracking-tight">Terminal Dashboard</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Real-time Golem Core System Monitor</p>
                    </div>
                </div>
                <div className={cn(
                    "flex items-center space-x-2 text-[10px] uppercase tracking-widest font-bold bg-secondary/50 px-3 py-1.5 rounded-full border border-border",
                    isConnected ? "text-primary" : "text-destructive"
                )}>
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        isConnected ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-destructive"
                    )}></div>
                    <span>{isConnected ? "System Online" : "System Offline"}</span>
                </div>
            </div>

            {/* Terminal Grid Container */}
            <div className="flex-1 p-4 h-[calc(100vh-76px)] grid grid-cols-12 grid-rows-12 gap-4 overflow-hidden">

                {/* [左上 0,0 - 寬8,高4] 系統核心 (System Core) */}
                <div className="col-span-8 row-span-4 bg-card border border-border rounded-2xl flex flex-col overflow-hidden relative p-8 shadow-sm group hover:border-primary/30 transition-colors duration-500">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>

                    <div className="flex justify-between items-start mb-6 z-10">
                        <div>
                            <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">Memory Usage Snapshot</h3>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-5xl font-black text-foreground tracking-tighter font-mono">
                                    {metrics.memUsage.toFixed(1)}
                                </span>
                                <span className="text-xl font-bold text-muted-foreground uppercase">MB</span>
                            </div>
                        </div>
                        <div className="text-primary/40 p-2 bg-primary/5 rounded-lg border border-primary/10">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex-1 relative mt-2">
                        {/* Interactive Area Chart with proper scaling */}
                        <div className="absolute inset-0">
                            <svg
                                className="w-full h-full overflow-visible"
                                viewBox="0 0 1000 100"
                                preserveAspectRatio="none"
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setHoveredPoint(null)}
                            >
                                <defs>
                                    <linearGradient id="refinedMemGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
                                    </linearGradient>
                                </defs>

                                {(() => {
                                    if (memHistory.length < 2) return null;
                                    const max = Math.max(100, ...memHistory.map(m => m.value)) * 1.2;
                                    const points = memHistory.map((pt, i) => {
                                        const x = (i / (memHistory.length - 1)) * 1000;
                                        const y = 100 - (pt.value / max) * 100;
                                        return `${x},${y}`;
                                    });

                                    const pathData = `M 0,100 ` + points.map(p => `L ${p}`).join(' ') + ` L 1000,100 Z`;
                                    const lineData = `M ` + points.map(p => `L ${p}`).join(' ').substring(2);

                                    return (
                                        <g>
                                            <path d={pathData} fill="url(#refinedMemGradient)" className="transition-all duration-300" />
                                            <path d={lineData} fill="none" stroke="currentColor" className="text-primary transition-all duration-300" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                                            {hoveredPoint && (
                                                <g>
                                                    <line x1={hoveredPoint.x} y1="0" x2={hoveredPoint.x} y2="100" stroke="currentColor" className="text-foreground/10" strokeWidth="1" strokeDasharray="4 2" />
                                                    <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="6" fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth="2" />

                                                    <foreignObject
                                                        x={hoveredPoint.x > 850 ? hoveredPoint.x - 130 : hoveredPoint.x + 15}
                                                        y={hoveredPoint.y - 60}
                                                        width="120"
                                                        height="60"
                                                        className="overflow-visible"
                                                    >
                                                        <div className="bg-popover/90 backdrop-blur-md border border-border rounded-xl p-2.5 shadow-2xl pointer-events-none ring-1 ring-border/5">
                                                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mb-1 font-sans">{hoveredPoint.time}</div>
                                                            <div className="font-mono font-black text-xs text-foreground">VAL: {hoveredPoint.value.toFixed(1)} <span className="text-[9px] text-muted-foreground">MB</span></div>
                                                        </div>
                                                    </foreignObject>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })()}
                            </svg>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></span>
                            Live Engine Stream
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">HISTORY: {memHistory.length}/60s</div>
                    </div>
                </div>

                {/* [右上 0,8 - 寬4,高4] 狀態 (Status) */}
                <div className="col-span-4 row-span-4 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">System Status</span>
                        <div className="flex space-x-1">
                            <div className="w-1 h-1 rounded-full bg-green-500"></div>
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                        </div>
                    </div>
                    <div className="flex-1 p-5 text-xs space-y-5 overflow-y-auto font-mono custom-scrollbar">
                        <div className="group">
                            <div className="font-bold text-primary mb-2 flex items-center text-[10px] uppercase tracking-wider">
                                <span className="w-1 h-3 bg-primary mr-2 rounded-full"></span>
                                Core Module (v9.0)
                            </div>
                            <ul className="space-y-2.5 ml-3 border-l border-border pl-4 py-1">
                                <li className="flex justify-between hover:translate-x-1 transition-transform"><span className="text-muted-foreground">MODE:</span> <span className="text-foreground">BROWSER_ENV</span></li>
                                <li className="flex justify-between hover:translate-x-1 transition-transform"><span className="text-muted-foreground">ENGINE:</span> <span className="text-foreground font-bold">MULTI_AGENT</span></li>
                                <li className="flex justify-between hover:translate-x-1 transition-transform"><span className="text-muted-foreground">UPTIME:</span> <span className="text-primary">{metrics.uptime}</span></li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-bold text-muted-foreground mb-2 flex items-center text-[10px] uppercase tracking-wider">
                                <span className="w-1 h-3 bg-muted-foreground/30 mr-2 rounded-full"></span>
                                Active Subsystems
                            </div>
                            <ul className="space-y-2.5 ml-3 border-l border-border pl-4 py-1">
                                <li className="flex justify-between"><span className="text-muted-foreground">Chronos:</span> <span className="text-primary/80">ONLINE</span></li>
                                <li className="flex justify-between"><span className="text-muted-foreground">Agents:</span> <span className="text-foreground font-medium">READY ({metrics.queueCount})</span></li>
                                <li className="flex justify-between whitespace-nowrap overflow-hidden text-ellipsis"><span className="text-muted-foreground">Last:</span> <span className="text-muted-foreground text-[10px]">{metrics.lastSchedule}</span></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* [中層 4,0 - 寬6,高3] 時序雷達 (Chronos Radar) */}
                <div className="col-span-6 row-span-3 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm group hover:border-primary/20 transition-colors">
                    <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className="text-amber-600 dark:text-amber-400">⏰</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">時序雷達 (Chronos Radar)</span>
                        </div>
                    </div>
                    <LogStream className="border-0 rounded-none p-3 bg-transparent text-[10px] font-mono leading-relaxed" types={['chronos']} />
                </div>

                {/* [中層 4,6 - 寬6,高3] 隊列交通 (Queue Traffic) */}
                <div className="col-span-6 row-span-3 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm group hover:border-primary/20 transition-colors">
                    <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className="text-purple-600 dark:text-purple-400">🚦</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">隊列交通 (Traffic & Agents)</span>
                        </div>
                    </div>
                    <LogStream className="border-0 rounded-none p-3 bg-transparent text-[10px] font-mono leading-relaxed" types={['queue', 'agent']} autoScroll={false} />
                </div>

                {/* [底層 7,0 - 寬12,高5] 核心日誌 (Neuro-Link Stream) */}
                <div className="col-span-12 row-span-5 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className="text-foreground">📝</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">核心日誌 (Neuro-Link Stream)</span>
                        </div>
                        <div className="flex space-x-2 text-[9px] font-bold text-muted-foreground uppercase">
                            <span>General</span>
                            <span className="text-border">|</span>
                            <span>Error</span>
                        </div>
                    </div>
                    <LogStream className="border-0 rounded-none p-4 bg-transparent text-[11px] font-mono leading-loose custom-scrollbar" types={['general', 'error']} />
                </div>

            </div>
        </div>
    );
}
