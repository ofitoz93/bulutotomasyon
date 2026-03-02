import { Outlet, NavLink } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const tabs = [
    { label: "Personel Listesi", path: "", end: true },
    { label: "Sağlık Kayıtları", path: "saglik" },
    { label: "KKD Zimmet Takibi", path: "kkd" },
    { label: "Toplu İşlemler", path: "toplu-islem" },
];

export default function PersonnelLayout() {
    return (
        <div className="space-y-0 -m-4 sm:-m-6 min-h-screen">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 px-6 pt-6 pb-0 shadow-2xl">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white leading-tight">Personel Takip</h1>
                            <p className="text-indigo-200 text-xs mt-0.5">Çalışan Özlük ve İSG Kayıt Yönetimi</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-hide text-white">
                        {tabs.map(tab => (
                            <NavLink
                                key={tab.path}
                                to={`/app/personel-takip${tab.path ? "/" + tab.path : ""}`}
                                end={tab.end}
                                className={({ isActive }) =>
                                    `flex-none px-4 py-3 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg border-b-2 ${isActive
                                        ? "text-white border-white bg-white/15 backdrop-blur-sm"
                                        : "text-indigo-200 border-transparent hover:text-white hover:bg-white/10"
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
