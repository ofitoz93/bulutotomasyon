import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Accident {
    id: string;
    tracking_no: string;
    type: "kaza" | "ramak_kala";
    accident_date: string;
    accident_time: string | null;
    location: string | null;
    department: string | null;
    injured_person_name: string | null;
    injury_type: string | null;
    body_part: string | null;
    severity: string;
    lost_workdays: number;
    description: string;
    status: string;
    created_at: string;
    immediate_cause?: string;
    root_cause?: string;
    corrective_action?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    olumlu: "bg-slate-900 dark:bg-slate-950 text-white border-slate-900 dark:border-slate-800",
    agir: "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30",
    orta: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30",
    hafif: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30",
};
const SEVERITY_LABELS: Record<string, string> = { olumlu: "Ölümlü", agir: "Ağır", orta: "Orta", hafif: "Hafif" };

function defaultForm() {
    return {
        type: "kaza" as "kaza" | "ramak_kala",
        accident_date: new Date().toISOString().split("T")[0],
        accident_time: "",
        location: "",
        department: "",
        injured_person_name: "",
        injury_type: "",
        body_part: "",
        severity: "hafif",
        lost_workdays: 0,
        description: "",
        immediate_cause: "",
        root_cause: "",
        corrective_action: "",
        witness_names: "",
    };
}

