import { useState } from "react";
import LegalListTab from "./components/LegalListTab";
import LegalTrackingTab from "./components/LegalTrackingTab";
import { Scale, CheckSquare } from "lucide-react";

export default function LegalRequirementsPage() {
    const [activeTab, setActiveTab] = useState<"list" | "tracking">("list");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Yasal Şartlar Takibi</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Sistem genelinde yasal mevzuatları kaydedin ve lokasyon bazlı uyumluluk takibi yapın.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab("list")}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "list"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                >
                    <Scale className="w-4 h-4" />
                    Mevzuat Listesi (Master List)
                </button>
                <button
                    onClick={() => setActiveTab("tracking")}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "tracking"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                >
                    <CheckSquare className="w-4 h-4" />
                    Takip Çizelgesi
                </button>
            </div>

            {/* Tab Contents */}
            <div className="mt-6">
                {activeTab === "list" ? <LegalListTab /> : <LegalTrackingTab />}
            </div>
        </div>
    );
}
