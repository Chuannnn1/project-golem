"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { BookOpen, AlertCircle, CheckCircle2, RefreshCcw, ChevronRight, Zap, TriangleAlert, Plus, Pencil, X, Search, Download, Store, Tags, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// ── Inject Confirm Dialog ───────────────────────────────────────────────────
function InjectConfirmDialog({
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
                    <DialogTitle className="text-foreground text-base">注入技能書？</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                        系統將依據目前配置，重新開啟全新的 Gemini 對話視窗進行注入。過往設定的人格與歷史記憶將會完整保留。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg bg-secondary/60 border border-border/50 px-3 py-2.5">
                        <TriangleAlert className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">此動作將暫時開新視窗中斷目前對話，但人格設定與長期記憶不受影響。</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground mb-1 font-medium">確認後將自動執行：</p>
                        <ol className="text-[11px] text-muted-foreground/80 space-y-0.5 list-decimal list-inside">
                            <li>清除技能快取</li>
                            <li>重新開啟 Gemini 通訊視窗</li>
                            <li>自存檔載入人格，並注入所有技能記憶</li>
                        </ol>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => onOpenChange(false)} disabled={isLoading}>取消</Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? (
                            <span className="flex items-center gap-1.5"><RefreshCcw className="w-3.5 h-3.5 animate-spin" />注入中...</span>
                        ) : (
                            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />確認注入</span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Inject Done Dialog ──────────────────────────────────────────────────────
function InjectDoneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border text-foreground max-w-sm" showCloseButton={false}>
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-green-500/10 border-green-500/20 flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <DialogTitle className="text-foreground text-base">技能注入完成 ✅</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                        已於新的 Gemini 對話視窗中完成注入。人格設定與歷史記憶已從存檔完整還原，3 秒後自動關閉。
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}

// ── Skill Editor Dialog ─────────────────────────────────────────────────────
function SkillEditorDialog({
    open, onOpenChange, mode, initialId = "", initialContent = "", onSaved,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    mode: "create" | "edit";
    initialId?: string;
    initialContent?: string;
    onSaved: () => void;
}) {
    const [id, setId] = useState(initialId);
    const [content, setContent] = useState(initialContent);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setId(initialId);
            setContent(initialContent || "# 新技能\n\n在這裡輸入 Markdown 格式的提示詞...");
            setError(null);
        }
    }, [open, initialId, initialContent]);

    const handleSubmit = async () => {
        if (!id.trim()) { setError("請填寫技能 ID"); return; }
        if (!content.trim()) { setError("請填寫技能內容"); return; }

        setIsLoading(true); setError(null);
        try {
            const endpoint = mode === "create" ? "/api/skills/create" : "/api/skills/update";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id.trim(), content }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onOpenChange(false);
                onSaved();
            } else {
                setError(data.error || "儲存失敗");
            }
        } catch {
            setError("請求發送失敗");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
            <DialogContent showCloseButton={!isLoading} className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl border bg-primary/10 border-primary/20 flex items-center justify-center mb-2">
                        {mode === "create" ? <Plus className="w-5 h-5 text-primary" /> : <Pencil className="w-5 h-5 text-primary" />}
                    </div>
                    <DialogTitle className="text-foreground text-base">
                        {mode === "create" ? "新增自訂技能" : "編輯自訂技能"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                        編輯 Markdown 格式的技能提示詞。將自動存為 <code>src/skills/lib/{id || '<id>'}.md</code>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-[300px] flex flex-col">
                    <div className="flex-shrink-0">
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">檔案 ID (英文數字底線)</label>
                        <input
                            value={id}
                            onChange={e => setId(e.target.value)}
                            disabled={mode === "edit"}
                            placeholder="my_custom_skill"
                            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono"
                        />
                    </div>
                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">提示詞內容 (Markdown)</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="w-full flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground/90 font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                            placeholder="# 標題\n\n對 AI 的系統指令..."
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 flex-shrink-0">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2 flex-shrink-0 pt-2">
                    <Button variant="outline" className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => onOpenChange(false)} disabled={isLoading}>取消</Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? (
                            <span className="flex items-center gap-1.5"><RefreshCcw className="w-3.5 h-3.5 animate-spin" />儲存中...</span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                {mode === "create" ? <Plus className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                儲存技能
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Install Success Dialog ──────────────────────────────────────────────────
function InstallSuccessDialog({
    open, onOpenChange
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border text-foreground max-w-sm sm:max-w-[425px]">
                <DialogHeader className="flex flex-col items-center gap-2 pt-2">
                    <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-primary" />
                    </div>
                    <DialogTitle className="text-foreground text-lg mt-2 font-bold">技能已安裝成功</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm text-center leading-relaxed mt-2" asChild>
                        <div>
                            新技能已經加入「已載入模組」標籤中囉！<br />
                            請記得切換至 <strong>「已載入模組」</strong> 並將其 <strong>手動啟用</strong>，<br />
                            最後再點擊右上角的 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 mx-1 font-medium"><Zap className="w-3 h-3" />注入技能書</span> 即可。
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center mt-4">
                    <Button
                        className="bg-primary hover:bg-primary/90 text-primary-foreground w-full focus:ring-2 focus:ring-primary/50 outline-none"
                        onClick={() => onOpenChange(false)}
                    >
                        我知道了
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Delete Confirm Dialog ───────────────────────────────────────────────────
function DeleteConfirmDialog({
    open, onOpenChange, onConfirm, isLoading, skillTitle
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => void;
    isLoading: boolean;
    skillTitle: string;
}) {
    return (
        <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
            <DialogContent showCloseButton={!isLoading} className="bg-card border-border text-foreground max-w-sm">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-xl border bg-red-500/10 border-red-500/20 flex items-center justify-center mb-2">
                        <Trash2 className="w-5 h-5 text-red-500" />
                    </div>
                    <DialogTitle className="text-foreground text-base">刪除技能？</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                        您確定要刪除「<span className="text-red-500 font-medium">{skillTitle}</span>」嗎？此動作將永久移除該技能的 Markdown 檔案，且無法復原。
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => onOpenChange(false)} disabled={isLoading}>取消</Button>
                    <Button className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? (
                            <span className="flex items-center gap-1.5"><RefreshCcw className="w-3.5 h-3.5 animate-spin" />刪除中...</span>
                        ) : (
                            <span className="flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />確認刪除</span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const MARKET_CATEGORIES = [
    { id: 'all', name: '全部類別', name_en: 'All Categories' },
    { id: 'ai-and-llms', name: '人工智慧與模型', name_en: 'AI & LLMs' },
    { id: 'apple-apps-and-services', name: 'Apple 應用與服務', name_en: 'Apple Apps' },
    { id: 'browser-and-automation', name: '瀏覽器與自動化', name_en: 'Browser Automation' },
    { id: 'calendar-and-scheduling', name: '行事曆與排程', name_en: 'Calendar' },
    { id: 'clawdbot-tools', name: 'Clawdbot 工具', name_en: 'Clawdbot Tools' },
    { id: 'cli-utilities', name: '命令列工具', name_en: 'CLI Utilities' },
    { id: 'coding-agents-and-ides', name: '程式碼代理與 IDE', name_en: 'Coding Agents' },
    { id: 'communication', name: '通訊聯絡', name_en: 'Communication' },
    { id: 'data-and-analytics', name: '數據與分析', name_en: 'Data Analytics' },
    { id: 'devops-and-cloud', name: 'DevOps 與雲端', name_en: 'DevOps & Cloud' },
    { id: 'finance', name: '金融理財', name_en: 'Finance' },
    { id: 'gaming', name: '遊戲娛樂', name_en: 'Gaming' },
    { id: 'git-and-github', name: 'Git & GitHub', name_en: 'Git & GitHub' },
    { id: 'health-and-fitness', name: '健康與健身', name_en: 'Health & Fitness' },
    { id: 'image-and-video-generation', name: '圖像與影片生成', name_en: 'Image & Video' },
    { id: 'ios-and-macos-development', name: 'iOS/macOS 開發', name_en: 'iOS/macOS Dev' },
    { id: 'marketing-and-sales', name: '行銷與銷售', name_en: 'Marketing & Sales' },
    { id: 'media-and-streaming', name: '媒體與串流', name_en: 'Media' },
    { id: 'moltbook', name: 'Moltbook', name_en: 'Moltbook' },
    { id: 'notes-and-pkm', name: '筆記與知識管理', name_en: 'Notes & PKM' },
    { id: 'pdf-and-documents', name: 'PDF 與文件', name_en: 'PDF & Docs' },
    { id: 'personal-development', name: '個人成長', name_en: 'Personal Dev' },
    { id: 'productivity-and-tasks', name: '生產力與任務', name_en: 'Productivity' },
    { id: 'search-and-research', name: '搜索與研究', name_en: 'Search & Research' },
    { id: 'security-and-passwords', name: '安全與密碼', name_en: 'Security' },
    { id: 'self-hosted-and-automation', name: '自託管與自動化', name_en: 'Self-Hosted' },
    { id: 'shopping-and-e-commerce', name: '購物與電商', name_en: 'E-commerce' },
    { id: 'smart-home-and-iot', name: '智慧家庭與物聯網', name_en: 'Smart Home' },
    { id: 'speech-and-transcription', name: '語音與逐字稿', name_en: 'Speech' },
    { id: 'transportation', name: '交通運輸', name_en: 'Transportation' },
    { id: 'web-and-frontend-development', name: '網頁與前端開發', name_en: 'Web Dev' }
];

// ── Main Page ───────────────────────────────────────────────────────────────
export default function SkillsPage() {
    const [activeTab, setActiveTab] = useState<"installed" | "marketplace">("installed");

    // Installed Skills
    const [skills, setSkills] = useState<any[]>([]);
    const [selectedSkill, setSelectedSkill] = useState<any | null>(null);
    const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

    // Marketplace
    const [marketSkills, setMarketSkills] = useState<any[]>([]);
    const [selectedMarketSkill, setSelectedMarketSkill] = useState<any | null>(null);
    const [marketTotal, setMarketTotal] = useState(0);
    const [marketPage, setMarketPage] = useState(1);
    const [marketSearchText, setMarketSearchText] = useState("");
    const [marketSearchQuery, setMarketSearchQuery] = useState("");
    const [marketCategory, setMarketCategory] = useState("all");
    const [isMarketLoading, setIsMarketLoading] = useState(false);
    const [installingId, setInstallingId] = useState<string | null>(null);

    const [isInjecting, setIsInjecting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDone, setShowDone] = useState(false);

    // Editor state
    const [showEditor, setShowEditor] = useState(false);
    const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
    const [editTarget, setEditTarget] = useState<{ id: string, content: string }>({ id: "", content: "" });

    // Success dialog
    const [showInstallSuccess, setShowInstallSuccess] = useState(false);

    // Delete dialog
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sync hint
    const [showSyncHint, setShowSyncHint] = useState(false);
    const [syncHintType, setSyncHintType] = useState<"enable" | "delete">("enable");

    const loadSkills = useCallback(() => {
        fetch("/api/skills")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setSkills(data);
                    // Update selected skill if it exists
                    if (selectedSkill) {
                        const updated = data.find(s => s.id === selectedSkill.id);
                        if (updated) setSelectedSkill(updated);
                    } else if (data.length > 0) {
                        setSelectedSkill(data[0]);
                    }
                }
            })
            .catch((err) => console.error(err));
    }, [selectedSkill]);

    const loadMarketplace = useCallback(async (page = 1, search = marketSearchQuery, category = marketCategory) => {
        setIsMarketLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
                search,
                category
            });
            const res = await fetch(`/api/skills/marketplace?${params.toString()}`);
            const data = await res.json();
            setMarketSkills(data.skills || []);
            setMarketTotal(data.total || 0);

            if (data.skills && data.skills.length > 0 && !selectedMarketSkill) {
                setSelectedMarketSkill(data.skills[0]);
            }
        } catch (err) {
            console.error("Failed to load marketplace:", err);
        } finally {
            setIsMarketLoading(false);
        }
    }, [marketSearchQuery, marketCategory, selectedMarketSkill]);

    useEffect(() => {
        loadSkills();
        loadMarketplace(1, "", "all");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch marketplace when page or search query changes
    useEffect(() => {
        loadMarketplace(marketPage, marketSearchQuery, marketCategory);
    }, [marketPage, marketSearchQuery, marketCategory]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setMarketPage(1);
        setMarketSearchQuery(marketSearchText);
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setMarketCategory(e.target.value);
        setMarketPage(1);
    };

    const toggleSkill = async (id: string, enabled: boolean) => {
        try {
            const res = await fetch("/api/skills/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, enabled }),
            });
            const data = await res.json();
            if (data.success) {
                setSkills((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, isEnabled: enabled } : s))
                );
                if (selectedSkill?.id === id) {
                    setSelectedSkill((prev: any) => prev ? { ...prev, isEnabled: enabled } : null);
                }
                if (enabled) {
                    setSyncHintType("enable");
                    setShowSyncHint(true);
                }
                setHasUnsyncedChanges(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const installSkill = async (skill: any) => {
        setInstallingId(skill.id);
        try {
            const res = await fetch("/api/skills/marketplace/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: skill.id, repoUrl: skill.repoUrl }),
            });
            const data = await res.json();
            if (data.success) {
                setHasUnsyncedChanges(true);
                loadSkills();
                setShowInstallSuccess(true);
            }
        } catch (err) {
            console.error("Install failed:", err);
        } finally {
            setInstallingId(null);
        }
    };

    const handleInject = async () => {
        setIsInjecting(true);
        try {
            const res = await fetch("/api/skills/inject", { method: "POST" });
            
            // ── [v9.1.12] 強化非 JSON 回應處理 ──
            const contentType = res.headers.get("content-type");
            let data: any;
            
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            } else {
                const text = await res.text();
                data = { success: false, message: text || `Server error (${res.status})` };
            }

            if (data.success) {
                setShowConfirm(false);
                setHasUnsyncedChanges(false);
                setShowDone(true);
                setTimeout(() => {
                    setShowDone(false);
                    setIsInjecting(false);
                    setShowSyncHint(false);
                    loadSkills();
                }, 3000);
            } else {
                console.error("Injection failed:", data.message || data.error);
                alert(`注入失敗: ${data.message || data.error || "未知伺服器錯誤"}`);
                setIsInjecting(false);
            }
        } catch (err: any) {
            console.error(err);
            alert(`請求失敗: ${err.message || "請檢查網路連線或伺服器狀態"}`);
            setIsInjecting(false);
        }
    };

    const handleDeleteSkill = async () => {
        if (!selectedSkill) return;
        setIsDeleting(true);
        try {
            const res = await fetch("/api/skills/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedSkill.id }),
            });
            const data = await res.json();
            if (data.success) {
                setShowDeleteConfirm(false);
                setHasUnsyncedChanges(true); // 檔案刪除後也需要重新注入以同步內部狀態
                
                // ── [v9.1.13] 優化：僅在刪除「已啟用」的技能時顯示提示 ──
                if (selectedSkill.isEnabled) {
                    setSyncHintType("delete");
                    setShowSyncHint(true);
                }
                
                // 從列表中移除
                const updatedSkills = skills.filter(s => s.id !== selectedSkill.id);
                setSkills(updatedSkills);
                
                // 選取下一個或清空
                if (updatedSkills.length > 0) {
                    setSelectedSkill(updatedSkills[0]);
                } else {
                    setSelectedSkill(null);
                }
            } else {
                alert(data.error || "刪除失敗");
            }
        } catch (err) {
            console.error(err);
            alert("請求發送失敗");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateSkill = () => {
        setEditorMode("create");
        setEditTarget({ id: "", content: "" });
        setShowEditor(true);
    };

    const handleEditSkill = (e: React.MouseEvent, skill: any) => {
        e.stopPropagation();
        setEditorMode("edit");
        setEditTarget({ id: skill.id, content: skill.content });
        setShowEditor(true);
    };

    return (
        <>
            <div className="flex-1 overflow-hidden bg-background p-6 flex flex-col text-foreground">
                <div className="max-w-6xl w-full mx-auto h-full flex flex-col pt-4">
 
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="inline-flex items-center justify-center p-3 bg-primary/10 border border-primary/20 rounded-xl shadow-[0_0_20px_-5px_var(--primary)] shadow-primary/40">
                                <BookOpen className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-primary tracking-tight">
                                    技能說明書 (Skills)
                                </h1>
                                <p className="text-sm text-muted-foreground mt-0.5">管理 Golem 的核心能力與開放技能市場</p>
                            </div>
                        </div>
 
                        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-xl mr-auto ml-8 shadow-inner">
                            <button
                                onClick={() => setActiveTab("installed")}
                                className={`px-4 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${activeTab === "installed"
                                    ? "bg-secondary text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                    }`}
                            >
                                <BookOpen className="w-4 h-4" />
                                已載入模組
                            </button>
                            <button
                                onClick={() => setActiveTab("marketplace")}
                                className={`px-4 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${activeTab === "marketplace"
                                    ? "bg-secondary text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                    }`}
                            >
                                <Store className="w-4 h-4" />
                                技能市場
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCreateSkill}
                                className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground"
                            >
                                <Plus className="w-4 h-4" />
                                新增技能
                            </button>
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={isInjecting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${hasUnsyncedChanges
                                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 animate-pulse"
                                    : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                                    } ${isInjecting ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                                <Zap className={`w-4 h-4 ${isInjecting ? "animate-pulse" : ""}`} />
                                {isInjecting ? "注入中..." : "注入技能書"}
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-1 min-h-0 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                        {/* Detail View (Left) */}
                        <Card className="flex-[2] bg-card border-border shadow-2xl flex flex-col min-h-0 rounded-2xl overflow-hidden backdrop-blur-sm">
                            <CardHeader className="flex-shrink-0 border-b border-border bg-card/60 p-5 px-6">
                                {activeTab === "installed" ? (
                                    selectedSkill ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shadow-inner">
                                                    <BookOpen className="w-5 h-5 text-primary/80" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground leading-tight">
                                                        {selectedSkill.title}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                                        {selectedSkill.id}.md
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {!selectedSkill.isOptional && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary border border-border text-muted-foreground text-[11px] uppercase tracking-wider font-bold rounded-lg select-none">
                                                        <AlertCircle className="w-3.5 h-3.5 opacity-70" />
                                                        常駐核心技能
                                                    </div>
                                                )}
                                                {selectedSkill.isOptional && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(true)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:text-red-500 hover:bg-red-500/20 text-xs font-medium rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" /> 刪除
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleEditSkill(e, selectedSkill)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium rounded-lg transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" /> 編輯
                                                        </button>
                                                    </div>
                                                )}
                                                {selectedSkill.isOptional && (
                                                    <label className="relative inline-flex items-center cursor-pointer ml-1">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={selectedSkill.isEnabled}
                                                            onChange={(e) => toggleSkill(selectedSkill.id, e.target.checked)}
                                                        />
                                                        <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted-foreground peer-checked:after:bg-primary-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border border-border peer-checked:bg-primary peer-checked:border-primary shadow-inner"></div>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-[46px] flex items-center text-muted-foreground text-sm">請選擇一個技能以檢視內容</div>
                                    )
                                ) : (
                                    selectedMarketSkill ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shadow-inner">
                                                    <Store className="w-5 h-5 text-primary/80" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground leading-tight">
                                                        {selectedMarketSkill.title}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                                        {selectedMarketSkill.id}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {skills.some(s => s.id === selectedMarketSkill.id) ? (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs tracking-wider font-bold rounded-lg cursor-default">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        已安裝
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => installSkill(selectedMarketSkill)}
                                                        disabled={installingId === selectedMarketSkill.id}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-primary border border-primary/20 hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors shadow-lg disabled:opacity-50"
                                                    >
                                                        {installingId === selectedMarketSkill.id ? (
                                                            <><RefreshCcw className="w-4 h-4 animate-spin" /> 安裝中...</>
                                                        ) : (
                                                            <><Download className="w-4 h-4" /> 一鍵安裝</>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-[46px] flex items-center text-muted-foreground text-sm">請在右側選擇技能以檢視詳細</div>
                                    )
                                )}
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-0 scroll-smooth">
                                {activeTab === "installed" ? (
                                    selectedSkill ? (
                                        <div className="prose prose-slate dark:prose-invert prose-cyan max-w-none p-6 text-foreground/80 text-[15px] leading-relaxed 
                                            prose-headings:text-foreground prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                                            prose-a:text-primary hover:prose-a:text-primary/80 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                                            prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:shadow-lg
                                            prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-muted-foreground
                                            prose-strong:text-foreground prose-li:marker:text-muted-foreground/50"
                                        >
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {selectedSkill.content.replace(/<SkillModule[^>]*>([\s\S]*?)<\/SkillModule>/g, '$1').trim()}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 space-y-4">
                                            <BookOpen className="w-12 h-12 opacity-20" />
                                            <p>在右側列表中選擇技能</p>
                                        </div>
                                    )
                                ) : (
                                    selectedMarketSkill ? (
                                        <div className="p-8">
                                            <div className="flex gap-4 items-start mb-6">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-card border border-border flex items-center justify-center shadow-lg">
                                                    <Store className="w-8 h-8 text-primary/80" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-foreground mb-2">{selectedMarketSkill.title}</h2>
                                                    <div className="flex gap-2">
                                                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-secondary text-muted-foreground rounded-md border border-border">
                                                            <Tags className="w-3 h-3 text-primary" /> {selectedMarketSkill.category_name?.zh || selectedMarketSkill.category}
                                                        </span>
                                                        <a href={selectedMarketSkill.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs px-2.5 py-1 bg-secondary text-muted-foreground rounded-md border border-border hover:text-foreground hover:border-accent-foreground/30 transition-colors">
                                                            View on GitHub
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="prose prose-slate dark:prose-invert prose-cyan max-w-none text-foreground/80 text-[15px] leading-relaxed">
                                                <h3>Description</h3>
                                                {selectedMarketSkill.description_zh && (
                                                    <p className="font-medium text-foreground mb-2">{selectedMarketSkill.description_zh}</p>
                                                )}
                                                <p className={selectedMarketSkill.description_zh ? "text-muted-foreground text-sm italic" : "text-foreground/70"}>
                                                    {selectedMarketSkill.description}
                                                </p>
                                                <div className="p-4 mt-6 bg-secondary border border-border rounded-xl relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
                                                    <h4 className="flex items-center gap-2 text-primary text-sm font-bold uppercase tracking-wide mt-0 mb-3"><Zap className="w-4 h-4" />如何安裝</h4>
                                                    <p className="text-sm text-muted-foreground mt-0 m-0">
                                                        點擊右上角的「一鍵安裝」，Golem 會自動從 GitHub 抓取這個技能學會新能力！
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 space-y-4">
                                            <Store className="w-12 h-12 opacity-20" />
                                            <p>在市場列表中選擇技能</p>
                                        </div>
                                    )
                                )}
                            </CardContent>
                        </Card>

                        {/* List (Right) */}
                        <div className="flex-1 flex flex-col min-h-0 bg-card/30 border border-border rounded-2xl overflow-hidden shadow-xl">
                            {activeTab === "installed" ? (
                                <>
                                    <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm flex justify-between items-center shrink-0">
                                        <h2 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"></div>
                                            已載入模組 ({skills.length})
                                        </h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
                                        {skills.map((skill) => (
                                            <button
                                                key={skill.id}
                                                onClick={() => setSelectedSkill(skill)}
                                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200 group relative overflow-hidden ${selectedSkill?.id === skill.id
                                                    ? "bg-primary/10 border border-primary/50 shadow-lg"
                                                    : "hover:bg-secondary border border-transparent"
                                                    }`}
                                            >
                                                {/* Highlight accent on selected */}
                                                {selectedSkill?.id === skill.id && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_12px_rgba(var(--primary),0.6)] rounded-r-full"></div>
                                                )}

                                                <div className="flex flex-col gap-1 pr-4 z-10 w-full overflow-hidden">
                                                    <span className={`font-semibold text-[15px] truncate ${selectedSkill?.id === skill.id ? "text-primary" : "text-foreground"
                                                        }`}>
                                                        {skill.title}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {!skill.isOptional ? (
                                                            <span className="text-[9px] bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold shadow-[0_0_10px_-2px_rgba(99,102,241,0.2)]">
                                                                常駐核心
                                                            </span>
                                                        ) : skill.isEnabled ? (
                                                            <span className="flex items-center gap-1 text-[10px] text-primary uppercase tracking-wider font-bold">
                                                                <CheckCircle2 className="w-3 h-3" /> 已啟用
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">未啟用</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 z-10 shrink-0">
                                                    {skill.isOptional && (
                                                        <div
                                                            onClick={(e) => handleEditSkill(e, skill)}
                                                            className={`p-1.5 rounded-md transition-colors ${selectedSkill?.id === skill.id
                                                                ? "text-primary hover:bg-primary/20"
                                                                : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                                                                }`}
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}
                                                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedSkill?.id === skill.id ? "text-primary translate-x-1" : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                                                        }`} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0 flex flex-col gap-3">
                                        <form onSubmit={handleSearchSubmit} className="relative w-full">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={marketSearchText}
                                                onChange={(e) => setMarketSearchText(e.target.value)}
                                                placeholder="搜尋市場技能..."
                                                className="w-full bg-secondary/60 border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
                                            />
                                        </form>
                                        <div className="relative w-full">
                                            <select
                                                value={marketCategory}
                                                onChange={handleCategoryChange}
                                                className="w-full appearance-none bg-secondary/60 border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
                                            >
                                                {MARKET_CATEGORIES.map(cat => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.name} {cat.name_en ? `(${cat.name_en})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
                                        {isMarketLoading ? (
                                            <div className="p-8 flex flex-col items-center justify-center text-muted-foreground">
                                                <RefreshCcw className="w-6 h-6 animate-spin mb-4" />
                                                <p className="text-sm">載入技能資料中...</p>
                                            </div>
                                        ) : marketSkills.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm">找不到相關技能</div>
                                        ) : (
                                            marketSkills.map((skill) => (
                                                <button
                                                    key={skill.id}
                                                    onClick={() => setSelectedMarketSkill(skill)}
                                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200 group relative overflow-hidden ${selectedMarketSkill?.id === skill.id
                                                        ? "bg-primary/10 border border-primary/50 shadow-lg"
                                                        : "hover:bg-secondary border border-transparent"
                                                        }`}
                                                >
                                                    {selectedMarketSkill?.id === skill.id && (
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_12px_rgba(var(--primary),0.6)] rounded-r-full"></div>
                                                    )}
                                                    <div className="flex flex-col gap-1 pr-4 z-10 w-full overflow-hidden">
                                                        <span className={`font-semibold text-sm truncate w-full ${selectedMarketSkill?.id === skill.id ? "text-primary" : "text-foreground"
                                                            }`}>
                                                            {skill.title}
                                                        </span>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] text-muted-foreground truncate w-3/4" title={skill.description_zh || skill.description}>
                                                                {skill.description_zh || skill.description}
                                                            </span>
                                                            {skills.some(installedSkill => installedSkill.id === skill.id) && (
                                                                <span className="text-[9px] bg-green-500/10 text-green-500 border border-green-500/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
                                                                    已安裝
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                    {/* Pagination Controls */}
                                    <div className="p-3 border-t border-border bg-card/50 shrink-0 flex items-center justify-between text-sm">
                                        <button
                                            onClick={() => setMarketPage(p => Math.max(1, p - 1))}
                                            disabled={marketPage === 1}
                                            className="px-3 py-1 bg-secondary border border-border rounded text-foreground disabled:opacity-50 hover:bg-accent transition"
                                        >
                                            上頁
                                        </button>
                                        <span className="text-muted-foreground text-xs">
                                            {marketPage} / {Math.ceil(marketTotal / 20) || 1}
                                        </span>
                                        <button
                                            onClick={() => setMarketPage(p => p + 1)}
                                            disabled={marketPage >= Math.ceil(marketTotal / 20)}
                                            className="px-3 py-1 bg-secondary border border-border rounded text-foreground disabled:opacity-50 hover:bg-accent transition"
                                        >
                                            下頁
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Floating Sync Hint */}
                {showSyncHint && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-amber-500/10 border border-amber-500/30 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(245,158,11,0.3)] flex items-center gap-4 text-foreground">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-200">
                                    {syncHintType === "enable" ? "技能已啟用！" : "技能已刪除！"}
                                </p>
                                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">請記得點擊右上方「注入技能書」按鈕，讓 AI 同步最新的能力。</p>
                            </div>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                                onClick={() => setShowSyncHint(false)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Dialogs */}
            <InjectConfirmDialog open={showConfirm} onOpenChange={setShowConfirm} onConfirm={handleInject} isLoading={isInjecting} />
            <InjectDoneDialog open={showDone} onOpenChange={setShowDone} />
            <SkillEditorDialog
                open={showEditor}
                onOpenChange={setShowEditor}
                mode={editorMode}
                initialId={editTarget.id}
                initialContent={editTarget.content}
                onSaved={() => {
                    setHasUnsyncedChanges(true);
                    loadSkills();
                }}
            />
            <InstallSuccessDialog
                open={showInstallSuccess}
                onOpenChange={setShowInstallSuccess}
            />

            <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleDeleteSkill}
                isLoading={isDeleting}
                skillTitle={selectedSkill?.title || ""}
            />
        </>
    );
}
