import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Measurement {
    id: string;
    measurement_type: string;
    measurement_date: string;
    location: string;
    measured_value: number | null;
    unit: string | null;
    limit_value: number | null;
    result: string;
    measuring_company: string | null;
    certificate_no: string | null;
    next_measurement_date: string | null;
    file_url: string | null;
    notes: string | null;
}

const TYPES: Record<string, { label: string; unit: string; limit: string }> = {
    gurultu: { label: "Gürültü", unit: "dB(A)", limit: "85" },
    toz: { label: "Toz / Kimyasal", unit: "mg/m³", limit: "" },
    aydinlatma: { label: "Aydınlatma", unit: "lux", limit: "200" },
    titresim: { label: "Titreşim", unit: "m/s²", limit: "" },
    kimyasal: { label: "Kimyasal / Gaz", unit: "ppm", limit: "" },
    diger: { label: "Diğer", unit: "", limit: "" },
};

function defaultForm() {
    return {
        measurement_type: "gurultu",
        measurement_date: new Date().toISOString().split("T")[0],
        location: "",
        measured_value: "",
        unit: "dB(A)",
        limit_value: "85",
        result: "uygun",
        measuring_company: "",
        certificate_no: "",
        next_measurement_date: "",
        notes: "",
    };
}

export default function MeasurementRecords() {
    const { profile } = useAuthStore();
    const [measurements, setMeasurements] = useState<Measurement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<any>(defaultForm());
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [filterType, setFilterType] = useState("tumu");

    useEffect(() => { if (profile?.tenant_id) fetchData(); }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase.from("ohs_measurements").select("*").eq("company_id", profile!.tenant_id!).order("measurement_date", { ascending: false });
        setMeasurements(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!form.location || !form.measurement_date) return alert("Konum ve tarih zorunludur.");
        setSaving(true);
        try {
            const payload = {
                ...form,
                company_id: profile!.tenant_id!,
                created_by: profile!.id,
                measured_value: form.measured_value ? parseFloat(form.measured_value) : null,
                limit_value: form.limit_value ? parseFloat(form.limit_value) : null,
            };
            const { error } = await supabase.from("ohs_measurements").insert([payload]);
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
            const path = `measurements/${profile!.tenant_id!}/${id}.${ext}`;
            const { error } = await supabase.storage.from("ohs-documents").upload(path, file, { upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from("ohs-documents").getPublicUrl(path);
            await supabase.from("ohs_measurements").update({ file_url: publicUrl }).eq("id", id);
            fetchData();
        } catch (e: any) { alert("Dosya yüklenemedi: " + e.message); }
        finally { setUploading(null); }
    };

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors";

    const filtered = filterType === "tumu" ? measurements : measurements.filter(m => m.measurement_type === filterType);

    const today = new Date();
    const overdueCount = measurements.filter(m => m.next_measurement_date && new Date(m.next_measurement_date) < today).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Periyodik Ölçüm Kayıtları</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Gürültü, toz, aydınlatma ve diğer çevresel ölçüm raporları</p>
                </div>
                <button onClick={() => { setShowModal(true); setForm(defaultForm()); }}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-teal-500/20">
                    + Ölçüm Ekle
                </button>
            </div>

            {overdueCount > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">⏰</span>
                    <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{overdueCount} ölçümün yenilenme tarihi geçti!</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Yasal yükümlülüklerinizi yerine getirmek için güncelleyin.</p>
                    </div>
                </div>
            )}

            {/* Filtreler */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => setFilterType("tumu")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterType === "tumu" ? "bg-teal-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-teal-400"}`}>Tümü ({measurements.length})</button>
                {Object.entries(TYPES).map(([k, v]) => (
                    <button key={k} onClick={() => setFilterType(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterType === k ? "bg-teal-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-teal-400"}`}>
                        {v.label} ({measurements.filter(m => m.measurement_type === k).length})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-2">🔬</div>
                    <p className="text-sm text-slate-500">Ölçüm kaydı bulunamadı.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                {["Tür", "Tarih", "Konum", "Ölçüm Değeri", "Sınır", "Sonuç", "Yapan Firma", "Sertifika", "Sonraki Ölçüm", "Dosya"].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filtered.map(m => {
                                const overdue = m.next_measurement_date && new Date(m.next_measurement_date) < today;
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-3 py-3">
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{TYPES[m.measurement_type]?.label || m.measurement_type}</span>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{new Date(m.measurement_date).toLocaleDateString("tr-TR")}</td>
                                        <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-300">{m.location}</td>
                                        <td className="px-3 py-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                                            {m.measured_value != null ? `${m.measured_value} ${m.unit || ""}` : "—"}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-slate-500">
                                            {m.limit_value != null ? `${m.limit_value} ${m.unit || ""}` : "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.result === "uygun" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400"}`}>
                                                {m.result === "uygun" ? "Uygun" : "Uygunsuz"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{m.measuring_company || "—"}</td>
                                        <td className="px-3 py-3 text-xs font-mono text-slate-400">{m.certificate_no || "—"}</td>
                                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                                            {m.next_measurement_date ? (
                                                <span className={overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-500 dark:text-slate-400"}>
                                                    {overdue ? "⚠️ " : ""}{new Date(m.next_measurement_date).toLocaleDateString("tr-TR")}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {m.file_url ? (
                                                <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-500 hover:text-teal-400 font-medium">📄 İndir</a>
                                            ) : (
                                                <label className="cursor-pointer">
                                                    <span className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">{uploading === m.id ? "⏳" : "📎 Ekle"}</span>
                                                    <input type="file" accept=".pdf" className="hidden" disabled={!!uploading}
                                                        onChange={e => { if (e.target.files?.[0]) handleFileUpload(m.id, e.target.files[0]); }} />
                                                </label>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Ekleme Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 my-8 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ölçüm Kaydı Ekle</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Ölçüm Türü</label>
                            <select value={form.measurement_type}
                                onChange={e => {
                                    const t = TYPES[e.target.value];
                                    setForm((f: any) => ({ ...f, measurement_type: e.target.value, unit: t.unit, limit_value: t.limit }));
                                }} className={inputCls}>
                                {Object.entries(TYPES).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { l: "Ölçüm Tarihi *", k: "measurement_date", t: "date" },
                                { l: "Sonraki Ölçüm Tarihi", k: "next_measurement_date", t: "date" },
                                { l: "Ölçüm Değeri", k: "measured_value", t: "number", ph: "85.4" },
                                { l: "Birim", k: "unit", t: "text", ph: "dB(A), lux, mg/m³..." },
                                { l: "Yasal Sınır Değeri", k: "limit_value", t: "number", ph: "85" },
                                { l: "Ölçüm Yapan Firma", k: "measuring_company", t: "text", ph: "Akustik Lab. A.Ş." },
                                { l: "Sertifika / Belge No", k: "certificate_no", t: "text", ph: "ÖL-2024-001" },
                            ].map(f => (
                                <div key={f.k}>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{f.l}</label>
                                    <input type={f.t} value={form[f.k]} placeholder={(f as any).ph}
                                        onChange={e => setForm((prev: any) => ({ ...prev, [f.k]: e.target.value }))} className={inputCls} />
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Ölçüm Noktası / Konum *</label>
                            <input type="text" value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} placeholder="Makine parkuru, 2. Kat depo kapısı..." className={inputCls} />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Sonuç</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[["uygun", "✅ Uygun"], ["uygunsuz", "⚠️ Uygunsuz"]].map(([v, l]) => (
                                    <button key={v} onClick={() => setForm((f: any) => ({ ...f, result: v }))}
                                        className={`py-2 rounded-lg text-sm font-medium transition-colors border-2 ${form.result === v ? (v === "uygun" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300") : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Notlar</label>
                            <textarea rows={2} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} className={inputCls + " resize-none"} />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold transition-colors shadow-md shadow-teal-500/20 disabled:opacity-50">
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
