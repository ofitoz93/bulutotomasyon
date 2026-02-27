import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface TeamMember {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
    tc_no: string | null;
    company_employee_no: string | null;
}

interface CompanyModule {
    module_key: string;
    name: string;
}

interface UserAccess {
    user_id: string;
    module_key: string;
}

export default function TeamPage() {
    const { profile, user } = useAuthStore();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);
    const [userAccessList, setUserAccessList] = useState<UserAccess[]>([]);
    const [loading, setLoading] = useState(true);

    // Davet modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Personel arama & modül yönetimi
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

    // Modül atama ve düzenleme modalı
    const [showEditModal, setShowEditModal] = useState(false);
    const [editMember, setEditMember] = useState<TeamMember | null>(null);
    const [tempEmployeeNo, setTempEmployeeNo] = useState("");
    const [savingEmployeeNo, setSavingEmployeeNo] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) fetchAll();
    }, [profile?.tenant_id]);

    const fetchAll = async () => {
        try {
            const { data: membersData } = await supabase
                .from("profiles").select("*")
                .eq("tenant_id", profile!.tenant_id)
                .order("first_name", { ascending: true });
            setMembers(membersData || []);

            const { data: modsData } = await supabase
                .from("company_modules")
                .select("module_key, is_active, is_indefinite, expires_at, modules(name)")
                .eq("company_id", profile!.tenant_id)
                .eq("is_active", true);
            if (modsData) {
                const now = new Date();
                const validMods = modsData.filter((m: any) => {
                    if (m.is_indefinite) return true;
                    if (!m.expires_at) return true;
                    return new Date(m.expires_at) >= now;
                });
                setCompanyModules(validMods.map((m: any) => ({
                    module_key: m.module_key,
                    name: m.modules?.name || m.module_key,
                })));
            }

            const { data: accessData } = await supabase
                .from("user_module_access")
                .select("user_id, module_key")
                .eq("tenant_id", profile!.tenant_id);
            setUserAccessList(accessData || []);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Arama sonuçları
    const employees = members.filter(m => m.role === "employee");
    const filteredEmployees = searchQuery.trim()
        ? employees.filter(m => {
            const fullName = `${m.first_name || ""} ${m.last_name || ""} ${m.email}`.toLowerCase();
            return fullName.includes(searchQuery.toLowerCase());
        }).slice(0, 15)
        : [];

    const hasModuleAccess = (userId: string, moduleKey: string) => {
        return userAccessList.some(a => a.user_id === userId && a.module_key === moduleKey);
    };

    const toggleModuleAccess = async (member: TeamMember, moduleKey: string) => {
        try {
            const has = hasModuleAccess(member.id, moduleKey);
            if (has) {
                await supabase.from("user_module_access").delete()
                    .eq("user_id", member.id).eq("module_key", moduleKey).eq("tenant_id", profile!.tenant_id);
            } else {
                await supabase.from("user_module_access").insert([{
                    user_id: member.id, module_key: moduleKey,
                    tenant_id: profile!.tenant_id, granted_by: user!.id,
                }]);
            }
            fetchAll();
        } catch (error: any) { alert("Hata: " + error.message); }
    };

    const handleInviteMember = async () => {
        if (!email.trim()) return;
        setCreateLoading(true);
        try {
            const { data: existingProfile } = await supabase
                .from("profiles").select("id").eq("email", email.trim()).single();
            if (existingProfile) { alert("Bu e-posta adresi zaten sistemde kayıtlı!"); setCreateLoading(false); return; }

            const tempPassword = Math.random().toString(36).slice(-12) + "Aa1!";
            const { createClient } = await import("@supabase/supabase-js");
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' } }
            );
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: email.trim(), password: tempPassword,
                options: { emailRedirectTo: `${window.location.origin}/auth/login`, data: { first_name: firstName.trim() || "Çalışan", last_name: lastName.trim() || "", force_password_change: true, temp_password: tempPassword } },
            });
            if (authError) throw authError;
            if (authData.user) {
                await supabase.from("profiles").update({
                    role: "employee", tenant_id: profile!.tenant_id,
                    first_name: firstName.trim() || "Çalışan", last_name: lastName.trim() || "",
                }).eq("id", authData.user.id);
            }
            alert(`Çalışan davet edildi!\n${email}`);
            setShowInviteModal(false); setEmail(""); setFirstName(""); setLastName(""); fetchAll();
        } catch (error: any) { alert("Hata: " + error.message); }
        finally { setCreateLoading(false); }
    };

    const handleRemoveMember = async (member: TeamMember) => {
        if (member.role === "company_manager") { alert("Yöneticiyi kaldıramazsınız!"); return; }
        if (!window.confirm(`${member.first_name || ""} ${member.last_name || member.email} kullanıcısını şirketten çıkarmak istediğinize emin misiniz?`)) return;
        try {
            await supabase.from("user_module_access").delete()
                .eq("user_id", member.id).eq("tenant_id", profile!.tenant_id);
            await supabase.from("profiles").update({ tenant_id: null, role: "employee", company_employee_no: null }).eq("id", member.id);
            alert("Kullanıcı şirketten çıkarıldı.");
            if (selectedMember?.id === member.id) setSelectedMember(null);
            fetchAll();
        } catch (error: any) { alert("Hata: " + error.message); }
    };

    const handleSaveEmployeeNo = async () => {
        if (!editMember) return;
        setSavingEmployeeNo(true);
        try {
            const val = tempEmployeeNo.trim() || null;
            const { error } = await supabase.from("profiles").update({ company_employee_no: val }).eq("id", editMember.id);
            if (error) throw error;

            setShowEditModal(false);
            setEditMember(null);
            fetchAll();
        } catch (e: any) {
            if (e.message?.includes("unique_company_employee_no_per_tenant") || e.message?.includes("duplicate key")) {
                alert("Bu şirket sicil numarası zaten başka bir personelde kullanılıyor.");
            } else {
                alert("Hata: " + e.message);
            }
        } finally {
            setSavingEmployeeNo(false);
        }
    };

    // Seçili personelin modül sayısı
    const getMemberModuleCount = (userId: string) => {
        return userAccessList.filter(a => a.user_id === userId).length;
    };

    const getMemberDisplayName = (member: TeamMember) => {
        const name = `${member.first_name || ""} ${member.last_name || ""}`.trim();
        return name || member.email;
    };

    const inputClass = "w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Ekip Yönetimi</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Toplam {members.length} üye · {employees.length} çalışan
                    </p>
                </div>
                <button onClick={() => setShowInviteModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                    + Yeni Çalışan Davet Et
                </button>
            </div>

            {/* Modül Erişim Yönetimi - Arama Bazlı */}
            {companyModules.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Modül Erişim Yönetimi</h2>
                        <p className="text-xs text-slate-500 mt-1">Personel arayarak hangi modüllere erişebileceğini belirleyin.</p>
                    </div>
                    <div className="p-4">
                        <div className="relative">
                            <input
                                type="text"
                                value={selectedMember ? getMemberDisplayName(selectedMember) : searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setSelectedMember(null); }}
                                placeholder="Personel adı veya e-posta arayın..."
                                className={`${inputClass} pr-10`}
                            />
                            {selectedMember && (
                                <button onClick={() => { setSelectedMember(null); setSearchQuery(""); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-lg">✕</button>
                            )}
                            {!selectedMember && filteredEmployees.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {filteredEmployees.map(emp => (
                                        <button key={emp.id}
                                            onClick={() => { setSelectedMember(emp); setSearchQuery(""); }}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-700 border-b border-slate-700 last:border-0 flex justify-between items-center">
                                            <div>
                                                <span className="font-medium text-slate-200">{getMemberDisplayName(emp)}</span>
                                                {emp.first_name && <span className="text-slate-500 ml-2 text-xs">{emp.email}</span>}
                                            </div>
                                            <span className="text-xs text-slate-500">{getMemberModuleCount(emp.id)} modül</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!selectedMember && searchQuery.trim() && filteredEmployees.length === 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-4 py-3">
                                    <p className="text-sm text-slate-500 italic">Personel bulunamadı.</p>
                                </div>
                            )}
                        </div>

                        {selectedMember && (
                            <div className="mt-4 border-t border-slate-800 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm text-slate-400">
                                        <span className="font-semibold text-slate-200">{getMemberDisplayName(selectedMember)}</span> — modül erişimleri:
                                    </p>
                                    <span className="text-xs text-slate-600">{selectedMember.email}</span>
                                </div>
                                <div className="space-y-2">
                                    {companyModules.map(mod => {
                                        const has = hasModuleAccess(selectedMember.id, mod.module_key);
                                        return (
                                            <div key={mod.module_key}
                                                className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition ${has
                                                        ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                                                        : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                                                    }`}
                                                onClick={() => toggleModuleAccess(selectedMember, mod.module_key)}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${has ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-500"
                                                        }`}>
                                                        {has ? "✓" : "—"}
                                                    </span>
                                                    <span className="text-sm font-medium text-slate-200">{mod.name}</span>
                                                </div>
                                                <span className={`text-xs font-medium ${has ? "text-emerald-400" : "text-slate-500"}`}>
                                                    {has ? "Aktif" : "Pasif"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Ekip Listesi */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Ekip Üyeleri</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ad Soyad</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">E-posta</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Sicil No / TC</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Modüller</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Kayıt</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-slate-500 text-sm">Yükleniyor...</span>
                                    </div>
                                </td></tr>
                            ) : members.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">Henüz ekip üyesi yok.</td></tr>
                            ) : (
                                members.map((member) => (
                                    <tr key={member.id} className={`transition-colors ${selectedMember?.id === member.id
                                            ? "bg-indigo-500/10 border-l-2 border-indigo-500"
                                            : "hover:bg-slate-800/60"
                                        }`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                                            {member.first_name || ""} {member.last_name || ""}
                                            {!member.first_name && !member.last_name && (
                                                <span className="text-slate-500 italic">Eksik Profil</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{member.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-slate-300"><span className="text-xs text-slate-500">Sicil:</span> {member.company_employee_no || <span className="text-rose-400 italic text-xs">Atanmamış</span>}</span>
                                                {member.tc_no && <span className="text-xs text-slate-500">TC: ***{member.tc_no.slice(-3)}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${member.role === "company_manager"
                                                    ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                                                    : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                                }`}>
                                                {member.role === "company_manager" ? "Yönetici" : "Çalışan"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {member.role === "employee" ? (
                                                <button onClick={() => { setSelectedMember(member); setSearchQuery(""); }}
                                                    className="text-indigo-400 hover:text-indigo-300 font-medium text-xs transition-colors">
                                                    {getMemberModuleCount(member.id)}/{companyModules.length} modül
                                                </button>
                                            ) : (
                                                <span className="text-slate-600 text-xs">Tümü</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                            {new Date(member.created_at).toLocaleDateString("tr-TR")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => { setEditMember(member); setTempEmployeeNo(member.company_employee_no || ""); setShowEditModal(true); }}
                                                    className="text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg text-xs transition-colors">Düzenle</button>
                                                {member.role !== "company_manager" && (
                                                    <button onClick={() => handleRemoveMember(member)}
                                                        className="text-rose-400 hover:text-rose-300 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg text-xs transition-colors">Çıkar</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Davet Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">Yeni Çalışan Davet Et</h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad</label>
                                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                        className={inputClass} placeholder="Ahmet" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Soyad</label>
                                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                                        className={inputClass} placeholder="Yılmaz" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">E-posta Adresi *</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass} placeholder="calisan@sirket.com" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowInviteModal(false)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                            <button onClick={handleInviteMember} disabled={createLoading || !email}
                                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50">
                                {createLoading ? "Gönderiliyor..." : "Davet Gönder"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Düzenleme Modal (Sicil No) */}
            {showEditModal && editMember && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
                        <div>
                            <h3 className="text-lg font-bold text-white">Personel Düzenle</h3>
                            <p className="text-sm text-slate-400 mt-1">{editMember.first_name || ""} {editMember.last_name || ""}
                                <span className="text-slate-500"> ({editMember.email})</span>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Şirket Sicil Numarası</label>
                            <input type="text" value={tempEmployeeNo} onChange={(e) => setTempEmployeeNo(e.target.value)}
                                className={inputClass} placeholder="Örn: 2024-1234" />
                            <p className="text-xs text-slate-500 mt-1.5">Şirket içindeki benzersiz personel takip numarası.</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => { setShowEditModal(false); setEditMember(null); }}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">İptal</button>
                            <button onClick={handleSaveEmployeeNo} disabled={savingEmployeeNo}
                                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50">
                                {savingEmployeeNo ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
