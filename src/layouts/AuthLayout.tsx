import { Outlet } from "react-router-dom";

export default function AuthLayout() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full p-6 space-y-8 bg-white shadow-lg rounded-xl">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900">
                        Tersane Otomasyonu
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Güvenli Giriş Paneli
                    </p>
                </div>
                <Outlet />
            </div>
        </div>
    );
}
