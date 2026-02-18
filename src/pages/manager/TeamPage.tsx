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
                { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
            );
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: email.trim(), password: tempPassword,
                options: { data: { first_name: firstName.trim() || "Çalışan", last_name: lastName.trim() || "", force_password_change: true } },
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
            await supabase.from("profiles").update({ tenant_id: null, role: "employee" }).eq("id", member.id);
            alert("Kullanıcı şirketten çıkarıldı.");
            if (selectedMember?.id === member.id) setSelectedMember(null);
            fetchAll();
        } catch (error: any) { alert("Hata: " + error.message); }
    };

    // Seçili personelin modül sayısı
    const getMemberModuleCount = (userId: string) => {
        return userAccessList.filter(a => a.user_id === userId).length;
    };

    const getMemberDisplayName = (member: TeamMember) => {
        const name = `${member.first_name || ""} ${member.last_name || ""}`.trim();
        return name || member.email;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Ekip Yönetimi</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Toplam {members.length} üye · {employees.length} çalışan
                    </p>
                </div>
                <button onClick={() => setShowInviteModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                    Yeni Çalışan Davet Et
                </button>
            </div>

            {/* Modül Erişim Yönetimi - Arama Bazlı */}
            {companyModules.length > 0 && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase">Modül Erişim Yönetimi</h2>
                        <p className="text-xs text-gray-500 mt-1">Personel arayarak hangi modüllere erişebileceğini belirleyin.</p>
                    </div>
                    <div className="p-4">
                        <div className="relative">
                            <input
                                type="text"
                                value={selectedMember ? getMemberDisplayName(selectedMember) : searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setSelectedMember(null); }}
                                placeholder="Personel adı veya e-posta arayın..."
                                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                            />
                            {selectedMember && (
                                <button onClick={() => { setSelectedMember(null); setSearchQuery(""); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">✕</button>
                            )}
                            {/* Arama dropdown */}
                            {!selectedMember && filteredEmployees.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredEmployees.map(emp => (
                                        <button key={emp.id}
                                            onClick={() => { setSelectedMember(emp); setSearchQuery(""); }}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex justify-between items-center">
                                            <div>
                                                <span className="font-medium text-gray-900">{getMemberDisplayName(emp)}</span>
                                                {emp.first_name && <span className="text-gray-400 ml-2 text-xs">{emp.email}</span>}
                                            </div>
                                            <span className="text-xs text-gray-400">{getMemberModuleCount(emp.id)} modül</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!selectedMember && searchQuery.trim() && filteredEmployees.length === 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-4 py-3">
                                    <p className="text-sm text-gray-400 italic">Personel bulunamadı.</p>
                                </div>
                            )}
                        </div>

                        {/* Seçili personelin modülleri */}
                        {selectedMember && (
                            <div className="mt-4 border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm text-gray-500">
                                        <span className="font-semibold text-gray-700">{getMemberDisplayName(selectedMember)}</span> — modül erişimleri:
                                    </p>
                                    <span className="text-xs text-gray-400">{selectedMember.email}</span>
                                </div>
                                <div className="space-y-2">
                                    {companyModules.map(mod => {
                                        const has = hasModuleAccess(selectedMember.id, mod.module_key);
                                        return (
                                            <div key={mod.module_key}
                                                className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition ${has ? "bg-green-50 border-green-200 hover:bg-green-100" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
                                                onClick={() => toggleModuleAccess(selectedMember, mod.module_key)}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${has ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                                                        {has ? "✓" : "—"}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900">{mod.name}</span>
                                                </div>
                                                <span className={`text-xs font-medium ${has ? "text-green-600" : "text-gray-400"}`}>
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
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase">Ekip Üyeleri</h2>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Soyad</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-posta</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Modüller</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kayıt</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center">Yükleniyor...</td></tr>
                        ) : members.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Henüz ekip üyesi yok.</td></tr>
                        ) : (
                            members.map((member) => (
                                <tr key={member.id} className={`${selectedMember?.id === member.id ? "bg-indigo-50" : "hover:bg-gray-50"} transition`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {member.first_name || ""} {member.last_name || ""}
                                        {!member.first_name && !member.last_name && (
                                            <span className="text-gray-400 italic">İsim belirtilmemiş</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${member.role === "company_manager" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                                            {member.role === "company_manager" ? "Yönetici" : "Çalışan"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        {member.role === "employee" ? (
                                            <button onClick={() => { setSelectedMember(member); setSearchQuery(""); }}
                                                className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">
                                                {getMemberModuleCount(member.id)}/{companyModules.length} modül
                                            </button>
                                        ) : (
                                            <span className="text-gray-300 text-xs">Tümü</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(member.created_at).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {member.role !== "company_manager" ? (
                                            <button onClick={() => handleRemoveMember(member)}
                                                className="text-red-600 hover:text-red-900">Çıkar</button>
                                        ) : <span className="text-gray-300">—</span>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Davet Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold">Yeni Çalışan Davet Et</h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad</label>
                                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Ahmet" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Soyad</label>
                                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Yılmaz" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta Adresi *</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="calisan@sirket.com" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowInviteModal(false)}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">İptal</button>
                            <button onClick={handleInviteMember} disabled={createLoading || !email}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {createLoading ? "Gönderiliyor..." : "Davet Gönder"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
