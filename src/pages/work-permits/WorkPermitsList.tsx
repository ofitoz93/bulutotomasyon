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

            // Everyone in the tenant can see all permits according to the RLS policies.
            // No additional filtering needed here based on the user's role.

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
            case 'approved': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Onaylandı</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">Reddedildi</span>;
            default: return <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium">Onay Bekliyor</span>;
        }
    };

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex space-x-2">
                    <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}>
                        Tümü
                    </button>
                    <button onClick={() => setFilter('pending')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${filter === 'pending' ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}>
                        Onay Bekleyenler
                    </button>
                    <button onClick={() => setFilter('approved')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${filter === 'approved' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}>
                        Onaylananlar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-gray-500">Yükleniyor...</div>
            ) : permits.length === 0 ? (
                <div className="p-12 text-center text-gray-500">Listelenecek iş izni bulunamadı.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma / Departman</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proje</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oluşturan</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Eylem</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {permits.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                        {new Date(p.work_date).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {p.company_name || "-"} / {p.department || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {p.action_projects?.name || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {p.profiles?.first_name} {p.profiles?.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {getStatusBadge(p.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <Link to={`/app/work-permits/${p.id}`} className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded bg-indigo-50">
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
                                                    className="text-red-600 hover:text-red-900 border border-red-200 px-3 py-1.5 rounded bg-red-50"
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
