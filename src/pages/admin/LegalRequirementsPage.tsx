import { useState, useEffect } from "react";
import LegalListTab from "./components/LegalListTab";
import LegalTrackingTab from "./components/LegalTrackingTab";
import LegalSettingsTab from "./components/LegalSettingsTab";
import { Scale, CheckSquare, Settings, FileDown, X, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { exportToExcel } from "./utils/legalExport";
import type { LegalExportMetadata } from "./utils/legalExport";

export default function LegalRequirementsPage() {
    const { profile } = useAuthStore();
    const [activeTab, setActiveTab] = useState<"list" | "tracking" | "settings">("list");
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportMeta, setExportMeta] = useState<LegalExportMetadata>({
        docNo: "",
        effectiveDate: new Date().toISOString().split('T')[0],
        revNo: "00",
        revDate: new Date().toISOString().split('T')[0],
    });

    const handleExport = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsExporting(true);
        try {
            // 1. Tüm veriyi çek (Reg -> Article -> Tracking)
            const { data: regs } = await supabase.from("legal_regulations").select("*").order("name");
            const { data: arts } = await supabase.from("legal_articles").select("*");
            const { data: tracks } = await supabase.from("legal_tracking").select("*");
            const { data: comp } = await supabase.from("companies").select("legal_logo_url").eq("id", profile?.tenant_id).single();

            if (!regs) throw new Error("Veri bulunamadı.");

            // 2. Veriyi düzleştir (Flatten)
            const exportData: any[] = [];
            regs.forEach(reg => {
                const regArts = (arts || []).filter(a => a.regulation_id === reg.id);
                regArts.forEach(art => {
                    const artTracks = (tracks || []).filter(t => t.article_id === art.id);
                    
                    if (artTracks.length === 0) {
                        // Takibi olmayan maddeler için boş satır
                        exportData.push({
                            reg_name: reg.name,
                            gazette_date: reg.gazette_date,
                            gazette_number: reg.gazette_number,
                            last_modification_date: reg.last_modification_date,
                            reg_effective_date: reg.effective_date,
                            article_number: art.article_number,
                            provision: art.provision,
                            period: art.period,
                            location: '-',
                            current_status: '-',
                            is_compliant: null,
                            action_required: '-',
                            responsible_persons: '-',
                            due_date: '-'
                        });
                    } else {
                        artTracks.forEach(track => {
                            exportData.push({
                                reg_name: reg.name,
                                gazette_date: reg.gazette_date,
                                gazette_number: reg.gazette_number,
                                last_modification_date: reg.last_modification_date,
                                reg_effective_date: reg.effective_date,
                                article_number: art.article_number,
                                provision: art.provision,
                                period: art.period,
                                ...track
                            });
                        });
                    }
                });
            });

            // 3. Excel Üret
            await exportToExcel(exportData, exportMeta, comp?.legal_logo_url);
            setIsExportModalOpen(false);
        } catch (err: any) {
            alert("Export hatası: " + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Yasal Şartlar Takibi</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Sistem genelinde yasal mevzuatları kaydedin ve lokasyon bazlı uyumluluk takibi yapın.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                        <FileDown className="w-4 h-4" />
                        Excel'e Aktar
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => setActiveTab("list")}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "list"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                >
                    <Scale className="w-4 h-4" />
                    Mevzuat Listesi (Master List)
                </button>
                <button
                    onClick={() => setActiveTab("tracking")}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "tracking"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                >
                    <CheckSquare className="w-4 h-4" />
                    Takip Çizelgesi
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "settings"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                >
                    <Settings className="w-4 h-4" />
                    Ayarlar
                </button>
            </div>

            {/* Tab Contents */}
            <div className="mt-6">
                {activeTab === "list" && <LegalListTab />}
                {activeTab === "tracking" && <LegalTrackingTab />}
                {activeTab === "settings" && <LegalSettingsTab />}
            </div>

            {/* Excel Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
                                    <FileDown className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Excel Raporu Al</h3>
                            </div>
                            <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleExport} className="p-6 space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg flex gap-3 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 mb-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <div>
                                    <p className="font-semibold">Bilgi</p>
                                    <p>Excel dokümanının sağ üst köşesinde yer alacak başlık bilgilerini giriniz.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Döküman No</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={exportMeta.docNo} 
                                        onChange={e => setExportMeta({...exportMeta, docNo: e.target.value})}
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        placeholder="Örn: YS-001"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Yürürlük Tarihi</label>
                                        <input 
                                            required
                                            type="date" 
                                            value={exportMeta.effectiveDate} 
                                            onChange={e => setExportMeta({...exportMeta, effectiveDate: e.target.value})}
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Revizyon No</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={exportMeta.revNo} 
                                            onChange={e => setExportMeta({...exportMeta, revNo: e.target.value})}
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Revizyon Tarihi</label>
                                    <input 
                                        required
                                        type="date" 
                                        value={exportMeta.revDate} 
                                        onChange={e => setExportMeta({...exportMeta, revDate: e.target.value})}
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    İptal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isExporting}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isExporting ? (
                                        <>
                                            <Clock className="w-4 h-4 animate-spin" />
                                            Hazırlanıyor...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Excel Üret
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

