import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Risk {
    id: string;
    title: string;
    assessment_date: string;
    review_date: string | null;
    department: string | null;
    assessor_name: string;
    risk_count: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    status: string;
    file_url: string | null;
    notes: string | null;
}

function defaultForm() {
    return {
        title: "",
        assessment_date: new Date().toISOString().split("T")[0],
        review_date: "",
        department: "",
        assessor_name: "",
        risk_count: 0,
        high_risk_count: 0,
        medium_risk_count: 0,
        low_risk_count: 0,
        notes: "",
        status: "aktif",
    };
}

export default function RiskAssessments() {
    const { profile } = useAuthStore();
    const [risks, setRisks] = useState<Risk[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(defaultForm());
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => { if (profile?.tenant_id) fetchData(); }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase.from("ohs_risk_assessments").select("*").eq("company_id", profile!.tenant_id!).order("assessment_date", { ascending: false });
        setRisks(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!form.title || !form.assessment_date || !form.assessor_name) return alert("Başlık, tarih ve değerlendiren zorunludur.");
        setSaving(true);
        try {
            const payload = { ...form, company_id: profile!.tenant_id!, created_by: profile!.id };
            const { error } = await supabase.from("ohs_risk_assessments").insert([payload]);
            if (error) throw error;
            setShowModal(false);
            setForm(defaultForm());
            fetchData();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setSaving(false); }
    };

    const handleFileUpload = async (id: string, file: File) => {
        setUploading(id);
        try {
            const ext = file.name.split(".").pop();
            const path = `risks/${profile!.tenant_id!}/${id}.${ext}`;
            const { error } = await supabase.storage.from("ohs-documents").upload(path, file, { upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from("ohs-documents").getPublicUrl(path);
            await supabase.from("ohs_risk_assessments").update({ file_url: publicUrl }).eq("id", id);
            fetchData();
        } catch (e: any) { alert("Dosya yüklenemedi: " + e.message); }
        finally { setUploading(null); }
    };

    const handleArchive = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "arsiv" ? "aktif" : currentStatus === "aktif" ? "revizyon" : "arsiv";
        await supabase.from("ohs_risk_assessments").update({ status: newStatus }).eq("id", id);
        fetchData();
    };

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors";

    const STATUS_COLORS: Record<string, string> = {
        aktif: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        revizyon: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400",
        arsiv: "bg-slate-100 dark:bg-slate-800 text-slate-500",
    };

    const totalActive = risks.filter(r => r.status === "aktif").length;
    const totalRevision = risks.filter(r => r.status === "revizyon").length;
    const totalHigh = risks.reduce((s, r) => s + (r.high_risk_count || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Risk Değerlendirme Raporları</h2>
                    <p className="text-sm text-slate-500 mt-0.5">6331 Sayılı Kanun gereği yapılan risk değerlendirme kayıtları</p>
                </div>
                <button onClick={() => { setShowModal(true); setForm(defaultForm()); }}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-purple-500/20">
                    + Rapor Ekle
                </button>
            </div>

            {/* Özet Kartları */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Aktif Rapor", value: totalActive, color: "text-emerald-500" },
                    { label: "Revizyon Bekleyen", value: totalRevision, color: "text-amber-500" },
                    { label: "Yüksek Risk Sayısı", value: totalHigh, color: "text-rose-500" },
                ].map(c => (
                    <div key={c.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-sm">
                        <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : risks.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-sm text-slate-500">Henüz risk değerlendirme raporu girilmedi.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {risks.map(r => {
                        const isOverdue = r.review_date && new Date(r.review_date) < new Date();
                        return (
                            <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className={`h-1 ${r.high_risk_count > 0 ? "bg-rose-500" : r.medium_risk_count > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{r.title}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-none ${STATUS_COLORS[r.status] || ""}`}>
                                            {r.status === "aktif" ? "Aktif" : r.status === "revizyon" ? "Revizyon" : "Arşiv"}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-0.5">
                                        <div>📅 {new Date(r.assessment_date).toLocaleDateString("tr-TR")} — {r.assessor_name}</div>
                                        {r.department && <div>🏢 {r.department}</div>}
                                        {r.review_date && (
                                            <div className={isOverdue ? "text-rose-500 font-medium" : ""}>
                                                🔄 Revizyon: {new Date(r.review_date).toLocaleDateString("tr-TR")}{isOverdue ? " ⚠️" : ""}
                                            </div>
                                        )}
                                    </div>

                                    {/* Risk Dağılımı */}
                                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                                        <div className="bg-rose-50 dark:bg-rose-500/10 rounded-lg py-1.5">
                                            <div className="font-bold text-rose-600 dark:text-rose-400">{r.high_risk_count}</div>
                                            <div className="text-slate-400">Yüksek</div>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg py-1.5">
                                            <div className="font-bold text-amber-600 dark:text-amber-400">{r.medium_risk_count}</div>
                                            <div className="text-slate-400">Orta</div>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg py-1.5">
                                            <div className="font-bold text-emerald-600 dark:text-emerald-400">{r.low_risk_count}</div>
                                            <div className="text-slate-400">Düşük</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-50 dark:border-slate-800">
                                        {r.file_url ? (
                                            <a href={r.file_url} target="_blank" rel="noopener noreferrer"
                                                className="flex-1 text-center py-1.5 text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors font-medium">
                                                📥 Rapora Bak
                                            </a>
                                        ) : (
                                            <label className="flex-1 cursor-pointer">
                                                <span className={`flex text-center justify-center py-1.5 text-xs rounded-lg transition-colors font-medium ${uploading === r.id ? "bg-slate-100 dark:bg-slate-800 text-slate-400" : "bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                                                    {uploading === r.id ? "Yükleniyor..." : "📎 PDF Yükle"}
                                                </span>
                                                <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={!!uploading}
                                                    onChange={e => { if (e.target.files?.[0]) handleFileUpload(r.id, e.target.files[0]); }} />
                                            </label>
                                        )}
                                        <button onClick={() => handleArchive(r.id, r.status)}
                                            className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            {r.status === "aktif" ? "Revize Et" : r.status === "revizyon" ? "Arşivle" : "Aktif Et"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Ekleme Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 my-8 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Risk Değerlendirme Ekle</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Rapor Başlığı *</label>
                            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ör. Üretim Alanı Risk Değerlendirmesi" className={inputCls} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Değerlendirme Tarihi *</label>
                                <input type="date" value={form.assessment_date} onChange={e => setForm(f => ({ ...f, assessment_date: e.target.value }))} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Sonraki Revizyon</label>
                                <input type="date" value={form.review_date} onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Değerlendiren *</label>
                                <input type="text" value={form.assessor_name} onChange={e => setForm(f => ({ ...f, assessor_name: e.target.value }))} placeholder="İSG Uzmanı Adı" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Departman / Alan</label>
                                <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Üretim, Depo..." className={inputCls} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Risk Dağılımı</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[{ l: "Yüksek Risk", k: "high_risk_count", color: "rose" }, { l: "Orta Risk", k: "medium_risk_count", color: "amber" }, { l: "Düşük Risk", k: "low_risk_count", color: "emerald" }].map(f => (
                                    <div key={f.k}>
                                        <label className="block text-xs text-slate-500 mb-1">{f.l}</label>
                                        <input type="number" min="0" value={(form as any)[f.k]}
                                            onChange={e => setForm(prev => ({ ...prev, [f.k]: parseInt(e.target.value) || 0, risk_count: (prev.high_risk_count + prev.medium_risk_count + prev.low_risk_count) }))}
                                            className={inputCls} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Notlar</label>
                            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls + " resize-none"} />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors shadow-md shadow-purple-500/20 disabled:opacity-50">
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
