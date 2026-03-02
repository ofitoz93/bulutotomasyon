import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Audit {
    id: string;
    tracking_no: string;
    audit_type: string;
    audit_date: string;
    auditor_name: string;
    auditor_institution: string | null;
    scope: string | null;
    findings: string | null;
    nonconformities: string | null;
    status: string;
    result: string;
    deadline: string | null;
    file_url: string | null;
}

function defaultForm() {
    return {
        audit_type: "ic",
        audit_date: new Date().toISOString().split("T")[0],
        auditor_name: "",
        auditor_institution: "",
        scope: "",
        findings: "",
        nonconformities: "",
        recommendations: "",
        corrective_actions: "",
        deadline: "",
        result: "uygun",
    };
}

const STATUS_COLORS: Record<string, string> = {
    acik: "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
    takipte: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
    kapali: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const RESULT_COLORS: Record<string, string> = {
    uygun: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    kosullu_uygun: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
    uygunsuz: "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export default function AuditTracking() {
    const { profile } = useAuthStore();
    const [audits, setAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(defaultForm());
    const [saving, setSaving] = useState(false);
    const [selected, setSelected] = useState<Audit | null>(null);
    const [fileUploading, setFileUploading] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase.from("ohs_audits").select("*").eq("company_id", profile!.tenant_id!).order("audit_date", { ascending: false });
        setAudits(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!form.auditor_name || !form.audit_date) return alert("Denetçi adı ve tarihi zorunludur.");
        setSaving(true);
        try {
            const payload = { ...form, company_id: profile!.tenant_id!, created_by: profile!.id, status: "acik" };
            const { error } = await supabase.from("ohs_audits").insert([payload]);
            if (error) throw error;
            setShowModal(false);
            setForm(defaultForm());
            fetchData();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setSaving(false); }
    };

    const handleFileUpload = async (auditId: string, file: File) => {
        setFileUploading(true);
        try {
            const ext = file.name.split(".").pop();
            const path = `audits/${profile!.tenant_id!}/${auditId}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("ohs-documents").upload(path, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from("ohs-documents").getPublicUrl(path);
            await supabase.from("ohs_audits").update({ file_url: publicUrl }).eq("id", auditId);
            fetchData();
        } catch (e: any) { alert("Dosya yüklenemedi: " + e.message); }
        finally { setFileUploading(false); }
    };

    const handleStatus = async (id: string, status: string) => {
        await supabase.from("ohs_audits").update({ status }).eq("id", id);
        fetchData();
        setSelected(null);
    };

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors";

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">İSG Denetim Takibi</h2>
                    <p className="text-sm text-slate-500 mt-0.5">İç ve dış denetim kayıtları ile takip listesi</p>
                </div>
                <button onClick={() => { setShowModal(true); setForm(defaultForm()); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-500/20">
                    + Denetim Ekle
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : audits.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-2">🔍</div>
                    <p className="text-sm text-slate-500">Henüz denetim kaydı girilmedi.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                {["Tür", "Tarih", "Denetçi / Kurum", "Kapsam", "Sonuç", "Termin", "Durum", "Dosya", ""].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {audits.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => setSelected(a)}>
                                    <td className="px-3 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.audit_type === "dis" ? "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300" : "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"}`}>
                                            {a.audit_type === "dis" ? "Dış" : "İç"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{new Date(a.audit_date).toLocaleDateString("tr-TR")}</td>
                                    <td className="px-3 py-3">
                                        <div className="text-sm text-slate-800 dark:text-slate-200 font-medium">{a.auditor_name}</div>
                                        {a.auditor_institution && <div className="text-xs text-slate-400">{a.auditor_institution}</div>}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">{a.scope || "—"}</td>
                                    <td className="px-3 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESULT_COLORS[a.result] || ""}`}>
                                            {a.result === "uygun" ? "Uygun" : a.result === "kosullu_uygun" ? "Koşullu" : "Uygunsuz"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                                        {a.deadline ? new Date(a.deadline).toLocaleDateString("tr-TR") : "—"}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || ""}`}>
                                            {a.status === "kapali" ? "Kapalı" : a.status === "takipte" ? "Takipte" : "Açık"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                        {a.file_url ? (
                                            <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-400 font-medium">📄 İndir</a>
                                        ) : (
                                            <label className="cursor-pointer">
                                                <span className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">📎 Ekle</span>
                                                <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={fileUploading}
                                                    onChange={e => { if (e.target.files?.[0]) handleFileUpload(a.id, e.target.files[0]); }} />
                                            </label>
                                        )}
                                    </td>
                                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                        {a.status !== "kapali" && (
                                            <button onClick={() => handleStatus(a.id, a.status === "acik" ? "takipte" : "kapali")}
                                                className="text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                                                {a.status === "acik" ? "Takibe Al" : "Kapat"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Ekleme Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Denetim Kaydı Ekle</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
                        </div>

                        {/* Tür */}
                        <div className="grid grid-cols-2 gap-3">
                            {[{ v: "ic", l: "İç Denetim", d: "Şirket içi yapılan denetim" }, { v: "dis", l: "Dış Denetim", d: "SGK, Bakanlık, vb." }].map(t => (
                                <button key={t.v} onClick={() => setForm(f => ({ ...f, audit_type: t.v }))}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.audit_type === t.v ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.l}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{t.d}</div>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { l: "Denetim Tarihi *", key: "audit_date", type: "date" },
                                { l: "Termin Tarihi", key: "deadline", type: "date" },
                                { l: "Denetçi Adı *", key: "auditor_name", type: "text", ph: "Uzman Adı..." },
                                { l: "Kurum / Firma", key: "auditor_institution", type: "text", ph: "SGK, ÇSGB..." },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{f.l}</label>
                                    <input type={f.type} value={(form as any)[f.key]} placeholder={(f as any).ph}
                                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputCls} />
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Denetim Sonucu</label>
                            <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} className={inputCls}>
                                <option value="uygun">Uygun</option>
                                <option value="kosullu_uygun">Koşullu Uygun</option>
                                <option value="uygunsuz">Uygunsuz</option>
                            </select>
                        </div>

                        {[
                            { l: "Denetim Kapsamı", key: "scope", ph: "Hangi alanlar denetlendi..." },
                            { l: "Tespitler", key: "findings", ph: "Olumlu/olumsuz tespitler..." },
                            { l: "Uygunsuzluklar", key: "nonconformities", ph: "Bulunan uygunsuzluklar..." },
                            { l: "Öneriler", key: "recommendations", ph: "Denetçi önerileri..." },
                            { l: "Düzeltici Faaliyetler / DÖF", key: "corrective_actions", ph: "Planlanan veya tamamlanan faaliyetler..." },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{f.l}</label>
                                <textarea rows={2} value={(form as any)[f.key]} placeholder={f.ph}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputCls + " resize-none"} />
                            </div>
                        ))}

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50">
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detay */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-end z-50">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto shadow-2xl">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">Denetim Detayı</h2>
                            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
                        </div>
                        <div className="p-5 space-y-4 text-sm">
                            {[["Tarih", new Date(selected.audit_date).toLocaleDateString("tr-TR")], ["Tür", selected.audit_type === "dis" ? "Dış Denetim" : "İç Denetim"], ["Denetçi", selected.auditor_name], ["Kurum", selected.auditor_institution || "—"], ["Kapsam", selected.scope || "—"], ["Tespitler", selected.findings || "—"], ["Uygunsuzluklar", selected.nonconformities || "—"]].map(([k, v]) => (
                                <div key={k} className="border-b border-slate-50 dark:border-slate-800 pb-2">
                                    <p className="text-xs text-slate-400 font-semibold uppercase mb-0.5">{k}</p>
                                    <p className="text-slate-700 dark:text-slate-300">{v}</p>
                                </div>
                            ))}
                            {selected.file_url && (
                                <a href={selected.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm font-medium">
                                    📄 Denetim Raporunu İndir
                                </a>
                            )}
                            {selected.status !== "kapali" && (
                                <div className="flex gap-2 pt-2">
                                    {selected.status === "acik" && (
                                        <button onClick={() => handleStatus(selected.id, "takipte")} className="flex-1 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium transition-colors">Takibe Al</button>
                                    )}
                                    <button onClick={() => handleStatus(selected.id, "kapali")} className="flex-1 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Kapat</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
