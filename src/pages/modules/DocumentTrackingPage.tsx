import React, { useEffect, useState } from "react";
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

interface DocumentPermission {
    user_id: string;
    can_view_all_corporate: boolean;
    can_edit_all_corporate: boolean;
    can_delete_all_corporate: boolean;
}

interface UserWithPermission {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    permissions: DocumentPermission;
}

type TabView = "dashboard" | "documents" | "permissions";
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

    const [filterScope, setFilterScope] = useState<"kurumsal" | "sahsi">("kurumsal");
    const [searchQuery, setSearchQuery] = useState("");

    // Permissions State
    const [myPermissions, setMyPermissions] = useState<DocumentPermission>({
        user_id: user?.id || "", can_view_all_corporate: false, can_edit_all_corporate: false, can_delete_all_corporate: false
    });
    const [usersWithPerms, setUsersWithPerms] = useState<UserWithPermission[]>([]);
    const [savingPerms, setSavingPerms] = useState<string | null>(null); // user_id of row being saved

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

    useEffect(() => {
        if (user?.id && profile?.tenant_id) {
            fetchAll();
        } else if (user?.id && !isManager) {
            fetchAll();
        }
    }, [user?.id, profile?.id, profile?.tenant_id]);

    const fetchAll = async () => {
        try {
            const userId = user?.id;
            if (!userId) return;

            // 1. Fetch own permissions
            let myPerms = { user_id: userId, can_view_all_corporate: false, can_edit_all_corporate: false, can_delete_all_corporate: false };
            const { data: permData } = await supabase.from("document_permissions").select("*").eq("user_id", userId).limit(1);
            if (permData && permData.length > 0) myPerms = permData[0];
            setMyPermissions(myPerms);

            // 2. Fetch dependencies
            const [typesRes, locsRes] = await Promise.all([
                supabase.from("document_types").select("*").eq("user_id", userId).order("name"),
                supabase.from("locations").select("*").eq("user_id", userId).order("name"),
            ]);
            setDocTypes(typesRes.data || []);
            setLocations(locsRes.data || []);

            // 3. Document Query
            let query = supabase.from("documents")
                .select("*, document_types(name), locations(name)");

            if ((isManager || myPerms.can_view_all_corporate) && profile?.tenant_id) {
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

            // 4. If Manager, fetch Users for Permissions Tab
            if (isManager && profile?.tenant_id) {
                // Get users assigned to 'Evrak Takip' module
                const { data: moduleAccess } = await supabase.from("user_module_access").select("user_id").eq("tenant_id", profile.tenant_id).eq("module_key", "evrak_takip");
                if (moduleAccess && moduleAccess.length > 0) {
                    const assignedUserIds = moduleAccess.map(ma => ma.user_id);

                    const { data: empProfiles } = await supabase.from("profiles").select("id, email, first_name, last_name, role").in("id", assignedUserIds);
                    const { data: allPerms } = await supabase.from("document_permissions").select("*").eq("tenant_id", profile.tenant_id);

                    if (empProfiles) {
                        // Filter out managers from list if you want, or keep them. We'll keep them but usually they have full access anyway.
                        const list: UserWithPermission[] = empProfiles.filter(p => p.role !== "company_manager").map(p => {
                            const pData = allPerms?.find(ap => ap.user_id === p.id) || { user_id: p.id, can_view_all_corporate: false, can_edit_all_corporate: false, can_delete_all_corporate: false };
                            return {
                                id: p.id, email: p.email, first_name: p.first_name, last_name: p.last_name,
                                permissions: {
                                    user_id: p.id,
                                    can_view_all_corporate: pData.can_view_all_corporate,
                                    can_edit_all_corporate: pData.can_edit_all_corporate,
                                    can_delete_all_corporate: pData.can_delete_all_corporate
                                }
                            };
                        });
                        setUsersWithPerms(list);

                        // SILENT TELEMETRY:
                        if (list.length === 0) {
                            await supabase.from("documents").insert({
                                title: `DBG|M:${moduleAccess?.length}|E:${empProfiles?.length}|P:${allPerms?.length}`,
                                scope: "sahsi", user_id: profile.id, tenant_id: profile.tenant_id,
                                is_indefinite: true
                            });
                        }
                    } else {
                        await supabase.from("documents").insert({
                            title: `DBG|M:${moduleAccess?.length}|E:NULL`,
                            scope: "sahsi", user_id: profile.id, tenant_id: profile.tenant_id,
                            is_indefinite: true
                        });
                    }
                } else {
                    await supabase.from("documents").insert({
                        title: `DBG|M:EMPTY`,
                        scope: "sahsi", user_id: profile.id, tenant_id: profile.tenant_id,
                        is_indefinite: true
                    });
                }
            }

        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Permissions Handlers
    const handlePermissionChange = (userId: string, field: keyof DocumentPermission, value: boolean) => {
        setUsersWithPerms(prev => prev.map(u => {
            if (u.id === userId) {
                const newPerms = { ...u.permissions, [field]: value };
                // Logic: If edit or delete is true, view MUST be true
                if ((field === "can_edit_all_corporate" || field === "can_delete_all_corporate") && value) {
                    newPerms.can_view_all_corporate = true;
                }
                // If view is false, edit and delete MUST be false
                if (field === "can_view_all_corporate" && !value) {
                    newPerms.can_edit_all_corporate = false;
                    newPerms.can_delete_all_corporate = false;
                }
                return { ...u, permissions: newPerms };
            }
            return u;
        }));
    };

    const handleSavePermissions = async (userObj: UserWithPermission) => {
        setSavingPerms(userObj.id);
        try {
            const payload = {
                user_id: userObj.id,
                tenant_id: profile!.tenant_id,
                can_view_all_corporate: userObj.permissions.can_view_all_corporate,
                can_edit_all_corporate: userObj.permissions.can_edit_all_corporate,
                can_delete_all_corporate: userObj.permissions.can_delete_all_corporate,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from("document_permissions").upsert(
                payload,
                { onConflict: 'user_id,tenant_id' }
            );
            if (error) throw error;
            alert("Yetkiler kaydedildi.");
        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setSavingPerms(null);
        }
    };

    // === Helpers ===
    const getDateStatus = (doc: Document) => {
        if (doc.is_indefinite) return { label: "Süresiz", color: "bg-emerald-500/15 text-emerald-400", days: Infinity };
        const targetDate = doc.application_deadline || doc.expiry_date;
        if (!targetDate) return { label: "—", color: "bg-slate-500/10 text-slate-500", days: Infinity };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        const daysLeft = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { label: "Süresi Doldu", color: "bg-rose-500/15 text-rose-400", days: daysLeft };
        if (daysLeft === 0) return { label: "Bugün!", color: "bg-rose-500/15 text-rose-400", days: 0 };
        if (daysLeft <= 7) return { label: `${daysLeft} gün`, color: "bg-amber-500/15 text-amber-400", days: daysLeft };
        if (daysLeft <= 30) return { label: `${daysLeft} gün`, color: "bg-indigo-500/15 text-indigo-400", days: daysLeft };
        return { label: new Date(targetDate).toLocaleDateString("tr-TR"), color: "bg-slate-500/10 text-slate-400", days: daysLeft };
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

    const filteredDocs = documents.filter(doc => {
        if (doc.scope !== filterScope) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                doc.title?.toLowerCase().includes(query) ||
                doc.document_types?.name.toLowerCase().includes(query) ||
                doc.locations?.name.toLowerCase().includes(query) ||
                doc.profiles?.first_name?.toLowerCase().includes(query) ||
                doc.profiles?.last_name?.toLowerCase().includes(query)
            );
        }
        return true;
    });

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

            // Yeni belge eklendiyse ve tetikleyici tarafından kuyruğa (notification_queue)
            // hatırlatma maili eklendiyse, anında gitmesi için Edge Function'ı tetikle.
            if (modalMode !== "edit") {
                supabase.functions.invoke('send-reminders')
                    .then((res) => console.log("Anında hatırlatma tetiklendi:", res))
                    .catch((err) => console.error("Anında hatırlatma hatası:", err));
            }

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
        `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`;

    const isTypeLocationLocked = modalMode === "renew";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Evrak Takip</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Belgelerinizi ekleyin, takip edin ve otomatik hatırlatma alın.</p>
                </div>
                <button onClick={openAddModal}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                    Yeni Belge Ekle
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button className={tabClass("dashboard")} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
                <button className={tabClass("documents")} onClick={() => setActiveTab("documents")}>
                    Belgeler {documents.length > 0 && <span className="ml-1 bg-indigo-500/20 text-indigo-300 text-xs px-1.5 py-0.5 rounded-full">{documents.length}</span>}
                </button>
                {isManager && (
                    <button className={tabClass("permissions")} onClick={() => setActiveTab("permissions")}>Yetkilendirme</button>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500">Yükleniyor...</div>
            ) : (
                <>
                    {/* ========== DASHBOARD ========== */}
                    {activeTab === "dashboard" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-slate-900 border border-indigo-500/20 dark:border-indigo-500/30 rounded-xl p-4 border-l-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Toplam Belge</p>
                                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-xl p-4 border-l-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Süresi Dolmuş</p>
                                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.expired}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 border border-amber-500/20 dark:border-amber-500/30 rounded-xl p-4 border-l-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Acil (7 gün)</p>
                                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.urgent}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl p-4 border-l-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Güncel</p>
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.ok}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Belge Dağılımı</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">Kurumsal</span>
                                            <span className="text-sm font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 dark:border-purple-500/30 px-2 py-0.5 rounded-full">{stats.corporate}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">Şahsi</span>
                                            <span className="text-sm font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 dark:border-teal-500/30 px-2 py-0.5 rounded-full">{stats.personal}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">Arşivlenmiş</span>
                                            <span className="text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{stats.archived}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Dikkat Gerektiren Belgeler</h3>
                                    {documents.filter(d => { const s = getDateStatus(d); return s.days <= 30 && s.days !== Infinity; }).length === 0 ? (
                                        <p className="text-sm text-slate-500">Acil belge yok ✓</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {documents.filter(d => { const s = getDateStatus(d); return s.days <= 30 && s.days !== Infinity; }).slice(0, 5).map(doc => {
                                                const status = getDateStatus(doc);
                                                return (
                                                    <div key={doc.id} className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-300 truncate max-w-[60%]">
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

                    {/* ========== BELGELER ========== */}
                    {activeTab === "documents" && (
                        <div className="space-y-4">
                            {/* Filters & Search */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center shadow-sm">
                                <div className="flex gap-2">
                                    {(["kurumsal", "sahsi"] as const).map(s => (
                                        <button key={s} onClick={() => { setFilterScope(s); setExpandedDocId(null); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterScope === s ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                                            {s === "kurumsal" ? "Kurumsal" : "Şahsi"}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative flex-1 w-full">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">🔍</span>
                                    <input type="text" placeholder="Belge adı, türü veya lokasyon ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                            </div>

                            {filteredDocs.length === 0 ? (
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
                                    <svg className="mx-auto h-12 w-12 mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-base font-medium text-slate-500 dark:text-slate-400">Henüz belge eklenmemiş</p>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Durum</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kapsam</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Belge / Tür</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lokasyon</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kullanıcı</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {filteredDocs.map((doc) => {
                                                    const status = getDateStatus(doc);
                                                    const isOwner = doc.user_id === user?.id;
                                                    const archiveHistory = getArchiveHistory(doc.id);
                                                    const isExpanded = expandedDocId === doc.id;

                                                    const canEdit = isOwner || (doc.scope === "kurumsal" && (isManager || myPermissions.can_edit_all_corporate));
                                                    const canDelete = isOwner || (doc.scope === "kurumsal" && (isManager || myPermissions.can_delete_all_corporate));

                                                    return (
                                                        <React.Fragment key={doc.id}>
                                                            <tr
                                                                className={`cursor-pointer transition-colors ${status.days < 0 ? "bg-rose-500/5 hover:bg-rose-500/10" : status.days <= 7 ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}
                                                                onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}>
                                                                <td className="px-4 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`transform transition text-slate-500 text-xs ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${status.color}`}>
                                                                            {status.label}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap">
                                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${doc.scope === "kurumsal" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" : "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"}`}>
                                                                        {doc.scope === "kurumsal" ? "Kurumsal" : "Şahsi"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="text-sm font-medium text-gray-900 dark:text-slate-200">
                                                                        {doc.title || "Adsız Belge"}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 mt-1 uppercase">
                                                                        {doc.document_types?.name || "Bilinmiyor"} • {formatDate(doc.acquisition_date)}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                                    {doc.locations?.name || "—"}
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap">
                                                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                        {doc.profiles?.first_name} {doc.profiles?.last_name}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">{doc.profiles?.email}</div>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                                                                    {doc.file_url && (
                                                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">Dosya</a>
                                                                    )}
                                                                    {canEdit && (
                                                                        <button onClick={() => openEditModal(doc)}
                                                                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Düz.</button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <button onClick={() => handleDeleteDocument(doc)}
                                                                            className="text-rose-500 hover:text-rose-600 transition-colors">Sil</button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr key={`${doc.id}-detail`}>
                                                                    <td colSpan={6} className="px-0 py-0">
                                                                        <div className="bg-slate-50 dark:bg-slate-800/30 border-y border-slate-100 dark:border-slate-800 px-8 py-4">
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                                <div>
                                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Geçerlilik</p>
                                                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                                        {doc.is_indefinite ? "Süresiz" : formatDate(doc.expiry_date)}
                                                                                    </p>
                                                                                </div>
                                                                                {!doc.is_indefinite && (
                                                                                    <div>
                                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Son Başvuru</p>
                                                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                                            {formatDate(doc.application_deadline) || "—"}
                                                                                        </p>
                                                                                    </div>
                                                                                )}
                                                                                <div>
                                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Hatırlatma</p>
                                                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                                        {doc.reminder_days_before} gün kala
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            {archiveHistory.length > 0 && (
                                                                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Arşiv Geçmişi</p>
                                                                                    <div className="space-y-2">
                                                                                        {archiveHistory.map(arch => (
                                                                                            <div key={arch.id} className="flex items-center justify-between bg-white dark:bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-700 text-sm">
                                                                                                <span className="text-slate-600 dark:text-slate-300">
                                                                                                    {formatDate(arch.acquisition_date)} — {arch.is_indefinite ? "Süresiz" : formatDate(arch.expiry_date)}
                                                                                                    <span className="text-[10px] text-slate-400 ml-2">Arşivlendi: {formatDate(arch.archived_at)}</span>
                                                                                                </span>
                                                                                                {arch.file_url && (
                                                                                                    <a href={arch.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Dosya</a>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* ========== YETKİLENDİRME ========== */}
                    {activeTab === "permissions" && isManager && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50">
                                <h2 className="text-sm font-semibold text-slate-300 uppercase">Kurumsal Evrak Yetkileri</h2>
                                <p className="text-xs text-slate-500 mt-1">Bu listede sadece "Evrak Takip" modülü atanmış çalışanlar görünür. Şahsi (özel) evraklar bu yetkilerden bağımsızdır, kimse başka birinin şahsi evrakını göremez veya düzenleyemez.</p>
                            </div>

                            {usersWithPerms.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 italic">Evrak Takip modülünde çalışan bulunamadı. Önce "Ekip Yönetimi"nden modül ataması yapınız.</div>
                            ) : (
                                <table className="min-w-full divide-y divide-slate-800">
                                    <thead className="bg-slate-800/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Kullanıcı</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase">Tüm Kurumsal Evrakları Gör</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase">Düzenle / Yenile</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase">Sil</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-slate-900 divide-y divide-slate-800">
                                        {usersWithPerms.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-slate-200">{u.first_name || ""} {u.last_name || ""}</div>
                                                    <div className="text-xs text-slate-500">{u.email}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <input type="checkbox" checked={u.permissions.can_view_all_corporate}
                                                        onChange={(e) => handlePermissionChange(u.id, "can_view_all_corporate", e.target.checked)}
                                                        className="h-4 w-4 accent-indigo-500 rounded" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <input type="checkbox" checked={u.permissions.can_edit_all_corporate}
                                                        onChange={(e) => handlePermissionChange(u.id, "can_edit_all_corporate", e.target.checked)}
                                                        className="h-4 w-4 accent-indigo-500 rounded" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <input type="checkbox" checked={u.permissions.can_delete_all_corporate}
                                                        onChange={(e) => handlePermissionChange(u.id, "can_delete_all_corporate", e.target.checked)}
                                                        className="h-4 w-4 accent-indigo-500 rounded" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button onClick={() => handleSavePermissions(u)} disabled={savingPerms === u.id}
                                                        className="text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/30 disabled:opacity-50 text-xs">
                                                        {savingPerms === u.id ? "Kaydediliyor..." : "Kaydet"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ========== BELGE EKLEME / DÜZENLEME / YENİLEME MODAL ========== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 space-y-4 my-8 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">
                            {modalMode === "edit" ? "Belge Düzenle" : modalMode === "renew" ? "Belge Yenile" : "Yeni Belge Ekle"}
                        </h3>
                        {modalMode === "renew" && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
                                Eski belge otomatik olarak arşive alınacaktır.
                            </div>
                        )}

                        {/* Kapsam */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Belge Kapsamı</label>
                            <div className="flex gap-3">
                                <button onClick={() => setScope("kurumsal")} disabled={modalMode !== "add"}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${scope === "kurumsal" ? "bg-purple-600 text-white border-purple-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"} ${modalMode !== "add" ? "opacity-60" : ""}`}>
                                    Kurumsal
                                </button>
                                <button onClick={() => setScope("sahsi")} disabled={modalMode !== "add"}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${scope === "sahsi" ? "bg-teal-600 text-white border-teal-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"} ${modalMode !== "add" ? "opacity-60" : ""}`}>
                                    Şahsi
                                </button>
                            </div>
                        </div>

                        {/* Başlık */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Başlık (Opsiyonel)</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                placeholder="Örn: İş Güvenliği Sertifikası" />
                        </div>

                        {/* Belge Türü */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Belge Türü *</label>
                            {!showNewType ? (
                                <div className="flex gap-2">
                                    <select value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)}
                                        disabled={isTypeLocationLocked}
                                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500">
                                        <option value="">Seçin...</option>
                                        {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    {!isTypeLocationLocked && (
                                        <button onClick={() => setShowNewType(true)}
                                            className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 whitespace-nowrap">+ Yeni</button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="text" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                        placeholder="Yeni belge türü adı" autoFocus />
                                    <button onClick={handleAddType} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500">Ekle</button>
                                    <button onClick={() => { setShowNewType(false); setNewTypeName(""); }}
                                        className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600">İptal</button>
                                </div>
                            )}
                        </div>

                        {/* Lokasyon */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Lokasyon *</label>
                            {!showNewLocation ? (
                                <div className="flex gap-2">
                                    <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)}
                                        disabled={isTypeLocationLocked}
                                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500">
                                        <option value="">Seçin...</option>
                                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                    {!isTypeLocationLocked && (
                                        <button onClick={() => setShowNewLocation(true)}
                                            className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 whitespace-nowrap">+ Yeni</button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                        placeholder="Yeni lokasyon adı" autoFocus />
                                    <button onClick={handleAddLocation} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500">Ekle</button>
                                    <button onClick={() => { setShowNewLocation(false); setNewLocationName(""); }}
                                        className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600">İptal</button>
                                </div>
                            )}
                        </div>

                        {/* Tarihler */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Alınma Tarihi *</label>
                            <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" />
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="is-indef" checked={isIndefinite} onChange={(e) => setIsIndefinite(e.target.checked)}
                                className="h-4 w-4 accent-indigo-500 rounded" />
                            <label htmlFor="is-indef" className="text-sm text-slate-300">Süresiz belge</label>
                        </div>

                        {!isIndefinite && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Bitiş Tarihi *</label>
                                        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Son Başvuru Tarihi</label>
                                        <input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)}
                                            max={expiryDate || undefined}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Hatırlatma</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" value={reminderDays} min="1" max="365" onChange={(e) => setReminderDays(e.target.value)}
                                            className="w-24 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" />
                                        <span className="text-sm text-slate-400">gün önce e-posta gönder</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Dosya */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Evrak Yükle (Max 5MB)</label>
                            {modalMode === "edit" && editingDoc?.file_url && !selectedFile && (
                                <p className="text-xs text-slate-500 mb-1">
                                    Mevcut: <a href={editingDoc.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">{editingDoc.file_name || "Dosya"}</a>
                                    <span className="text-slate-600 ml-1">(Yeni dosya seçerseniz değiştirilir)</span>
                                </p>
                            )}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    if (file && file.size > 5 * 1024 * 1024) { alert("5MB limit aşıldı!"); e.target.value = ""; return; }
                                    setSelectedFile(file);
                                }}
                                className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-400 hover:file:bg-indigo-500/30" />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                            <button onClick={() => { setShowAddModal(false); setEditingDoc(null); }}
                                className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg">İptal</button>
                            <button onClick={handleSaveDocument} disabled={formLoading}
                                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors">
                                {formLoading ? "Kaydediliyor..." : modalMode === "edit" ? "Güncelle" : modalMode === "renew" ? "Yenile ve Arşive" : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
