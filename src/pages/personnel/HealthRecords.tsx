import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface HealthRecord {
    id: string;
    record_type: string;
    exam_date: string;
    next_exam_date: string | null;
    doctor_name: string | null;
    result: string;
    findings: string | null;
    recommendations: string | null;
    file_url: string | null;
    profiles: {
        first_name: string;
        last_name: string;
    };
}

const RECORD_TYPES: Record<string, string> = {
    ise_giris: "İşe Giriş Muayenesi",
    periyodik_muayene: "Periyodik Muayene",
    is_donusu: "İşe Dönüş Muayenesi",
    diger: "Diğer Sağlık Kaydı",
};

export default function HealthRecords() {
    const { profile } = useAuthStore();
    const [records, setRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [personnel, setPersonnel] = useState<{ id: string, first_name: string, last_name: string }[]>([]);
    const [form, setForm] = useState({
        user_id: "",
        record_type: "periyodik_muayene",
        exam_date: new Date().toISOString().split("T")[0],
        next_exam_date: "",
        doctor_name: "",
        result: "uygun",
        findings: "",
        recommendations: ""
    });

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchRecords();
            fetchPersonnel();
        }
    }, [profile?.tenant_id]);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("personnel_health_records")
                .select("*, profiles!inner(first_name, last_name)")
                .eq("tenant_id", profile!.tenant_id)
                .order("exam_date", { ascending: false });

            if (error) throw error;
            setRecords(data as any);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPersonnel = async () => {
        const { data } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("tenant_id", profile!.tenant_id);
        setPersonnel(data || []);
    };

    const handleSave = async () => {
        if (!form.user_id || !form.exam_date) return alert("Lütfen personel ve tarih seçin.");
        setSaving(true);
        try {
            const { error } = await supabase.from("personnel_health_records").insert([{
                ...form,
                tenant_id: profile!.tenant_id,
                created_by: profile!.id
            }]);
            if (error) throw error;
            setShowModal(false);
            fetchRecords();
        } catch (e: any) {
            alert("Hata: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors";

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Genel Sağlık & Muayene Kayıtları</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20">
                    + Muayene Kaydı Ekle
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : records.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-4">🩺</div>
                    <p className="text-slate-500 dark:text-slate-400">Kayıtlı sağlık muayenesi bulunmuyor.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Personel</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kayıt Türü</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Muayene Tarihi</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sonuç</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sıradaki Muayene</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Dosya</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {records.map(record => (
                                <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                        {record.profiles.first_name} {record.profiles.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {RECORD_TYPES[record.record_type] || record.record_type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {new Date(record.exam_date).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${record.result === 'uygun' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                record.result === 'akis' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                            }`}>
                                            {record.result.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {record.next_exam_date ? new Date(record.next_exam_date).toLocaleDateString("tr-TR") : "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        {record.file_url ? (
                                            <a href={record.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold underline">
                                                Görüntüle
                                            </a>
                                        ) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 my-8 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Muayene Kaydı Ekle</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">PERSONEL *</label>
                                <select
                                    value={form.user_id}
                                    onChange={e => setForm({ ...form, user_id: e.target.value })}
                                    className={inputCls}
                                >
                                    <option value="">Seçiniz...</option>
                                    {personnel.map(p => (
                                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">MUAYENE TÜRÜ</label>
                                <select
                                    value={form.record_type}
                                    onChange={e => setForm({ ...form, record_type: e.target.value })}
                                    className={inputCls}
                                >
                                    {Object.entries(RECORD_TYPES).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">MUAYENE TARİHİ *</label>
                                <input type="date" value={form.exam_date} onChange={e => setForm({ ...form, exam_date: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">GELECEK MUAYENE TARİHİ</label>
                                <input type="date" value={form.next_exam_date} onChange={e => setForm({ ...form, next_exam_date: e.target.value })} className={inputCls} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">DOKTOR ADI</label>
                            <input type="text" value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} placeholder="Dr. Ad Soyad" className={inputCls} />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">SONUÇ</label>
                            <div className="flex gap-2">
                                {[
                                    { id: 'uygun', label: 'Uygun' },
                                    { id: 'akis', label: 'Kısıtlı Uygun' },
                                    { id: 'uygunsuz', label: 'Uygunsuz' }
                                ].map(res => (
                                    <button
                                        key={res.id}
                                        onClick={() => setForm({ ...form, result: res.id })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${form.result === res.id
                                                ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                                                : "border-slate-100 dark:border-slate-800 text-slate-400"
                                            }`}
                                    >
                                        {res.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">BULGULAR & NOTLAR</label>
                            <textarea value={form.findings} onChange={e => setForm({ ...form, findings: e.target.value })} className={inputCls + " h-20 resize-none"} />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">İptal</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50"
                            >
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
