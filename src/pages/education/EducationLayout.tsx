import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function EducationLayout() {
    const { profile } = useAuthStore();
    const location = useLocation();

    // Check if user is manager or admin to show certain tabs
    const isManager = profile?.role === "company_manager" || profile?.role === "system_admin";

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Eğitim Modülü</h1>
                <p className="text-sm text-gray-500 mt-1">Eğitimlerinizi, sınavlarınızı ve kursiyerleri yönetin.</p>
            </div>

            <div className="mb-6 flex space-x-4 border-b">
                <NavLink
                    to="/app/education"
                    end
                    className={({ isActive }) =>
                        `pb-2 px-1 text-sm font-medium border-b-2 transition ${isActive
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`
                    }
                >
                    Aktif Kurslar
                </NavLink>

                {isManager && (
                    <NavLink
                        to="/app/education/manage"
                        className={({ isActive }) =>
                            `pb-2 px-1 text-sm font-medium border-b-2 transition ${isActive || location.pathname.includes('/manage')
                                ? "border-indigo-500 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`
                        }
                    >
                        Eğitim Yönetimi
                    </NavLink>
                )}

                {isManager && (
                    <NavLink
                        to="/app/education/settings"
                        className={({ isActive }) =>
                            `pb-2 px-1 text-sm font-medium border-b-2 transition ${isActive
                                ? "border-indigo-500 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`
                        }
                    >
                        Eğitim Ayarları
                    </NavLink>
                )}
            </div>

            <main>
                <Outlet />
            </main>
        </div>
    );
}
