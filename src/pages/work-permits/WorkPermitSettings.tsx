import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
}

interface Approver {
    id: string;
    user_id: string;
    role_type: 'engineer' | 'isg';
    profiles?: {
        first_name: string | null;
        last_name: string | null;
        email: string;
    };
}

export default function WorkPermitSettings() {
    const { profile, isCompanyManager } = useAuthStore();
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [approvers, setApprovers] = useState<Approver[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedEmployee, setSelectedEmployee] = useState("");
    const [selectedRole, setSelectedRole] = useState<'engineer' | 'isg'>('engineer');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profile?.tenant_id) return;

        const fetchData = async () => {
            // Fetch all employees in tenant
            const { data: empData } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email')
                .eq('tenant_id', profile.tenant_id);

            // Fetch current approvers
            const { data: appData } = await supabase
                .from('work_permit_approvers')
                .select(`
                    id, 
                    user_id, 
                    role_type,
                    profiles (first_name, last_name, email)
                `)
                .eq('tenant_id', profile.tenant_id);

            setEmployees(empData || []);
            setApprovers(appData as any || []);
            setLoading(false);
        };

        fetchData();
    }, [profile]);

    const handleAddApprover = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || !profile?.tenant_id) return;
        setSaving(true);

        try {
            // Check if already exists
            const exists = approvers.find(a => a.user_id === selectedEmployee && a.role_type === selectedRole);
            if (exists) {
                alert("Bu personel zaten bu rol için daha önce eklenmiş.");
                setSaving(false);
                return;
            }

            const { data, error } = await supabase
                .from('work_permit_approvers')
                .insert([{
                    tenant_id: profile.tenant_id,
                    user_id: selectedEmployee,
                    role_type: selectedRole
                }])
                .select(`*, profiles(first_name, last_name, email)`)
                .single();

            if (error) throw error;
            if (data) {
                setApprovers([...approvers, data as any]);
                setSelectedEmployee("");
            }
        } catch (err: any) {
            alert("Eklenirken hata oluştu: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveApprover = async (id: string) => {
        if (!confirm("Bu yetkiyi kaldırmak istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from('work_permit_approvers').delete().eq('id', id);
            if (error) throw error;
            setApprovers(approvers.filter(a => a.id !== id));
        } catch (err: any) {
            alert("Silinirken hata oluştu: " + err.message);
        }
    };

    if (!isCompanyManager()) {
        return <div className="p-8 text-center text-red-500">Bu sayfayı görüntüleme yetkiniz yok. Sadece şirket yöneticileri erişebilir.</div>;
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

    const engineers = approvers.filter(a => a.role_type === 'engineer');
    const isgStaff = approvers.filter(a => a.role_type === 'isg');

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">İş İzni Onay Mercileri Ayarları</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Sistemde iş izinlerini onaylayabilecek <strong>Mühendis / Yetkili</strong> ve <strong>İSG Sorumlusu</strong> personellerinizi buradan belirleyebilirsiniz.
                    Şirket Yöneticileri varsayılan olarak tüm formları görebilir ve onaylayabilir. Eklenen bu personeller de yönetici olmadıkları halde onay yetkisine sahip olacaklardır.
                </p>

                <form onSubmit={handleAddApprover} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 p-4 border rounded-md">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Personel Seçin</label>
                        <select
                            required
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                            <option value="">-- Personel Seçin --</option>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.first_name || e.email} {e.last_name || ""} {e.first_name ? `(${e.email})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Verilecek Yetki</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as any)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                            <option value="engineer">Mühendis / Yetkili Onayı</option>
                            <option value="isg">İSG Sorumlusu Onayı</option>
                        </select>
                    </div>
                    <div className="w-full md:w-auto mt-2 md:mt-0">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {saving ? 'Ekleniyor...' : '+ Yetki Ekle'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Engineer List */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                        Mühendis / Yetkili Onaycılar
                    </h3>
                    {engineers.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Henüz özel bir "Mühendis/Yetkili" tanımlanmamış. Sadece yöneticiler onay verebilir.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {engineers.map(app => (
                                <li key={app.id} className="py-3 flex justify-between items-center">
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-900">{app.profiles?.first_name} {app.profiles?.last_name}</div>
                                        <div className="text-gray-500 text-xs">{app.profiles?.email}</div>
                                    </div>
                                    <button onClick={() => handleRemoveApprover(app.id)} className="text-red-500 hover:text-red-700 p-1 text-xs font-medium">
                                        Kaldır
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ISG List */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                        İSG Sorumlusu Onaycılar
                    </h3>
                    {isgStaff.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Henüz özel bir "İSG" yetkilisi tanımlanmamış. Sadece yöneticiler onay verebilir.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {isgStaff.map(app => (
                                <li key={app.id} className="py-3 flex justify-between items-center">
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-900">{app.profiles?.first_name} {app.profiles?.last_name}</div>
                                        <div className="text-gray-500 text-xs">{app.profiles?.email}</div>
                                    </div>
                                    <button onClick={() => handleRemoveApprover(app.id)} className="text-red-500 hover:text-red-700 p-1 text-xs font-medium">
                                        Kaldır
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
