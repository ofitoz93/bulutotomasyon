import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Accident {
    id: string;
    tracking_no: string;
    type: string;
    accident_date: string;
    description: string;
    root_cause: string | null;
    immediate_cause: string | null;
    corrective_action: string | null;
    severity: string;
    status: string;
}

const WHY_LIMIT = 5;

export default function RootCauseAnalysis() {
    const { profile } = useAuthStore();
    const [accidents, setAccidents] = useState<Accident[]>([]);
    const [selected, setSelected] = useState<Accident | null>(null);
    const [whyAnswers, setWhyAnswers] = useState<string[]>(["", "", "", "", ""]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("ohs_accidents")
            .select("id, tracking_no, type, accident_date, description, root_cause, immediate_cause, corrective_action, severity, status")
            .eq("company_id", profile!.tenant_id!)
            .eq("type", "kaza")
            .order("accident_date", { ascending: false });
        setAccidents(data || []);
        setLoading(false);
    };

    const handleSelect = (acc: Accident) => {
        setSelected(acc);
        // Mevcut root_cause JSON veya metin olarak yüklü olabilir
        try {
            const parsed = JSON.parse(acc.root_cause || "[]");
            if (Array.isArray(parsed)) {
                const arr = [...parsed, ...Array(WHY_LIMIT).fill("")].slice(0, WHY_LIMIT);
                setWhyAnswers(arr);
            } else {
                setWhyAnswers([acc.root_cause || "", "", "", "", ""]);
            }
        } catch {
            setWhyAnswers([acc.root_cause || "", "", "", "", ""]);
        }
    };

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        const rootCauseJson = JSON.stringify(whyAnswers.filter(a => a.trim()));
        await supabase.from("ohs_accidents").update({ root_cause: rootCauseJson }).eq("id", selected.id);
        setSaving(false);
        setSelected(null);
        fetchData();
    };

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-colors";

    const hasRootCause = (acc: Accident) => {
        try { return JSON.parse(acc.root_cause || "[]")[0]?.trim(); } catch { return acc.root_cause?.trim(); }
    };

    return (
        <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 font-medium">
                💡 <strong>5-Neden (5-Why) Analizi:</strong> Kaza kayıtlarının altında yatan kök nedeni bulmak için seçili kazayı analiz edin.
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Sol: Kaza Listesi */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">İş Kazaları</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Analiz yapmak için bir kaza seçin</p>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                            {accidents.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-8">Kaza kaydı bulunamadı.</p>
                            )}
                            {accidents.map(acc => (
                                <button key={acc.id} onClick={() => handleSelect(acc)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selected?.id === acc.id ? "bg-rose-50 dark:bg-rose-500/10 border-l-4 border-rose-500" : "border-l-4 border-transparent"}`}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-mono text-slate-400">{acc.tracking_no}</span>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">{acc.description}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(acc.accident_date).toLocaleDateString("tr-TR")}</p>
                                        </div>
                                        {hasRootCause(acc) ? (
                                            <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium flex-none">Analiz Var</span>
                                        ) : (
                                            <span className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium flex-none">Analiz Yok</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sağ: Analiz */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        {!selected ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                <div className="text-5xl mb-3">🔍</div>
                                <p className="text-sm">Soldan bir kaza seçin</p>
                            </div>
                        ) : (
                            <div className="p-5 space-y-4">
                                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase mb-1">Seçilen Kaza</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selected.tracking_no} — {new Date(selected.accident_date).toLocaleDateString("tr-TR")}</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{selected.description}</p>
                                    {selected.immediate_cause && (
                                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-2"><strong>Anlık Neden:</strong> {selected.immediate_cause}</p>
                                    )}
                                </div>

                                {/* 5-Neden */}
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">5-Neden Analizi</p>
                                    {whyAnswers.map((ans, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-slate-500 mb-1">Neden {i + 1}?</p>
                                                <input type="text" value={ans}
                                                    onChange={e => { const n = [...whyAnswers]; n[i] = e.target.value; setWhyAnswers(n); }}
                                                    placeholder={i === 0 ? "Olay neden gerçekleşti?" : `Neden ${i}?`}
                                                    className={inputCls} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                    <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                                    <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors">
                                        {saving ? "Kaydediliyor..." : "Kaydet"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
