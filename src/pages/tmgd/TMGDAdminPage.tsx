import { useState } from "react";
import { Building2, PackageSearch, FileText, Settings } from "lucide-react";
import TMGDClientList from "./components/TMGDClientList";
import TMGDProductList from "./components/TMGDProductList";
import TMGDDocumentList from "./components/TMGDDocumentList";
import TMGDSettings from "./components/TMGDSettings";

export default function TMGDAdminPage() {
    const [activeTab, setActiveTab] = useState("clients");

    const tabs = [
        { id: "clients", label: "Firmalar (Müşteriler)", icon: Building2 },
        { id: "products", label: "Tehlikeli Madde Karalisti", icon: PackageSearch },
        { id: "docs", label: "Oluşturulan Evraklar", icon: FileText },
        { id: "settings", label: "Modül Ayarları", icon: Settings },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-indigo-500" />
                    TMGD Taşıma Evrakı Yönetimi
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Müşteri bazlı TMGD gönderi evraklarını, şifreli URL'leri ve firma logolarını yönetin.
                </p>
            </div>

            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mb-6 overflow-x-auto">
                {tabs.map(t => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                isActive 
                                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            <main className="min-h-[500px]">
                {activeTab === "clients" && <TMGDClientList />}
                {activeTab === "products" && <TMGDProductList />}
                {activeTab === "docs" && <TMGDDocumentList />}
                {activeTab === "settings" && <TMGDSettings />}
            </main>
        </div>
    );
}