export default function AccidentTracking() {
    const { profile } = useAuthStore();
    const [accidents, setAccidents] = useState<Accident[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(defaultForm());
    const [saving, setSaving] = useState(false);
    const [selectedAccident, setSelectedAccident] = useState<Accident | null>(null);
    const [filter, setFilter] = useState<"tumu" | "kaza" | "ramak_kala">("tumu");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("ohs_accidents")
            .select("*")
            .eq("company_id", profile!.tenant_id!)
            .order("accident_date", { ascending: false });
        setAccidents(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!form.description || !form.accident_date) return alert("Tarih ve açıklama zorunludur.");
        setSaving(true);
        try {
            const payload = { ...form, company_id: profile!.tenant_id!, created_by: profile!.id, status: "acik" };
            const { error } = await supabase.from("ohs_accidents").insert([payload]);
            if (error) throw error;
            setShowModal(false);
            setForm(defaultForm());
            fetchData();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setSaving(false); }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        await supabase.from("ohs_accidents").update({ status }).eq("id", id);
        fetchData();
        setSelectedAccident(null);
    };

    const filtered = accidents.filter(a => {
        if (filter !== "tumu" && a.type !== filter) return false;
        if (searchQuery && !a.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(a.injured_person_name || "").toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(a.tracking_no || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
            {children}
        </div>
    );

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-colors";

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                    {[
                        { key: "tumu", label: "Tümü" },
                        { key: "kaza", label: "İş Kazaları" },
                        { key: "ramak_kala", label: "Ramak Kala" },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key as any)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? "bg-rose-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 flex-1 max-w-sm">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ara..." className="pl-9 pr-4 py-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm" />
                    </div>
                    <button onClick={() => { setShowModal(true); setForm(defaultForm()); }}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-rose-500/20">
                        + Olay Kaydı
                    </button>
                </div>
            </div>

            {/* Tablo */}
            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-sm text-slate-500">Kayıt bulunamadı.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                {["No", "Tür", "Tarih", "Konum/Departman", "Kişi / Açıklama", "Ciddiyet", "Kİ Günü", "Durum", ""].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filtered.map(acc => (
                                <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => setSelectedAccident(acc)}>
                                    <td className="px-3 py-3 text-xs font-mono text-slate-400">{acc.tracking_no}</td>
                                    <td className="px-3 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${acc.type === "ramak_kala" ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30" : "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30"}`}>
                                            {acc.type === "ramak_kala" ? "Ramak Kala" : "Kaza"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{new Date(acc.accident_date).toLocaleDateString("tr-TR")}</td>
                                    <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{acc.location || acc.department || "—"}</td>
                                    <td className="px-3 py-3 max-w-xs">
                                        {acc.injured_person_name && <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{acc.injured_person_name}</div>}
                                        <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{acc.description}</div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${SEVERITY_COLORS[acc.severity] || ""}`}>
                                            {SEVERITY_LABELS[acc.severity] || acc.severity}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-sm text-center text-slate-700 dark:text-slate-300 font-bold">{acc.lost_workdays}</td>
                                    <td className="px-3 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.status === "kapali" ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : acc.status === "inceleniyor" ? "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
                                            {acc.status === "kapali" ? "Kapalı" : acc.status === "inceleniyor" ? "İnceleniyor" : "Açık"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                        {acc.status !== "kapali" && (
                                            <button onClick={() => handleUpdateStatus(acc.id, acc.status === "acik" ? "inceleniyor" : "kapali")}
                                                className="text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                                                {acc.status === "acik" ? "İncelemeye Al" : "Kapat"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Ekleme Modalı */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Olay Kaydı Ekle</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">✕</button>
                        </div>

                        {/* Tür Seçimi */}
                        <div className="grid grid-cols-2 gap-3">
                            {(["kaza", "ramak_kala"] as const).map(t => (
                                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                                    className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === t ? (t === "kaza" ? "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300") : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"}`}>
                                    {t === "kaza" ? "⚠️ İş Kazası" : "⚡ Ramak Kala"}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Olay Tarihi *">
                                <input type="date" value={form.accident_date} onChange={e => setForm(f => ({ ...f, accident_date: e.target.value }))} className={inputCls} />
                            </Field>
                            <Field label="Olay Saati">
                                <input type="time" value={form.accident_time} onChange={e => setForm(f => ({ ...f, accident_time: e.target.value }))} className={inputCls} />
                            </Field>
                            <Field label="Olay Yeri">
                                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Fabrika 2. Kat, Vinç Alanı..." className={inputCls} />
                            </Field>
                            <Field label="Departman">
                                <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Üretim, Bakım..." className={inputCls} />
                            </Field>
                            {form.type === "kaza" && (
                                <>
                                    <Field label="Yaralanan Kişi Adı">
                                        <input type="text" value={form.injured_person_name} onChange={e => setForm(f => ({ ...f, injured_person_name: e.target.value }))} className={inputCls} />
                                    </Field>
                                    <Field label="Yaralanma Türü">
                                        <input type="text" value={form.injury_type} onChange={e => setForm(f => ({ ...f, injury_type: e.target.value }))} placeholder="Kesik, kırık, yanık..." className={inputCls} />
                                    </Field>
                                    <Field label="Etkilenen Vücut Bölgesi">
                                        <input type="text" value={form.body_part} onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))} placeholder="Sol el, sırt..." className={inputCls} />
                                    </Field>
                                    <Field label="Kayıp İş Günü">
                                        <input type="number" min="0" value={form.lost_workdays} onChange={e => setForm(f => ({ ...f, lost_workdays: parseInt(e.target.value) || 0 }))} className={inputCls} />
                                    </Field>
                                    <Field label="Ciddiyet Derecesi">
                                        <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inputCls}>
                                            <option value="hafif">Hafif</option>
                                            <option value="orta">Orta</option>
                                            <option value="agir">Ağır</option>
                                            <option value="olumlu">Ölümlü</option>
                                        </select>
                                    </Field>
                                </>
                            )}
                            <Field label="Tanıklar">
                                <input type="text" value={form.witness_names} onChange={e => setForm(f => ({ ...f, witness_names: e.target.value }))} placeholder="Ad Soyad, Ad Soyad..." className={inputCls} />
                            </Field>
                        </div>

                        <Field label="Olay Açıklaması *">
                            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Olay nasıl gerçekleşti? Detaylı açıklayın..." className={inputCls + " resize-none"} />
                        </Field>
                        <Field label="Anlık (İlk) Neden">
                            <textarea rows={2} value={form.immediate_cause} onChange={e => setForm(f => ({ ...f, immediate_cause: e.target.value }))} placeholder="Doğrudan olay sebebi..." className={inputCls + " resize-none"} />
                        </Field>
                        <Field label="Kök Neden (Varsa)">
                            <textarea rows={2} value={form.root_cause} onChange={e => setForm(f => ({ ...f, root_cause: e.target.value }))} placeholder="Sistematik / altta yatan neden..." className={inputCls + " resize-none"} />
                        </Field>
                        <Field label="Alınan / Planlanan Önlem">
                            <textarea rows={2} value={form.corrective_action} onChange={e => setForm(f => ({ ...f, corrective_action: e.target.value }))} placeholder="Ne yapıldı / yapılacak?" className={inputCls + " resize-none"} />
                        </Field>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-colors shadow-md shadow-rose-500/20 disabled:opacity-50">
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detay Modalı */}
            {selectedAccident && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-end z-50">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto shadow-2xl animate-slide-in-right">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">{selectedAccident.tracking_no}</h2>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${selectedAccident.type === "ramak_kala" ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30" : "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30"}`}>
                                    {selectedAccident.type === "ramak_kala" ? "Ramak Kala" : "İş Kazası"}
                                </span>
                            </div>
                            <button onClick={() => setSelectedAccident(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">✕</button>
                        </div>
                        <div className="p-5 space-y-4 text-sm">
                            {[
                                ["Tarih", new Date(selectedAccident.accident_date).toLocaleDateString("tr-TR")],
                                ["Saat", selectedAccident.accident_time || "—"],
                                ["Konum", selectedAccident.location || "—"],
                                ["Departman", selectedAccident.department || "—"],
                                ["Kişi", selectedAccident.injured_person_name || "—"],
                                ["Yaralanma", selectedAccident.injury_type || "—"],
                                ["Vücut Bölgesi", selectedAccident.body_part || "—"],
                                ["Kayıp İş Günü", String(selectedAccident.lost_workdays)],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between items-start border-b border-slate-50 dark:border-slate-800 pb-2">
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">{k}</span>
                                    <span className="text-slate-800 dark:text-slate-200 text-right">{v}</span>
                                </div>
                            ))}
                            {selectedAccident.immediate_cause && (
                                <div><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Anlık Neden</p><p className="text-slate-700 dark:text-slate-300">{selectedAccident.immediate_cause}</p></div>
                            )}
                            {selectedAccident.root_cause && (
                                <div><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Kök Neden</p><p className="text-slate-700 dark:text-slate-300">{selectedAccident.root_cause}</p></div>
                            )}
                            {selectedAccident.corrective_action && (
                                <div><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Alınan Önlem</p><p className="text-slate-700 dark:text-slate-300">{selectedAccident.corrective_action}</p></div>
                            )}
                            {selectedAccident.status !== "kapali" && (
                                <div className="flex gap-2 pt-2">
                                    {selectedAccident.status === "acik" && (
                                        <button onClick={() => handleUpdateStatus(selectedAccident.id, "inceleniyor")} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">İncelemeye Al</button>
                                    )}
                                    <button onClick={() => handleUpdateStatus(selectedAccident.id, "kapali")} className="flex-1 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Kapat</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
