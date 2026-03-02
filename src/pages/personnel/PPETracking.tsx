import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface PPEAssignment {
    id: string;
    assignment_date: string;
    expected_renewal_date: string | null;
    status: string;
    notes: string | null;
    ppe_types: {
        name: string;
        category: string;
    };
    profiles: {
        first_name: string;
        last_name: string;
    };
}

export default function PPETracking() {
    const { profile } = useAuthStore();
    const [assignments, setAssignments] = useState<PPEAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [personnel, setPersonnel] = useState<{ id: string, first_name: string, last_name: string }[]>([]);
    const [ppeTypes, setPPETypes] = useState<{ id: string, name: string, renewal_period_months: number }[]>([]);

    const [form, setForm] = useState({
        user_id: "",
        ppe_type_id: "",
        assignment_date: new Date().toISOString().split("T")[0],
        expected_renewal_date: "",
        size: "",
        status: "zimmetli",
        notes: ""
    });

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchAssignments();
            fetchPersonnel();
            fetchPPETypes();
        }
    }, [profile?.tenant_id]);

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("ppe_assignments")
                .select("*, ppe_types!inner(name, category), profiles!inner(first_name, last_name)")
                .eq("tenant_id", profile!.tenant_id)
                .order("assignment_date", { ascending: false });

            if (error) throw error;
            setAssignments(data as any);
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

    const fetchPPETypes = async () => {
        const { data } = await supabase
            .from("ppe_types")
            .select("id, name, renewal_period_months")
            .eq("tenant_id", profile!.tenant_id);
        setPPETypes(data || []);
    };

    const handleSave = async () => {
        if (!form.user_id || !form.ppe_type_id || !form.assignment_date) return alert("Lütfen gerekli alanları doldurun.");
        setSaving(true);
        try {
            const { error } = await supabase.from("ppe_assignments").insert([{
                ...form,
                tenant_id: profile!.tenant_id,
                created_by: profile!.id
            }]);
            if (error) throw error;
            setShowModal(false);
            fetchAssignments();
        } catch (e: any) {
            alert("Hata: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const isExpiringSoon = (dateStr: string | null) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const today = new Date();
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
    };

    const isExpired = (dateStr: string | null) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date < new Date();
    };

    const inputCls = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors";

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">KKD Zimmet & Takip</h2>
                <div className="flex gap-2">
                    <button className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                        Tanımları Düzenle
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20">
                        + Yeni Zimmet
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : assignments.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-4">🛡️</div>
                    <p className="text-slate-500 dark:text-slate-400">Henüz bir KKD zimmeti kaydedilmemiş.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Personel</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Donanım</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Zimmet Tarihi</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Yenileme Tarihi</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksiyon</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {assignments.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                        {item.profiles.first_name} {item.profiles.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">{item.ppe_types.name}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-500">{item.ppe_types.category}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {new Date(item.assignment_date).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {item.expected_renewal_date ? (
                                            <span className={`text-sm font-medium ${isExpired(item.expected_renewal_date) ? "text-rose-600 dark:text-rose-400 font-bold" :
                                                    isExpiringSoon(item.expected_renewal_date) ? "text-amber-600 dark:text-amber-400" :
                                                        "text-slate-500 dark:text-slate-400"
                                                }`}>
                                                {new Date(item.expected_renewal_date).toLocaleDateString("tr-TR")}
                                                {isExpired(item.expected_renewal_date) && " ❌"}
                                                {isExpiringSoon(item.expected_renewal_date) && !isExpired(item.expected_renewal_date) && " ⚠️"}
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${item.status === 'zimmetli' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' :
                                                item.status === 'iade' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' :
                                                    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                            }`}>
                                            {item.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold">
                                            Detay
                                        </button>
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
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Yeni KKD Zimmeti</h3>
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
                                <label className="block text-xs font-bold text-slate-500 mb-1">DONANIM TÜRÜ *</label>
                                <select
                                    value={form.ppe_type_id}
                                    onChange={e => {
                                        const type = ppeTypes.find(t => t.id === e.target.value);
                                        let renewal = "";
                                        if (type && type.renewal_period_months > 0) {
                                            const d = new Date(form.assignment_date);
                                            d.setMonth(d.getMonth() + type.renewal_period_months);
                                            renewal = d.toISOString().split("T")[0];
                                        }
                                        setForm({ ...form, ppe_type_id: e.target.value, expected_renewal_date: renewal });
                                    }}
                                    className={inputCls}
                                >
                                    <option value="">Seçiniz...</option>
                                    {ppeTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">ZİMMET TARİHİ *</label>
                                <input type="date" value={form.assignment_date} onChange={e => setForm({ ...form, assignment_date: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">YENİLEME TARİHİ</label>
                                <input type="date" value={form.expected_renewal_date} onChange={e => setForm({ ...form, expected_renewal_date: e.target.value })} className={inputCls} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">BEDEN / ÖLÇÜ</label>
                                <input type="text" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="42, L, Standart..." className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">DURUM</label>
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                                    <option value="zimmetli">Zimmetli</option>
                                    <option value="iade">İade Edildi</option>
                                    <option value="kayip">Kayıp</option>
                                    <option value="eskidi">Ekonomik Ömrünü Tamamladı</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">NOTLAR</label>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + " h-20 resize-none"} />
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
