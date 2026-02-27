import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Trash2, Settings } from "lucide-react";

interface Subcontractor {
    id: string;
    name: string;
    email: string;
    user_id: string | null;
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

export default function SubcontractorsPage() {
    const { profile } = useAuthStore();
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);
    const [userAccesses, setUserAccesses] = useState<UserAccess[]>([]);
    const [loading, setLoading] = useState(true);

    // Ekleme formu
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Modül yönetimi
    const [selectedSub, setSelectedSub] = useState<Subcontractor | null>(null);

    useEffect(() => {
        if (profile?.tenant_id) fetchAll();
    }, [profile]);

    const fetchAll = async () => {
        setLoading(true);
        const [subRes, modRes, accRes] = await Promise.all([
            supabase.from("subcontractors").select("*").eq("parent_company_id", profile!.tenant_id).order("created_at", { ascending: false }),
            supabase.from("company_modules").select("module_key, modules(name)").eq("company_id", profile!.tenant_id).eq("is_active", true),
            supabase.from("user_module_access").select("user_id, module_key").eq("tenant_id", profile!.tenant_id),
        ]);
        if (subRes.data) setSubcontractors(subRes.data);
        if (modRes.data) setCompanyModules(modRes.data.map((m: any) => ({ module_key: m.module_key, name: m.modules?.name || m.module_key })));
        if (accRes.data) setUserAccesses(accRes.data);
        setLoading(false);
    };

    const handleAddSubcontractor = async () => {
        if (!newName.trim() || !newEmail.trim()) {
            setError("Firma adı ve e-posta adresi gereklidir.");
            return;
        }
        setAddLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // 1. Aynı e-posta zaten var mı kontrol et
            const { data: existingProfile } = await supabase
                .from("profiles").select("id").eq("email", newEmail.trim()).single();
            if (existingProfile) {
                setError("Bu e-posta adresi zaten sistemde kayıtlı!");
                setAddLoading(false);
                return;
            }

            // 2. Auth hesabı oluştur
            const tempPassword = Math.random().toString(36).slice(-12) + "Aa1!";
            const { createClient } = await import("@supabase/supabase-js");
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' } }
            );

            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: newEmail.trim(),
                password: tempPassword,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/login`,
                    data: {
                        first_name: newName.trim(),
                        last_name: "Taşeron",
                        force_password_change: true,
                        temp_password: tempPassword,
                    },
                },
            });
            if (authError) throw authError;

            if (authData.user) {
                // 3. E-postayı otomatik onayla (admin tarafından oluşturulduğu için)
                await supabase.rpc('auto_confirm_user_email', { user_id: authData.user.id });

                // 4. Profili güncelle: subcontractor_manager rolü, tenant_id = parent_company_id
                await supabase
                    .from("profiles")
                    .update({ role: "subcontractor_manager", tenant_id: profile!.tenant_id })
                    .eq("id", authData.user.id);

                // 5. Subcontractors tablosuna kaydet
                await supabase.from("subcontractors").insert({
                    parent_company_id: profile!.tenant_id,
                    name: newName.trim(),
                    email: newEmail.trim(),
                    user_id: authData.user.id,
                });
            }

            setSuccess(`${newName.trim()} alt taşeron olarak eklendi. Davet e-postası gönderildi.`);
            setNewName("");
            setNewEmail("");
            setShowAddForm(false);
            fetchAll();
        } catch (err: any) {
            setError(err.message || "Alt taşeron eklenirken bir hata oluştu.");
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemoveSubcontractor = async (sub: Subcontractor) => {
        if (!confirm(`"${sub.name}" alt taşeronunu kaldırmak istediğinize emin misiniz?`)) return;
        await supabase.from("subcontractors").delete().eq("id", sub.id);
        if (sub.user_id) {
            await supabase.from("profiles").update({ is_active: false }).eq("id", sub.user_id);
        }
        fetchAll();
    };

    const hasModuleAccess = (userId: string, moduleKey: string) => {
        return userAccesses.some(a => a.user_id === userId && a.module_key === moduleKey);
    };

    const toggleModuleAccess = async (sub: Subcontractor, moduleKey: string) => {
        if (!sub.user_id) return;
        const has = hasModuleAccess(sub.user_id, moduleKey);
        if (has) {
            await supabase.from("user_module_access").delete()
                .eq("user_id", sub.user_id).eq("module_key", moduleKey).eq("tenant_id", profile!.tenant_id);
        } else {
            await supabase.from("user_module_access").insert({
                user_id: sub.user_id, module_key: moduleKey, tenant_id: profile!.tenant_id,
            });
        }
        fetchAll();
    };

    if (loading) return (
        <div className="flex items-center justify-center gap-3 p-12">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-500 text-sm">Yükleniyor...</span>
        </div>
    );

    const inputClass = "w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Alt Taşeron Yönetimi</h1>
                    <p className="text-sm text-slate-400 mt-1">Şirketinize bağlı alt taşeron firmalarını buradan yönetebilirsiniz.</p>
                </div>
                <button onClick={() => { setShowAddForm(!showAddForm); setError(null); setSuccess(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20">
                    <Plus className="w-4 h-4" /> Yeni Alt Taşeron Ekle
                </button>
            </div>

            {error && (
                <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/30 text-sm">{error}</div>
            )}
            {success && (
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/30 text-sm">{success}</div>
            )}

            {/* Ekleme Formu */}
            {showAddForm && (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-white mb-4">Yeni Alt Taşeron Ekle</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Firma Adı *</label>
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                className={inputClass} placeholder="Örn: ABC Mühendislik" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">E-posta Adresi *</label>
                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                className={inputClass} placeholder="taseron@firma.com" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleAddSubcontractor} disabled={addLoading}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50">
                            {addLoading ? "Ekleniyor..." : "Taşeronu Ekle ve Davet Gönder"}
                        </button>
                        <button onClick={() => setShowAddForm(false)}
                            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors text-sm">
                            İptal
                        </button>
                    </div>
                </div>
            )}

            {/* Taşeron Listesi */}
            {subcontractors.length === 0 ? (
                <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Settings className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-base font-medium text-slate-300">Henüz alt taşeron eklenmemiş</h3>
                    <p className="text-sm text-slate-500 mt-2">Yukarıdaki butona tıklayarak ilk alt taşeronanunuzu ekleyin.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {subcontractors.map(sub => (
                        <div key={sub.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-100">{sub.name}</h3>
                                    <p className="text-sm text-slate-500">{sub.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${sub.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                                        {sub.is_active ? "Aktif" : "Pasif"}
                                    </span>
                                    <button onClick={() => setSelectedSub(selectedSub?.id === sub.id ? null : sub)}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors">
                                        {selectedSub?.id === sub.id ? "Modülleri Kapat" : "Modül Yönetimi"}
                                    </button>
                                    <button onClick={() => handleRemoveSubcontractor(sub)}
                                        className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {selectedSub?.id === sub.id && sub.user_id && (
                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <h4 className="text-sm font-semibold text-slate-300 mb-3">Modül Erişim Yetkileri</h4>
                                    {companyModules.filter(m => m.module_key !== 'alt_taseron').length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">Şirketinize tanımlı modül yok.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {companyModules.filter(m => m.module_key !== 'alt_taseron').map(mod => {
                                                const has = hasModuleAccess(sub.user_id!, mod.module_key);
                                                return (
                                                    <label key={mod.module_key} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${has ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                                                        <input type="checkbox" checked={has} onChange={() => toggleModuleAccess(sub, mod.module_key)} className="rounded text-indigo-600 accent-indigo-500" />
                                                        <span className="text-sm font-medium text-slate-300">{mod.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
