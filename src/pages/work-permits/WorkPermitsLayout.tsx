import { Outlet, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function WorkPermitsLayout() {
    const location = useLocation();
    const { isSystemAdmin } = useAuthStore();

    // Prevent system admins from using company modules directly if they don't have a tenant
    if (isSystemAdmin()) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <div className="bg-orange-100 text-orange-600 p-4 rounded-full mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800">Sistem Yöneticisi Görünümü</h2>
                <p className="text-gray-500 mt-2 max-w-md">
                    Sistem yöneticileri şirkete özel iş izinlerini doğrudan kullanamazlar. İş İzni yönetimi şirket çalışanları ve yöneticileri içindir.
                </p>
            </div>
        );
    }

    const { isCompanyManager } = useAuthStore();
    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">İş İzinleri (Work Permits)</h1>
                    <p className="text-sm text-gray-500 mt-1">Sahadaki çalışmalar için iş izni oluşturun ve onay süreçlerini takip edin.</p>
                </div>
                <div className="flex space-x-3">
                    {isCompanyManager() && location.pathname === "/app/work-permits" && (
                        <Link
                            to="/app/work-permits/settings"
                            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md shadow-sm hover:bg-gray-50"
                        >
                            <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Ayarlar
                        </Link>
                    )}
                    {location.pathname === "/app/work-permits" && (
                        <Link
                            to="/app/work-permits/new"
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md shadow hover:bg-indigo-700"
                        >
                            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
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
