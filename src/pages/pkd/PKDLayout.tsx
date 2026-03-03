import { Outlet, NavLink } from "react-router-dom";

const tabs = [
    { label: "Dashboard", path: "", end: true },
    { label: "Yeni PKD Oluştur", path: "new" },
];

export default function PKDLayout() {
    return (
        <div className="space-y-0 -m-4 sm:-m-6 min-h-screen">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 px-6 pt-6 pb-0 shadow-2xl">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white leading-tight">Patlamadan Korunma Yönetimi</h1>
                            <p className="text-orange-200 text-xs mt-0.5">EN 60079-10-1 & 1999/92/EC ATEX 137 Kapsamı</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-hide">
                        {tabs.map(tab => (
                            <NavLink
                                key={tab.path}
                                to={`/app/pkd_yonetimi${tab.path ? "/" + tab.path : ""}`}
                                end={tab.end}
                                className={({ isActive }) =>
                                    `flex-none px-4 py-3 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg border-b-2 ${isActive
                                        ? "text-white border-white bg-white/15 backdrop-blur-sm"
                                        : "text-orange-200 border-transparent hover:text-white hover:bg-white/10"
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
