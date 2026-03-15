"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { MetricCard } from "@/components/MetricCard";
import { LogStream } from "@/components/LogStream";
import { useGolem } from "@/components/GolemContext";
import { Activity, Cpu, Server, Clock, RefreshCcw, PowerOff, AlertTriangle, TriangleAlert, BrainCircuit, UserPlus, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

// ── 通用確認彈窗元件 ────────────────────────────────────────────────────────
interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant: "restart" | "shutdown";
    onConfirm: () => void;
    isLoading: boolean;
}

function ConfirmDialog({ open, onOpenChange, variant, onConfirm, isLoading }: ConfirmDialogProps) {
    const isRestart = variant === "restart";

    const config = isRestart
        ? {
            icon: <RefreshCcw className="w-5 h-5 text-primary" />,
            iconBg: "bg-primary/10 border-primary/20",
            title: "重新啟動 Golem？",
            description: "這將終止目前進程並立即重啟。前端會短暫斷線（約 3-5 秒）後自動重新連線。",
            warning: "進行中的對話將被中斷。",
            confirmLabel: "確認重啟",
            loadingLabel: "正在重啟...",
            confirmClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
        }
        : {
            icon: <PowerOff className="w-5 h-5 text-destructive" />,
            iconBg: "bg-destructive/10 border-destructive/20",
            title: "關閉 Golem？",
            description: "這將完全終止後端進程。關閉後需手動在終端機執行 npm start 重新啟動。",
            warning: "所有運行中的任務將立即停止。",
            confirmLabel: "確認關閉",
            loadingLabel: "正在關閉...",
            confirmClass: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
        };

    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
            <DialogContent
                showCloseButton={!isLoading}
                className="bg-card border-border text-foreground max-w-sm"
            >
                <DialogHeader>
                    {/* 圖示卡片 */}
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-2 ${config.iconBg}`}>
                        {config.icon}
                    </div>
                    <DialogTitle className="text-foreground text-base">
                        {config.title}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                        {config.description}
                    </DialogDescription>
                </DialogHeader>

                {/* 警示欄 */}
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 border border-border/50 px-3 py-2.5">
                    <TriangleAlert className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">{config.warning}</p>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        取消
                    </Button>
                    <Button
                        className={`flex-1 ${config.confirmClass}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-1.5">
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                {config.loadingLabel}
                            </span>
                        ) : config.confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── 完成通知彈窗 ───────────────────────────────────────────────────────────
interface DoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant: "restarted" | "shutdown";
}

