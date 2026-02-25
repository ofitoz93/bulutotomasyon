import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { WorkPermit } from "@/types/workPermit";

export default function WorkPermitDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile, isCompanyManager } = useAuthStore();
    const [permit, setPermit] = useState<WorkPermit | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [isEngineer, setIsEngineer] = useState(false);
    const [isIsg, setIsIsg] = useState(false);

    const maskIdentity = (val: string | null | undefined) => {
        if (!val) return "";
        if (val.length <= 2) return val;
        return val.substring(0, 2) + "*".repeat(val.length - 2);
    };

    useEffect(() => {
        if (!id) return;
        const fetchPermit = async () => {
            const { data, error } = await supabase
                .from('work_permits')
                .select(`
                    *,
                    profiles:created_by (first_name, last_name),
                    action_projects:project_id (name),
                    coworkers:work_permit_coworkers(*),
                    engineer_profile:engineer_approved_by (first_name, last_name, tc_no),
                    isg_profile:isg_approved_by (first_name, last_name, tc_no)
                `)
                .eq('id', id)
                .single();

            if (!error && data) {
                setPermit(data as any);

                // Check permissions
                if (!isCompanyManager() && profile?.tenant_id) {
                    const { data: myRoles, error: rolesError } = await supabase
                        .rpc('get_my_permit_approval_roles', { p_tenant_id: profile.tenant_id });

                    if (!rolesError && myRoles) {
                        setIsEngineer(myRoles.some((r: any) => r.role_type === 'engineer'));
                        setIsIsg(myRoles.some((r: any) => r.role_type === 'isg'));
                    }
                }

            } else {
                navigate('/app/work-permits');
            }
            setLoading(false);
        };
        fetchPermit();
    }, [id, navigate, profile, isCompanyManager]);

    const handleApprove = async (roleType: 'engineer' | 'isg') => {
        if (!permit || !profile) return;
        setActionLoading(true);

        try {
            const updateData: any = {};
            if (roleType === 'engineer') {
                updateData.engineer_approved_by = profile.id;
                updateData.engineer_approved_at = new Date().toISOString();
            } else {
                updateData.isg_approved_by = profile.id;
                updateData.isg_approved_at = new Date().toISOString();
            }

            // Both approved? Mark status as approved
            const willBeEngineerApproved = roleType === 'engineer' || !!permit.engineer_approved_by;
            const willBeIsgApproved = roleType === 'isg' || !!permit.isg_approved_by;

            if (willBeEngineerApproved && willBeIsgApproved) {
                updateData.status = 'approved';
            }

            const { error } = await supabase
                .from('work_permits')
                .update(updateData)
                .eq('id', permit.id);

            if (error) throw error;

            // Reload
            const { data } = await supabase.from('work_permits').select('*, profiles:created_by(first_name, last_name), action_projects:project_id(name), coworkers:work_permit_coworkers(*)').eq('id', permit.id).single();
            if (data) setPermit(data as any);

        } catch (err) {
            alert("Onaylanırken hata oluştu.");
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500">Yükleniyor...</div>;
    if (!permit) return null;

    return (
        <div className="max-w-4xl mx-auto pb-24 print:pb-0">
            <div className="mb-6 flex items-center justify-between print:hidden">
                <button onClick={() => navigate("/app/work-permits")} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Listeye Dön
                </button>
                <div className="flex space-x-3">
                    <button onClick={() => window.print()} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                        <svg className="mr-1.5 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        PDF Çıktısı Al
                    </button>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-8 print:shadow-none print:border print:p-0 print:text-sm">
                {/* Header Info */}
                <div className="border-b pb-6 mb-6 print:pb-2 print:mb-2">
                    <div className="flex justify-between items-start mb-4 print:mb-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 uppercase print:text-lg">İŞ İZNİ FORMU</h1>
                            <p className="text-sm text-gray-500 print:text-xs">Referans Kodu: {permit.id.substring(0, 8)}</p>
                        </div>
                        <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold print:text-xs ${permit.status === 'approved' ? 'bg-green-100 text-green-800 border border-green-200' :
                                permit.status === 'rejected' ? 'bg-red-100 text-red-800 border border-red-200' :
                                    'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                {permit.status === 'approved' ? 'ONAYLANDI' : permit.status === 'rejected' ? 'REDDEDİLDİ' : 'ONAY BEKLİYOR'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm text-gray-700 print:gap-y-1 print:text-xs">
                        <div><strong className="text-gray-900 block uppercase text-xs mb-1 print:inline print:mr-1">Tarih:</strong> {new Date(permit.work_date).toLocaleDateString('tr-TR')}</div>
                        <div><strong className="text-gray-900 block uppercase text-xs mb-1 print:inline print:mr-1">Tahmini Süre:</strong> {permit.estimated_hours} Saat</div>
                        <div><strong className="text-gray-900 block uppercase text-xs mb-1 print:inline print:mr-1">Firma / Departman:</strong> {permit.company_name || "-"} / {permit.department || "-"}</div>
                        <div><strong className="text-gray-900 block uppercase text-xs mb-1 print:inline print:mr-1">Proje / Lokasyon:</strong> {permit.action_projects?.name || "-"}</div>
                    </div>
                </div>

                {/* Arrays rendering helper */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 print:gap-4 print:mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase border-b pb-1 print:text-xs print:mb-1">Yapılacak İşler</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 print:text-xs print:space-y-0">
                            {(permit.job_types || []).map(j => <li key={j}>{j === "Diğer" ? `Diğer: ${permit.job_type_other}` : j}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-red-700 mb-2 uppercase border-b pb-1 print:text-xs print:mb-1">Tehlikeler</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 print:text-xs print:space-y-0">
                            {(permit.hazards || []).map(h => <li key={h}>{h === "Diğer" ? `Diğer: ${permit.hazard_other}` : h}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-blue-700 mb-2 uppercase border-b pb-1 print:text-xs print:mb-1">İstenen KKD</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 print:text-xs print:space-y-0">
                            {(permit.ppe_requirements || []).map(p => <li key={p}>{p === "Diğer" ? `Diğer: ${permit.ppe_other}` : p}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-emerald-700 mb-2 uppercase border-b pb-1 print:text-xs print:mb-1">Alınan Önlemler / Kontroller</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 print:text-xs print:space-y-0">
                            {(permit.precautions || []).map(p => <li key={p}>{p === "Diğer" ? `Diğer: ${permit.precaution_other}` : p}</li>)}
                        </ul>
                    </div>
                </div>

                {/* Personel List */}
                <div className="mb-8 print:mb-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase border-b pb-1 print:text-xs print:mb-1">İşi Yapan Ekip & Onay Durumları</h3>
                    <div className="overflow-x-auto border rounded-lg print:border-none">
                        <table className="min-w-full text-sm print:text-xs">
                            <thead className="bg-gray-50 border-b print:bg-white">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 print:px-1 print:py-1">Rol</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 print:px-1 print:py-1">Ad Soyad</th>
                                    <th className="px-4 py-2 text-center font-semibold text-gray-600 print:px-1 print:py-1">Onay Durumu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-gray-700">
                                <tr>
                                    <td className="px-4 py-3 font-medium text-gray-900 print:px-1 print:py-1">Formu Dolduran Sorumlu</td>
                                    <td className="px-4 py-3 print:px-1 print:py-1">{permit.profiles?.first_name} {permit.profiles?.last_name}</td>
                                    <td className="px-4 py-3 text-center print:px-1 print:py-1">
                                        <span className="text-green-600 font-bold">✓ (E-İmza: {maskIdentity(permit.creator_tc_no)})</span>
                                    </td>
                                </tr>
                                {(permit.coworkers || []).map(cw => (
                                    <tr key={cw.id} className="bg-gray-50/50 print:bg-white">
                                        <td className="px-4 py-2 text-gray-500 print:px-1 print:py-1">Beraber Çalışan</td>
                                        <td className="px-4 py-2 print:px-1 print:py-1">{cw.full_name} {cw.location ? `(${cw.location})` : ''}</td>
                                        <td className="px-4 py-2 text-center print:px-1 print:py-1">
                                            {cw.is_approved ? (
                                                <span className="text-green-600 font-bold">✓ Onaylandı</span>
                                            ) : (
                                                <span className="text-amber-500 font-medium whitespace-nowrap">Bekleniyor...</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Management Approvals */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 print:bg-white print:p-0 print:border-none print:mt-4">
                    <h3 className="text-md font-bold text-gray-900 mb-4 uppercase text-center border-b pb-2 print:text-sm print:mb-2 print:pb-1">Kontrol ve Karar Mercileri</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-2">

                        {/* Engineer Box */}
                        <div className="bg-white p-4 border rounded shadow-sm text-center print:border-transparent print:p-2">
                            <h4 className="font-semibold text-gray-800 mb-2 print:text-xs">Mühendis / Yetkili Onayı</h4>
                            {permit.engineer_approved_by ? (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-center space-x-2 text-green-600">
                                        <span className="font-bold text-xl print:text-sm">✓</span>
                                        <span className="font-medium text-sm print:text-xs">
                                            {permit.engineer_profile?.first_name} {permit.engineer_profile?.last_name}
                                        </span>
                                    </div>
                                    <div className="text-xs text-green-700 font-medium">E-imza ile onaylanmıştır</div>
                                    <div className="text-xs text-gray-500">{new Date(permit.engineer_approved_at!).toLocaleString('tr-TR')}</div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-500 print:text-xs">Bekleniyor...</p>
                                    {(isCompanyManager() || isEngineer) && (
                                        <button
                                            onClick={() => handleApprove('engineer')}
                                            disabled={actionLoading}
                                            className="w-full text-xs bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 print:hidden"
                                        >
                                            Mühendis / Yetkili Olarak Onayla
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ISG Box */}
                        <div className="bg-white p-4 border rounded shadow-sm text-center print:border-transparent print:p-2">
                            <h4 className="font-semibold text-gray-800 mb-2 print:text-xs">İSG Sorumlusu Onayı</h4>
                            {permit.isg_approved_by ? (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-center space-x-2 text-green-600">
                                        <span className="font-bold text-xl print:text-sm">✓</span>
                                        <span className="font-medium text-sm print:text-xs">
                                            {permit.isg_profile?.first_name} {permit.isg_profile?.last_name}
                                        </span>
                                    </div>
                                    <div className="text-xs text-green-700 font-medium">E-imza ile onaylanmıştır</div>
                                    <div className="text-xs text-gray-500">{new Date(permit.isg_approved_at!).toLocaleString('tr-TR')}</div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-500 print:text-xs">Bekleniyor...</p>
                                    {(isCompanyManager() || isIsg) && (
                                        <button
                                            onClick={() => handleApprove('isg')}
                                            disabled={actionLoading}
                                            className="w-full text-xs bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 print:hidden"
                                        >
                                            İSG Yetkilisi Olarak Onayla
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
