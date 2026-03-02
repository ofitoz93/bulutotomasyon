import { Outlet } from "react-router-dom";

export default function AuthLayout() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="max-w-md w-full p-8 space-y-8 bg-white dark:bg-slate-900 shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        Tersane Otomasyonu
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Güvenli Giriş Paneli
                    </p>
                </div>
                <Outlet />
            </div>
        </div>
    );
}
