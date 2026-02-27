import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { WorkPermit } from "@/types/workPermit";

export default function WorkPermitsList() {
    const { profile, isCompanyManager } = useAuthStore();
    const [permits, setPermits] = useState<WorkPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

    useEffect(() => {
        if (!profile?.tenant_id) return;

        const fetchPermits = async () => {
            let query = supabase
                .from('work_permits')
                .select(`
                    id, 
                    work_date, 
                    department, 
                    company_name, 
                    status, 
                    created_at,
                    project_id,
                    created_by,
                    profiles:created_by (first_name, last_name),
                    action_projects:project_id (name)
                `)
                .eq('tenant_id', profile.tenant_id)
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;
            if (!error && data) {
                setPermits(data as any);
            }
            setLoading(false);
        };

        fetchPermits();
    }, [profile, filter, isCompanyManager]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-1 rounded-full font-medium">Onaylandı</span>;
            case 'rejected':
                return <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs px-2 py-1 rounded-full font-medium">Reddedildi</span>;
            default:
                return <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs px-2 py-1 rounded-full font-medium">Onay Bekliyor</span>;
        }
    };

    const filterBtn = (value: 'all' | 'pending' | 'approved', label: string, activeColor: string) => (
        <button
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filter === value
                    ? `${activeColor} text-white`
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Filter header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                {filterBtn('all', 'Tümü', 'bg-slate-600')}
                {filterBtn('pending', 'Onay Bekleyenler', 'bg-amber-600')}
                {filterBtn('approved', 'Onaylananlar', 'bg-emerald-600')}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-3 p-12">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-500 text-sm">Yükleniyor...</span>
                </div>
            ) : permits.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">Listelenecek iş izni bulunamadı.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                        <thead className="bg-slate-800/50">
                            <tr>
                                {["Tarih", "Firma / Departman", "Proje", "Oluşturan", "Durum", "Eylem"].map(h => (
                                    <th key={h} scope="col" className={`px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${h === "Eylem" ? "text-right" : "text-left"}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {permits.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-800/60 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200 font-medium">
                                        {new Date(p.work_date).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {p.company_name || "—"} / {p.department || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {p.action_projects?.name || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {p.profiles?.first_name} {p.profiles?.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(p.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                to={`/app/work-permits/${p.id}`}
                                                className="text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                            >
                                                Görüntüle
                                            </Link>
                                            {isCompanyManager() && (
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm("Bu iş iznini ve ona bağlı tüm kayıtları silmek istediğinize emin misiniz?")) {
                                                            const { error } = await supabase.from('work_permits').delete().eq('id', p.id);
                                                            if (!error) {
                                                                setPermits(permits.filter(permit => permit.id !== p.id));
                                                            } else {
                                                                alert("Silinirken bir hata oluştu: " + error.message);
                                                            }
                                                        }
                                                    }}
                                                    className="text-rose-400 hover:text-rose-300 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    Sil
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
