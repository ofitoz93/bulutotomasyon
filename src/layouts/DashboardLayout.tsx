import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProfileCompletion from "@/pages/auth/ProfileCompletion";

interface ActiveModule {
    module_key: string;
    name: string;
    category: string;
}

// --- İkon Haritası ---
const ModuleIcon = ({ moduleKey, className = "w-4 h-4" }: { moduleKey: string; className?: string }) => {
    const icons: Record<string, JSX.Element> = {
        evrak_takip: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        ekipman_takip: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
        ),
        adr: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        aksiyon_takip: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        ),
        org_chart: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        work_permits: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
        education: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        alt_taseron: (
            <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
    };
    return icons[moduleKey] ?? (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    );
};

export default function DashboardLayout() {
    const { signOut, user, profile, loading } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [companyName, setCompanyName] = useState<string>("");
    const [activeModules, setActiveModules] = useState<ActiveModule[]>([]);
    const [showProfileCompletion, setShowProfileCompletion] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/auth/login");
            } else if (user.user_metadata?.force_password_change) {
                navigate("/auth/update-password");
            } else if (profile && (!profile.first_name || !profile.last_name || !profile.tc_no || !profile.phone_number)) {
                setShowProfileCompletion(true);
            } else {
                setShowProfileCompletion(false);
            }
        }
    }, [user, loading, navigate, profile]);

    useEffect(() => {
        if (!user || !profile) return;

        if (profile.tenant_id && profile.role !== "system_admin") {
            supabase.from("companies").select("name").eq("id", profile.tenant_id).single()
                .then(({ data }) => { if (data) setCompanyName(data.name); });
        }

        const fetchModules = async () => {
            if (profile.role === "system_admin") {
                const { data } = await supabase.from("modules").select("key, name, category");
                if (data) {
                    setActiveModules(data.map((m: any) => ({
                        module_key: m.key,
                        name: m.name,
                        category: m.category || "Genel"
                    })));
                }
            } else if (profile.role === "company_manager" && profile.tenant_id) {
                const { data } = await supabase
                    .from("company_modules")
                    .select("module_key, is_active, is_indefinite, expires_at, category_override, modules(name, category)")
                    .eq("company_id", profile.tenant_id)
                    .eq("is_active", true);

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
                        category: m.category_override || m.modules?.category || "Genel"
                    })));
                }
            } else if ((profile.role === "employee" || profile.role === "subcontractor_manager") && profile.tenant_id) {
                const { data: accessData } = await supabase
                    .from("user_module_access")
                    .select("module_key")
                    .eq("user_id", user.id)
                    .eq("tenant_id", profile.tenant_id);

                if (accessData && accessData.length > 0) {
                    const keys = accessData.map(a => a.module_key);
                    const { data: moduleDetails } = await supabase
                        .from("company_modules")
                        .select("module_key, category_override, modules(name, category)")
                        .eq("company_id", profile.tenant_id)
                        .in("module_key", keys)
                        .eq("is_active", true);

                    if (moduleDetails) {
                        setActiveModules(moduleDetails.map((m: any) => ({
                            module_key: m.module_key,
                            name: m.modules?.name || m.module_key,
                            category: m.category_override || m.modules?.category || "Genel"
                        })));
                    }
                }
            }
        };

        fetchModules();
    }, [profile?.tenant_id, profile?.role, user]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-slate-400 text-sm">Yükleniyor...</span>
            </div>
        </div>
    );

    const isActive = (path: string) => location.pathname === path;
    const handleNavigation = () => { setIsSidebarOpen(false); };

    const moduleRoutes: Record<string, string> = {
        evrak_takip: "/app/evrak-takip",
        ekipman_takip: "/app/ekipman-takip",
        adr: "/app/adr",
        aksiyon_takip: "/app/aksiyon-takip",
        org_chart: "/app/org-chart",
        work_permits: "/app/work-permits",
        education: "/app/education",
    };

    const getRoleLabel = () => {
        if (profile?.role === "system_admin") return "Sistem Yöneticisi";
        if (profile?.role === "company_manager") return "Şirket Yöneticisi";
        if (profile?.role === "subcontractor_manager") return "Alt Taşeron Firma";
        return "Çalışan";
    };

    const getRoleBadgeColor = () => {
        if (profile?.role === "system_admin") return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
        if (profile?.role === "company_manager") return "bg-violet-500/20 text-violet-300 border border-violet-500/30";
        if (profile?.role === "subcontractor_manager") return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
        return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    };

    const groupedModules = activeModules.reduce((acc, mod) => {
        if (mod.module_key === 'alt_taseron') return acc;
        const cat = mod.category || "Genel";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(mod);
        return acc;
    }, {} as Record<string, ActiveModule[]>);

    const sortedCategories = Object.keys(groupedModules).sort();

    const navLinkClass = (path: string) =>
        `flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 group ${isActive(path)
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
            : "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
        }`;

    const userInitial = (user?.email ?? "?").charAt(0).toUpperCase();

    return (
        <div className="min-h-screen flex bg-slate-950 print:bg-white relative">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ─── Sidebar ─── */}
            <aside className={`
                w-64 bg-slate-900 border-r border-slate-800 print:hidden
                fixed inset-y-0 left-0 z-50 flex flex-col
                transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo / Brand */}
                <div className="px-5 py-5 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white leading-none">Bulut Otomasyon</h1>
                                <p className="text-[10px] text-slate-500 mt-0.5">Platform</p>
                            </div>
                        </div>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-slate-300 p-1 rounded-md">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* User info */}
                    {profile && (
                        <div className="mt-4 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                                {userInitial}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-200 truncate">{user?.email}</p>
                                <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${getRoleBadgeColor()}`}>
                                    {getRoleLabel()}
                                </span>
                            </div>
                        </div>
                    )}
                    {companyName && profile?.role !== "system_admin" && (
                        <div className="mt-2 flex items-center gap-1.5 px-1">
                            <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-[11px] text-slate-400 truncate">{companyName}</span>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                    {/* Ana Sayfa */}
                    <a href="/app" onClick={handleNavigation} className={navLinkClass("/app")}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span>Ana Sayfa</span>
                    </a>

                    {/* Sistem Yöneticisi */}
                    {profile?.role === "system_admin" && (
                        <>
                            <div className="pt-4 pb-1 px-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Yönetim</p>
                            </div>
                            {[
                                {
                                    href: "/admin/companies", label: "Şirket Yönetimi", icon: (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    )
                                },
                                {
                                    href: "/admin/modules", label: "Modül Yönetimi", icon: (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    )
                                },
                                {
                                    href: "/admin/announcements", label: "Sistem Duyuruları", icon: (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                        </svg>
                                    )
                                },
                            ].map(item => (
                                <a key={item.href} href={item.href} onClick={handleNavigation} className={navLinkClass(item.href)}>
                                    <span className="flex-shrink-0">{item.icon}</span>
                                    <span>{item.label}</span>
                                </a>
                            ))}
                        </>
                    )}

                    {/* Şirket Yöneticisi */}
                    {profile?.role === "company_manager" && (
                        <>
                            <div className="pt-4 pb-1 px-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Şirket İşlemleri</p>
                            </div>
                            {[
                                {
                                    href: "/manager/team", label: "Alt Hesap Daveti", icon: (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                    )
                                },
                                {
                                    href: "/manager/announcements", label: "Şirket Duyuruları", icon: (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    )
                                },
                            ].map(item => (
                                <a key={item.href} href={item.href} onClick={handleNavigation} className={navLinkClass(item.href)}>
                                    <span className="flex-shrink-0">{item.icon}</span>
                                    <span>{item.label}</span>
                                </a>
                            ))}
                            {activeModules.some(m => m.module_key === 'alt_taseron') && (
                                <a href="/manager/subcontractors" onClick={handleNavigation} className={navLinkClass("/manager/subcontractors")}>
                                    <ModuleIcon moduleKey="alt_taseron" />
                                    <span>Alt Taşeron Yönetimi</span>
                                </a>
                            )}
                        </>
                    )}

                    {/* Modüller (Kategorili) */}
                    {sortedCategories.map(category => (
                        <div key={category}>
                            <div className="pt-4 pb-1 px-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{category}</p>
                            </div>
                            {groupedModules[category].map(mod => {
                                const route = moduleRoutes[mod.module_key] || `/app/${mod.module_key}`;
                                return (
                                    <a key={mod.module_key} href={route} onClick={handleNavigation} className={navLinkClass(route)}>
                                        <span className="flex-shrink-0"><ModuleIcon moduleKey={mod.module_key} /></span>
                                        <span>{mod.name}</span>
                                        {isActive(route) && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                                        )}
                                    </a>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Ayarlar & Çıkış */}
                <div className="p-3 border-t border-slate-800 space-y-1">
                    <a href="/app/settings" onClick={handleNavigation} className={navLinkClass("/app/settings")}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Ayarlar</span>
                    </a>
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-150"
                    >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Çıkış Yap</span>
                    </button>
                </div>
            </aside>

            {/* ─── Main Content ─── */}
            <main className="flex-1 flex flex-col print:block w-full md:w-auto min-h-screen bg-slate-950">
                {/* Top Header */}
                <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 print:hidden sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-300">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="text-slate-600">/</span>
                            <span>Hoşgeldiniz</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden sm:block text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                            {user?.email}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                            {userInitial}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 sm:p-6 overflow-auto flex-1 print:p-0 print:overflow-visible">
                    <Outlet />
                </div>
            </main>

            {/* Profil Tamamlama Zorunluluğu */}
            {showProfileCompletion && (
                <ProfileCompletion onComplete={() => setShowProfileCompletion(false)} />
            )}
        </div>
    );
}
