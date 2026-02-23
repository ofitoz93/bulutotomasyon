import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Settings, Plus, List, CheckCircle } from "lucide-react";

export default function ActionLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;
    const tabClass = (path: string) =>
        `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${isActive(path)
            ? "border-indigo-600 text-indigo-600"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
        }`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Aksiyon Takip Sistemi</h1>
                    <p className="text-sm text-gray-500 mt-1">Kişilere, departmanlara veya firmalara aksiyon (görev/düzeltici faaliyet) atama ve takip sistemi.</p>
                </div>
                <button
                    onClick={() => navigate("/app/aksiyon-takip/new")}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" /> Yeni Aksiyon Aç
                </button>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    <button onClick={() => navigate("/app/aksiyon-takip")} className={tabClass("/app/aksiyon-takip")}>
                        <div className="flex items-center gap-2"><List className="w-4 h-4" /> Açık Aksiyonlar</div>
                    </button>
                    <button onClick={() => navigate("/app/aksiyon-takip/closed")} className={tabClass("/app/aksiyon-takip/closed")}>
                        <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Kapanan Aksiyonlar</div>
                    </button>
                    <button onClick={() => navigate("/app/aksiyon-takip/settings")} className={tabClass("/app/aksiyon-takip/settings")}>
                        <div className="flex items-center gap-2"><Settings className="w-4 h-4" /> Ayarlar</div>
                    </button>
                </nav>
            </div>

            <div className="pb-20">
                <Outlet />
            </div>
        </div>
    );
}
