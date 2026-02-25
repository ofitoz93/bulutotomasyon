import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
}

interface Department {
    id: string;
    name: string;
}

interface OrgRole {
    id: string;
    name: string;
}

interface Approver {
    id: string;
    user_id: string | null;
    org_role_id: string | null;
    department_id: string | null;
    include_sub_departments: boolean;
    role_type: 'engineer' | 'isg';
    profiles?: {
        first_name: string | null;
        last_name: string | null;
        email: string;
    };
    org_roles?: {
        name: string;
    };
    departments?: {
        name: string;
    };
}

type AssignmentType = 'user' | 'role' | 'department';

export default function WorkPermitSettings() {
    const { profile, isCompanyManager } = useAuthStore();
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);

    const [approvers, setApprovers] = useState<Approver[]>([]);
    const [loading, setLoading] = useState(true);

    const [assignmentType, setAssignmentType] = useState<AssignmentType>('user');
    const [selectedId, setSelectedId] = useState("");
    const [includeSubDeps, setIncludeSubDeps] = useState(false);
    const [selectedRoleType, setSelectedRoleType] = useState<'engineer' | 'isg'>('engineer');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profile?.tenant_id) return;

        const fetchData = async () => {
            // Fetch employees
            const { data: empData } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email')
                .eq('tenant_id', profile.tenant_id);

            // Fetch departments
            const { data: depData } = await supabase
                .from('departments')
                .select('id, name')
                .eq('tenant_id', profile.tenant_id);

            // Fetch org roles
            const { data: roleData } = await supabase
                .from('org_roles')
                .select('id, name')
                .eq('tenant_id', profile.tenant_id);

            // Fetch current approvers
            const { data: appData } = await supabase
                .from('work_permit_approvers')
                .select(`
                    id, 
                    user_id, 
                    org_role_id,
                    department_id,
                    include_sub_departments,
                    role_type,
                    profiles (first_name, last_name, email),
                    org_roles (name),
                    departments (name)
                `)
                .eq('tenant_id', profile.tenant_id);

            setEmployees(empData || []);
            setDepartments(depData || []);
            setOrgRoles(roleData || []);
            setApprovers(appData as any || []);
            setLoading(false);
        };

        fetchData();
    }, [profile]);

    const handleAddApprover = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedId || !profile?.tenant_id) return;
        setSaving(true);

        try {
            // Check existing
            const exists = approvers.find(a =>
                a.role_type === selectedRoleType &&
                ((assignmentType === 'user' && a.user_id === selectedId) ||
                    (assignmentType === 'role' && a.org_role_id === selectedId) ||
                    (assignmentType === 'department' && a.department_id === selectedId))
            );

            if (exists) {
                alert("Bu yetki tanımı daha önce oluşturulmuş.");
                setSaving(false);
                return;
            }

            const payload: any = {
                tenant_id: profile.tenant_id,
                role_type: selectedRoleType,
                user_id: assignmentType === 'user' ? selectedId : null,
                org_role_id: assignmentType === 'role' ? selectedId : null,
                department_id: assignmentType === 'department' ? selectedId : null,
                include_sub_departments: assignmentType === 'department' ? includeSubDeps : false
            };

            const { data, error } = await supabase
                .from('work_permit_approvers')
                .insert([payload])
                .select(`*, profiles(first_name, last_name, email), org_roles(name), departments(name)`)
                .single();

            if (error) throw error;
            if (data) {
                setApprovers([...approvers, data as any]);
                setSelectedId("");
                setIncludeSubDeps(false);
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

    const renderListItem = (app: Approver) => {
        if (app.user_id && app.profiles) {
            return (
                <div>
                    <span className="inline-block px-2 text-xs font-semibold bg-gray-100 text-gray-600 rounded mr-2 uppercase">Kişi</span>
                    <span className="font-medium text-gray-900">{app.profiles.first_name} {app.profiles.last_name}</span>
                    <span className="text-gray-500 text-xs ml-2">({app.profiles.email})</span>
                </div>
            );
        }
        if (app.org_role_id && app.org_roles) {
            return (
                <div>
                    <span className="inline-block px-2 text-xs font-semibold bg-blue-100 text-blue-700 rounded mr-2 uppercase">Unvan</span>
                    <span className="font-medium text-gray-900">{app.org_roles.name}</span>
                </div>
            );
        }
        if (app.department_id && app.departments) {
            return (
                <div>
                    <span className="inline-block px-2 text-xs font-semibold bg-purple-100 text-purple-700 rounded mr-2 uppercase">Departman</span>
                    <span className="font-medium text-gray-900">{app.departments.name}</span>
                    {app.include_sub_departments && <span className="text-xs text-purple-600 ml-2 italic">+ Alt Birimler</span>}
                </div>
            );
        }
        return <span className="text-gray-500">Bilinmeyen Atama</span>;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-24">
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">İş İzni Onay Mercileri Ayarları</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Sistemde iş izinlerini onaylayabilecek <strong>Mühendis / Yetkili</strong> ve <strong>İSG Sorumlusu</strong> atamalarını buradan yapabilirsiniz.
                    Onay yetkisi belirli bir <strong>kişiye</strong>, bir <strong>unvana</strong> ("Tüm Mühendisler") veya bir <strong>departmana</strong> verilebilir.
                </p>

                <form onSubmit={handleAddApprover} className="bg-gray-50 p-5 border rounded-md shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Atama Türü</label>
                            <select
                                value={assignmentType}
                                onChange={(e) => {
                                    setAssignmentType(e.target.value as AssignmentType);
                                    setSelectedId("");
                                }}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            >
                                <option value="user">Kişiye Özel</option>
                                <option value="role">Unvana (Role) Göre</option>
                                <option value="department">Departmana Göre</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {assignmentType === 'user' ? 'Personel Seçin' : assignmentType === 'role' ? 'Unvan Seçin' : 'Departman Seçin'}
                            </label>
                            {assignmentType === 'user' && (
                                <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                                    <option value="">-- Personel Seçin --</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.first_name || e.email} {e.last_name || ""} {e.first_name ? `(${e.email})` : ''}</option>
                                    ))}
                                </select>
                            )}
                            {assignmentType === 'role' && (
                                <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                                    <option value="">-- Unvan Seçin --</option>
                                    {orgRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            )}
                            {assignmentType === 'department' && (
                                <div className="flex flex-col gap-2">
                                    <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                                        <option value="">-- Departman Seçin --</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <label className="flex items-center text-sm text-gray-700 mt-1 cursor-pointer">
                                        <input type="checkbox" checked={includeSubDeps} onChange={(e) => setIncludeSubDeps(e.target.checked)} className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                        Alt Birimler (Departmanlar) Dahil
                                    </label>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Verilecek Yetki</label>
                            <select
                                value={selectedRoleType}
                                onChange={(e) => setSelectedRoleType(e.target.value as any)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            >
                                <option value="engineer">Mühendis / Yetkili Onayı</option>
                                <option value="isg">İSG Sorumlusu Onayı</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-200 mt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
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
                        Mühendis / Yetkili Yetkisine Sahip Olanlar
                    </h3>
                    {engineers.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Henüz özel bir "Mühendis/Yetkili" tanımlanmamış. Sadece yöneticiler onay verebilir.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {engineers.map(app => (
                                <li key={app.id} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                    <div className="text-sm flex-1">
                                        {renderListItem(app)}
                                    </div>
                                    <button onClick={() => handleRemoveApprover(app.id)} className="text-red-500 hover:text-red-700 p-1 text-xs font-medium bg-red-50 rounded px-2">
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
                        İSG Sorumlusu Yetkisine Sahip Olanlar
                    </h3>
                    {isgStaff.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Henüz özel bir "İSG" yetkilisi tanımlanmamış. Sadece yöneticiler onay verebilir.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {isgStaff.map(app => (
                                <li key={app.id} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                    <div className="text-sm flex-1">
                                        {renderListItem(app)}
                                    </div>
                                    <button onClick={() => handleRemoveApprover(app.id)} className="text-red-500 hover:text-red-700 p-1 text-xs font-medium bg-red-50 rounded px-2">
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
