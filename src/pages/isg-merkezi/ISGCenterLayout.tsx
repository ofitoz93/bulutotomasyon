import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const tabs = [
    { label: "Genel Bakış", path: "", end: true },
    { label: "Kaza & Ramak Kala", path: "kazalar" },
    { label: "Kök Neden Analizi", path: "kok-neden" },
    { label: "Denetimler", path: "denetimler" },
    { label: "Risk Değerlendirme", path: "risk" },
    { label: "DÖF / Aksiyonlar", path: "dof" },
    { label: "Periyodik Ölçümler", path: "olcumler" },
];

export default function ISGCenterLayout() {
    const { profile } = useAuthStore();
    const isManager = profile?.role === "company_manager" || profile?.role === "system_admin";

    return (
        <div className="space-y-0 -m-4 sm:-m-6 min-h-screen">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-700 via-rose-700 to-orange-700 px-6 pt-6 pb-0 shadow-2xl">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white leading-tight">İSG Merkezi</h1>
                            <p className="text-rose-200 text-xs mt-0.5">6331 Sayılı İş Sağlığı ve Güvenliği Kanunu Kapsamı</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-hide">
                        {tabs.map(tab => (
                            <NavLink
                                key={tab.path}
                                to={`/app/isg-merkezi${tab.path ? "/" + tab.path : ""}`}
                                end={tab.end}
                                className={({ isActive }) =>
                                    `flex-none px-4 py-3 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg border-b-2 ${isActive
                                        ? "text-white border-white bg-white/15 backdrop-blur-sm"
                                        : "text-rose-200 border-transparent hover:text-white hover:bg-white/10"
                                    }`
                                }
                            >
                                {tab.label}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>

            {/* Page Content */}
            <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
