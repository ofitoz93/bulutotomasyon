import { Outlet, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function WorkPermitsLayout() {
    const location = useLocation();
    const { isSystemAdmin } = useAuthStore();

    if (isSystemAdmin()) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <div className="w-16 h-16 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-white">Sistem Yöneticisi Görünümü</h2>
                <p className="text-slate-400 mt-2 max-w-md text-sm">
                    Sistem yöneticileri şirkete özel iş izinlerini doğrudan kullanamazlar. İş İzni yönetimi şirket çalışanları ve yöneticileri içindir.
                </p>
            </div>
        );
    }

    const { isCompanyManager } = useAuthStore();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 border border-slate-800 p-5 rounded-xl gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">İş İzinleri</h1>
                    <p className="text-sm text-slate-400 mt-1">Sahadaki çalışmalar için iş izni oluşturun ve onay süreçlerini takip edin.</p>
                </div>
                <div className="flex space-x-3">
                    {isCompanyManager() && location.pathname === "/app/work-permits" && (
                        <Link
                            to="/app/work-permits/settings"
                            className="inline-flex items-center px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            <svg className="w-4 h-4 mr-1.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Ayarlar
                        </Link>
                    )}
                    {location.pathname === "/app/work-permits" && (
                        <Link
                            to="/app/work-permits/new"
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-colors"
                        >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni İş İzni Talebi
                        </Link>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
}
