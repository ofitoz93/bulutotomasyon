import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Company {
    id: string;
    name: string;
    subscription_status: string;
    created_at: string;
}

interface Profile {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
    tenant_id: string | null;
}

export default function CompaniesPage() {
    const { profile } = useAuthStore();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [managerEmail, setManagerEmail] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Yönetici Düzenleme State'leri
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [currentManager, setCurrentManager] = useState<Profile | null>(null);
    const [newManagerEmail, setNewManagerEmail] = useState("");
    const [editLoading, setEditLoading] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase.from("companies").select("*");
            if (error) throw error;
            setCompanies(data || []);
        } catch (error) {
            console.error("Error fetching companies:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCompany = async () => {
        if (!newCompanyName.trim() || !managerEmail.trim()) return;
        setCreateLoading(true);

        try {
            // Aynı isimde şirket var mı kontrol et (Frontend tarafı)
            const existingCompany = companies.find(
                (c) => c.name.toLowerCase() === newCompanyName.trim().toLowerCase()
            );
            if (existingCompany) {
                alert("Bu isimde bir şirket zaten mevcut! Lütfen farklı bir isim girin.");
                setCreateLoading(false);
                return;
            }

            // 1. Şirketi oluştur
            const { data: companyData, error: companyError } = await supabase
                .from("companies")
                .insert([{ name: newCompanyName.trim() }])
                .select()
                .single();

            if (companyError) {
                // Veritabanı UNIQUE constraint hatası
                if (companyError.code === "23505") {
                    alert("Bu isimde bir şirket zaten mevcut!");
                    setCreateLoading(false);
                    return;
                }
                throw companyError;
            }

            // 2. Yeni yönetici zaten sistemde var mı kontrol et
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("email", managerEmail.trim())
                .single();

            if (existingProfile) {
                // Mevcut kullanıcıyı yeni şirketin yöneticisi yap
                const { error: updateError } = await supabase
                    .from("profiles")
                    .update({ role: "company_manager", tenant_id: companyData.id })
                    .eq("id", existingProfile.id);

                if (updateError) {
                    throw updateError;
                }
            } else {
                // 3. Geçici şifre
                const tempPassword = Math.random().toString(36).slice(-12) + "Aa1!";

                // 4. Ayrı client ile signUp (Admin oturumunu bozmaz)
                const { createClient } = await import("@supabase/supabase-js");
                const tempSupabase = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    import.meta.env.VITE_SUPABASE_ANON_KEY,
                    {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                            detectSessionInUrl: false,
                            flowType: 'implicit'
                        },
                    }
                );

                const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                    email: managerEmail,
                    password: tempPassword,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/login`,
                        data: {
                            first_name: "Şirket",
                            last_name: "Yöneticisi",
                            force_password_change: true,
                            temp_password: tempPassword
                        },
                    },
                });

                if (authError) throw authError;

                // 5. Profili güncelle
                if (authData.user) {
                    await supabase
                        .from("profiles")
                        .update({ role: "company_manager", tenant_id: companyData.id })
                        .eq("id", authData.user.id);
                }
            }

            alert(`Şirket "${newCompanyName}" oluşturuldu!\n\n${existingProfile ? "Mevcut kullanıcı yeni şirketin yöneticisi yapıldı." : managerEmail + " adresine doğrulama bağlantısı gönderildi."}`);
            setShowModal(false);
            setNewCompanyName("");
            setManagerEmail("");
            fetchCompanies();
        } catch (error: any) {
            console.error("Error creating company:", error);
            alert("Hata: " + error.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDeleteCompany = async (id: string) => {
        if (!window.confirm("Bu şirketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;

        try {
            // Şirkete bağlı kullanıcıları employee'ye düşür
            await supabase
                .from("profiles")
                .update({ role: "employee", tenant_id: null })
                .eq("tenant_id", id);

            const { error } = await supabase.from("companies").delete().eq("id", id);
            if (error) throw error;

            alert("Şirket silindi. Bağlı kullanıcılar normal üye statüsüne geçirildi.");
            fetchCompanies();
        } catch (error: any) {
            console.error("Error deleting company:", error);
            alert("Hata: " + error.message);
        }
    };

    // Yönetici Düzenleme İşlevi
    const openEditModal = async (company: Company) => {
        setEditingCompany(company);
        setNewManagerEmail("");
        setShowEditModal(true);

        // Mevcut yöneticiyi getir
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", company.id)
            .eq("role", "company_manager")
            .single();

        setCurrentManager(data);
    };

    const handleChangeManager = async () => {
        if (!editingCompany || !newManagerEmail.trim()) return;
        setEditLoading(true);

        try {
            // 1. Yeni yönetici zaten sistemde var mı kontrol et
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("email", newManagerEmail.trim())
                .single();

            if (existingProfile) {
                // Mevcut kullanıcıyı yönetici yap
                await supabase
                    .from("profiles")
                    .update({ role: "company_manager", tenant_id: editingCompany.id })
                    .eq("id", existingProfile.id);
            } else {
                // Yeni kullanıcı oluştur
                const tempPassword = Math.random().toString(36).slice(-12) + "Aa1!";
                const { createClient } = await import("@supabase/supabase-js");
                const tempSupabase = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    import.meta.env.VITE_SUPABASE_ANON_KEY,
                    {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                            detectSessionInUrl: false,
                            flowType: 'implicit'
                        },
                    }
                );

                const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                    email: newManagerEmail.trim(),
                    password: tempPassword,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/login`,
                        data: {
                            first_name: "Şirket",
                            last_name: "Yöneticisi",
                            force_password_change: true,
                            temp_password: tempPassword
                        },
                    },
                });

                if (authError) throw authError;

                if (authData.user) {
                    await supabase
                        .from("profiles")
                        .update({ role: "company_manager", tenant_id: editingCompany.id })
                        .eq("id", authData.user.id);
                }
            }

            // 2. Eski yöneticiyi "employee" yap (artık hiçbir modülü göremez)
            if (currentManager) {
                await supabase
                    .from("profiles")
                    .update({ role: "employee", tenant_id: editingCompany.id })
                    .eq("id", currentManager.id);
            }

            alert(
                `Yönetici değiştirildi!\n\n` +
                `Yeni Yönetici: ${newManagerEmail}\n` +
                (currentManager ? `Eski Yönetici (${currentManager.email}): Normal üye statüsüne geçirildi.` : "")
            );

            setShowEditModal(false);
            setEditingCompany(null);
            setCurrentManager(null);
            setNewManagerEmail("");
        } catch (error: any) {
            console.error("Error changing manager:", error);
            alert("Hata: " + error.message);
        } finally {
            setEditLoading(false);
        }
    };

    const inputClass = "w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Şirketler</h1>
                    <p className="text-sm text-slate-400 mt-1">Sisteme kayıtlı tüm şirketler.</p>
                </div>
                {profile?.role === "system_admin" && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        + Yeni Şirket Ekle
                    </button>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-800/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Şirket Adı</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Durum</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Oluşturulma Tarihi</th>
                            {profile?.role === "system_admin" && (
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">İşlemler</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-slate-500 text-sm">Yükleniyor...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : companies.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">Henüz hiç şirket yok.</td>
                            </tr>
                        ) : (
                            companies.map((company) => (
                                <tr key={company.id} className="hover:bg-slate-800/60 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                                        {company.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${company.subscription_status === "active"
                                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                            }`}>
                                            {company.subscription_status === "active" ? "Aktif" : "Pasif"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {new Date(company.created_at).toLocaleDateString("tr-TR")}
                                    </td>
                                    {profile?.role === "system_admin" && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(company)}
                                                    className="text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs transition-colors"
                                                >
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCompany(company.id)}
                                                    className="text-rose-400 hover:text-rose-300 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg text-xs transition-colors"
                                                >
                                                    Sil
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Yeni Şirket Oluştur Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">Yeni Şirket ve Yönetici Oluştur</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Şirket Adı</label>
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    className={inputClass}
                                    placeholder="Örn: Acme A.Ş."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Yönetici E-postası</label>
                                <input
                                    type="email"
                                    value={managerEmail}
                                    onChange={(e) => setManagerEmail(e.target.value)}
                                    className={inputClass}
                                    placeholder="yonetici@sirket.com"
                                />
                                <p className="text-xs text-slate-500 mt-1.5">
                                    Yöneticiye doğrulama ve şifre belirleme bağlantısı gönderilecektir.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                                İptal
                            </button>
                            <button
                                onClick={handleCreateCompany}
                                disabled={createLoading || !newCompanyName || !managerEmail}
                                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {createLoading ? "Oluşturuluyor..." : "Oluştur"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Yönetici Düzenle Modal */}
            {showEditModal && editingCompany && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">Yönetici Düzenle</h3>
                        <p className="text-sm text-slate-400">
                            <span className="text-slate-200 font-medium">{editingCompany.name}</span> şirketinin yöneticisini değiştirin.
                        </p>

                        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg">
                            <p className="text-xs font-medium text-slate-500 mb-1">Mevcut Yönetici</p>
                            {currentManager ? (
                                <p className="text-sm font-medium text-slate-200">{currentManager.email}</p>
                            ) : (
                                <p className="text-sm text-slate-500">Yönetici bulunamadı</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Yeni Yönetici E-postası</label>
                            <input
                                type="email"
                                value={newManagerEmail}
                                onChange={(e) => setNewManagerEmail(e.target.value)}
                                className={inputClass}
                                placeholder="yeni.yonetici@sirket.com"
                            />
                            <p className="text-xs text-slate-500 mt-1.5">
                                Eski yönetici normal üye statüsüne düşürülecektir.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => { setShowEditModal(false); setEditingCompany(null); setCurrentManager(null); }}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleChangeManager}
                                disabled={editLoading || !newManagerEmail}
                                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {editLoading ? "Güncelleniyor..." : "Yöneticiyi Değiştir"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