function DoneDialog({ open, onOpenChange, variant }: DoneDialogProps) {
    const isRestarted = variant === "restarted";
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border text-foreground max-w-sm" showCloseButton={false}>
                <DialogHeader>
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-2 ${isRestarted ? "bg-green-500/10 border-green-500/20" : "bg-muted border-border"}`}>
                        {isRestarted
                            ? <RefreshCcw className="w-5 h-5 text-green-400 animate-spin" />
                            : <PowerOff className="w-5 h-5 text-gray-400" />
                        }
                    </div>
                    <DialogTitle className="text-foreground text-base">
                        {isRestarted ? "正在重新啟動..." : "Golem 已關閉"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                        {isRestarted
                            ? "系統正在重啟中，頁面將在 3 秒後自動重新整理。"
                            : "進程已完全停止。若需重新啟動，請在終端機執行："
                        }
                    </DialogDescription>
                </DialogHeader>
                {!isRestarted && (
                    <div className="rounded-lg bg-muted border border-border px-3 py-2">
                        <code className="text-xs text-primary font-mono">npm start</code>
                    </div>
                )}
                {!isRestarted && (
                    <DialogFooter>
                        <Button
                            variant="secondary"
                            className="w-full border-border"
                            onClick={() => onOpenChange(false)}
                        >
                            關閉
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── 主頁面 ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { hasGolems, isLoadingGolems, isSingleNode, isBooting } = useGolem();
    const [metrics, setMetrics] = useState({
        uptime: "0h 0m",
        queueCount: 0,
        lastSchedule: "無排程",
        memUsage: 0,
    });

    const [memHistory, setMemHistory] = useState<{ time: string; value: number }[]>([]);

    // Dialog states
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; variant: "restart" | "shutdown" }>({
        open: false, variant: "restart"
    });
    const [doneDialog, setDoneDialog] = useState<{ open: boolean; variant: "restarted" | "shutdown" }>({
        open: false, variant: "restarted"
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // 開啟確認 dialog
    const openConfirm = (variant: "restart" | "shutdown") => {
        setConfirmDialog({ open: true, variant });
    };

    // 執行重啟
    const handleReload = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/system/reload", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setDoneDialog({ open: true, variant: "restarted" });
                setTimeout(() => window.location.reload(), 3000);
            }
        } catch (e) {
            console.error("Reload failed:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // 執行關閉
    const handleShutdown = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/system/shutdown", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setDoneDialog({ open: true, variant: "shutdown" });
            }
        } catch (e) {
            // 進程已關閉時 fetch 會拋出錯誤，此為預期行為
            setConfirmDialog(prev => ({ ...prev, open: false }));
            setDoneDialog({ open: true, variant: "shutdown" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (confirmDialog.variant === "restart") handleReload();
        else handleShutdown();
    };

    useEffect(() => {
        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        // Sync current state immediately (socket may already be connected before listeners registered)
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
                return newData.slice(-60);
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

    const isBusy = isLoading;

    // ── 主頁面開始 ──
    if (!isLoadingGolems && !hasGolems && !isBooting) {
        return (
            <div className="h-full flex items-center justify-center p-6 bg-background">
                <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-primary/10 border border-primary/20 rounded-[2rem] shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)] mb-2">
                        <BrainCircuit className="w-12 h-12 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">系統已就緒</h1>
                        <p className="text-muted-foreground text-base leading-relaxed">
                            目前尚未部署任何 Golem 實體。<br />請建立你的第一個 AI 代理人來開始使用。
                        </p>
                    </div>
                    <Link href="/dashboard/agents/create" className="inline-block w-full pt-4">
                        <Button className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold border-0 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:shadow-primary/25">
                            <UserPlus className="w-5 h-5 mr-2" />
                            建立第一個 Golem
                        </Button>
                    </Link>
                    <div className="pt-2 p-3 rounded-xl bg-muted border border-border text-muted-foreground text-[10px] text-left">
                        <p>💡 提示：系統向導將協助您快速設定 <code>.env</code> 文件。</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Memory Usage"
                    value={`${metrics.memUsage.toFixed(1)} MB`}
                    icon={Activity}
                    data={memHistory}
                    color="#10b981"
                />
                <MetricCard title="Queue Load" value={metrics.queueCount} icon={Server} />
                <MetricCard title="System Uptime" value={metrics.uptime} icon={Clock} />
                <MetricCard title="Next Schedule" value={metrics.lastSchedule} icon={Cpu} />
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
                <div className="md:col-span-2 flex flex-col min-h-0">
                    <h2 className="text-lg font-semibold mb-2">Live System Logs</h2>
                    <LogStream className="flex-1" />
                </div>
                <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-semibold mb-4">System Status</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                                <span className="text-muted-foreground">Environment</span>
                                <span className="text-foreground">Production</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                                <span className="text-muted-foreground">Mode</span>
                                <span className="text-primary font-medium">
                                    Single Node
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                                <span className="text-muted-foreground">Backend</span>
                                <span className={isConnected ? "text-green-600 dark:text-green-400" : "text-destructive animate-pulse"}>
                                    {isConnected ? "Connected" : "Disconnected"}
                                </span>
                            </div>
                        </div>

                        {/* Inline Onboarding Card Removed (Now handled by full-page state) */}
                    </div>

                    {/* 操控區 */}
                    <div className="mt-6 pt-6 border-t border-border space-y-2">
                        {/* 重啟按鈕 */}
                        <button
                            onClick={() => openConfirm("restart")}
                            disabled={isBusy}
                            className="w-full group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                <RefreshCcw className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-medium text-foreground">重新啟動</p>
                                <p className="text-[10px] text-muted-foreground">Hot-reload · 自動重連</p>
                            </div>
                        </button>

                        {/* 關閉按鈕 */}
                        <button
                            onClick={() => openConfirm("shutdown")}
                            disabled={isBusy}
                            className="w-full group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-secondary/50 hover:bg-destructive/5 hover:border-destructive/20 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <div className="w-7 h-7 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0 group-hover:bg-destructive/20 transition-colors">
                                <PowerOff className="w-3.5 h-3.5 text-destructive" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-medium text-destructive">關閉 Golem</p>
                                <p className="text-[10px] text-muted-foreground">完全停止 · 需手動重啟</p>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* 確認 Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                onOpenChange={(open) => !isLoading && setConfirmDialog(prev => ({ ...prev, open }))}
                variant={confirmDialog.variant}
                onConfirm={handleConfirm}
                isLoading={isLoading}
            />

            {/* 完成通知 Dialog */}
            <DoneDialog
                open={doneDialog.open}
                onOpenChange={(open) => setDoneDialog(prev => ({ ...prev, open }))}
                variant={doneDialog.variant}
            />
        </div>
    );
}
