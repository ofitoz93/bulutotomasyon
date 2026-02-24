import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Department {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
}

interface OrgRole {
    id: string;
    tenant_id: string;
    name: string;
    level_weight: number;
}

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    tc_no: string | null;
    company_employee_no: string | null;
    email: string;
}

interface Member {
    id: string;
    department_id: string;
    user_id: string;
    role_id: string | null;
    is_manager: boolean;
    profiles: Profile | null;
    org_roles: OrgRole | null;
}

export default function OrganizationChartPage() {
    const { profile } = useAuthStore();
    const isManager = profile?.role === "company_manager" || profile?.role === "system_admin";

    const [departments, setDepartments] = useState<Department[]>([]);
    const [roles, setRoles] = useState<OrgRole[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<"chart" | "manage_deps" | "manage_roles" | "manage_members">("chart");

    // Modal States
    const [showDepModal, setShowDepModal] = useState(false);
    const [depForm, setDepForm] = useState({ id: "", name: "", description: "", parent_id: "" });
    const [savingDep, setSavingDep] = useState(false);

    const [showRoleModal, setShowRoleModal] = useState(false);
    const [roleForm, setRoleForm] = useState({ id: "", name: "", level_weight: 0 });
    const [savingRole, setSavingRole] = useState(false);

    const [showMemberModal, setShowMemberModal] = useState(false);
    const [memberForm, setMemberForm] = useState({ id: "", user_id: "", department_id: "", role_id: "", is_manager: false });
    const [savingMember, setSavingMember] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const [depRes, rolesRes, memRes, usersRes] = await Promise.all([
                supabase.from("departments").select("*").eq("tenant_id", profile.tenant_id).order("name"),
                supabase.from("org_roles").select("*").eq("tenant_id", profile.tenant_id).order("level_weight", { ascending: false }),
                supabase.from("department_members").select("*, profiles!inner(id, first_name, last_name, email), org_roles(id, name, level_weight)").eq("tenant_id", profile.tenant_id),
                isManager ? supabase.from("profiles").select("id, first_name, last_name, email, tc_no, company_employee_no").eq("tenant_id", profile.tenant_id) : Promise.resolve({ data: [] })
            ]);
            setDepartments(depRes.data || []);
            setRoles(rolesRes.data || []);
            setMembers((memRes.data || []) as unknown as Member[]);
            if (isManager) setCompanyUsers(usersRes.data || []);
        } catch (e) {
            console.error("Fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    // --- Departman İşlemleri ---
    const saveDepartment = async () => {
        if (!depForm.name) return alert("Departman adı zorunludur");
        setSavingDep(true);
        try {
            const payload = {
                name: depForm.name,
                description: depForm.description || null,
                parent_id: depForm.parent_id || null,
                tenant_id: profile!.tenant_id
            };
            if (depForm.id) {
                await supabase.from("departments").update(payload).eq("id", depForm.id);
            } else {
                await supabase.from("departments").insert([payload]);
            }
            setShowDepModal(false);
            fetchData();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setSavingDep(false); }
    };
    const deleteDepartment = async (id: string) => {
        if (!window.confirm("Bu departmanı silmek istediğinize emin misiniz? (Alt departmanlar da silinir)")) return;
        await supabase.from("departments").delete().eq("id", id);
        fetchData();
    };

    // --- Unvan İşlemleri ---
    const saveRole = async () => {
        if (!roleForm.name) return alert("Unvan adı zorunludur");
        setSavingRole(true);
        try {
            const payload = {
                name: roleForm.name,
                level_weight: roleForm.level_weight,
                tenant_id: profile!.tenant_id
            };
            if (roleForm.id) {
                await supabase.from("org_roles").update(payload).eq("id", roleForm.id);
            } else {
                await supabase.from("org_roles").insert([payload]);
            }
            setShowRoleModal(false);
            fetchData();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setSavingRole(false); }
    };
    const deleteRole = async (id: string) => {
        if (!window.confirm("Bu unvanı silmek istediğinize emin misiniz?")) return;
        await supabase.from("org_roles").delete().eq("id", id);
        fetchData();
    };

    // --- Personel Atama İşlemleri ---
    const saveMember = async () => {
        if (!memberForm.user_id || !memberForm.department_id) return alert("Personel ve Departman zorunludur");
        setSavingMember(true);
        try {
            const payload = {
                user_id: memberForm.user_id,
                department_id: memberForm.department_id,
                role_id: memberForm.role_id || null,
                is_manager: memberForm.is_manager,
                tenant_id: profile!.tenant_id
            };

            if (memberForm.id) {
                await supabase.from("department_members").update(payload).eq("id", memberForm.id);
            } else {
                await supabase.from("department_members").insert([payload]);
            }
            setShowMemberModal(false);
            fetchData();
        } catch (e: any) {
            if (e.message.includes("duplicate key")) {
                alert("Uyarı: Bu personel zaten bu departmana ekli.");
            } else {
                alert("Hata: " + e.message);
            }
        }
        finally { setSavingMember(false); }
    };
    const deleteMember = async (id: string) => {
        if (!window.confirm("Bu atamayı kaldırmak istediğinize emin misiniz?")) return;
        await supabase.from("department_members").delete().eq("id", id);
        fetchData();
    };


    if (loading) return <div className="p-8">Yükleniyor...</div>;

    const getHierarchicalDepartments = (deps: Department[], parentId: string | null = null, level = 0): (Department & { level: number })[] => {
        let result: (Department & { level: number })[] = [];
        const children = deps.filter(d => d.parent_id === parentId);
        for (const child of children) {
            result.push({ ...child, level });
            result = result.concat(getHierarchicalDepartments(deps, child.id, level + 1));
        }
        return result;
    };

    // Şema Çizimi İçin Recursive Fonksiyon
    const renderNode = (depId: string | null) => {
        const children = departments.filter(d => d.parent_id === depId);
        if (children.length === 0) return null;

        return (
            <div className={`flex flex-wrap gap-4 justify-center ${depId ? "mt-4 pt-4 border-t-2 border-gray-200 relative" : ""}`}>
                {depId && (
                    <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-gray-200 -translate-x-1/2 -mt-4"></div>
                )}
                {children.map(dep => {
                    const depMembers = members.filter(m => m.department_id === dep.id).sort((a, b) => {
                        const wA = a.org_roles?.level_weight || 0;
                        const wB = b.org_roles?.level_weight || 0;
                        return wB - wA; // Sort by weight desc
                    });

                    return (
                        <div key={dep.id} className="flex flex-col items-center">
                            {/* Card */}
                            <div className="bg-white border rounded-lg shadow-sm w-64 p-4 text-center z-10 hover:shadow-md transition">
                                <h3 className="font-bold text-indigo-900 mb-1">{dep.name}</h3>
                                {depMembers.length > 0 ? (
                                    <div className="mt-3 space-y-2 text-left">
                                        {depMembers.map(m => (
                                            <div key={m.id} className="text-sm bg-gray-50 p-2 rounded border flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
                                                    {m.profiles?.first_name?.charAt(0) || "U"}
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {(m.profiles?.first_name || "") + " " + (m.profiles?.last_name || "")}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {m.profiles?.company_employee_no ? `Sicil: ${m.profiles.company_employee_no}` : "Sicil No Yok"}
                                                        {m.profiles?.tc_no && ` | TC: ***${m.profiles.tc_no.slice(-3)}`}
                                                    </div>
                                                    <span className="text-xs text-indigo-600 font-medium">
                                                        {m.org_roles?.name || "Personel"} {m.is_manager ? "(Yönetici)" : ""}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 mt-2 italic">Personel Yok</p>
                                )}
                            </div>

                            {/* Recursive Children Render */}
                            <div className="flex flex-col items-center relative">
                                {departments.filter(d => d.parent_id === dep.id).length > 0 && (
                                    <div className="w-0.5 h-4 bg-gray-200"></div>
                                )}
                                {renderNode(dep.id)}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 max-w-7xl animate-fade-in pb-12">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Organizasyon Şeması</h1>
                    <p className="text-gray-500 text-sm">Şirketinizin departman hiyerarşisi ve personel yapısı</p>
                </div>
            </div>

            {isManager && (
                <div className="flex gap-2 mb-6 overflow-x-auto">
                    <button onClick={() => setActiveTab("chart")} className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab === "chart" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"}`}>Görünüm (Şema)</button>
                    <button onClick={() => setActiveTab("manage_deps")} className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab === "manage_deps" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"}`}>Departman Yönetimi</button>
                    <button onClick={() => setActiveTab("manage_roles")} className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab === "manage_roles" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"}`}>Unvan/Rol Yönetimi</button>
                    <button onClick={() => setActiveTab("manage_members")} className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab === "manage_members" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"}`}>Personel Atamaları</button>
                </div>
            )}

            {/* ŞEMA GÖRÜNÜMÜ */}
            {activeTab === "chart" && (
                <div className="bg-gray-50 p-8 rounded-xl border overflow-x-auto min-h-[500px]">
                    {departments.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            Henüz yapılandırılmış bir departman bulunmuyor.
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            {renderNode(null)}
                        </div>
                    )}
                </div>
            )}

            {/* DEPARTMAN YÖNETİMİ */}
            {activeTab === "manage_deps" && isManager && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">Departmanlar</h2>
                        <button onClick={() => { setDepForm({ id: "", name: "", description: "", parent_id: "" }); setShowDepModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Departman Ekle</button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departman Adı</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Üst Departman</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {getHierarchicalDepartments(departments).map(d => (
                                <tr key={d.id}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        <div style={{ paddingLeft: `${d.level * 1.5}rem` }} className="flex items-center">
                                            {d.level > 0 && <span className="text-gray-400 mr-2">└</span>}
                                            {d.name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {d.parent_id ? departments.find(x => x.id === d.parent_id)?.name : "Ana Departman (En Üst)"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        <button onClick={() => { setDepForm({ id: d.id, name: d.name, description: d.description || "", parent_id: d.parent_id || "" }); setShowDepModal(true); }} className="text-indigo-600 hover:text-indigo-900 mr-3">Düzenle</button>
                                        <button onClick={() => deleteDepartment(d.id)} className="text-red-600 hover:text-red-900">Sil</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* UNVAN YÖNETİMİ */}
            {activeTab === "manage_roles" && isManager && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">Unvanlar ve Roller</h2>
                        <button onClick={() => { setRoleForm({ id: "", name: "", level_weight: 0 }); setShowRoleModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Unvan Ekle</button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unvan Adı</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Büyük sayı üstte görünür">Görünüm Ağırlığı</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {roles.map(r => (
                                <tr key={r.id}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{r.level_weight}</td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        <button onClick={() => { setRoleForm({ id: r.id, name: r.name, level_weight: r.level_weight }); setShowRoleModal(true); }} className="text-indigo-600 hover:text-indigo-900 mr-3">Düzenle</button>
                                        <button onClick={() => deleteRole(r.id)} className="text-red-600 hover:text-red-900">Sil</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* PERSONEL ATAMALARI */}
            {activeTab === "manage_members" && isManager && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">Departman Personelleri</h2>
                        <button onClick={() => { setMemberForm({ id: "", user_id: "", department_id: "", role_id: "", is_manager: false }); setShowMemberModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Personel Ata</button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personel</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departman</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unvan / Rol</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {members.map(m => (
                                <tr key={m.id}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {(m.profiles?.first_name || "") + " " + (m.profiles?.last_name || "")}
                                        <span className="block text-xs text-gray-400">{m.profiles?.email}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{departments.find(d => d.id === m.department_id)?.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {m.org_roles?.name || "Personel"}
                                        {m.is_manager && <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">Birim Yöneticisi</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        <button onClick={() => { setMemberForm({ id: m.id, user_id: m.user_id, department_id: m.department_id, role_id: m.role_id || "", is_manager: m.is_manager }); setShowMemberModal(true); }} className="text-indigo-600 hover:text-indigo-900 mr-3">Düzenle</button>
                                        <button onClick={() => deleteMember(m.id)} className="text-red-600 hover:text-red-900">Kaldır</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}


            {/* MODALS */}
            {/* Departman Modal */}
            {showDepModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-lg font-bold mb-4">{depForm.id ? "Departman Düzenle" : "Yeni Departman"}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Departman Adı *</label>
                                <input type="text" value={depForm.name} onChange={e => setDepForm({ ...depForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bağlı Olduğu Üst Departman (Opsiyonel)</label>
                                <select value={depForm.parent_id} onChange={e => setDepForm({ ...depForm, parent_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="">-- En Üst Seviye (Ana Departman) --</option>
                                    {getHierarchicalDepartments(departments.filter(d => d.id !== depForm.id)).map(d => (
                                        <option key={d.id} value={d.id}>{"\u00A0\u00A0\u00A0\u00A0".repeat(d.level) + (d.level > 0 ? "└ " : "") + d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setShowDepModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
                                <button onClick={saveDepartment} disabled={savingDep} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Kaydet</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unvan Modal */}
            {showRoleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-lg font-bold mb-4">{roleForm.id ? "Unvan Düzenle" : "Yeni Unvan"}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unvan Adı *</label>
                                <input placeholder="Örn: Şef" type="text" value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ağırlık Puanı (Hiyerarşi) *</label>
                                <input type="number" value={roleForm.level_weight} onChange={e => setRoleForm({ ...roleForm, level_weight: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                <p className="text-xs text-gray-500 mt-1">Sayı ne kadar büyükse, listede o kadar üstte görünür. (Örn: Müdür 100, Uzman 50, Personel 10)</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
                                <button onClick={saveRole} disabled={savingRole} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Kaydet</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Personel Atama Modal */}
            {showMemberModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-lg font-bold mb-4">{memberForm.id ? "Atama Düzenle" : "Yeni Atama"}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Personel Seçimi *</label>
                                <select disabled={!!memberForm.id} value={memberForm.user_id} onChange={e => setMemberForm({ ...memberForm, user_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100">
                                    <option value="">-- Personel Seçin --</option>
                                    {companyUsers.map(u => (
                                        <option key={u.id} value={u.id}>{(u.first_name || "") + " " + (u.last_name || "")} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Departman *</label>
                                <select value={memberForm.department_id} onChange={e => setMemberForm({ ...memberForm, department_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="">-- Departman Seçin --</option>
                                    {getHierarchicalDepartments(departments).map(d => (
                                        <option key={d.id} value={d.id}>{"\u00A0\u00A0\u00A0\u00A0".repeat(d.level) + (d.level > 0 ? "└ " : "") + d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unvan / Rol</label>
                                <select value={memberForm.role_id} onChange={e => setMemberForm({ ...memberForm, role_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="">-- Personel (Varsayılan) --</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" id="is_mgr" checked={memberForm.is_manager} onChange={e => setMemberForm({ ...memberForm, is_manager: e.target.checked })} className="rounded text-indigo-600 w-4 h-4 cursor-pointer" />
                                <label htmlFor="is_mgr" className="text-sm font-medium text-gray-700 cursor-pointer">Bu departmanın yöneticisi mi?</label>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button onClick={() => setShowMemberModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
                                <button onClick={saveMember} disabled={savingMember} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Kaydet</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
