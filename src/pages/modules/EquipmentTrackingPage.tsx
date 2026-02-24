import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import QRCode from "qrcode";

// ===================== TYPES =====================
interface Category { id: string; name: string; }
interface EquipmentDefinition { id: string; name: string; }
interface Inspector { id: string; name: string; type: string; certificate_no: string | null; }
interface Equipment {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    type: string | null;
    serial_no: string | null;
    brand: string | null;
    model: string | null;
    purpose: string | null;
    assigned_to: string | null;
    risk_level: "düşük" | "orta" | "yüksek";
    inspection_period_months: number;
    default_location: string | null;
    current_location: string | null;
    qr_token: string;
    purchase_date: string | null;
    manufacture_year: number | null;
    is_active: boolean;
    created_at: string;
    category_id: string | null;
    equipment_categories: { name: string } | null;
    last_inspection_date?: string | null;
    next_inspection_date?: string | null;
    maintenance_required: boolean;
    is_damaged?: boolean;
}
interface Inspection {
    id: string;
    equipment_id: string;
    inspection_date: string;
    next_inspection_date: string;
    result: "uygun" | "koşullu uygun" | "uygunsuz";
    notes: string | null;
    file_url: string | null;
    file_name: string | null;
    inspector_id: string | null;
    inspector_name_override: string | null;
    equipment_inspectors: { name: string } | null;
    equipments?: { name: string; code: string } | null;
}
interface LocationHistory {
    id: string;
    equipment_id: string;
    location: string;
    scanned_by: string | null;
    created_at: string;
}

type TabView = "dashboard" | "equipments" | "inspectors";

const RISK_COLORS = {
    düşük: "bg-green-100 text-green-700",
    orta: "bg-yellow-100 text-yellow-700",
    yüksek: "bg-red-100 text-red-700",
};
const RISK_PERIODS: Record<string, number> = { düşük: 12, orta: 6, yüksek: 3 };

