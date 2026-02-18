import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";

export default function DashboardLayout() {
    const { signOut, user, profile, loading } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/auth/login");
            } else if (user.user_metadata?.force_password_change) {
                navigate("/auth/update-password");
            }
        }
    }, [user, loading, navigate]);

    if (loading) return <div className="p-10">Yükleniyor...</div>;

    return (
        <div className="min-h-screen flex bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md hidden md:block">
                <div className="p-6 border-b">
                    <h1 className="text-xl font-bold text-gray-800">Panel</h1>
                </div>
                <nav className="p-4 space-y-2">
                    <div className="text-gray-500 text-sm uppercase font-semibold mb-2">Menü</div>

                    {user?.email && (
                        <>
                            {/* System Admin Menu */}
                            {/* Rol kontrolü yapacağız. Ancak şu an profile authStore'da dolu mu emin olmalıyız. 
                                Şimdilik email kontrolü veya basitçe linki koyalım. 
                                Ama doğru olan profile.role kontrolü.
                            */}
                            <a href="/app" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                                Ana Sayfa
                            </a>

                            {/* TODO: Burayı profile.role === 'system_admin' kontrolüne alacağız. 
                                Şimdilik admin ise diye varsayalım veya linki her zaman gösterelim (geçici).
                                Kullanıcı admin değilse zaten RLS engeller ama UI'da gizlemek lazım.
                            */}
                            <a href="/admin/companies" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                                Şirket Yönetimi
                            </a>
                        </>
                    )}

                    <button onClick={() => signOut()} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded mt-4">
                        Çıkış Yap
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
                    <div className="text-lg font-medium">Hoşgeldiniz</div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{user?.email}</span>
                    </div>
                </header>
                <div className="p-6 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
