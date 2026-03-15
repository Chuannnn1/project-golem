"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    BrainCircuit,
    Cpu,
    Palette,
    Sparkles,
    User,
    Settings2,
    Search,
    Tag,
    X,
    Filter,
    Zap,
    RefreshCcw,
    TriangleAlert,
    Plus,
    AlertCircle,
    Pencil,
    Check,
    RotateCcw,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Preset {
    id: string;
    name: string;
    name_zh?: string;
    description: string;
    description_zh?: string;
    icon: string;
    aiName: string;
    userName: string;
    role: string;
    role_zh?: string;
    tone: string;
    tags: string[];
    skills: string[];
    category?: string;
    category_name?: { en: string, zh: string };
}

interface PersonaData {
    aiName: string;
    userName: string;
    currentRole: string;
    tone: string;
    skills: string[];
    isNew?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    BrainCircuit, Cpu, Palette, Sparkles, User, Settings2,
};
const ICON_OPTIONS = ["BrainCircuit", "Cpu", "Palette", "Sparkles", "User", "Settings2"];

// ── Confirm Restart Dialog ───────────────────────────────────────────────────
function RestartConfirmDialog({
    open, onOpenChange, onConfirm, isLoading,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => void;
    isLoading: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
            <DialogContent showCloseButton={!isLoading} className="bg-card border-border text-foreground max-w-sm">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-primary/10 border-primary/20 flex items-center justify-center mb-2">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <DialogTitle className="text-foreground text-base">儲存人格並開啟新對話窗口？</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                        人格設定將寫入檔案，並重新開啟 Golem 對話窗口使新設定正式生效。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg bg-muted border border-border px-3 py-2.5">
                        <TriangleAlert className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">進行中的對話將被中斷，此動作將為 Golem 開啟全新的對話視窗。</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground mb-1 font-medium">確認後將自動執行：</p>
                        <ol className="text-[11px] text-muted-foreground/80 space-y-0.5 list-decimal list-inside">
                            <li>將人格設定寫入 persona.json</li>
                            <li>重新開啟 Gemini 對話視窗</li>
                            <li>載入新的人格與歷史記憶</li>
                        </ol>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >取消</Button>
                    <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-1.5">
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />儲存並重啟視窗中...
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" />確認開啟
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Restarting Dialog ────────────────────────────────────────────────────────
function RestartingDialog({ open }: { open: boolean }) {
    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="bg-card border-border text-foreground max-w-sm" showCloseButton={false}>
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-green-500/10 border-green-500/20 flex items-center justify-center mb-2">
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <DialogTitle className="text-foreground text-base">人格設定已儲存 ✅</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                        人格已更新，Golem 正在新視窗載入您的設定。頁面將在 3 秒後自動重新整理。
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}

// ── Persona Delete Confirm Dialog ──────────────────────────────────────────
function PersonaDeleteConfirmDialog({
    open, onOpenChange, onConfirm, isLoading, personaName,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => void;
    isLoading: boolean;
    personaName: string;
}) {
    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
            <DialogContent showCloseButton={!isLoading} className="bg-card border-border text-foreground max-w-sm">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-destructive/10 border-destructive/20 flex items-center justify-center mb-2">
                        <Trash2 className="w-5 h-5 text-destructive" />
                    </div>
                    <DialogTitle className="text-foreground text-base">確定要刪除此人格嗎？</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                        您即將刪除樣板「<span className="text-foreground font-medium">{personaName}</span>」。此動作無法復原。
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2 pt-2">
                    <Button
                        variant="outline"
                        className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >取消</Button>
                    <Button
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-1.5">
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />刪除中...
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <Trash2 className="w-3.5 h-3.5" />確認刪除
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Create Persona Dialog ────────────────────────────────────────────────────
function CreatePersonaDialog({
    open, onOpenChange, onCreated,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onCreated: () => void;
}) {
    const [id, setId] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [icon, setIcon] = useState("BrainCircuit");
    const [aiName, setAiName] = useState("Golem");
    const [userName, setUserName] = useState("Traveler");
    const [role, setRole] = useState("");
    const [tone, setTone] = useState("");
    const [tags, setTags] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setId(""); setName(""); setDescription(""); setIcon("BrainCircuit");
        setAiName("Golem"); setUserName("Traveler"); setRole(""); setTone(""); setTags("");
        setError(null);
    };

    const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

    const handleSubmit = async () => {
        if (!id.trim() || !name.trim()) { setError("請填寫 ID 與名稱"); return; }
        setIsLoading(true); setError(null);
        try {
            const res = await fetch("/api/persona/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id.trim(), name: name.trim(), description, icon, aiName, userName, role, tone, tags }),
            });
            const data = await res.json();
            if (res.ok && data.success) { reset(); onOpenChange(false); onCreated(); }
            else setError(data.error || "建立失敗");
        } catch { setError("請求發送失敗"); }
        finally { setIsLoading(false); }
    };

    const fieldCls = "w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground";

    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : handleClose}>
            <DialogContent showCloseButton={!isLoading} className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="w-10 h-10 rounded-xl border bg-primary/10 border-primary/20 flex items-center justify-center mb-2">
                        <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <DialogTitle className="text-foreground text-base">新增人格樣板</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">建立新的 persona .md 樣板。</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">檔案 ID <span className="text-destructive">*</span></label>
                            <input value={id} onChange={e => setId(e.target.value)} placeholder="my_persona" className={fieldCls} />
                            <p className="text-[10px] text-muted-foreground mt-1">英數字與底線，自動轉小寫</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">顯示名稱 <span className="text-destructive">*</span></label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="我的人格" className={fieldCls} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">簡短描述</label>
                        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="一句話描述這個人格的特色" className={fieldCls} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">圖示</label>
                        <div className="flex flex-wrap gap-2">
                            {ICON_OPTIONS.map(opt => {
                                const Ico = ICON_MAP[opt];
                                return (
                                    <button key={opt} onClick={() => setIcon(opt)}
                                        className={cn("p-2.5 rounded-xl border transition-all",
                                            icon === opt ? "bg-primary/20 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:border-gray-400")}
                                        title={opt}><Ico className="w-4 h-4" /></button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">AI 名稱</label>
                            <input value={aiName} onChange={e => setAiName(e.target.value)} placeholder="Golem" className={fieldCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">使用者稱呼</label>
                            <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Traveler" className={fieldCls} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">任務定位 &amp; 人設背景</label>
                        <textarea value={role} onChange={e => setRole(e.target.value)}
                            placeholder="描述這個人格的身份背景、任務與個性..."
                            className={`${fieldCls} resize-y min-h-[90px]`} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">語言風格 &amp; 語氣</label>
                        <input value={tone} onChange={e => setTone(e.target.value)} placeholder="例如：活潑幽默、直接果斷" className={fieldCls} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">標籤（逗號分隔）</label>
                        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="生產力, 助手, 專業" className={fieldCls} />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2 pt-2">
                    <Button variant="outline" className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => handleClose(false)} disabled={isLoading}>取消</Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSubmit} disabled={isLoading}>
                        {isLoading
                            ? <span className="flex items-center gap-1.5"><RefreshCcw className="w-3.5 h-3.5 animate-spin" />建立中...</span>
                            : <span className="flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />建立人格</span>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Inline field component ───────────────────────────────────────────────────
function EditField({
    label, value, onChange, multiline = false, placeholder = "",
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
}) {
    const base = "w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/60";
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
            {multiline
                ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className={`${base} resize-y min-h-[100px]`} />
                : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className={base} />}
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PersonaPage() {
    const [saved, setSaved] = useState<PersonaData | null>(null);  // last-saved state
    const [aiName, setAiName] = useState("Golem");
    const [userName, setUserName] = useState("Traveler");
    const [role, setRole] = useState("");
    const [tone, setTone] = useState("");

    const [isEditing, setIsEditing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isInjecting, setIsInjecting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDone, setShowDone] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    const [templates, setTemplates] = useState<Preset[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [activePresetId, setActivePresetId] = useState("");

    // Market / Tab states
    const [activeTab, setActiveTab] = useState<"local" | "market">("local");
    const [marketPersonas, setMarketPersonas] = useState<Preset[]>([]);
    const [marketTotal, setMarketTotal] = useState(0);
    const [marketPage, setMarketPage] = useState(1);
    const [searchMarketTerm, setSearchMarketTerm] = useState("");
    const [marketCategory, setMarketCategory] = useState("all");
    const [isMarketLoading, setIsMarketLoading] = useState(false);

    // Delete state
    const [personaToDelete, setPersonaToDelete] = useState<Preset | null>(null);
    const [isDeletingPersona, setIsDeletingPersona] = useState(false);

    const [statusMsg, setStatusMsg] = useState<{ type: "error" | "info"; text: string } | null>(null);

    const applyToForm = (data: PersonaData) => {
        setAiName(data.aiName || "Golem");
        setUserName(data.userName || "Traveler");
        setRole(data.currentRole || "");
        setTone(data.tone || "");
    };

    // Load current persona
    useEffect(() => {
        fetch("/api/persona")
            .then(r => r.json())
            .then(data => {
                if (data && !data.error) {
                    setSaved(data);
                    applyToForm(data);
                }
            })
            .catch(() => { });
    }, []);

    const loadTemplates = useCallback(() => {
        fetch("/api/golems/templates")
            .then(r => r.json())
            .then(d => { if (d.templates) setTemplates(d.templates); })
            .catch(() => { });
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    useEffect(() => {
        if (activeTab === "market") {
            setIsMarketLoading(true);
            const delayDebounceFn = setTimeout(() => {
                fetch(`/api/persona/market?search=${encodeURIComponent(searchMarketTerm)}&category=${encodeURIComponent(marketCategory)}&page=${marketPage}&limit=20`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && !data.error) {
                            setMarketPersonas(data.personas || []);
                            setMarketTotal(data.total || 0);
                        }
                    })
                    .catch(e => console.error("Error fetching market personas", e))
                    .finally(() => setIsMarketLoading(false));
            }, 300); // debounce search
            return () => clearTimeout(delayDebounceFn);
        }
    }, [activeTab, searchMarketTerm, marketCategory, marketPage]);

    // Detect dirty state
    useEffect(() => {
        if (!saved) return;
        const changed = aiName !== saved.aiName || userName !== saved.userName
            || role !== saved.currentRole || tone !== saved.tone;
        setIsDirty(changed);
    }, [aiName, userName, role, tone, saved]);

    const handleDiscard = () => {
        if (saved) applyToForm(saved);
        setIsEditing(false);
        setIsDirty(false);
        setActivePresetId("");
        setStatusMsg(null);
    };

    const handleInject = async () => {
        setIsInjecting(true);
        setStatusMsg(null);
        try {
            const res = await fetch("/api/persona/inject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aiName, userName, currentRole: role, tone }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setShowConfirm(false);
                setIsEditing(false);
                setIsDirty(false);
                setShowDone(true);
                // 不再呼叫 /api/system/reload，因為這會殺掉整個 node process
                // 而是直接等待 3 秒讓前端狀態重置
                setTimeout(() => window.location.reload(), 3000);
            } else {
                setShowConfirm(false);
                setStatusMsg({ type: "error", text: data.message || data.error || "注入失敗" });
            }
        } catch {
            setShowConfirm(false);
            setStatusMsg({ type: "error", text: "注入請求發送失敗" });
        } finally {
            setIsInjecting(false);
        }
    };

    const applyPreset = (preset: Preset) => {
        const isZh = preset.tags?.includes('zh') || !!preset.name_zh;

        setActivePresetId(preset.id);
        setAiName(preset.name_zh || preset.aiName || preset.name);
        setUserName(isZh && (preset.userName === "User" || !preset.userName) ? "使用者" : (preset.userName || "User"));
        setRole(preset.role_zh || preset.role || preset.description_zh || preset.description);
        setTone(isZh && (preset.tone === "Professional" || !preset.tone) ? "專業" : (preset.tone || "Professional"));
        
        setIsEditing(true);
        setStatusMsg({ 
            type: "info", 
            text: `已套用樣板「${preset.name_zh || preset.name}」，確認後請點擊「儲存並重啟」。` 
        });
    };

    const handleDeletePersona = async () => {
        if (!personaToDelete) return;
        setIsDeletingPersona(true);
        try {
            const res = await fetch("/api/persona/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: personaToDelete.id }),
            });
            const data = await res.json();
            if (data.success) {
                setPersonaToDelete(null);
                loadTemplates(); // 重新整理列表
                if (activePresetId === personaToDelete.id) {
                    setActivePresetId("");
                }
            } else {
                alert(data.error || "刪除失敗");
            }
        } catch (err) {
            console.error(err);
            alert("請求發送失敗");
        } finally {
            setIsDeletingPersona(false);
        }
    };

    const allTags = Array.from(new Set(templates.flatMap(t => t.tags || [])));
    const filteredTemplates = templates.filter(t => {
        const s = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const tg = !selectedTag || (t.tags && t.tags.includes(selectedTag));
        return s && tg;
    });

    const inputCls = "w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground";

    return (
        <>
            <div className="flex-1 overflow-auto bg-background p-6 text-foreground">
                <div className="max-w-5xl w-full mx-auto pb-12 pt-4 space-y-6">

                    {/* ── Page Header ─────────────────────────────────── */}
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="inline-flex items-center justify-center p-3 bg-primary/10 border border-primary/20 shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)] rounded-xl">
                            <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-primary tracking-tight">
                                人格設定 (Persona)
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">管理 Golem 的身份、人設與語言風格</p>
                        </div>
                    </div>

                    {/* ── Current Persona Edit Card ────────────────────── */}
                    <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
                        <div className={cn(
                            "bg-card/70 backdrop-blur-sm border rounded-2xl relative overflow-hidden transition-all duration-300",
                            isEditing ? "border-primary/50 shadow-[0_0_30px_-8px_rgba(var(--primary),0.35)]" : "border-border"
                        )}>
                            {/* Top accent bar */}
                            <div className={cn("absolute inset-x-0 top-0 h-[2px] transition-all duration-300",
                                isEditing
                                    ? "bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-400"
                                    : "bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700")} />

                            {/* Card Header */}
                            <div className="flex items-center justify-between px-6 pt-6 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                        isEditing ? "bg-primary/20 border border-primary/40" : "bg-secondary border border-border"
                                    )}>
                                        <User className={cn("w-5 h-5 transition-colors", isEditing ? "text-primary/80" : "text-muted-foreground")} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">目前人格</p>
                                        <p className="text-lg font-bold text-foreground leading-tight">{aiName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isDirty && !isEditing && (
                                        <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                                            未儲存的變更
                                        </span>
                                    )}
                                    {isEditing ? (
                                        <button onClick={handleDiscard}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-lg transition-all">
                                            <RotateCcw className="w-3.5 h-3.5" />捨棄變更
                                        </button>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary/80 hover:text-primary bg-primary/10 hover:bg-primary/20 border border-primary/40 rounded-lg transition-all">
                                            <Pencil className="w-3.5 h-3.5" />編輯人格
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* View Mode */}
                            {!isEditing && (
                                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-secondary/40 border border-border/60 rounded-xl px-4 py-3">
                                        <p className="text-[10px] text-foreground/60 uppercase tracking-wider mb-1 font-bold">稱呼你為</p>
                                        <p className="text-sm text-foreground font-medium">「{userName}」</p>
                                    </div>
                                    <div className="bg-secondary/40 border border-border/60 rounded-xl px-4 py-3">
                                        <p className="text-[10px] text-foreground/60 uppercase tracking-wider mb-1 font-bold">語言風格</p>
                                        <p className="text-sm text-foreground font-medium line-clamp-1">{tone || "—"}</p>
                                    </div>
                                    <div className="bg-secondary/40 border border-border/60 rounded-xl px-4 py-3 sm:col-span-2">
                                        <p className="text-[10px] text-foreground/60 uppercase tracking-wider mb-1 font-bold">任務定位 &amp; 人設背景</p>
                                        <p className="text-sm text-foreground font-medium line-clamp-3">{role || "—"}</p>
                                    </div>
                                </div>
                            )}

                            {/* Edit Mode */}
                            {isEditing && (
                                <div className="px-6 pb-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <EditField label="AI 名稱" value={aiName} onChange={setAiName} placeholder="例如：Friday, Golem" />
                                        <EditField label="你的稱呼" value={userName} onChange={setUserName} placeholder="例如：Boss, Commander" />
                                    </div>
                                    <EditField label="語言風格 & 語氣" value={tone} onChange={setTone}
                                        placeholder="例如：活潑幽默、直接果斷" />
                                    <EditField label="任務定位 & 人設背景" value={role} onChange={setRole} multiline
                                        placeholder="描述這個人格的身份背景、任務與個性..." />

                                    {/* Status msg inside edit card */}
                                    {statusMsg && (
                                        <div className={cn("flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 border",
                                            statusMsg.type === "info"
                                                ? "bg-blue-950/30 border-blue-900/40 text-blue-300"
                                                : "bg-red-950/30 border-red-900/40 text-red-400")}>
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <p>{statusMsg.text}</p>
                                        </div>
                                    )}

                                    {/* Save & Restart CTA */}
                                    <div className="pt-1">
                                        <Button
                                            onClick={() => setShowConfirm(true)}
                                            disabled={isInjecting}
                                            className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-primary-foreground border-none shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 rounded-2xl text-base"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Zap className="w-5 h-5" />
                                                儲存人格並開啟新對話窗口
                                            </span>
                                        </Button>
                                        <p className="text-center text-xs text-muted-foreground mt-2">
                                            重開視窗後新設定正式生效，前端將自動重新整理
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Templates Section ────────────────────────────── */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                        <div className="flex items-center gap-6 border-b border-border mb-6">
                            <button
                                onClick={() => { setActiveTab("local"); setSearchTerm(""); setSelectedTag(null); }}
                                className={cn("pb-3 text-sm font-medium transition-all relative",
                                    activeTab === "local" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" /> 我的樣板 (Local)
                                </div>
                                {activeTab === "local" && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => { setActiveTab("market"); setSearchTerm(""); }}
                                className={cn("pb-3 text-sm font-medium transition-all relative",
                                    activeTab === "market" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" /> 人格市集 (Market)
                                </div>
                                {activeTab === "market" && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {activeTab === "local" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-medium text-muted-foreground">本地自訂與預設樣板</h2>
                                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-medium rounded-lg transition-all">
                                        <Plus className="w-3.5 h-3.5" />新增人格
                                    </button>
                                </div>
                                {/* Search + Tags */}
                                <div className="bg-card/40 border border-border rounded-2xl p-4">
                                    <div className="flex gap-3 mb-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="搜尋樣板..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full bg-secondary/30 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                                            />
                                            {searchTerm && (
                                                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground/60" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setSelectedTag(null)}
                                            className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-all",
                                                selectedTag === null ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}>
                                            全部
                                        </button>
                                        {allTags.map(tag => (
                                            <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                                className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                                                    selectedTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}>
                                                <Tag className="w-3 h-3" />{tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Local Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredTemplates.length > 0 ? filteredTemplates.map(preset => (
                                        <div
                                            key={preset.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => applyPreset(preset)}
                                            onKeyDown={(e) => e.key === 'Enter' && applyPreset(preset)}
                                            className={cn(
                                                "text-left p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden flex flex-col cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                                activePresetId === preset.id
                                                    ? "bg-primary/5 border-primary/50 ring-1 ring-primary/30"
                                                    : "bg-card border-border hover:border-primary/50 hover:bg-accent/50"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={cn("p-2.5 rounded-xl transition-colors",
                                                    activePresetId === preset.id
                                                        ? "bg-primary text-primary-foreground dark:text-primary-foreground"
                                                        : "bg-secondary text-muted-foreground group-hover:text-primary")}>
                                                    {(() => { const I = ICON_MAP[preset.icon] || ICON_MAP.BrainCircuit; return <I className="w-5 h-5" />; })()}
                                                </div>
                                                {activePresetId === preset.id && (
                                                    <div className="flex items-center gap-1 bg-primary/20 border border-primary/30 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                        <Check className="w-2.5 h-2.5" />套用中
                                                    </div>
                                                )}
                                            </div>
                                            <h4 className={cn("font-bold mb-1 text-sm transition-colors",
                                                activePresetId === preset.id ? "text-primary dark:text-primary-foreground text-base" : "text-foreground group-hover:text-primary text-sm")}>
                                                {preset.name}
                                            </h4>
                                            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{preset.description}</p>
                                            
                                            {/* Delete Button (only for custom ones) */}
                                            {activeTab === "local" && !['standard', 'expert', 'analyst', 'coach', 'creative', 'storyteller', 'translator'].includes(preset.id) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPersonaToDelete(preset);
                                                    }}
                                                    className="absolute bottom-3 right-3 p-2 bg-background/50 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                                    title="刪除人格樣板"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-16 text-center bg-secondary/20 border border-dashed border-border rounded-2xl flex flex-col items-center">
                                            <Search className="w-8 h-8 text-muted-foreground/40 mb-2" />
                                            <p className="text-muted-foreground text-sm">找不到符合條件的樣板</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === "market" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-medium text-muted-foreground">來自 Awesome ChatGPT Prompts 的海量人格</h2>
                                </div>
                                <div className="bg-card/40 border border-border rounded-2xl p-4">
                                    <div className="flex gap-3 mb-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="搜尋市集人格..."
                                                value={searchMarketTerm}
                                                onChange={e => { setSearchMarketTerm(e.target.value); setMarketPage(1); }}
                                                className="w-full bg-secondary/30 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                                            />
                                            {searchMarketTerm && (
                                                <button onClick={() => { setSearchMarketTerm(""); setMarketPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'all', label: '全部' },
                                            { id: 'coding-and-dev', label: '寫程式與開發' },
                                            { id: 'writing-and-language', label: '寫作與語言' },
                                            { id: 'business-and-marketing', label: '商業與行銷' },
                                            { id: 'education', label: '教育與學習' },
                                            { id: 'health-and-fitness', label: '健康與塑身' },
                                            { id: 'gaming-and-rpg', label: '遊戲與角色扮演' },
                                            { id: 'data-and-research', label: '數據與研究' },
                                            { id: 'creative-arts', label: '創意與藝術' },
                                            { id: 'other', label: '其他角色' }
                                        ].map(cat => (
                                            <button key={cat.id} onClick={() => { setMarketCategory(cat.id); setMarketPage(1); }}
                                                className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                                                    marketCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}>
                                                <Filter className="w-3 h-3" />{cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {isMarketLoading ? (
                                    <div className="py-20 flex justify-center items-center">
                                        <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {marketPersonas.length > 0 ? marketPersonas.map(preset => (
                                                <div
                                                    key={preset.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => applyPreset({ ...preset, icon: "Sparkles", aiName: preset.name, userName: "User", tone: "Professional", skills: [] })}
                                                    onKeyDown={(e) => e.key === 'Enter' && applyPreset({ ...preset, icon: "Sparkles", aiName: preset.name, userName: "User", tone: "Professional", skills: [] })}
                                                    className={cn(
                                                        "text-left p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden flex flex-col cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                                        activePresetId === preset.id
                                                            ? "bg-primary/5 border-primary/50 ring-1 ring-primary/30"
                                                            : "bg-card border-border hover:border-primary/50 hover:bg-accent/50"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className={cn("p-2.5 rounded-xl transition-colors",
                                                            activePresetId === preset.id
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-secondary text-muted-foreground group-hover:text-primary")}>
                                                            <Sparkles className="w-5 h-5" />
                                                        </div>
                                                        {activePresetId === preset.id && (
                                                            <div className="flex items-center gap-1 bg-primary/20 border border-primary/30 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                                <Check className="w-2.5 h-2.5" />套用中
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h4 className={cn("font-bold mb-1 text-sm transition-colors",
                                                        activePresetId === preset.id ? "text-primary-foreground" : "text-foreground group-hover:text-primary")}>
                                                        {preset.name_zh && preset.name_zh !== preset.name ? `${preset.name} / ${preset.name_zh}` : preset.name}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                                                        {preset.description_zh && preset.tags.includes('zh') ? preset.description_zh : preset.description}
                                                    </p>
                                                    {preset.category_name && (
                                                        <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center w-full">
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Tag className="w-3 h-3" /> {preset.category_name.zh || preset.category_name.en}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1 mt-3">
                                                        <span className="px-1.5 py-0.5 bg-secondary/50 border border-border text-[9px] text-muted-foreground rounded">
                                                            #market
                                                        </span>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="col-span-full py-16 text-center bg-secondary/20 border border-dashed border-border rounded-2xl flex flex-col items-center">
                                                    <Search className="w-8 h-8 text-muted-foreground/40 mb-2" />
                                                    <p className="text-muted-foreground text-sm">找不到符合條件的人格</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pagination Controls */}
                                        {marketTotal > 0 && (
                                            <div className="flex items-center justify-between mt-6 bg-secondary/40 p-3 rounded-xl border border-border">
                                                <p className="text-xs text-muted-foreground">
                                                    Showing {(marketPage - 1) * 20 + 1} to {Math.min(marketPage * 20, marketTotal)} of {marketTotal}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline" size="sm"
                                                        className="bg-secondary border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground h-8"
                                                        onClick={() => setMarketPage(p => Math.max(1, p - 1))}
                                                        disabled={marketPage === 1}
                                                    >
                                                        Prev
                                                    </Button>
                                                    <div className="flex items-center gap-1">
                                                        {Array.from({ length: Math.min(5, Math.ceil(marketTotal / 20)) }, (_, i) => {
                                                            let pageNum = marketPage;
                                                            if (marketPage < 3) pageNum = i + 1;
                                                            else if (marketPage > Math.ceil(marketTotal / 20) - 2) pageNum = Math.ceil(marketTotal / 20) - 4 + i;
                                                            else pageNum = marketPage - 2 + i;
                                                            
                                                            if (pageNum > 0 && pageNum <= Math.ceil(marketTotal / 20)) {
                                                                return (
                                                                    <button
                                                                        key={pageNum}
                                                                        onClick={() => setMarketPage(pageNum)}
                                                                        className={cn("w-8 h-8 rounded-lg text-xs font-medium transition-all",
                                                                            marketPage === pageNum ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
                                                                    >
                                                                        {pageNum}
                                                                    </button>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                    <Button
                                                        variant="outline" size="sm"
                                                        className="bg-secondary border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground h-8"
                                                        onClick={() => setMarketPage(p => Math.min(Math.ceil(marketTotal / 20), p + 1))}
                                                        disabled={marketPage === Math.ceil(marketTotal / 20)}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <RestartConfirmDialog open={showConfirm} onOpenChange={setShowConfirm} onConfirm={handleInject} isLoading={isInjecting} />
            <RestartingDialog open={showDone} />
            <CreatePersonaDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadTemplates} />
            <PersonaDeleteConfirmDialog
                open={!!personaToDelete}
                onOpenChange={(open) => !open && setPersonaToDelete(null)}
                onConfirm={handleDeletePersona}
                isLoading={isDeletingPersona}
                personaName={personaToDelete?.name || ""}
            />
        </>
    );
}
