import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

export default function EducationLayout() {
    const { profile } = useAuthStore();
    const location = useLocation();

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

    const tabClass = (isActive: boolean) =>
        `pb-2.5 px-1 text-sm font-medium border-b-2 transition-colors ${isActive
            ? "border-indigo-500 text-indigo-400"
            : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
        }`;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Eğitim Modülü</h1>
                    <p className="text-sm text-slate-400 mt-1">Eğitimlerinizi, sınavlarınızı ve kursiyerleri yönetin.</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="border-b border-slate-800">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <NavLink
                        to="/app/education"
                        end
                        className={({ isActive }) => tabClass(isActive)}
                    >
                        Aktif Kurslar
                    </NavLink>

                    {isEduManager && (
                        <NavLink
                            to="/app/education/manage"
                            className={({ isActive }) => tabClass(isActive || location.pathname.includes('/manage'))}
                        >
                            Eğitim Yönetimi
                        </NavLink>
                    )}

                    {isEduManager && (
                        <NavLink
                            to="/app/education/physical-exams"
                            className={({ isActive }) => tabClass(isActive || location.pathname.includes('/physical-exams'))}
                        >
                            Fiziki Sınıf Sınavları
                        </NavLink>
                    )}

                    {isEduManager && (
                        <NavLink
                            to="/app/education/settings"
                            className={({ isActive }) => tabClass(isActive)}
                        >
                            Eğitim Ayarları
                        </NavLink>
                    )}
                </nav>
            </div>

            <main>
                <Outlet />
            </main>
        </div>
    );
}
