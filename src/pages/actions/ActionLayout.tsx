import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Settings, Plus, List, CheckCircle } from "lucide-react";

export default function ActionLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;
    const tabClass = (path: string) =>
        `flex items-center gap-2 pb-2.5 px-1 text-sm font-medium border-b-2 transition-colors ${isActive(path)
            ? "border-indigo-500 text-indigo-400"
            : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
        }`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Aksiyon Takip Sistemi</h1>
                    <p className="text-sm text-slate-400 mt-1">Kişilere, departmanlara veya firmalara aksiyon atama ve takip sistemi.</p>
                </div>
                <button
                    onClick={() => navigate("/app/aksiyon-takip/new")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 w-full sm:w-auto justify-center transition-colors"
                >
                    <Plus className="w-4 h-4" /> Yeni Aksiyon Aç
                </button>
            </div>

            {/* Tab Bar */}
            <div className="border-b border-slate-800">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => navigate("/app/aksiyon-takip")} className={tabClass("/app/aksiyon-takip")}>
                        <List className="w-4 h-4" /> Açık Aksiyonlar
                    </button>
                    <button onClick={() => navigate("/app/aksiyon-takip/closed")} className={tabClass("/app/aksiyon-takip/closed")}>
                        <CheckCircle className="w-4 h-4" /> Kapanan Aksiyonlar
                    </button>
                    <button onClick={() => navigate("/app/aksiyon-takip/settings")} className={tabClass("/app/aksiyon-takip/settings")}>
                        <Settings className="w-4 h-4" /> Ayarlar
                    </button>
                </nav>
            </div>

            <div className="pb-20">
                <Outlet />
            </div>
        </div>
    );
}
