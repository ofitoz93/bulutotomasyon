import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

export default function EducationLayout() {
    const { profile } = useAuthStore();
    const location = useLocation();

    // Check if user is manager or admin to show certain tabs
    const [isEduManager, setIsEduManager] = useState(false);
    const isCompanyManager = profile?.role === "company_manager" || profile?.role === "system_admin";

    useEffect(() => {
        const checkEduManager = async () => {
            if (isCompanyManager) {
                setIsEduManager(true);
                return;
            }
            if (profile?.id && profile?.tenant_id) {
                const { data, error } = await supabase.rpc('is_education_manager');
                if (!error && data) {
                    setIsEduManager(true);
                }
            }
        };
        checkEduManager();
    }, [profile, isCompanyManager]);

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

                {isEduManager && (
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

                {isEduManager && (
                    <NavLink
                        to="/app/education/physical-exams"
                        className={({ isActive }) =>
                            `pb-2 px-1 text-sm font-medium border-b-2 transition ${isActive || location.pathname.includes('/physical-exams')
                                ? "border-indigo-500 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`
                        }
                    >
                        Fiziki Sınıf Sınavları
                    </NavLink>
                )}

                {isEduManager && (
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
        </div >
    );
}
