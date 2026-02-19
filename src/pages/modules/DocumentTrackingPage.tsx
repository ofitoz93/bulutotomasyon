import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface DocumentType { id: string; name: string; }
interface LocationItem { id: string; name: string; }
interface Document {
    id: string;
    user_id: string;
    scope: string;
    title: string | null;
    acquisition_date: string;
    is_indefinite: boolean;
    expiry_date: string | null;
    application_deadline: string | null;
    file_url: string | null;
    file_name: string | null;
    file_size: number | null;
    reminder_days_before: number | null;
    reminder_sent: boolean;
    is_archived: boolean;
    archived_at: string | null;
    renewed_from: string | null;
    created_at: string;
    document_type_id: string | null;
    location_id: string | null;
    document_types: { name: string } | null;
    locations: { name: string } | null;
    profiles?: { email: string; first_name: string | null; last_name: string | null } | null;
}

type TabView = "dashboard" | "documents";
type ModalMode = "add" | "edit" | "renew";

export default function DocumentTrackingPage() {
    const { profile, user } = useAuthStore();
    const isManager = profile?.role === "company_manager";
    const [documents, setDocuments] = useState<Document[]>([]);
    const [archivedDocs, setArchivedDocs] = useState<Document[]>([]);
    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabView>("dashboard");
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>("add");
    const [editingDoc, setEditingDoc] = useState<Document | null>(null);
    const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

    // Form
    const [scope, setScope] = useState<"kurumsal" | "sahsi">("kurumsal");
    const [title, setTitle] = useState("");
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [selectedLocationId, setSelectedLocationId] = useState("");
    const [acquisitionDate, setAcquisitionDate] = useState("");
    const [isIndefinite, setIsIndefinite] = useState(false);
    const [expiryDate, setExpiryDate] = useState("");
    const [applicationDeadline, setApplicationDeadline] = useState("");
    const [reminderDays, setReminderDays] = useState("5");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [newTypeName, setNewTypeName] = useState("");
    const [newLocationName, setNewLocationName] = useState("");
    const [showNewType, setShowNewType] = useState(false);
    const [showNewLocation, setShowNewLocation] = useState(false);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            const userId = user?.id;
            if (!userId) return;

            const [typesRes, locsRes] = await Promise.all([
                supabase.from("document_types").select("*").eq("user_id", userId).order("name"),
                supabase.from("locations").select("*").eq("user_id", userId).order("name"),
            ]);
            setDocTypes(typesRes.data || []);
            setLocations(locsRes.data || []);

            let query = supabase.from("documents")
                .select("*, document_types(name), locations(name)");

            if (isManager && profile?.tenant_id) {
                query = query.eq("tenant_id", profile.tenant_id);
            } else {
                query = query.eq("user_id", userId);
            }

            const { data: allDocs, error } = await query.order("created_at", { ascending: false });
            if (error) throw error;



            // Profil bilgileri (herkes için)
            let profilesMap: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {};
            if (allDocs && allDocs.length > 0) {
                const userIds = [...new Set(allDocs.map((d: any) => d.user_id))];
                const { data: profilesData } = await supabase
                    .from("profiles").select("id, email, first_name, last_name").in("id", userIds);
                if (profilesData) {
                    profilesData.forEach((p: any) => {
                        profilesMap[p.id] = { email: p.email, first_name: p.first_name, last_name: p.last_name };
                    });
                }
            }

            const docsWithProfiles = (allDocs || []).map((doc: any) => ({
                ...doc,
                profiles: profilesMap[doc.user_id] || null,
            }));

            let visibleDocs = docsWithProfiles.filter((doc: any) => {
                if (doc.scope === "sahsi" && doc.user_id !== userId) return false;
                return true;
            });

            const active = visibleDocs.filter((d: any) => !d.is_archived);
            const archived = visibleDocs.filter((d: any) => d.is_archived);

            active.sort((a: any, b: any) => {
                const dateA = a.application_deadline || a.expiry_date;
                const dateB = b.application_deadline || b.expiry_date;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return new Date(dateA).getTime() - new Date(dateB).getTime();
            });

            setDocuments(active as Document[]);
            setArchivedDocs(archived as Document[]);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // === Helpers ===
    const getDateStatus = (doc: Document) => {
        if (doc.is_indefinite) return { label: "Süresiz", color: "bg-green-100 text-green-700", days: Infinity };
        const targetDate = doc.application_deadline || doc.expiry_date;
        if (!targetDate) return { label: "—", color: "bg-gray-100 text-gray-500", days: Infinity };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        const daysLeft = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { label: "Süresi Doldu", color: "bg-red-100 text-red-800", days: daysLeft };
        if (daysLeft === 0) return { label: "Bugün!", color: "bg-red-100 text-red-800", days: 0 };
        if (daysLeft <= 7) return { label: `${daysLeft} gün`, color: "bg-yellow-100 text-yellow-800", days: daysLeft };
        if (daysLeft <= 30) return { label: `${daysLeft} gün`, color: "bg-blue-100 text-blue-700", days: daysLeft };
        return { label: new Date(targetDate).toLocaleDateString("tr-TR"), color: "bg-gray-100 text-gray-600", days: daysLeft };
    };

    const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

    // Belgenin arşiv geçmişini bul
    const getArchiveHistory = (docId: string): Document[] => {
        // Aynı tür + lokasyondaki arşivlenmiş belgeleri bul
        const doc = documents.find(d => d.id === docId);
        if (!doc) return [];
        return archivedDocs.filter(a =>
            a.document_type_id === doc.document_type_id &&
            a.location_id === doc.location_id &&
            a.scope === doc.scope
        ).sort((a, b) => new Date(b.archived_at || b.created_at).getTime() - new Date(a.archived_at || a.created_at).getTime());
    };

    // === Dashboard Stats ===
    const stats = {
        total: documents.length,
        expired: documents.filter(d => getDateStatus(d).days < 0).length,
        urgent: documents.filter(d => { const s = getDateStatus(d); return s.days >= 0 && s.days <= 7; }).length,
        ok: documents.filter(d => getDateStatus(d).days > 7).length,
        archived: archivedDocs.length,
        corporate: documents.filter(d => d.scope === "kurumsal").length,
        personal: documents.filter(d => d.scope === "sahsi").length,
    };

    // === Type/Location Add ===
    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        const { data, error } = await supabase.from("document_types")
            .insert([{ name: newTypeName.trim(), user_id: user!.id, tenant_id: profile?.tenant_id }])
            .select().single();
        if (error) { alert("Hata: " + error.message); return; }
        setDocTypes([...docTypes, data]); setSelectedTypeId(data.id); setNewTypeName(""); setShowNewType(false);
    };

    const handleAddLocation = async () => {
        if (!newLocationName.trim()) return;
        const { data, error } = await supabase.from("locations")
            .insert([{ name: newLocationName.trim(), user_id: user!.id, tenant_id: profile?.tenant_id }])
            .select().single();
        if (error) { alert("Hata: " + error.message); return; }
        setLocations([...locations, data]); setSelectedLocationId(data.id); setNewLocationName(""); setShowNewLocation(false);
    };

    // === Mükerrer Kontrol ===
    const checkDuplicate = async (typeId: string, locationId: string, excludeId?: string): Promise<boolean> => {
        if (!profile?.tenant_id) return false;
        let query = supabase.from("documents").select("id")
            .eq("tenant_id", profile.tenant_id)
            .eq("document_type_id", typeId)
            .eq("location_id", locationId)
            .eq("is_archived", false)
            .eq("scope", "kurumsal");
        if (excludeId) query = query.neq("id", excludeId);
        const { data } = await query;
        return !!(data && Array.isArray(data) && data.length > 0);
    };

    const resetForm = () => {
        setScope("kurumsal"); setTitle(""); setSelectedTypeId(""); setSelectedLocationId("");
        setAcquisitionDate(""); setIsIndefinite(false); setExpiryDate("");
        setApplicationDeadline(""); setReminderDays("5"); setSelectedFile(null);
        setShowNewType(false); setShowNewLocation(false);
    };

    // === Modal Açma ===
    const openAddModal = () => {
        resetForm(); setEditingDoc(null); setModalMode("add"); setShowAddModal(true);
    };

    const openEditModal = (doc: Document) => {
        setEditingDoc(doc);
        setModalMode("edit");
        setScope(doc.scope as "kurumsal" | "sahsi");
        setTitle(doc.title || "");
        setSelectedTypeId(doc.document_type_id || "");
        setSelectedLocationId(doc.location_id || "");
        setAcquisitionDate(doc.acquisition_date || "");
        setIsIndefinite(doc.is_indefinite);
        setExpiryDate(doc.expiry_date || "");
        setApplicationDeadline(doc.application_deadline || "");
        setReminderDays(String(doc.reminder_days_before || 5));
        setSelectedFile(null);
        setShowAddModal(true);
    };

    const openRenewModal = (doc: Document) => {
        setEditingDoc(doc);
        setModalMode("renew");
        setScope(doc.scope as "kurumsal" | "sahsi");
        setTitle(doc.title || "");
        setSelectedTypeId(doc.document_type_id || "");
        setSelectedLocationId(doc.location_id || "");
        setAcquisitionDate("");
        setIsIndefinite(false);
        setExpiryDate("");
        setApplicationDeadline("");
        setReminderDays(String(doc.reminder_days_before || 5));
        setSelectedFile(null);
        setShowAddModal(true);
    };

    // === Belge Kaydet / Düzenle / Yenile ===
    const handleSaveDocument = async () => {
        if (!selectedTypeId || !selectedLocationId || !acquisitionDate) {
            alert("Lütfen belge türü, lokasyon ve alınma tarihini doldurun."); return;
        }
        if (!isIndefinite && !expiryDate) {
            alert("Lütfen bitiş tarihi girin veya 'Süresiz' seçeneğini işaretleyin."); return;
        }
        setFormLoading(true);

        try {
            // Mükerrer kontrol (yeni eklerken veya yenilerken)
            if (scope === "kurumsal" && modalMode !== "edit") {
                const hasDup = await checkDuplicate(selectedTypeId, selectedLocationId);
                if (hasDup) {
                    alert("Bu belge türü ve lokasyonda zaten aktif bir kurumsal belge var!");
                    setFormLoading(false); return;
                }
            }
            // Düzenlerken de kontrol et ama kendi ID'sini hariç tut
            if (scope === "kurumsal" && modalMode === "edit" && editingDoc) {
                const hasDup = await checkDuplicate(selectedTypeId, selectedLocationId, editingDoc.id);
                if (hasDup) {
                    alert("Bu belge türü ve lokasyonda zaten aktif bir kurumsal belge var!");
                    setFormLoading(false); return;
                }
            }

            let fileUrl: string | null = editingDoc?.file_url || null;
            let fileName: string | null = editingDoc?.file_name || null;
            let fileSize: number | null = editingDoc?.file_size || null;

            if (selectedFile) {
                if (selectedFile.size > 5 * 1024 * 1024) {
                    alert("Dosya boyutu 5MB'yi aşamaz!"); setFormLoading(false); return;
                }
                const ext = selectedFile.name.split(".").pop();
                const path = `${user!.id}/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from("documents").upload(path, selectedFile);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
                fileUrl = urlData.publicUrl;
                fileName = selectedFile.name;
                fileSize = selectedFile.size;
            }

            const docData = {
                scope,
                title: title.trim() || null,
                document_type_id: selectedTypeId,
                location_id: selectedLocationId,
                acquisition_date: acquisitionDate,
                is_indefinite: isIndefinite,
                expiry_date: isIndefinite ? null : expiryDate || null,
                application_deadline: isIndefinite ? null : applicationDeadline || null,
                file_url: fileUrl, file_name: fileName, file_size: fileSize,
                reminder_days_before: parseInt(reminderDays) || 5,
            };

            if (modalMode === "edit" && editingDoc) {
                // Düzenleme
                const { error } = await supabase.from("documents")
                    .update({ ...docData, updated_at: new Date().toISOString() })
                    .eq("id", editingDoc.id);
                if (error) throw error;
                alert("Belge güncellendi!");
            } else if (modalMode === "renew" && editingDoc) {
                // Yenile: eski belgeyi arşive, yenisini ekle
                await supabase.from("documents").update({
                    is_archived: true, archived_at: new Date().toISOString()
                }).eq("id", editingDoc.id);

                const { error } = await supabase.from("documents").insert([{
                    ...docData,
                    user_id: user!.id,
                    tenant_id: profile?.tenant_id,
                    reminder_sent: false,
                    is_archived: false,
                    renewed_from: editingDoc.id,
                }]);
                if (error) throw error;
                alert("Belge yenilendi ve eski belge arşive alındı!");
            } else {
                // Yeni ekleme
                const { error } = await supabase.from("documents").insert([{
                    ...docData,
                    user_id: user!.id,
                    tenant_id: profile?.tenant_id,
                    reminder_sent: false,
                    is_archived: false,
                }]);
                if (error) throw error;
                alert("Belge başarıyla eklendi!");
            }

            resetForm(); setShowAddModal(false); setEditingDoc(null); fetchAll();
        } catch (error: any) {
            console.error("Error:", error);
            alert("Hata: " + error.message);
        } finally {
            setFormLoading(false);
        }
    };

    // === Belge Sil ===
    const handleDeleteDocument = async (doc: Document) => {
        if (!window.confirm("Bu belgeyi silmek istediğinize emin misiniz?")) return;
        try {
            if (doc.file_url) {
                const path = doc.file_url.split("/documents/")[1];
                if (path) await supabase.storage.from("documents").remove([path]);
            }
            await supabase.from("documents").delete().eq("id", doc.id);
            fetchAll();
        } catch (error: any) { alert("Hata: " + error.message); }
    };

    const tabClass = (tab: TabView) =>
        `px-4 py-2 text-sm font-medium rounded-t-md transition ${activeTab === tab
            ? "bg-white text-indigo-700 border border-b-0 border-gray-200"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
        }`;

    const isTypeLocationLocked = modalMode === "renew";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Evrak Takip</h1>
                    <p className="text-sm text-gray-500 mt-1">Belgelerinizi ekleyin, takip edin ve otomatik hatırlatma alın.</p>
                </div>
                <button onClick={openAddModal}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                    Yeni Belge Ekle
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
                <button className={tabClass("dashboard")} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
                <button className={tabClass("documents")} onClick={() => setActiveTab("documents")}>
                    Belgeler {documents.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{documents.length}</span>}
                </button>
            </div>

            {loading ? (
                <div className="p-12 text-center text-gray-400">Yükleniyor...</div>
            ) : (
                <>
                    {/* ========== DASHBOARD ========== */}
                    {activeTab === "dashboard" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white shadow rounded-lg p-4 border-l-4 border-indigo-500">
                                    <p className="text-sm text-gray-500">Toplam Belge</p>
                                    <p className="text-2xl font-bold text-indigo-700">{stats.total}</p>
                                </div>
                                <div className="bg-white shadow rounded-lg p-4 border-l-4 border-red-500">
                                    <p className="text-sm text-gray-500">Süresi Dolmuş</p>
                                    <p className="text-2xl font-bold text-red-700">{stats.expired}</p>
                                </div>
                                <div className="bg-white shadow rounded-lg p-4 border-l-4 border-yellow-500">
                                    <p className="text-sm text-gray-500">Acil (7 gün)</p>
                                    <p className="text-2xl font-bold text-yellow-700">{stats.urgent}</p>
                                </div>
                                <div className="bg-white shadow rounded-lg p-4 border-l-4 border-green-500">
                                    <p className="text-sm text-gray-500">Güncel</p>
                                    <p className="text-2xl font-bold text-green-700">{stats.ok}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white shadow rounded-lg p-5">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Belge Dağılımı</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Kurumsal</span>
                                            <span className="text-sm font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{stats.corporate}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Şahsi</span>
                                            <span className="text-sm font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{stats.personal}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t pt-2">
                                            <span className="text-sm text-gray-600">Arşivlenmiş</span>
                                            <span className="text-sm font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stats.archived}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white shadow rounded-lg p-5">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Dikkat Gerektiren Belgeler</h3>
                                    {documents.filter(d => { const s = getDateStatus(d); return s.days <= 30 && s.days !== Infinity; }).length === 0 ? (
                                        <p className="text-sm text-gray-400">Acil belge yok ✓</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {documents.filter(d => { const s = getDateStatus(d); return s.days <= 30 && s.days !== Infinity; }).slice(0, 5).map(doc => {
                                                const status = getDateStatus(doc);
                                                return (
                                                    <div key={doc.id} className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-700 truncate max-w-[60%]">
                                                            {doc.title || (doc.document_types as any)?.name || "Belge"}
                                                        </span>
                                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${status.color}`}>{status.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========== BELGELER (tıklanabilir satırlar + inline arşiv) ========== */}
                    {activeTab === "documents" && (
                        documents.length === 0 ? (
                            <div className="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                                <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-lg font-medium text-gray-500">Henüz belge eklenmemiş</p>
                            </div>
                        ) : (
                            <div className="bg-white shadow rounded-lg overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kapsam</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Belge Türü</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lokasyon</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alınma</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bitiş</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Son Başvuru</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosya</th>
                                            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {documents.map((doc) => {
                                            const status = getDateStatus(doc);
                                            const isOwner = doc.user_id === user?.id;
                                            const archiveHistory = getArchiveHistory(doc.id);
                                            const isExpanded = expandedDocId === doc.id;

                                            return (
                                                <>{/* Ana satır */}
                                                    <tr key={doc.id}
                                                        className={`cursor-pointer transition ${status.days < 0 ? "bg-red-50/40 hover:bg-red-50" : status.days <= 7 ? "bg-yellow-50/40 hover:bg-yellow-50" : "hover:bg-gray-50"}`}
                                                        onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}>
                                                        <td className="px-3 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-1">
                                                                <span className={`transform transition text-gray-400 text-xs ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${status.color}`}>{status.label}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                                                            <span className={`px-2 py-0.5 text-xs rounded-full ${doc.scope === "kurumsal" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}>
                                                                {doc.scope === "kurumsal" ? "Kurumsal" : "Şahsi"}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                                            {doc.title || (doc.document_types as any)?.name || "—"}
                                                        </td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{(doc.locations as any)?.name || "—"}</td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {(doc.profiles as any)?.first_name || ""} {(doc.profiles as any)?.last_name || (doc.profiles as any)?.email || ""}
                                                        </td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(doc.acquisition_date)}</td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{doc.is_indefinite ? "Süresiz" : formatDate(doc.expiry_date)}</td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{doc.is_indefinite ? "—" : formatDate(doc.application_deadline)}</td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                                                            {doc.file_url ? (
                                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                                                    className="text-indigo-600 hover:text-indigo-800 underline text-xs"
                                                                    onClick={(e) => e.stopPropagation()}>
                                                                    {doc.file_name?.substring(0, 15) || "Dosya"}
                                                                </a>
                                                            ) : <span className="text-gray-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-3 whitespace-nowrap text-right text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                                                            {isOwner && (
                                                                <button onClick={() => openEditModal(doc)}
                                                                    className="text-gray-600 hover:text-gray-800">Düzenle</button>
                                                            )}
                                                            {isOwner && status.days < 0 && (
                                                                <button onClick={() => openRenewModal(doc)}
                                                                    className="text-indigo-600 hover:text-indigo-800 font-medium">Yenile</button>
                                                            )}
                                                            {isOwner && (
                                                                <button onClick={() => handleDeleteDocument(doc)}
                                                                    className="text-red-600 hover:text-red-800">Sil</button>
                                                            )}
                                                        </td>
                                                    </tr>

                                                    {/* Genişletilmiş arşiv geçmişi */}
                                                    {isExpanded && (
                                                        <tr key={`${doc.id}-archive`}>
                                                            <td colSpan={isManager ? 10 : 9} className="px-0 py-0">
                                                                <div className="bg-gray-50 border-t border-b border-gray-200 px-6 py-4">
                                                                    {archiveHistory.length === 0 ? (
                                                                        <p className="text-sm text-gray-400 italic">Bu belgenin arşiv geçmişi bulunmuyor.</p>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                                                                Arşiv Geçmişi ({archiveHistory.length} eski belge)
                                                                            </p>
                                                                            <div className="space-y-2">
                                                                                {archiveHistory.map((arch) => (
                                                                                    <div key={arch.id} className="flex items-center justify-between bg-white rounded-md px-4 py-2 border border-gray-200 text-sm">
                                                                                        <div className="flex items-center gap-4">
                                                                                            <span className="text-gray-400 text-xs">📁</span>
                                                                                            <div>
                                                                                                <span className="text-gray-700">
                                                                                                    {formatDate(arch.acquisition_date)} — {arch.is_indefinite ? "Süresiz" : formatDate(arch.expiry_date)}
                                                                                                </span>
                                                                                                <span className="text-gray-400 text-xs ml-2">
                                                                                                    (Arşivlenme: {formatDate(arch.archived_at)})
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {arch.file_url && (
                                                                                            <a href={arch.file_url} target="_blank" rel="noopener noreferrer"
                                                                                                className="text-indigo-600 hover:text-indigo-800 underline text-xs">
                                                                                                Dosyayı Görüntüle
                                                                                            </a>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </>
            )}

            {/* ========== BELGE EKLEME / DÜZENLEME / YENİLEME MODAL ========== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-4 my-8">
                        <h3 className="text-lg font-bold">
                            {modalMode === "edit" ? "Belge Düzenle" : modalMode === "renew" ? "Belge Yenile" : "Yeni Belge Ekle"}
                        </h3>
                        {modalMode === "renew" && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                                Eski belge otomatik olarak arşive alınacaktır.
                            </div>
                        )}

                        {/* Kapsam */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Belge Kapsamı</label>
                            <div className="flex gap-3">
                                <button onClick={() => setScope("kurumsal")} disabled={modalMode !== "add"}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition ${scope === "kurumsal" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"} ${modalMode !== "add" ? "opacity-60" : ""}`}>
                                    Kurumsal
                                </button>
                                <button onClick={() => setScope("sahsi")} disabled={modalMode !== "add"}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition ${scope === "sahsi" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"} ${modalMode !== "add" ? "opacity-60" : ""}`}>
                                    Şahsi
                                </button>
                            </div>
                        </div>

                        {/* Başlık */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık (Opsiyonel)</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Örn: İş Güvenliği Sertifikası" />
                        </div>

                        {/* Belge Türü */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Belge Türü *</label>
                            {!showNewType ? (
                                <div className="flex gap-2">
                                    <select value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)}
                                        disabled={isTypeLocationLocked}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">Seçin...</option>
                                        {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    {!isTypeLocationLocked && (
                                        <button onClick={() => setShowNewType(true)}
                                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 whitespace-nowrap">+ Yeni</button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="text" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Yeni belge türü adı" autoFocus />
                                    <button onClick={handleAddType} className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Ekle</button>
                                    <button onClick={() => { setShowNewType(false); setNewTypeName(""); }}
                                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200">İptal</button>
                                </div>
                            )}
                        </div>

                        {/* Lokasyon */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lokasyon *</label>
                            {!showNewLocation ? (
                                <div className="flex gap-2">
                                    <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)}
                                        disabled={isTypeLocationLocked}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">Seçin...</option>
                                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                    {!isTypeLocationLocked && (
                                        <button onClick={() => setShowNewLocation(true)}
                                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 whitespace-nowrap">+ Yeni</button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Yeni lokasyon adı" autoFocus />
                                    <button onClick={handleAddLocation} className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Ekle</button>
                                    <button onClick={() => { setShowNewLocation(false); setNewLocationName(""); }}
                                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200">İptal</button>
                                </div>
                            )}
                        </div>

                        {/* Tarihler */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alınma Tarihi *</label>
                            <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="is-indef" checked={isIndefinite} onChange={(e) => setIsIndefinite(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
                            <label htmlFor="is-indef" className="text-sm text-gray-700">Süresiz belge</label>
                        </div>

                        {!isIndefinite && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi *</label>
                                        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Son Başvuru Tarihi</label>
                                        <input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)}
                                            max={expiryDate || undefined}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Hatırlatma</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" value={reminderDays} min="1" max="365" onChange={(e) => setReminderDays(e.target.value)}
                                            className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-500">gün önce e-posta gönder</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Dosya */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Evrak Yükle (Max 5MB)</label>
                            {modalMode === "edit" && editingDoc?.file_url && !selectedFile && (
                                <p className="text-xs text-gray-500 mb-1">
                                    Mevcut: <a href={editingDoc.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{editingDoc.file_name || "Dosya"}</a>
                                    <span className="text-gray-400 ml-1">(Yeni dosya seçerseniz değiştirilir)</span>
                                </p>
                            )}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    if (file && file.size > 5 * 1024 * 1024) { alert("5MB limit aşıldı!"); e.target.value = ""; return; }
                                    setSelectedFile(file);
                                }}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t">
                            <button onClick={() => { setShowAddModal(false); setEditingDoc(null); }}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">İptal</button>
                            <button onClick={handleSaveDocument} disabled={formLoading}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {formLoading ? "Kaydediliyor..." : modalMode === "edit" ? "Güncelle" : modalMode === "renew" ? "Yenile ve Arşivle" : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
