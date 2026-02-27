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
        return <div className="p-8 text-center text-rose-500 bg-slate-900 border border-slate-800 shadow rounded-xl">Bu sayfayı görüntüleme yetkiniz yok. Sadece şirket yöneticileri erişebilir.</div>;
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;

    const engineers = approvers.filter(a => a.role_type === 'engineer');
    const isgStaff = approvers.filter(a => a.role_type === 'isg');

    const cardClass = "bg-slate-900 shadow-sm rounded-xl p-6 border border-slate-800";
    const inputClass = "w-full bg-slate-800 border-slate-700 text-slate-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border placeholder-slate-500";

    const renderListItem = (app: Approver) => {
        if (app.user_id && app.profiles) {
            return (
                <div className="flex items-center">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded border border-slate-700 mr-2 uppercase tracking-wider">Kişi</span>
                    <span className="font-medium text-slate-200">{app.profiles.first_name} {app.profiles.last_name}</span>
                    <span className="text-slate-500 text-xs ml-2">({app.profiles.email})</span>
                </div>
            );
        }
        if (app.org_role_id && app.org_roles) {
            return (
                <div className="flex items-center">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20 mr-2 uppercase tracking-wider">Unvan</span>
                    <span className="font-medium text-slate-200">{app.org_roles.name}</span>
                </div>
            );
        }
        if (app.department_id && app.departments) {
            return (
                <div className="flex items-center">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-400 rounded border border-purple-500/20 mr-2 uppercase tracking-wider">Departman</span>
                    <span className="font-medium text-slate-200">{app.departments.name}</span>
                    {app.include_sub_departments && <span className="text-[10px] text-purple-400/70 ml-2 italic">+ Alt Birimler</span>}
                </div>
            );
        }
        return <span className="text-slate-500">Bilinmeyen Atama</span>;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-24">
            <div className={cardClass}>
                <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">İş İzni Onay Mercileri Ayarları</h2>
                <p className="text-sm text-slate-400 mb-6">
                    Sistemde iş izinlerini onaylayabilecek <strong>Mühendis / Yetkili</strong> ve <strong>İSG Sorumlusu</strong> atamalarını buradan yapabilirsiniz.
                    Onay yetkisi belirli bir <strong>kişiye</strong>, bir <strong>unvana</strong> ("Tüm Mühendisler") veya bir <strong>departmana</strong> verilebilir.
                </p>

                <form onSubmit={handleAddApprover} className="bg-slate-800/50 p-5 border border-slate-700 rounded-xl shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Atama Türü</label>
                            <select
                                value={assignmentType}
                                onChange={(e) => {
                                    setAssignmentType(e.target.value as AssignmentType);
                                    setSelectedId("");
                                }}
                                className={inputClass}
                            >
                                <option value="user">Kişiye Özel</option>
                                <option value="role">Unvana (Role) Göre</option>
                                <option value="department">Departmana Göre</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                {assignmentType === 'user' ? 'Personel Seçin' : assignmentType === 'role' ? 'Unvan Seçin' : 'Departman Seçin'}
                            </label>
                            {assignmentType === 'user' && (
                                <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
                                    <option value="">-- Personel Seçin --</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.first_name || e.email} {e.last_name || ""} {e.first_name ? `(${e.email})` : ''}</option>
                                    ))}
                                </select>
                            )}
                            {assignmentType === 'role' && (
                                <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
                                    <option value="">-- Unvan Seçin --</option>
                                    {orgRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            )}
                            {assignmentType === 'department' && (
                                <div className="flex flex-col gap-2">
                                    <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
                                        <option value="">-- Departman Seçin --</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <label className="flex items-center text-sm text-slate-400 mt-1 cursor-pointer hover:text-slate-200 transition-colors">
                                        <input type="checkbox" checked={includeSubDeps} onChange={(e) => setIncludeSubDeps(e.target.checked)} className="mr-2 h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500" />
                                        Alt Birimler (Departmanlar) Dahil
                                    </label>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Verilecek Yetki</label>
                            <select
                                value={selectedRoleType}
                                onChange={(e) => setSelectedRoleType(e.target.value as any)}
                                className={inputClass}
                            >
                                <option value="engineer">Mühendis / Yetkili Onayı</option>
                                <option value="isg">İSG Sorumlusu Onayı</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-700 mt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            {saving ? 'Ekleniyor...' : '+ Yetki Ekle'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Engineer List */}
                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center border-b border-slate-800 pb-2">
                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full mr-3 shadow-lg shadow-indigo-500/50"></div>
                        Mühendis / Yetkili Onay Yetkilileri
                    </h3>
                    {engineers.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">Henüz özel bir "Mühendis/Yetkili" tanımlanmamış. Sadece yöneticiler onay verebilir.</p>
                    ) : (
                        <ul className="divide-y divide-slate-800">
                            {engineers.map(app => (
                                <li key={app.id} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                    <div className="text-sm flex-1">
                                        {renderListItem(app)}
                                    </div>
                                    <button onClick={() => handleRemoveApprover(app.id)} className="text-rose-400 hover:text-rose-300 p-1.5 text-xs font-bold bg-rose-500/10 rounded-lg px-3 transition-colors border border-rose-500/20">
                                        Kaldır
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ISG List */}
                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center border-b border-slate-800 pb-2">
                        <div className="w-2.5 h-2.5 bg-rose-500 rounded-full mr-3 shadow-lg shadow-rose-500/50"></div>
                        İSG Sorumlusu Onay Yetkilileri
                    </h3>
                    {isgStaff.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">Henüz özel bir "İSG" yetkilisi tanımlanmamış. Sadece yöneticiler onay verebilir.</p>
                    ) : (
                        <ul className="divide-y divide-slate-800">
                            {isgStaff.map(app => (
                                <li key={app.id} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                    <div className="text-sm flex-1">
                                        {renderListItem(app)}
                                    </div>
                                    <button onClick={() => handleRemoveApprover(app.id)} className="text-rose-400 hover:text-rose-300 p-1.5 text-xs font-bold bg-rose-500/10 rounded-lg px-3 transition-colors border border-rose-500/20">
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
