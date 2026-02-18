import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Module {
    key: string;
    name: string;
    description: string | null;
}

interface Company {
    id: string;
    name: string;
}

interface CompanyModule {
    company_id: string;
    module_key: string;
    is_active: boolean;
    is_indefinite: boolean;
    expires_at: string | null;
}

export default function ModulesPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [assignments, setAssignments] = useState<CompanyModule[]>([]);
    const [loading, setLoading] = useState(true);

    // Firma arama & seçim
    const [companySearch, setCompanySearch] = useState("");
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    // Atama Modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [modalCompanySearch, setModalCompanySearch] = useState("");
    const [modalSelectedCompany, setModalSelectedCompany] = useState<Company | null>(null);
    const [isIndefinite, setIsIndefinite] = useState(false);
    const [expiresAt, setExpiresAt] = useState("");
    const [assignLoading, setAssignLoading] = useState(false);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            const [modulesRes, companiesRes, assignmentsRes] = await Promise.all([
                supabase.from("modules").select("*"),
                supabase.from("companies").select("id, name").order("name"),
                supabase.from("company_modules").select("*"),
            ]);
            if (modulesRes.error) throw modulesRes.error;
            if (companiesRes.error) throw companiesRes.error;
            if (assignmentsRes.error) throw assignmentsRes.error;
            setModules(modulesRes.data || []);
            setCompanies(companiesRes.data || []);
            setAssignments(assignmentsRes.data || []);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Firma araması sonuçları
    const filteredCompanies = companySearch.trim()
        ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 10)
        : [];

    // Modal firma araması
    const modalFilteredCompanies = modalCompanySearch.trim()
        ? companies.filter(c => c.name.toLowerCase().includes(modalCompanySearch.toLowerCase())).slice(0, 8)
        : [];

    // Seçili firmanın modül atamaları
    const getCompanyAssignments = () => {
        if (!selectedCompany) return [];
        return assignments.filter(a => a.company_id === selectedCompany.id);
    };

    const isModuleAssigned = (moduleKey: string) => {
        return getCompanyAssignments().some(a => a.module_key === moduleKey && a.is_active);
    };

    const getAssignment = (moduleKey: string) => {
        return getCompanyAssignments().find(a => a.module_key === moduleKey);
    };

    const getExpiryStatus = (assignment: CompanyModule) => {
        if (!assignment.is_active) return { label: "Pasif", color: "bg-gray-100 text-gray-600" };
        if (assignment.is_indefinite) return { label: "Süresiz", color: "bg-green-100 text-green-800" };
        if (!assignment.expires_at) return { label: "Tarih Yok", color: "bg-gray-100 text-gray-600" };
        const today = new Date();
        const expiry = new Date(assignment.expires_at);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { label: "Süresi Doldu", color: "bg-red-100 text-red-800" };
        if (daysLeft <= 7) return { label: `${daysLeft} gün`, color: "bg-yellow-100 text-yellow-800" };
        return { label: expiry.toLocaleDateString("tr-TR"), color: "bg-blue-100 text-blue-800" };
    };

    // Modül ata (modal)
    const openAssignModal = (mod: Module) => {
        setSelectedModule(mod);
        setModalCompanySearch("");
        setModalSelectedCompany(null);
        setIsIndefinite(false);
        setExpiresAt("");
        setShowAssignModal(true);
    };

    const handleAssign = async () => {
        if (!selectedModule || !modalSelectedCompany) return;
        if (!isIndefinite && !expiresAt) {
            alert("Lütfen bitiş tarihi girin veya 'Süresiz' seçeneğini işaretleyin."); return;
        }
        setAssignLoading(true);
        try {
            const existing = assignments.find(
                a => a.company_id === modalSelectedCompany.id && a.module_key === selectedModule.key
            );
            if (existing) {
                await supabase.from("company_modules").update({
                    is_active: true, is_indefinite: isIndefinite,
                    expires_at: isIndefinite ? null : expiresAt,
                }).eq("company_id", modalSelectedCompany.id).eq("module_key", selectedModule.key);
                alert("Modül ataması güncellendi!");
            } else {
                await supabase.from("company_modules").insert([{
                    company_id: modalSelectedCompany.id,
                    module_key: selectedModule.key,
                    is_active: true, is_indefinite: isIndefinite,
                    expires_at: isIndefinite ? null : expiresAt,
                }]);
                alert("Modül başarıyla atandı!");
            }
            setShowAssignModal(false);
            fetchAll();
        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setAssignLoading(false);
        }
    };

    const handleRemoveAssignment = async (companyId: string, moduleKey: string) => {
        const name = companies.find(c => c.id === companyId)?.name || "";
        if (!window.confirm(`"${name}" şirketinden bu modülü kaldırmak istediğinize emin misiniz?`)) return;
        try {
            await supabase.from("company_modules").delete()
                .eq("company_id", companyId).eq("module_key", moduleKey);
            alert("Modül ataması kaldırıldı.");
            fetchAll();
        } catch (error: any) { alert("Hata: " + error.message); }
    };

    // Modüle atanmış toplam şirket sayısı
    const getAssignmentCount = (moduleKey: string) => {
        return assignments.filter(a => a.module_key === moduleKey && a.is_active).length;
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Modül Yönetimi</h1>
                <p className="text-sm text-gray-500 mt-1">Firma arayarak modül erişimini yönetin veya toplu atama yapın.</p>
            </div>

            {/* Firma Arama */}
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Firmaya Göre Modül Yönetimi</h2>
                <div className="relative">
                    <input
                        type="text"
                        value={selectedCompany ? selectedCompany.name : companySearch}
                        onChange={(e) => { setCompanySearch(e.target.value); setSelectedCompany(null); }}
                        placeholder="Firma adı yazarak arayın..."
                        className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    />
                    {selectedCompany && (
                        <button onClick={() => { setSelectedCompany(null); setCompanySearch(""); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">✕</button>
                    )}
                    {/* Dropdown sonuçları */}
                    {!selectedCompany && filteredCompanies.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredCompanies.map(company => (
                                <button key={company.id}
                                    onClick={() => { setSelectedCompany(company); setCompanySearch(""); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex justify-between items-center">
                                    <span className="font-medium text-gray-900">{company.name}</span>
                                    <span className="text-xs text-gray-400">
                                        {assignments.filter(a => a.company_id === company.id && a.is_active).length} modül
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Seçili firmanın modülleri */}
                {selectedCompany && (
                    <div className="mt-4 border-t pt-4">
                        <p className="text-sm text-gray-500 mb-3">
                            <span className="font-semibold text-gray-700">{selectedCompany.name}</span> firmasının modül erişimleri:
                        </p>
                        <div className="space-y-2">
                            {modules.map(mod => {
                                const assigned = isModuleAssigned(mod.key);
                                const assignment = getAssignment(mod.key);
                                const status = assignment ? getExpiryStatus(assignment) : null;
                                return (
                                    <div key={mod.key}
                                        className={`flex items-center justify-between px-4 py-3 rounded-lg border ${assigned ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${assigned ? "bg-green-500" : "bg-gray-300"}`}></span>
                                            <div>
                                                <span className="text-sm font-medium text-gray-900">{mod.name}</span>
                                                {mod.description && <p className="text-xs text-gray-500">{mod.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {status && (
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            )}
                                            {assigned ? (
                                                <button onClick={() => handleRemoveAssignment(selectedCompany.id, mod.key)}
                                                    className="text-red-600 hover:text-red-800 text-sm font-medium">Kaldır</button>
                                            ) : (
                                                <button onClick={() => {
                                                    setSelectedModule(mod);
                                                    setModalSelectedCompany(selectedCompany);
                                                    setModalCompanySearch(selectedCompany.name);
                                                    setIsIndefinite(false); setExpiresAt("");
                                                    setShowAssignModal(true);
                                                }}
                                                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Ata</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modül Kartları (Genel Bakış) */}
            <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Modül Genel Bakış</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map(mod => (
                        <div key={mod.key} className="bg-white shadow rounded-lg p-5 border-l-4 border-indigo-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                                    {mod.description && <p className="text-xs text-gray-500 mt-1">{mod.description}</p>}
                                </div>
                                <button onClick={() => openAssignModal(mod)}
                                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">+ Ata</button>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-2xl font-bold text-indigo-700">{getAssignmentCount(mod.key)}</span>
                                <span className="text-sm text-gray-500">firma kullanıyor</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Atama Modal (firma arama ile) */}
            {showAssignModal && selectedModule && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold">
                            Modül Ata: <span className="text-indigo-600">{selectedModule.name}</span>
                        </h3>

                        {/* Firma Arama */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                            {modalSelectedCompany ? (
                                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                                    <span className="text-sm font-medium text-indigo-700">{modalSelectedCompany.name}</span>
                                    <button onClick={() => { setModalSelectedCompany(null); setModalCompanySearch(""); }}
                                        className="text-indigo-400 hover:text-indigo-600">✕</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input type="text" value={modalCompanySearch}
                                        onChange={(e) => setModalCompanySearch(e.target.value)}
                                        placeholder="Firma adı yazarak arayın..."
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        autoFocus />
                                    {modalFilteredCompanies.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                            {modalFilteredCompanies.map(company => (
                                                <button key={company.id}
                                                    onClick={() => { setModalSelectedCompany(company); setModalCompanySearch(company.name); }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b border-gray-100 last:border-0">
                                                    {company.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Süresiz */}
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="indefinite" checked={isIndefinite}
                                onChange={(e) => setIsIndefinite(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
                            <label htmlFor="indefinite" className="text-sm text-gray-700">Süresiz (Sınırsız erişim)</label>
                        </div>

                        {!isIndefinite && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">İptal</button>
                            <button onClick={handleAssign} disabled={assignLoading || !modalSelectedCompany}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {assignLoading ? "Atanıyor..." : "Ata"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
