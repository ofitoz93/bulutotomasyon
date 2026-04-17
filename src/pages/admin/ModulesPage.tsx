import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Module {
    key: string;
    name: string;
    description: string | null;
    category_id?: string;
    category?: string; // Fallback
    module_categories?: {
        id: string;
        name: string;
    } | null;
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

interface Category {
    id: string;
    name: string;
}

export default function ModulesPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [assignments, setAssignments] = useState<CompanyModule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Firma arama & seçim (Şirket)
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

    // Modül Düzenleme Modal
    const [editModal, setEditModal] = useState(false);
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [editForm, setEditForm] = useState({ name: "", description: "", category_id: "" });
    const [saveLoading, setSaveLoading] = useState(false);

    // Kategori Yönetimi Modal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryLoading, setCategoryLoading] = useState(false);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            const [modulesRes, companiesRes, assignmentsRes, categoriesRes] = await Promise.all([
                supabase.from("modules").select("*, module_categories(id, name)").order("name"),
                supabase.from("companies").select("id, name").order("name"),
                supabase.from("company_modules").select("*"),
                supabase.from("module_categories").select("*").order("name")
            ]);
            if (modulesRes.error) throw modulesRes.error;
            if (companiesRes.error) throw companiesRes.error;
            if (assignmentsRes.error) throw assignmentsRes.error;
            if (categoriesRes.error) throw categoriesRes.error;

            setModules(modulesRes.data || []);
            setCompanies(companiesRes.data || []);
            setAssignments(assignmentsRes.data || []);
            setCategories(categoriesRes.data || []);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- HELPERLER ---

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
        if (!assignment.is_active) return { label: "Pasif", color: "bg-slate-500/10 text-slate-500" };
        if (assignment.is_indefinite) return { label: "Süresiz", color: "bg-emerald-500/15 text-emerald-400" };
        if (!assignment.expires_at) return { label: "Tarih Yok", color: "bg-slate-500/10 text-slate-500" };
        const today = new Date();
        const expiry = new Date(assignment.expires_at);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { label: "Süresi Doldu", color: "bg-rose-500/15 text-rose-400" };
        if (daysLeft <= 7) return { label: `${daysLeft} gün`, color: "bg-amber-500/15 text-amber-400" };
        return { label: expiry.toLocaleDateString("tr-TR"), color: "bg-indigo-500/15 text-indigo-400" };
    };

    const getAssignmentCount = (moduleKey: string) => {
        return assignments.filter(a => a.module_key === moduleKey && a.is_active).length;
    };


    // --- ACTIONS ---

    // Modül Atama
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
            // Upsert mantığı (update or insert)
            const payload = {
                company_id: modalSelectedCompany.id,
                module_key: selectedModule.key,
                is_active: true,
                is_indefinite: isIndefinite,
                expires_at: isIndefinite ? null : expiresAt,
            };

            if (existing) {
                await supabase.from("company_modules").update({
                    is_active: true, is_indefinite: isIndefinite,
                    expires_at: isIndefinite ? null : expiresAt,
                }).eq("company_id", modalSelectedCompany.id).eq("module_key", selectedModule.key);
            } else {
                await supabase.from("company_modules").insert([payload]);
            }
            alert("Modül ataması yapıldı!");
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

    // Modül Düzenleme
    const openEditModal = (mod: Module) => {
        setEditingModule(mod);
        // Önce join'dan gelen category id'yi kullan, yoksa doğrudan category_id kolonunu kullan
        const categoryId = mod.module_categories?.id || mod.category_id || "";
        setEditForm({
            name: mod.name,
            description: mod.description || "",
            category_id: categoryId
        });
        setEditModal(true);
    };

    const handleSaveModule = async () => {
        if (!editingModule) return;
        setSaveLoading(true);
        try {
            const updatePayload: Record<string, any> = {
                name: editForm.name,
                description: editForm.description || null,
                category_id: editForm.category_id || null, // Boş string -> null
            };

            console.log("Modül güncelleniyor:", editingModule.key, updatePayload);

            const { data, error } = await supabase
                .from("modules")
                .update(updatePayload)
                .eq("key", editingModule.key)
                .select();

            console.log("Güncelleme sonucu:", data, error);

            if (error) throw error;
            setEditModal(false);
            await fetchAll();
        } catch (error: any) {
            console.error("Modül güncelleme hatası:", error);
            alert("Hata: " + (error.message || JSON.stringify(error)));
        } finally {
            setSaveLoading(false);
        }
    };

    // Kategori Yönetimi
    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        setCategoryLoading(true);
        try {
            if (editingCategory) {
                const { error } = await supabase.from("module_categories")
                    .update({ name: newCategoryName.trim() })
                    .eq("id", editingCategory.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("module_categories")
                    .insert([{ name: newCategoryName.trim() }]);
                if (error) throw error;
            }
            setNewCategoryName("");
            setEditingCategory(null);
            fetchAll();
        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setCategoryLoading(false);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!window.confirm(`"${name}" kategorisini silmek istediğinize emin misiniz? Bu kategoriye bağlı modüller 'Genel' veya kategorisiz duruma düşebilir.`)) return;
        try {
            const { error } = await supabase.from("module_categories").delete().eq("id", id);
            if (error) throw error;
            fetchAll();
        } catch (error: any) {
            alert("Hata: " + error.message);
        }
    };


    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Modül Yönetimi</h1>
                    <p className="text-sm text-slate-400 mt-1">Firma arayarak modül erişimini yönetin veya kategori düzenleyin.</p>
                </div>
                <button
                    onClick={() => setShowCategoryModal(true)}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-900 border border-slate-700 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors shadow-sm"
                >
                    📂 Kategorileri Yönet
                </button>
            </div>

            {/* Firma Arama */}
            <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-transparent dark:border-slate-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase mb-3 text-white">Firmaya Göre Modül Yönetimi</h2>
                <div className="relative">
                    <input
                        type="text"
                        value={selectedCompany ? selectedCompany.name : companySearch}
                        onChange={(e) => { setCompanySearch(e.target.value); setSelectedCompany(null); }}
                        placeholder="Firma adı yazarak arayın..."
                        className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white pr-10"
                    />
                    {selectedCompany && (
                        <button onClick={() => { setSelectedCompany(null); setCompanySearch(""); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-lg">✕</button>
                    )}
                    {/* Dropdown sonuçları */}
                    {!selectedCompany && filteredCompanies.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredCompanies.map(company => (
                                <button key={company.id}
                                    onClick={() => { setSelectedCompany(company); setCompanySearch(""); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0 flex justify-between items-center">
                                    <span className="font-medium text-gray-900 dark:text-slate-200">{company.name}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {assignments.filter(a => a.company_id === company.id && a.is_active).length} modül
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Seçili firmanın modülleri */}
                {selectedCompany && (
                    <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-4">
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                            <span className="font-semibold text-gray-700 dark:text-slate-200">{selectedCompany.name}</span> firmasının modül erişimleri:
                        </p>
                        <div className="space-y-2">
                            {modules.map(mod => {
                                const assigned = isModuleAssigned(mod.key);
                                const assignment = getAssignment(mod.key);
                                const status = assignment ? getExpiryStatus(assignment) : null;
                                return (
                                    <div key={mod.key}
                                        className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${assigned ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20" : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700"}`}>
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${assigned ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}></span>
                                            <div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-slate-200">{mod.name}</span>
                                                {mod.description && <p className="text-xs text-gray-500 dark:text-slate-500">{mod.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {status && (
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            )}
                                            {assigned ? (
                                                <button onClick={() => handleRemoveAssignment(selectedCompany.id, mod.key)}
                                                    className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 text-sm font-medium">Kaldır</button>
                                            ) : (
                                                <button onClick={() => {
                                                    setSelectedModule(mod);
                                                    setModalSelectedCompany(selectedCompany);
                                                    setModalCompanySearch(selectedCompany.name);
                                                    setIsIndefinite(false); setExpiresAt("");
                                                    setShowAssignModal(true);
                                                }}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">Ata</button>
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
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase mb-3">Modül Genel Bakış</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map(mod => (
                        <div key={mod.key} className="bg-white dark:bg-slate-900 shadow rounded-lg p-5 border-l-4 border-indigo-500 relative group border dark:border-slate-800">
                            <button onClick={() => openEditModal(mod)} className="absolute top-2 right-2 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                                ✏️
                            </button>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{mod.name}</h3>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                                        {mod.module_categories?.name || mod.category || "Genel"}
                                    </span>
                                    {mod.description && <p className="text-xs text-gray-500 dark:text-slate-500 mt-2 line-clamp-2">{mod.description}</p>}
                                </div>
                                <button onClick={() => openAssignModal(mod)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs font-medium ml-2">+ Ata</button>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{getAssignmentCount(mod.key)}</span>
                                <span className="text-sm text-gray-500 dark:text-slate-400">firma kullanıyor</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Atama Modal */}
            {showAssignModal && selectedModule && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Modül Ata: <span className="text-indigo-600 dark:text-indigo-400">{selectedModule.name}</span>
                        </h3>

                        {/* Firma Arama */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Firma</label>
                            {modalSelectedCompany ? (
                                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 rounded-md px-3 py-2">
                                    <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{modalSelectedCompany.name}</span>
                                    <button onClick={() => { setModalSelectedCompany(null); setModalCompanySearch(""); }}
                                        className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300">✕</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input type="text" value={modalCompanySearch}
                                        onChange={(e) => setModalCompanySearch(e.target.value)}
                                        placeholder="Firma adı yazarak arayın..."
                                        className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                        autoFocus />
                                    {modalFilteredCompanies.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                            {modalFilteredCompanies.map(company => (
                                                <button key={company.id}
                                                    onClick={() => { setModalSelectedCompany(company); setModalCompanySearch(company.name); }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0 text-gray-900 dark:text-slate-200">
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
                                className="h-4 w-4 text-indigo-600 dark:text-indigo-500 rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 accent-indigo-500" />
                            <label htmlFor="indefinite" className="text-sm text-gray-700 dark:text-slate-300">Süresiz (Sınırsız erişim)</label>
                        </div>

                        {!isIndefinite && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Bitiş Tarihi</label>
                                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white" />
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                            <button onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">İptal</button>
                            <button onClick={handleAssign} disabled={assignLoading || !modalSelectedCompany}
                                className="px-4 py-2 text-sm bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-50 transition-colors">
                                {assignLoading ? "Atanıyor..." : "Ata"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modül Düzenleme Modal */}
            {editModal && editingModule && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg max-w-sm w-full p-6 space-y-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Modül Düzenle</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Modül Adı</label>
                            <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Kategori</label>
                            <select
                                value={editForm.category_id}
                                onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                            >
                                <option value="">Kategori Seçin...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Açıklama</label>
                            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white h-24 resize-none" />
                        </div>
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                            <button onClick={() => setEditModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">İptal</button>
                            <button onClick={handleSaveModule} disabled={saveLoading}
                                className="px-4 py-2 text-sm bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-50 transition-colors">
                                {saveLoading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kategori Yönetimi Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg max-w-sm w-full p-6 flex flex-col max-h-[80vh] shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Kategori Yönetimi</h3>

                        {/* Yeni Kategori Ekleme */}
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="Yeni kategori adı..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleSaveCategory}
                                disabled={categoryLoading || !newCategoryName.trim()}
                                className="bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-50 transition-colors"
                            >
                                {editingCategory ? "Güncelle" : "Ekle"}
                            </button>
                        </div>
                        {editingCategory && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 flex justify-between px-1">
                                <span>Düzenleniyor: {editingCategory.name}</span>
                                <button onClick={() => { setEditingCategory(null); setNewCategoryName(""); }} className="underline hover:no-underline">İptal</button>
                            </div>
                        )}

                        {/* Liste */}
                        <div className="flex-1 overflow-y-auto border-t border-gray-100 dark:border-slate-800 pt-2 space-y-1">
                            {categories.length === 0 && <p className="text-sm text-gray-500 dark:text-slate-500 italic text-center py-4">Henüz kategori yok.</p>}
                            {categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded group transition-colors">
                                    <span className="text-sm text-gray-900 dark:text-slate-200">{cat.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 text-xs"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 p-1 text-xs"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4 mt-2 border-t border-gray-100 dark:border-slate-800">
                            <button onClick={() => setShowCategoryModal(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm transition-colors">Kapat</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