export default function EquipmentTrackingPage() {
    const { profile, user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<TabView>("dashboard");

    // Data
    const [equipments, setEquipments] = useState<Equipment[]>([]);

    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [definitions, setDefinitions] = useState<EquipmentDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state for equipments
    const [filterDamaged, setFilterDamaged] = useState(false);

    // Detail modal (row click)
    const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailInspections, setDetailInspections] = useState<Inspection[]>([]);
    const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
    // Fetch fault reports
    const [faultReports, setFaultReports] = useState<any[]>([]);
    const [detailTab, setDetailTab] = useState<"overview" | "maintenance" | "location">("overview");
    const [showInlineInsp, setShowInlineInsp] = useState(false);

    // Ekipman adı listesi - yeni tanım ekleme
    const [showNewDefModal, setShowNewDefModal] = useState(false);
    const [newDefName, setNewDefName] = useState("");
    const [newDefLoading, setNewDefLoading] = useState(false);

    // Equipment modal
    const [showEquipModal, setShowEquipModal] = useState(false);
    const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);
    const [equipForm, setEquipForm] = useState(defaultEquipForm());
    const [equipLoading, setEquipLoading] = useState(false);

    // Inspection modal
    const [showInspModal, setShowInspModal] = useState(false);
    const [inspForm, setInspForm] = useState(defaultInspForm());
    const [inspLoading, setInspLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Inspector modal
    const [showInspectorModal, setShowInspectorModal] = useState(false);
    const [inspectorForm, setInspectorForm] = useState(defaultInspectorForm());
    const [inspectorLoading, setInspectorLoading] = useState(false);

    // Inline kategori ekleme
    const [showNewCatModal, setShowNewCatModal] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [newCatLoading, setNewCatLoading] = useState(false);

    // Arama
    const [searchQuery, setSearchQuery] = useState("");

    // QR
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (profile?.tenant_id) fetchAll();
    }, [profile?.tenant_id]);

    // Kategori ekle (inline)
    const handleSaveCategory = async () => {
        if (!newCatName.trim()) { alert("Kategori adı zorunludur."); return; }
        setNewCatLoading(true);
        try {
            const { data, error } = await supabase.from("equipment_categories").insert([{
                name: newCatName.trim(),
                tenant_id: profile!.tenant_id,
            }]).select().single();
            if (error) throw error;
            setCategories(cats => [...cats, data]);
            setEquipForm(f => ({ ...f, category_id: data.id }));
            setNewCatName("");
            setShowNewCatModal(false);
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setNewCatLoading(false); }
    };
    const fetchAll = async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const [catRes, defRes, equipRes, inspectorRes] = await Promise.all([
                supabase.from("equipment_categories").select("*").eq("tenant_id", profile.tenant_id).order("name"),
                supabase.from("equipment_definitions").select("id, name").eq("tenant_id", profile.tenant_id).order("name"),
                supabase.from("equipments").select("*, equipment_categories(name)").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("created_at", { ascending: false }),
                supabase.from("equipment_inspectors").select("*").eq("tenant_id", profile.tenant_id).order("name"),
            ]);
            setCategories(catRes.data || []);
            setDefinitions(defRes.data || []);
            setInspectors(inspectorRes.data || []);
            setEquipments(equipRes.data || []);
        } finally { setLoading(false); }
    };

    // ===================== HELPERS =====================
    const getDaysUntilInspection = (eq: Equipment) => {
        const target = eq.next_inspection_date;
        if (!target) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const t = new Date(target);
        return Math.ceil((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Auto-generate code: ilk 3 harf (büyük) + sıradaki numara
    const generateCode = async (name: string) => {
        const prefix = name.replace(/[^a-zA-ZÀ-ɏ]/g, "").substring(0, 3).toUpperCase() || "EKP";
        const { data } = await supabase.from("equipments")
            .select("code").eq("tenant_id", profile!.tenant_id).ilike("code", `${prefix}-%`);
        const nums = (data || []).map((r: any) => parseInt(r.code.split("-").pop() || "0")).filter(n => !isNaN(n));
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        return `${prefix}-${String(next).padStart(3, "0")}`;
    };

    // Ekipman sil (soft delete)
    const handleDeleteEquip = async (eq: Equipment) => {
        if (!window.confirm(`"${eq.name}" (${eq.code}) silinsin mi?`)) return;
        await supabase.from("equipments").update({ is_active: false }).eq("id", eq.id);
        fetchAll();
    };

    // Ekipman adı tanımı ekle
    const handleSaveDefinition = async () => {
        if (!newDefName.trim()) return;
        setNewDefLoading(true);
        try {
            const { data, error } = await supabase.from("equipment_definitions").insert([{ name: newDefName.trim(), tenant_id: profile!.tenant_id }]).select().single();
            if (error) throw error;
            setDefinitions(d => [...d, data]);
            const code = await generateCode(data.name);
            setEquipForm(f => ({ ...f, name: data.name, code }));
            setNewDefName(""); setShowNewDefModal(false);
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setNewDefLoading(false); }
    };

    // Ekipman seçilince detail modal aç
    const openDetail = async (eq: Equipment) => {
        setSelectedEquip(eq);
        setDetailTab("overview");
        const [inspRes, locRes, faultRes] = await Promise.all([
            supabase.from("equipment_inspections").select("*, equipment_inspectors(name)").eq("equipment_id", eq.id).order("inspection_date", { ascending: false }),
            supabase.from("equipment_locations").select("*").eq("equipment_id", eq.id).order("created_at", { ascending: false }),
            supabase.from("equipment_fault_reports").select("*").eq("equipment_id", eq.id).order("created_at", { ascending: false }),
        ]);
        setDetailInspections((inspRes.data || []) as Inspection[]);
        setLocationHistory((locRes.data || []) as LocationHistory[]);
        setFaultReports(faultRes.data || []);
        setShowInlineInsp(false);
        setInspForm({ ...defaultInspForm(), equipment_id: eq.id });
        setShowDetailModal(true);
    };

    const resolveFault = async (faultId: string) => {
        if (!window.confirm("Bu arıza/hasar kaydını çözüldü olarak işaretlemek istiyor musunuz?")) return;
        try {
            // Update fault report status
            await supabase.from("equipment_fault_reports").update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolved_by: user!.id
            }).eq("id", faultId);

            // Check if there are any other open faults for this equipment
            const { data: otherFaults } = await supabase.from("equipment_fault_reports")
                .select("id")
                .eq("equipment_id", selectedEquip!.id)
                .eq("status", "open")
                .neq("id", faultId);

            if (!otherFaults || otherFaults.length === 0) {
                // If no other open faults, mark equipment as not damaged
                await supabase.from("equipments").update({
                    is_damaged: false,
                    updated_at: new Date().toISOString()
                }).eq("id", selectedEquip!.id);
                setSelectedEquip({ ...selectedEquip!, is_damaged: false } as Equipment);
                setEquipments(equipments.map(e => e.id === selectedEquip!.id ? { ...e, is_damaged: false } as Equipment : e));
            }

            // Refresh faults list
            const { data: newFaults } = await supabase.from("equipment_fault_reports")
                .select("*")
                .eq("equipment_id", selectedEquip!.id)
                .order("created_at", { ascending: false });
            setFaultReports(newFaults || []);

        } catch (e: any) {
            console.error(e);
            alert("İşlem sırasında bir hata oluştu: " + e.message);
        }
    };

    const getInspStatus = (days: number | null) => {
        if (days === null) return { label: "Bakım yok", color: "bg-gray-100 text-gray-500" };
        if (days < 0) return { label: `${Math.abs(days)} gün gecikmiş`, color: "bg-red-100 text-red-700" };
        if (days === 0) return { label: "Bugün!", color: "bg-red-100 text-red-700" };
        if (days <= 30) return { label: `${days} gün`, color: "bg-yellow-100 text-yellow-700" };
        return { label: `${days} gün`, color: "bg-green-100 text-green-700" };
    };

    const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

    // ===================== QR Download =====================
    const downloadQR = async (eq: Equipment) => {
        const url = `${window.location.origin}/qr/${eq.qr_token}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `QR-${eq.code}-${eq.name}.png`;
        link.click();
    };

    // ===================== EQUIPMENT SAVE =====================
    const handleSaveEquip = async () => {
        if (!equipForm.code || !equipForm.name) { alert("Ekipman kodu ve adı zorunludur."); return; }
        setEquipLoading(true);
        try {
            const period = equipForm.inspection_period_months || RISK_PERIODS[equipForm.risk_level];
            // Boş string olan opsiyonel alanları null'a çevir (PostgreSQL integer/date hatasını önler)
            const strOrNull = (v: string) => v.trim() !== "" ? v.trim() : null;
            const intOrNull = (v: string) => v.trim() !== "" ? parseInt(v.trim(), 10) : null;
            const data = {
                code: equipForm.code.trim(),
                name: equipForm.name.trim(),
                type: strOrNull(equipForm.type),
                serial_no: strOrNull(equipForm.serial_no),
                brand: strOrNull(equipForm.brand),
                model: strOrNull(equipForm.model),
                purpose: strOrNull(equipForm.purpose),
                assigned_to: strOrNull(equipForm.assigned_to),
                default_location: strOrNull(equipForm.default_location),
                current_location: strOrNull(equipForm.current_location) || strOrNull(equipForm.default_location),
                purchase_date: strOrNull(equipForm.purchase_date),
                manufacture_year: intOrNull(equipForm.manufacture_year),
                risk_level: equipForm.risk_level,
                inspection_period_months: period,
                category_id: strOrNull(equipForm.category_id),
                tenant_id: profile!.tenant_id,
                maintenance_required: equipForm.maintenance_required,
                created_by: user!.id,
            };
            if (editingEquip) {
                const { error } = await supabase.from("equipments").update({ ...data, updated_at: new Date().toISOString() }).eq("id", editingEquip.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("equipments").insert([data]);
                if (error) throw error;
            }
            setShowEquipModal(false); setEditingEquip(null); setEquipForm(defaultEquipForm()); fetchAll();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setEquipLoading(false); }
    };


    // ===================== INSPECTION SAVE =====================
    const handleSaveInspection = async () => {
        if (!inspForm.equipment_id || !inspForm.inspection_date || !inspForm.next_inspection_date) {
            alert("Ekipman, kontrol tarihi ve sonraki tarih zorunludur."); return;
        }
        setInspLoading(true);
        try {
            let fileUrl: string | null = null, fileName: string | null = null, fileSize: number | null = null;
            if (selectedFile) {
                if (selectedFile.size > 10 * 1024 * 1024) { alert("Dosya 10MB'yi aşamaz!"); setInspLoading(false); return; }
                const ext = selectedFile.name.split(".").pop();
                const path = `${profile!.tenant_id}/${inspForm.equipment_id}/${Date.now()}.${ext}`;
                const { error: upErr } = await supabase.storage.from("equipment-files").upload(path, selectedFile);
                if (upErr) throw upErr;
                const { data: urlData } = supabase.storage.from("equipment-files").getPublicUrl(path);
                fileUrl = urlData.publicUrl; fileName = selectedFile.name; fileSize = selectedFile.size;
            }
            const { error } = await supabase.from("equipment_inspections").insert([{
                ...inspForm,
                tenant_id: profile!.tenant_id,
                performed_by: user!.id,
                file_url: fileUrl, file_name: fileName, file_size: fileSize,
            }]);
            if (error) throw error;
            // Ekipmanın last/next bakım tarihini güncelle
            await supabase.from("equipments").update({
                last_inspection_date: inspForm.inspection_date,
                next_inspection_date: inspForm.next_inspection_date,
                updated_at: new Date().toISOString(),
            }).eq("id", inspForm.equipment_id);
            // Detail modal açıksa yenile
            if (selectedEquip?.id === inspForm.equipment_id) {
                const { data: newInspData } = await supabase.from("equipment_inspections")
                    .select("*, equipment_inspectors(name)").eq("equipment_id", inspForm.equipment_id)
                    .order("inspection_date", { ascending: false });
                setDetailInspections((newInspData || []) as Inspection[]);
                setSelectedEquip(eq => eq ? { ...eq, last_inspection_date: inspForm.inspection_date, next_inspection_date: inspForm.next_inspection_date } : eq);
            }
            setShowInspModal(false); setShowInlineInsp(false);
            setInspForm(f => ({ ...defaultInspForm(), equipment_id: f.equipment_id }));
            setSelectedFile(null); fetchAll();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setInspLoading(false); }
    };

    // ===================== INSPECTOR SAVE =====================
    const handleSaveInspector = async () => {
        if (!inspectorForm.name) { alert("Ad zorunludur."); return; }
        setInspectorLoading(true);
        try {
            const { error } = await supabase.from("equipment_inspectors").insert([{ ...inspectorForm, tenant_id: profile!.tenant_id }]);
            if (error) throw error;
            setShowInspectorModal(false); setInspectorForm(defaultInspectorForm()); fetchAll();
        } catch (e: any) { alert("Hata: " + e.message); }
        finally { setInspectorLoading(false); }
    };

    // ===================== STATS =====================
    const stats = {
        total: equipments.length,
        overdue: equipments.filter(e => (getDaysUntilInspection(e) ?? 1) < 0).length,
        urgent: equipments.filter(e => { const d = getDaysUntilInspection(e); return d !== null && d >= 0 && d <= 30; }).length,
        ok: equipments.filter(e => (getDaysUntilInspection(e) ?? -1) > 30).length,
        noInspection: equipments.filter(e => e.next_inspection_date === null).length,
    };

    const tabClass = (tab: TabView) =>
        `px-4 py-2 text-sm font-medium rounded-t-md transition ${activeTab === tab
            ? "bg-white text-indigo-700 border border-b-0 border-gray-200"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
        }`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Ekipman Takip</h1>
                    <p className="text-sm text-gray-500 mt-1">6331 İSG Kanunu kapsamında periyodik ekipman bakım takibi</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === "equipments" && (
                        <button onClick={() => { setEditingEquip(null); setEquipForm(defaultEquipForm()); setShowEquipModal(true); }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                            + Ekipman Ekle
                        </button>
                    )}
                    {activeTab === "inspectors" && (
                        <button onClick={() => { setInspectorForm(defaultInspectorForm()); setShowInspectorModal(true); }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                            + Kuruluş/Mühendis Ekle
                        </button>
                    )}
                </div>
            </div>

            {/* Search & Tabs */}
            {/* Search & Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 border-b border-gray-200 pb-1">
                <div className="flex gap-1 overflow-x-auto max-w-full pb-1">
                    <button className={tabClass("dashboard")} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
                    <button className={tabClass("equipments")} onClick={() => setActiveTab("equipments")}>
                        Ekipmanlar {equipments.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{equipments.length}</span>}
                    </button>
                    <button className={tabClass("inspectors")} onClick={() => setActiveTab("inspectors")}>Yetkili Kuruluşlar</button>
                </div>
                {(activeTab === "equipments") && (
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-sm font-medium border border-red-200 hover:bg-red-100 transition">
                            <input type="checkbox" checked={filterDamaged} onChange={e => setFilterDamaged(e.target.checked)} className="rounded text-red-600 focus:ring-red-500 bg-white" />
                            <span>⚠️ Sadece Hasarlılar</span>
                        </label>
                        <div className="relative w-full sm:w-64 mb-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-400">🔍</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-1.5 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {(activeTab === "inspectors") && (
                    <div className="relative w-full sm:w-64 mb-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400">🔍</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-1.5 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center text-gray-400">Yükleniyor...</div>
            ) : (<>

                {/* ===== DASHBOARD ===== */}
                {activeTab === "dashboard" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: "Toplam Ekipman", value: stats.total, color: "border-indigo-500", text: "text-indigo-700" },
                                { label: "Gecikmeli Bakım", value: stats.overdue, color: "border-red-500", text: "text-red-700" },
                                { label: "30 Gün İçinde", value: stats.urgent, color: "border-yellow-500", text: "text-yellow-700" },
                                { label: "Güncel", value: stats.ok, color: "border-green-500", text: "text-green-700" },
                                { label: "Bakım Yok", value: stats.noInspection, color: "border-gray-400", text: "text-gray-600" },
                            ].map(s => (
                                <div key={s.label} className={`bg-white shadow rounded-lg p-4 border-l-4 ${s.color}`}>
                                    <p className="text-sm text-gray-500">{s.label}</p>
                                    <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Yaklaşan bakımlar */}
                        <div className="bg-white shadow rounded-lg p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Yaklaşan & Gecikmeli Bakımlar</h3>
                            {equipments.filter(e => (getDaysUntilInspection(e) ?? 999) <= 60).length === 0 ? (
                                <p className="text-sm text-gray-400">Yakın vadede bakım gereken ekipman yok ✓</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead>
                                            <tr>
                                                {["Kod", "Ekipman", "Risk", "Son Bakım", "Sonraki Bakım", "Durum"].map(h => (
                                                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {equipments
                                                .filter(e => (getDaysUntilInspection(e) ?? 999) <= 60)
                                                .sort((a, b) => (getDaysUntilInspection(a) ?? 999) - (getDaysUntilInspection(b) ?? 999))
                                                .map(eq => {
                                                    const days = getDaysUntilInspection(eq);
                                                    const st = getInspStatus(days);
                                                    return (
                                                        <tr key={eq.id} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 text-xs font-mono text-gray-600">{eq.code}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{eq.name}</td>
                                                            <td className="px-3 py-2"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${RISK_COLORS[eq.risk_level]}`}>{eq.risk_level}</span></td>
                                                            <td className="px-3 py-2 text-sm text-gray-500">{formatDate(eq.last_inspection_date ?? null)}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-500">{formatDate(eq.next_inspection_date ?? null)}</td>
                                                            <td className="px-3 py-2"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${st.color}`}>{st.label}</span></td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Risk Dağılımı */}
                        <div className="grid grid-cols-3 gap-4">
                            {(["yüksek", "orta", "düşük"] as const).map(level => (
                                <div key={level} className="bg-white shadow rounded-lg p-4">
                                    <p className="text-xs uppercase font-semibold text-gray-500 mb-1">{level} Risk</p>
                                    <p className={`text-3xl font-bold ${RISK_COLORS[level].split(" ")[1]}`}>
                                        {equipments.filter(e => e.risk_level === level).length}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Periyot: {RISK_PERIODS[level]} ay (varsayılan)</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== EKİPMANLAR ===== */}
                {activeTab === "equipments" && (
                    equipments.length === 0 ? (
                        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                            <p className="text-lg font-medium">Henüz ekipman eklenmemiş</p>
                            <p className="text-sm mt-1">Ekipman envanterinizi oluşturmak için "Ekipman Ekle" butonunu kullanın.</p>
                        </div>
                    ) : (
                        <div className="bg-white shadow rounded-lg overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {["Kod", "Ekipman Adı", "Tip", "Risk", "Teslim Edilen", "Lokasyon", "Son Bakım", "Durum", "İşlemler"].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {equipments.filter(eq => {
                                        if (filterDamaged && !eq.is_damaged) return false;
                                        if (!searchQuery) return true;
                                        const q = searchQuery.toLowerCase();
                                        return (
                                            eq.name.toLowerCase().includes(q) ||
                                            eq.code.toLowerCase().includes(q) ||
                                            (eq.type && eq.type.toLowerCase().includes(q)) ||
                                            (eq.serial_no && eq.serial_no.toLowerCase().includes(q)) ||
                                            (eq.brand && eq.brand.toLowerCase().includes(q)) ||
                                            (eq.model && eq.model.toLowerCase().includes(q))
                                        );
                                    }).map(eq => {
                                        const days = eq.maintenance_required ? getDaysUntilInspection(eq) : null;
                                        const st = eq.maintenance_required ? getInspStatus(days) : { label: "Gerekmiyor", color: "bg-gray-100 text-gray-400 border-gray-200" };
                                        const lastDate = eq.last_inspection_date || eq.purchase_date;
                                        return (
                                            <tr key={eq.id} className={`hover:bg-gray-50 ${eq.is_damaged ? "bg-red-50/30" : ""}`}>
                                                <td className="px-3 py-3 text-xs font-mono text-gray-600">
                                                    <div className="flex items-center gap-1">
                                                        {eq.is_damaged && <span className="text-red-500" title="Hasarlı/Arızalı">⚠️</span>}
                                                        {eq.code}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-sm font-medium text-gray-900">{eq.name}</td>
                                                <td className="px-3 py-3 text-sm text-gray-500">{eq.type || "—"}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${RISK_COLORS[eq.risk_level]}`}>{eq.risk_level}</span>
                                                </td>
                                                <td className="px-3 py-3 text-sm text-gray-500">{eq.assigned_to || "—"}</td>
                                                <td className="px-3 py-3 text-sm text-gray-500">{eq.current_location || eq.default_location || "—"}</td>
                                                <td className="px-3 py-3 text-sm text-gray-500">{eq.maintenance_required ? formatDate(lastDate ?? null) : "—"}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${st.color}`}>{st.label}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap text-sm space-x-2">
                                                    <button onClick={() => openDetail(eq)}
                                                        className="text-indigo-600 hover:text-indigo-800 font-medium">Detay / Bakım</button>
                                                    <button onClick={() => { setEditingEquip(eq); setEquipForm(equipToForm(eq)); setShowEquipModal(true); }}
                                                        className="text-gray-600 hover:text-gray-800">Düzenle</button>
                                                    <button onClick={() => downloadQR(eq)}
                                                        className="text-green-600 hover:text-green-800">QR</button>
                                                    <button onClick={() => handleDeleteEquip(eq)}
                                                        className="text-red-500 hover:text-red-700">Sil</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {/* ===== YETKİLİ KURULUŞLAR ===== */}
                {activeTab === "inspectors" && (
                    inspectors.length === 0 ? (
                        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                            <p className="text-lg font-medium">Yetkili kuruluş/mühendis eklenmemiş</p>
                        </div>
                    ) : (
                        <div className="bg-white shadow rounded-lg overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {["Ad / Kuruluş", "Tür", "Sertifika No", "Telefon", "E-posta"].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {inspectors.filter(ins => {
                                        if (!searchQuery) return true;
                                        const q = searchQuery.toLowerCase();
                                        return (
                                            ins.name.toLowerCase().includes(q) ||
                                            (ins.certificate_no && ins.certificate_no.toLowerCase().includes(q))
                                        );
                                    }).map(ins => (
                                        <tr key={ins.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-3 text-sm font-medium text-gray-900">{ins.name}</td>
                                            <td className="px-3 py-3">
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ins.type === "kuruluş" ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"}`}>
                                                    {ins.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-500 font-mono">{ins.certificate_no || "—"}</td>
                                            <td className="px-3 py-3 text-sm text-gray-500">{(ins as any).phone || "—"}</td>
                                            <td className="px-3 py-3 text-sm text-gray-500">{(ins as any).email || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </>)}

            {/* ===== MODAL: EKİPMAN EKLE/DÜZENLE ===== */}
            {showEquipModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4 my-8">
                        <h3 className="text-lg font-bold">{editingEquip ? "Ekipman Düzenle" : "Yeni Ekipman Ekle"}</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Ekipman Kodu *" value={equipForm.code} onChange={v => setEquipForm(f => ({ ...f, code: v }))} placeholder="Otomatik üretilir..." />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ekipman Adı *
                                    <span className="ml-1 text-xs text-gray-400 font-normal">(Tanımlı listeden seçin)</span>
                                </label>
                                <div className="flex gap-2">
                                    <select value={equipForm.name}
                                        onChange={async e => {
                                            const name = e.target.value;
                                            if (!name) { setEquipForm(f => ({ ...f, name: "" })); return; }
                                            const code = await generateCode(name);
                                            setEquipForm(f => ({ ...f, name, code }));
                                        }}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">Seçin...</option>
                                        {definitions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                    </select>
                                    <button type="button" onClick={() => { setNewDefName(""); setShowNewDefModal(true); }}
                                        title="Yeni ekipman adı tanımla"
                                        className="px-3 py-2 border border-dashed border-indigo-400 text-indigo-600 rounded-md text-sm hover:bg-indigo-50 font-bold">
                                        +
                                    </button>
                                </div>
                                {showNewDefModal && (
                                    <div className="mt-2 p-3 border border-indigo-200 bg-indigo-50 rounded-md space-y-2">
                                        <p className="text-xs font-medium text-indigo-700">Yeni Ekipman Adı Tanımla</p>
                                        <div className="flex gap-2">
                                            <input type="text" value={newDefName} onChange={e => setNewDefName(e.target.value)}
                                                placeholder="ör. Kompresör, Vinç, Jeneratör..."
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveDefinition(); }}
                                                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                                            <button onClick={handleSaveDefinition} disabled={newDefLoading}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                                                {newDefLoading ? "..." : "Ekle"}
                                            </button>
                                            <button onClick={() => setShowNewDefModal(false)}
                                                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-sm">
                                                İptal
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Field label="Tip" value={equipForm.type} onChange={v => setEquipForm(f => ({ ...f, type: v }))} placeholder="Hava kompresörü" />
                            <Field label="Seri No" value={equipForm.serial_no} onChange={v => setEquipForm(f => ({ ...f, serial_no: v }))} />
                            <Field label="Marka" value={equipForm.brand} onChange={v => setEquipForm(f => ({ ...f, brand: v }))} />
                            <Field label="Model" value={equipForm.model} onChange={v => setEquipForm(f => ({ ...f, model: v }))} />
                            <Field label="Teslim Edilen Kişi/Firma" value={equipForm.assigned_to} onChange={v => setEquipForm(f => ({ ...f, assigned_to: v }))} placeholder="Ahmet Yılmaz / ABC Lojistik" />
                            <Field label="Kullanım Amacı" value={equipForm.purpose} onChange={v => setEquipForm(f => ({ ...f, purpose: v }))} />
                            <Field label="Varsayılan Lokasyon" value={equipForm.default_location} onChange={v => setEquipForm(f => ({ ...f, default_location: v }))} placeholder="Fabrika / Depo A" />
                            <Field label="Satın Alma Tarihi" type="date" value={equipForm.purchase_date} onChange={v => setEquipForm(f => ({ ...f, purchase_date: v }))} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Seviyesi</label>
                                <select value={equipForm.risk_level}
                                    onChange={e => {
                                        const rl = e.target.value as "düşük" | "orta" | "yüksek";
                                        setEquipForm(f => ({ ...f, risk_level: rl, inspection_period_months: RISK_PERIODS[rl] }));
                                    }}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="düşük">Düşük</option>
                                    <option value="orta">Orta</option>
                                    <option value="yüksek">Yüksek</option>
                                </select>
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                    <input type="checkbox" checked={equipForm.maintenance_required}
                                        onChange={e => setEquipForm(f => ({ ...f, maintenance_required: e.target.checked }))}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-gray-700">Periyodik Bakım Gerekli</span>
                                </label>
                                {equipForm.maintenance_required && (
                                    <>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Periyot (ay)</label>
                                        <input type="number" min={1} max={60} value={equipForm.inspection_period_months}
                                            onChange={e => setEquipForm(f => ({ ...f, inspection_period_months: parseInt(e.target.value) || 6 }))}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Kategori
                                    <span className="ml-1 text-xs text-gray-400 font-normal">(vinç, kompresör, elektrik panosu vb.)</span>
                                </label>
                                <div className="flex gap-2">
                                    <select value={equipForm.category_id}
                                        onChange={e => setEquipForm(f => ({ ...f, category_id: e.target.value }))}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">Seçin...</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <button type="button" onClick={() => { setNewCatName(""); setShowNewCatModal(true); }}
                                        title="Yeni kategori ekle"
                                        className="px-3 py-2 border border-dashed border-indigo-400 text-indigo-600 rounded-md text-sm hover:bg-indigo-50 font-bold">
                                        +
                                    </button>
                                </div>
                                {showNewCatModal && (
                                    <div className="mt-2 p-3 border border-indigo-200 bg-indigo-50 rounded-md space-y-2">
                                        <p className="text-xs font-medium text-indigo-700">Yeni Kategori Ekle</p>
                                        <div className="flex gap-2">
                                            <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                                                placeholder="ör. Kaldırma Araçları, Basınçlı Ekipmanlar..."
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveCategory(); }}
                                                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                                            <button onClick={handleSaveCategory} disabled={newCatLoading}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                                                {newCatLoading ? "..." : "Kaydet"}
                                            </button>
                                            <button onClick={() => setShowNewCatModal(false)}
                                                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-sm">
                                                İptal
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t">
                            <button onClick={() => { setShowEquipModal(false); setEditingEquip(null); }}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">İptal</button>
                            <button onClick={handleSaveEquip} disabled={equipLoading}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {equipLoading ? "Kaydediliyor..." : editingEquip ? "Güncelle" : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: BAKIM KAYDI ===== */}
            {showInspModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-4 my-8">
                        <h3 className="text-lg font-bold">Periyodik Bakım / Kontrol Kaydı</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ekipman *</label>
                            <select value={inspForm.equipment_id} onChange={e => setInspForm(f => ({ ...f, equipment_id: e.target.value }))}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">Seçin...</option>
                                {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.code} — {eq.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Kontrol Tarihi *" type="date" value={inspForm.inspection_date} onChange={v => setInspForm(f => ({ ...f, inspection_date: v }))} />
                            <Field label="Sonraki Kontrol Tarihi *" type="date" value={inspForm.next_inspection_date} onChange={v => setInspForm(f => ({ ...f, next_inspection_date: v }))} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Yetkili Kuruluş / Mühendis</label>
                            <select value={inspForm.inspector_id} onChange={e => setInspForm(f => ({ ...f, inspector_id: e.target.value }))}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">Listeden seç...</option>
                                {inspectors.map(ins => <option key={ins.id} value={ins.id}>{ins.name}</option>)}
                            </select>
                        </div>
                        <Field label="Yetkili (serbest metin)" value={inspForm.inspector_name_override} onChange={v => setInspForm(f => ({ ...f, inspector_name_override: v }))} placeholder="Listede yoksa buraya yazın" />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sonuç</label>
                            <select value={inspForm.result} onChange={e => setInspForm(f => ({ ...f, result: e.target.value as any }))}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="uygun">Uygun</option>
                                <option value="koşullu uygun">Koşullu Uygun</option>
                                <option value="uygunsuz">Uygunsuz</option>
                            </select>
                        </div>

                        <Field label="Notlar" value={inspForm.notes} onChange={v => setInspForm(f => ({ ...f, notes: v }))} placeholder="Gözlemler, notlar..." />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Belge Yükle (Max 10MB)</label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t">
                            <button onClick={() => { setShowInspModal(false); setSelectedFile(null); }}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">İptal</button>
                            <button onClick={handleSaveInspection} disabled={inspLoading}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {inspLoading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: YETKİLİ KURULUŞ ===== */}
            {showInspectorModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold">Kuruluş / Mühendis Ekle</h3>

                        <Field label="Ad / Kuruluş Adı *" value={inspectorForm.name} onChange={v => setInspectorForm(f => ({ ...f, name: v }))} />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tür</label>
                            <select value={inspectorForm.type} onChange={e => setInspectorForm(f => ({ ...f, type: e.target.value as any }))}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="kuruluş">A Tipi Muayene Kuruluşu</option>
                                <option value="mühendis">Sertifikalı Mühendis</option>
                            </select>
                        </div>
                        <Field label="Sertifika / Yetki Belgesi No" value={inspectorForm.certificate_no} onChange={v => setInspectorForm(f => ({ ...f, certificate_no: v }))} />
                        <Field label="Telefon" value={inspectorForm.phone} onChange={v => setInspectorForm(f => ({ ...f, phone: v }))} />
                        <Field label="E-posta" value={inspectorForm.email} onChange={v => setInspectorForm(f => ({ ...f, email: v }))} />
                        <Field label="Notlar" value={inspectorForm.notes} onChange={v => setInspectorForm(f => ({ ...f, notes: v }))} />

                        <div className="flex justify-end gap-3 pt-2 border-t">
                            <button onClick={() => setShowInspectorModal(false)}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">İptal</button>
                            <button onClick={handleSaveInspector} disabled={inspectorLoading}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {inspectorLoading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: EKİPMAN DETAY & GEÇMİŞ ===== */}
            {showDetailModal && selectedEquip && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50 overflow-hidden">
                    <div className="w-full max-w-md bg-white h-full shadow-xl overflow-y-auto flex flex-col animate-slide-in-right">
                        <div className="p-4 border-b flex justify-between items-start bg-gray-50 sticky top-0 z-10">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-gray-900">{selectedEquip.name}</h2>
                                    {selectedEquip.is_damaged && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">HASARLI</span>}
                                </div>
                                <p className="text-sm font-mono text-gray-500">{selectedEquip.code}</p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="flex border-b border-gray-200 sticky top-[73px] bg-white z-10 overflow-x-auto">
                            {[
                                { id: "overview", label: "Genel Bakış" },
                                { id: "maintenance", label: "Bakım Geçmişi" },
                                { id: "faults", label: `Hasarlar ${faultReports.length > 0 ? `(${faultReports.length})` : ""}` },
                                { id: "location", label: "Konum Geçmişi" }
                            ].map(tab => (
                                <button key={tab.id}
                                    onClick={() => setDetailTab(tab.id as any)}
                                    className={`flex-none px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${detailTab === tab.id ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                            {detailTab === "overview" && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* Özet Kartı */}
                                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 shadow-sm">
                                        {(() => {
                                            const days = selectedEquip.maintenance_required ? (selectedEquip.next_inspection_date ? getDaysUntilInspection(selectedEquip) : null) : null;
                                            const st = selectedEquip.maintenance_required ? getInspStatus(days) : { label: "Gerekmiyor", color: "bg-gray-200 text-gray-600 border-gray-300" };
                                            const borderColor = st.color.includes("border-") ? "" : st.color.replace("bg-", "border-").replace("text-", "text-");
                                            return (
                                                <>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-medium text-indigo-900">Bakıma Kalan Süre</span>
                                                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold bg-white border ${borderColor} ${st.color.replace("bg-", "text-")}`}>
                                                            {st.label}
                                                        </span>
                                                    </div>
                                                    <div className="text-3xl font-bold text-indigo-700 mb-1">
                                                        {selectedEquip.maintenance_required ? (days ?? "—") : "—"} <span className="text-base font-normal text-indigo-500">gün</span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-indigo-100/50">
                                                        <p className="text-xs text-indigo-400">Sonraki Planlanan</p>
                                                        <p className="text-sm font-medium text-indigo-800">{selectedEquip.maintenance_required ? formatDate(selectedEquip.next_inspection_date || null) : "—"}</p>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* Ekipman Künye */}
                                    <div className="space-y-3 text-sm">
                                        <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                                            <span>📋</span> Künye Bilgileri
                                        </h3>
                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-gray-600">
                                            <div className="flex flex-col"><span className="text-xs text-gray-400">Marka / Model</span><span className="text-gray-900 font-medium">{selectedEquip.brand || "—"} / {selectedEquip.model || "—"}</span></div>
                                            <div className="flex flex-col"><span className="text-xs text-gray-400">Seri No</span><span className="text-gray-900 font-medium font-mono">{selectedEquip.serial_no || "—"}</span></div>
                                            <div className="flex flex-col"><span className="text-xs text-gray-400">Tür</span><span className="text-gray-900 font-medium">{selectedEquip.type || "—"}</span></div>
                                            <div className="flex flex-col"><span className="text-xs text-gray-400">Üretim Yılı</span><span className="text-gray-900 font-medium">{selectedEquip.manufacture_year || "—"}</span></div>
                                            <div className="flex flex-col"><span className="text-xs text-gray-400">Satın Alma</span><span className="text-gray-900 font-medium">{formatDate(selectedEquip.purchase_date)}</span></div>
                                            <div className="flex flex-col"><span className="text-xs text-gray-400">Risk Seviyesi</span><span className={`font-medium w-max px-2 rounded ${RISK_COLORS[selectedEquip.risk_level]}`}>{selectedEquip.risk_level.toUpperCase()}</span></div>
                                            <div className="flex flex-col col-span-2"><span className="text-xs text-gray-400">Zimmet</span><span className="text-gray-900 font-medium">{selectedEquip.assigned_to || "—"}</span></div>
                                            <div className="flex flex-col col-span-2"><span className="text-xs text-gray-400">Güncel Konum</span><span className="text-gray-900 font-medium">{selectedEquip.current_location || selectedEquip.default_location || "—"}</span></div>
                                        </div>
                                    </div>

                                    {/* QR İndir Butonu */}
                                    <div className="pt-2">
                                        <button onClick={() => downloadQR(selectedEquip)} className="w-full flex justify-center items-center gap-2 border border-gray-200 bg-gray-50 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition shadow-sm">
                                            <span>📱</span> QR Kodunu İndir
                                        </button>
                                    </div>
                                </div>
                            )}

                            {detailTab === "maintenance" && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center sticky top-0 bg-white z-10 pb-2 border-b">
                                        <h3 className="font-semibold text-gray-900">Bakım Kayıtları</h3>
                                        {!showInlineInsp && (
                                            <button onClick={() => setShowInlineInsp(true)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-medium hover:bg-indigo-100 transition border border-indigo-100">
                                                + Kayıt Ekle
                                            </button>
                                        )}
                                    </div>

                                    {showInlineInsp && (
                                        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-md ring-4 ring-indigo-50/50 animate-slide-down">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-bold text-gray-800">Yeni Bakım Kaydı</h4>
                                                <button onClick={() => setShowInlineInsp(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tarih</label>
                                                        <input type="date" value={inspForm.inspection_date} onChange={e => setInspForm(f => ({ ...f, inspection_date: e.target.value }))}
                                                            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Sonuç</label>
                                                        <select value={inspForm.result} onChange={e => setInspForm(f => ({ ...f, result: e.target.value as any }))}
                                                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                                                            <option value="uygun">Uygun</option>
                                                            <option value="koşullu uygun">Koşullu Uygun</option>
                                                            <option value="uygunsuz">Uygunsuz</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <Field label="Kontrol Eden (Liste)" as="select" value={inspForm.inspector_id} onChange={v => setInspForm(f => ({ ...f, inspector_id: v }))}>
                                                    <option value="">Seçiniz...</option>
                                                    {inspectors.map(i => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
                                                </Field>
                                                {!inspForm.inspector_id && (
                                                    <Field label="veya Harici Uzman Adı" value={inspForm.inspector_name_override} onChange={v => setInspForm(f => ({ ...f, inspector_name_override: v }))} />
                                                )}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Notlar</label>
                                                    <textarea rows={2} value={inspForm.notes} onChange={e => setInspForm(f => ({ ...f, notes: e.target.value }))}
                                                        className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Yapılan işlemler..." />
                                                </div>
                                                <div className="pt-2">
                                                    <button onClick={handleSaveInspection} disabled={inspLoading} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm">
                                                        {inspLoading ? "Kaydediliyor..." : "Kaydet ve Tamamla"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4 relative pl-2">
                                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100 rounded-full"></div>
                                        {detailInspections.length === 0 ? (
                                            <p className="text-center text-sm text-gray-400 py-8 italic bg-gray-50 rounded-lg border border-dashed">Henüz bakım kaydı yok.</p>
                                        ) : (
                                            detailInspections.map(insp => (
                                                <div key={insp.id} className="relative pl-8 group">
                                                    <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 bg-white z-10 transition-transform group-hover:scale-110 ${insp.result === "uygun" ? "border-green-500" : insp.result === "koşullu uygun" ? "border-yellow-500" : "border-red-500"}`}></div>
                                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group-hover:border-indigo-100">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-sm font-bold text-gray-900">{formatDate(insp.inspection_date)}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide ${insp.result === "uygun" ? "bg-green-100 text-green-700" : insp.result === "koşullu uygun" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{insp.result}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                                            <span>👤</span> {insp.inspector_name_override || (insp.equipment_inspectors as any)?.name || "—"}
                                                        </p>
                                                        {insp.notes && <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg italic border border-gray-100">"{insp.notes}"</div>}
                                                        {insp.file_url && (
                                                            <a href={insp.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded">
                                                                <span>📄</span> {insp.file_name?.substring(0, 15) || "Belge"}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {detailTab === ("faults" as any) && (
                                <div className="space-y-4 animate-fade-in">
                                    <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                                        <span>⚠️</span> Hasar & Arıza Bildirimleri
                                    </h3>

                                    {faultReports.length === 0 ? (
                                        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <div className="text-4xl mb-2">✅</div>
                                            <p className="text-sm text-gray-600 font-medium mb-1">Hasar kaydı bulunmamaktadır.</p>
                                            <p className="text-xs text-gray-400">Bu ekipman için sahadan bildirilmiş bir arıza yok.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {faultReports.map((report) => (
                                                <div key={report.id} className={`p-4 rounded-xl border shadow-sm ${report.status === 'open' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                            {report.status === 'open' ? 'AÇIK ARIZA' : 'ÇÖZÜLDÜ'}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-medium">
                                                            {new Date(report.created_at).toLocaleDateString('tr-TR')}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-gray-800 font-medium mb-3">
                                                        "{report.description}"
                                                    </p>

                                                    <div className="text-xs text-gray-500 space-y-1 mb-3">
                                                        <div className="flex items-center gap-1"><span>👤</span> Bildiren: {report.reported_by_name || "Bilinmiyor"}</div>
                                                        <div className="flex items-center gap-1"><span>📍</span> Konum: {report.location || "Bilinmiyor"}</div>
                                                    </div>

                                                    {report.status === 'open' ? (
                                                        <button
                                                            onClick={() => resolveFault(report.id)}
                                                            className="w-full bg-white border border-gray-300 text-gray-700 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm"
                                                        >
                                                            Aksiyon Alındı / Çözüldü İşaretle
                                                        </button>
                                                    ) : (
                                                        <div className="bg-white border text-center border-green-200 text-green-700 py-1.5 rounded-lg text-xs font-medium bg-opacity-50">
                                                            Çözüldü Olarak İşaretlendi ({new Date(report.resolved_at).toLocaleDateString('tr-TR')})
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {detailTab === "location" && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* Map Embed */}
                                    {selectedEquip.current_location && (
                                        <div className="rounded-xl overflow-hidden border border-gray-200 h-48 bg-gray-100 relative shadow-sm">
                                            <iframe
                                                width="100%"
                                                height="100%"
                                                frameBorder="0"
                                                scrolling="no"
                                                src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedEquip.current_location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                                className="grayscale-[20%] hover:grayscale-0 transition-all duration-500"
                                            ></iframe>
                                            <div className="absolute bottom-0 left-0 right-0 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 truncate border-t backdrop-blur-sm flex items-center gap-2">
                                                <span className="text-red-500">📍</span> {selectedEquip.current_location}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                                            <span>🗺️</span> Konum Geçmişi
                                        </h3>
                                        <div className="space-y-0 relative pl-2">
                                            <div className="absolute left-[7px] top-2 bottom-4 w-0.5 bg-gray-200"></div>
                                            {locationHistory.length === 0 ? (
                                                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                    <p className="text-sm text-gray-500 mb-1">Henüz konum kaydı yok.</p>
                                                    <p className="text-xs text-gray-400">QR kod okutulduğunda konumlar buraya eklenecek.</p>
                                                </div>
                                            ) : (
                                                locationHistory.map((loc, i) => (
                                                    <div key={loc.id} className="relative pl-6 pb-6 last:pb-0 group">
                                                        <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 z-10 transition-all ${i === 0 ? "bg-indigo-600 border-indigo-100 ring-4 ring-indigo-50" : "bg-white border-gray-300"}`}></div>
                                                        <div className={`${i === 0 ? "opacity-100" : "opacity-70 group-hover:opacity-100"} transition-opacity`}>
                                                            <p className="text-sm font-medium text-gray-900 leading-none mb-1">{loc.location}</p>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                <span>🕒 {new Date(loc.created_at).toLocaleString("tr-TR")}</span>
                                                                <span>•</span>
                                                                <span>👤 {loc.scanned_by || "Sistem"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* hidden canvas for QR */}
            <canvas ref={qrCanvasRef} className="hidden" />
        </div>
    );
}

// ===================== HELPERS =====================
function Field({ label, value, onChange, placeholder, type = "text", children, as }: {
    label: string; value: string | undefined; onChange: (v: string) => void; placeholder?: string; type?: string; children?: React.ReactNode; as?: "input" | "select";
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            {as === "select" ? (
                <select value={value || ""} onChange={e => onChange(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    {children}
                </select>
            ) : (
                <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            )}
        </div>
    );
}

type RiskLevel = "düşük" | "orta" | "yüksek";
type EquipForm = { code: string; name: string; type: string; serial_no: string; brand: string; model: string; purpose: string; assigned_to: string; default_location: string; current_location: string; purchase_date: string; manufacture_year: string; risk_level: RiskLevel; inspection_period_months: number; category_id: string; maintenance_required: boolean; };

function defaultEquipForm(): EquipForm {
    return { code: "", name: "", type: "", serial_no: "", brand: "", model: "", purpose: "", assigned_to: "", default_location: "", current_location: "", purchase_date: "", manufacture_year: "", risk_level: "orta", inspection_period_months: 6, category_id: "", maintenance_required: true };
}
function equipToForm(eq: Equipment): EquipForm {
    return { code: eq.code, name: eq.name, type: eq.type || "", serial_no: eq.serial_no || "", brand: eq.brand || "", model: eq.model || "", purpose: eq.purpose || "", assigned_to: eq.assigned_to || "", default_location: eq.default_location || "", current_location: eq.current_location || "", purchase_date: eq.purchase_date || "", manufacture_year: String(eq.manufacture_year || ""), risk_level: eq.risk_level, inspection_period_months: eq.inspection_period_months, category_id: eq.category_id || "", maintenance_required: eq.maintenance_required ?? true };
}
function defaultInspForm() {
    return { equipment_id: "", inspection_date: "", next_inspection_date: "", inspector_id: "", inspector_name_override: "", result: "uygun" as const, notes: "" };
}
function defaultInspectorForm() {
    return { name: "", type: "kuruluş" as const, certificate_no: "", phone: "", email: "", notes: "" };
}
