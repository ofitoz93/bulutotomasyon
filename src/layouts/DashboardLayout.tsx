import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ActiveModule {
    module_key: string;
    name: string;
}

export default function DashboardLayout() {
    const { signOut, user, profile, loading } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [companyName, setCompanyName] = useState<string>("");
    const [activeModules, setActiveModules] = useState<ActiveModule[]>([]);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/auth/login");
            } else if (user.user_metadata?.force_password_change) {
                navigate("/auth/update-password");
            }
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (!user || !profile) return;

        // Şirket adını getir (yönetici ve çalışan)
        if (profile.tenant_id && profile.role !== "system_admin") {
            supabase.from("companies").select("name").eq("id", profile.tenant_id).single()
                .then(({ data }) => { if (data) setCompanyName(data.name); });
        }

        // Modülleri getir
        if (profile.role === "system_admin") {
            // Admin: tüm tanımlı modülleri sidebar'da görsün (test amaçlı)
            supabase.from("modules").select("key, name").then(({ data }) => {
                if (data) {
                    setActiveModules(data.map((m: any) => ({
                        module_key: m.key,
                        name: m.name,
                    })));
                }
            });
        } else if (profile.role === "company_manager" && profile.tenant_id) {
            // Yönetici: şirketine atanmış aktif modülleri görür
            supabase
                .from("company_modules")
                .select("module_key, is_active, is_indefinite, expires_at, modules(name)")
                .eq("company_id", profile.tenant_id)
                .eq("is_active", true)
                .then(({ data }) => {
                    if (data) {
                        const now = new Date();
                        const valid = data.filter((m: any) => {
                            if (m.is_indefinite) return true;
                            if (!m.expires_at) return true;
                            return new Date(m.expires_at) >= now;
                        });
                        setActiveModules(valid.map((m: any) => ({
                            module_key: m.module_key,
                            name: m.modules?.name || m.module_key,
                        })));
                    }
                });
        } else if (profile.role === "employee" && profile.tenant_id) {
            // Çalışan: sadece yöneticinin kendisine açtığı modülleri görür
            supabase
                .from("user_module_access")
                .select("module_key, modules(name)")
                .eq("user_id", user.id)
                .eq("tenant_id", profile.tenant_id)
                .then(({ data }) => {
                    if (data) {
                        setActiveModules(data.map((m: any) => ({
                            module_key: m.module_key,
                            name: m.modules?.name || m.module_key,
                        })));
                    }
                });
        }
    }, [profile?.tenant_id, profile?.role, user]);

    if (loading) return <div className="p-10">Yükleniyor...</div>;

    const isActive = (path: string) => location.pathname === path;
    const linkClass = (path: string) =>
        `block px-4 py-2 text-sm rounded transition ${isActive(path)
            ? "bg-indigo-50 text-indigo-700 font-medium"
            : "text-gray-700 hover:bg-gray-50"
        }`;

    const moduleRoutes: Record<string, string> = {
        evrak_takip: "/app/evrak-takip",
        ekipman_takip: "/app/ekipman-takip",
    };

    const getRoleLabel = () => {
        if (profile?.role === "system_admin") return "Sistem Yöneticisi";
        if (profile?.role === "company_manager") return "Şirket Yöneticisi";
        return "Çalışan";
    };

    return (
        <div className="min-h-screen flex bg-gray-100">
            <aside className="w-64 bg-white shadow-md hidden md:flex md:flex-col">
                <div className="p-6 border-b">
                    <h1 className="text-xl font-bold text-gray-800">Panel</h1>
                    {profile && (
                        <div className="mt-1">
                            <p className="text-xs text-gray-400">{getRoleLabel()}</p>
                            {companyName && profile.role !== "system_admin" && (
                                <p className="text-xs font-medium text-indigo-600 mt-0.5">{companyName}</p>
                            )}
                        </div>
                    )}
                </div>
                <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
                    <a href="/app" className={linkClass("/app")}>Ana Sayfa</a>

                    {/* Admin */}
                    {profile?.role === "system_admin" && (
                        <>
                            <div className="text-gray-400 text-xs uppercase font-semibold mt-4 mb-2 px-4">Yönetim</div>
                            <a href="/admin/companies" className={linkClass("/admin/companies")}>Şirket Yönetimi</a>
                            <a href="/admin/modules" className={linkClass("/admin/modules")}>Modül Yönetimi</a>
                        </>
                    )}

                    {/* Şirket Yöneticisi */}
                    {profile?.role === "company_manager" && (
                        <>
                            <div className="text-gray-400 text-xs uppercase font-semibold mt-4 mb-2 px-4">Şirket İşlemleri</div>
                            <a href="/manager/team" className={linkClass("/manager/team")}>Alt Hesap Daveti</a>
                        </>
                    )}

                    {/* Modüller — tüm roller için (admin dahil) */}
                    {activeModules.length > 0 && (
                        <>
                            <div className="text-gray-400 text-xs uppercase font-semibold mt-4 mb-2 px-4">Modüller</div>
                            {activeModules.map((mod) => {
                                const route = moduleRoutes[mod.module_key] || `/app/${mod.module_key}`;
                                return (
                                    <a key={mod.module_key} href={route} className={linkClass(route)}>{mod.name}</a>
                                );
                            })}
                        </>
                    )}
                </nav>

                <div className="p-4 border-t">
                    <button onClick={() => signOut()}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded">
                        Çıkış Yap
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col">
                <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
                    <div className="text-lg font-medium">Hoşgeldiniz</div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{user?.email}</span>
                    </div>
                </header>
                <div className="p-6 overflow-auto flex-1">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
