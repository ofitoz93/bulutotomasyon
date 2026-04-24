import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { 
    Zap, 
    Users, 
    Maximize, 
    TrendingUp, 
    AlertTriangle, 
    Plus, 
    Search,
    MapPin,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    MoreVertical,
    Trash2,
    Edit2,
    Download,
    Activity
} from "lucide-react";

// ===================== TYPES =====================
interface EnergyLocation {
    id: string;
    name: string;
    total_area_m2: number | null;
    personnel_capacity: number | null;
    target_reduction_percent: number | null;
}

interface EnergyConsumptionRecord {
    id: string;
    location_id: string;
    period_month: number;
    period_year: number;
    consumption_kwh: number;
    headcount: number;
    total_cost: number | null;
    created_at: string;
    energy_locations: { name: string; total_area_m2: number | null } | null;
}

// ===================== COMPONENTS =====================
const Card = ({ title, value, sub, icon, trend, trendUp }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${trendUp ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </div>
            )}
        </div>
        <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</h3>
        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{value}</div>
        <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-tighter">{sub}</p>
    </div>
);

const Modal = ({ title, children, onClose, onSave, saving }: any) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <Trash2 className="w-5 h-5 text-slate-400" />
                </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto">
                {children}
            </div>
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                <button 
                    onClick={onClose}
                    className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                    Vazgeç
                </button>
                <button 
                    onClick={onSave}
                    disabled={saving}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
                >
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
            </div>
        </div>
    </div>
);

export default function EnergyManagementPage() {
    const { profile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<EnergyLocation[]>([]);
    const [records, setRecords] = useState<EnergyConsumptionRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"dashboard" | "records" | "locations">("dashboard");

    // Filter States
    const [filterYear, setFilterYear] = useState<string>("all");
    const [filterMonth, setFilterMonth] = useState<string>("all");
    const [filterLocation, setFilterLocation] = useState<string>("all");

    // Modal States
    const [showLocModal, setShowLocModal] = useState(false);
    const [showRecModal, setShowRecModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingLoc, setEditingLoc] = useState<EnergyLocation | null>(null);
    const [editingRec, setEditingRec] = useState<EnergyConsumptionRecord | null>(null);
    const [dashboardYears, setDashboardYears] = useState<string[]>([new Date().getFullYear().toString()]);
    const [dashboardLocationIds, setDashboardLocationIds] = useState<string[]>(["all"]);

    // Form States
    const [locForm, setLocForm] = useState({ name: "", total_area_m2: "", personnel_capacity: "", target_reduction_percent: "5" });
    const [recForm, setRecForm] = useState({ 
        location_id: "", 
        period_month: new Date().getMonth() + 1, 
        period_year: new Date().getFullYear(),
        consumption_kwh: "",
        headcount: "",
        total_cost: ""
    });

    const [bulkForm, setBulkForm] = useState({
        location_id: "",
        year: new Date().getFullYear(),
        months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            consumption_kwh: "",
            headcount: "",
            total_cost: ""
        }))
    });

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchAll();
        }
    }, [profile?.tenant_id]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [locRes, recRes] = await Promise.all([
                supabase.from("energy_locations").select("*").eq("tenant_id", profile!.tenant_id).order("name"),
                supabase.from("energy_consumption_records").select("*, energy_locations(name, total_area_m2)").eq("tenant_id", profile!.tenant_id).order("period_year", { ascending: false }).order("period_month", { ascending: false })
            ]);

            setLocations(locRes.data || []);
            setRecords(recRes.data || []);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLocation = async () => {
        if (!locForm.name) return;
        setSaving(true);
        try {
            const data = {
                ...locForm,
                total_area_m2: locForm.total_area_m2 ? parseFloat(locForm.total_area_m2) : null,
                personnel_capacity: locForm.personnel_capacity ? parseInt(locForm.personnel_capacity) : null,
                target_reduction_percent: locForm.target_reduction_percent ? parseFloat(locForm.target_reduction_percent) : 5,
                tenant_id: profile!.tenant_id
            };

            if (editingLoc) {
                const { error } = await supabase.from("energy_locations").update(data).eq("id", editingLoc.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("energy_locations").insert([data]);
                if (error) throw error;
            }

            setShowLocModal(false);
            setEditingLoc(null);
            setLocForm({ name: "", total_area_m2: "", personnel_capacity: "", target_reduction_percent: "5" });
            fetchAll();
        } catch (e: any) {
            alert("Hata: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLocation = async (id: string) => {
        if (!window.confirm("Bu lokasyonu ve tüm tüketim kayıtlarını silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("energy_locations").delete().eq("id", id);
            if (error) throw error;
            fetchAll();
        } catch (e: any) {
            alert("Hata: " + e.message);
        }
    };

    const handleSaveRecord = async () => {
        if (!recForm.location_id || !recForm.consumption_kwh || !recForm.headcount) return;
        setSaving(true);
        try {
            const data = {
                ...recForm,
                consumption_kwh: parseFloat(recForm.consumption_kwh),
                headcount: parseInt(recForm.headcount),
                total_cost: recForm.total_cost ? parseFloat(recForm.total_cost) : null,
                tenant_id: profile!.tenant_id
            };

            if (editingRec) {
                const { error } = await supabase.from("energy_consumption_records").update(data).eq("id", editingRec.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("energy_consumption_records").insert([data]);
                if (error) throw error;
            }

            setShowRecModal(false);
            setEditingRec(null);
            setRecForm({ ...recForm, consumption_kwh: "", headcount: "", total_cost: "" });
            fetchAll();
        } catch (e: any) {
            alert("Hata: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!window.confirm("Bu tüketim kaydını silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("energy_consumption_records").delete().eq("id", id);
            if (error) throw error;
            fetchAll();
        } catch (e: any) {
            alert("Hata: " + e.message);
        }
    };

    const handleSaveBulk = async () => {
        if (!bulkForm.location_id) return;
        setSaving(true);
        try {
            const recordsToSave = bulkForm.months
                .filter(m => m.consumption_kwh !== "" && m.headcount !== "")
                .map(m => ({
                    tenant_id: profile!.tenant_id,
                    location_id: bulkForm.location_id,
                    period_year: bulkForm.year,
                    period_month: m.month,
                    consumption_kwh: parseFloat(m.consumption_kwh),
                    headcount: parseInt(m.headcount),
                    total_cost: m.total_cost ? parseFloat(m.total_cost) : null
                }));

            if (recordsToSave.length === 0) {
                alert("Lütfen en az bir ay için veri giriniz.");
                return;
            }

            const { error } = await supabase
                .from("energy_consumption_records")
                .upsert(recordsToSave, { onConflict: 'location_id, period_year, period_month' });

            if (error) throw error;

            setShowBulkModal(false);
            alert(`${recordsToSave.length} aylık veri başarıyla kaydedildi.`);
            fetchAll();
        } catch (e: any) {
            alert("Hata: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleYear = (y: string) => {
        if (y === "all") {
            setDashboardYears(["all"]);
        } else {
            let newYears = dashboardYears.includes("all") ? [] : [...dashboardYears];
            if (newYears.includes(y)) {
                if (newYears.length > 1) setDashboardYears(newYears.filter(item => item !== y));
            } else {
                if (newYears.length < 3) setDashboardYears([...newYears, y]);
            }
        }
    };

    const toggleLocation = (id: string) => {
        if (id === "all") {
            setDashboardLocationIds(["all"]);
        } else {
            let newIds = dashboardLocationIds.includes("all") ? [] : [...dashboardLocationIds];
            if (newIds.includes(id)) {
                if (newIds.length > 1) setDashboardLocationIds(newIds.filter(item => item !== id));
            } else {
                if (newIds.length < 3) setDashboardLocationIds([...newIds, id]);
            }
        }
    };

    const dashboardRecords = records.filter(r => {
        const yearMatch = dashboardYears.includes("all") || dashboardYears.includes(r.period_year.toString());
        const locMatch = dashboardLocationIds.includes("all") || dashboardLocationIds.includes(r.location_id);
        return yearMatch && locMatch;
    });

    const totalConsumption = dashboardRecords.reduce((acc, curr) => acc + curr.consumption_kwh, 0);
    const avgEfficiency = dashboardRecords.length > 0 
        ? (dashboardRecords.reduce((acc, curr) => acc + (curr.consumption_kwh / curr.headcount / 30), 0)).toFixed(1)
        : "0";

    // Target Logic
    const currentYearNum = dashboardYears.includes("all") ? new Date().getFullYear() : Number(dashboardYears[0]);
    const prevYearNum = currentYearNum - 1;
    
    const prevYearRecords = records.filter(r => {
        const yearMatch = r.period_year === prevYearNum;
        const locMatch = dashboardLocationIds.includes("all") || dashboardLocationIds.some(id => id === r.location_id);
        return yearMatch && locMatch;
    });

    let targetConsumption = 0;
    if (!dashboardLocationIds.includes("all")) {
        dashboardLocationIds.forEach(id => {
            const loc = locations.find(l => l.id === id);
            const reduction = loc?.target_reduction_percent || 5;
            const locPrevYearTotal = prevYearRecords.filter(r => r.location_id === id).reduce((acc, curr) => acc + curr.consumption_kwh, 0);
            targetConsumption += locPrevYearTotal * (1 - reduction / 100);
        });
    } else {
        locations.forEach(loc => {
            const locPrevYearTotal = prevYearRecords.filter(r => r.location_id === loc.id).reduce((acc, curr) => acc + curr.consumption_kwh, 0);
            const reduction = loc.target_reduction_percent || 5;
            targetConsumption += locPrevYearTotal * (1 - reduction / 100);
        });
    }

    const savingsRate = targetConsumption > 0 
        ? (((targetConsumption - totalConsumption) / targetConsumption) * 100).toFixed(1)
        : null;

    const prevYearAvgEfficiency = prevYearRecords.length > 0
        ? prevYearRecords.reduce((acc, curr) => acc + (curr.consumption_kwh / curr.headcount / 30), 0) / prevYearRecords.length
        : 0;
    
    let targetEfficiency = 0;
    const activeReductions = dashboardLocationIds.includes("all") 
        ? locations.map(l => l.target_reduction_percent || 5)
        : dashboardLocationIds.map(id => locations.find(l => l.id === id)?.target_reduction_percent || 5);
    const avgReduction = activeReductions.length > 0 ? activeReductions.reduce((a, b) => a + b, 0) / activeReductions.length : 5;
    targetEfficiency = prevYearAvgEfficiency * (1 - avgReduction / 100);

    // Chart Comparison Logic
    const chartColors = ["bg-yellow-500", "bg-emerald-500", "bg-indigo-500", "bg-orange-500", "bg-rose-500"];
    
    const monthlySeries = Array.from({ length: 12 }).map((_, i) => {
        const month = i + 1;
        const monthName = new Date(2000, i).toLocaleDateString("tr-TR", { month: "short" });
        
        const seriesItems: { label: string; value: number; color: string }[] = [];

        if (dashboardYears.length > 1 && (dashboardLocationIds.length === 1)) {
            dashboardYears.forEach((y, idx) => {
                const val = records
                    .filter(r => r.period_year.toString() === y && r.period_month === month && (dashboardLocationIds.includes("all") || dashboardLocationIds.includes(r.location_id)))
                    .reduce((acc, curr) => acc + Number(curr.consumption_kwh), 0);
                seriesItems.push({ label: `${y}`, value: val, color: chartColors[idx % chartColors.length] });
            });
        } else if (dashboardLocationIds.length > 1 && (dashboardYears.length === 1)) {
            dashboardLocationIds.filter(id => id !== "all").forEach((id, idx) => {
                const locName = locations.find(l => l.id === id)?.name || "Bilinmeyen";
                const val = records
                    .filter(r => r.location_id === id && r.period_month === month && (dashboardYears.includes("all") || dashboardYears.includes(r.period_year.toString())))
                    .reduce((acc, curr) => acc + Number(curr.consumption_kwh), 0);
                seriesItems.push({ label: locName, value: val, color: chartColors[idx % chartColors.length] });
            });
        } else {
            const val = records
                .filter(r => {
                    const yearMatch = dashboardYears.includes("all") || dashboardYears.includes(r.period_year.toString());
                    const monthMatch = r.period_month === month;
                    const locMatch = dashboardLocationIds.includes("all") || dashboardLocationIds.includes(r.location_id);
                    return yearMatch && monthMatch && locMatch;
                })
                .reduce((acc, curr) => acc + Number(curr.consumption_kwh), 0);
            seriesItems.push({ label: "Tüketim", value: val, color: chartColors[0] });
        }

        return { monthName, seriesItems };
    });

    const monthlySeriesWithVariance = monthlySeries.map(m => {
        let variance: { val: number; type: 'up' | 'down' } | null = null;
        if (m.seriesItems.length >= 2) {
            const v1 = m.seriesItems[0].value;
            const v2 = m.seriesItems[1].value;
            if (v1 > 0) {
                const diff = ((v2 - v1) / v1) * 100;
                variance = { 
                    val: Math.abs(diff), 
                    type: diff > 0 ? 'up' : 'down' 
                };
            }
        }
        return { ...m, variance };
    });

    const maxChartVal = Math.max(...monthlySeries.flatMap(m => m.seriesItems.map(s => s.value)), 1);

    const filteredRecords = records.filter(r => {
        const matchesSearch = searchQuery === "" || 
            r.energy_locations?.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesYear = filterYear === "all" || r.period_year.toString() === filterYear;
        const matchesMonth = filterMonth === "all" || r.period_month.toString() === filterMonth;
        const matchesLocation = filterLocation === "all" || r.location_id === filterLocation;
        return matchesSearch && matchesYear && matchesMonth && matchesLocation;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-yellow-500 rounded-xl shadow-lg shadow-yellow-500/20">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        Enerji Yönetimi ve Verimlilik
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Elektrik tüketim analizi, tasarruf hedefleri ve karbon ayak izi takibi
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowLocModal(true)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Lokasyon Ekle
                    </button>
                    <button onClick={() => setShowBulkModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Yıllık Toplu Giriş
                    </button>
                    <button onClick={() => setShowRecModal(true)} className="bg-yellow-500 hover:bg-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-yellow-500/20 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Veri Girişi
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 scrollbar-hide overflow-x-auto">
                <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === "dashboard" ? "border-yellow-500 text-yellow-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    <TrendingUp className="w-4 h-4" /> Özet Panel
                </button>
                <button onClick={() => setActiveTab("records")} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === "records" ? "border-yellow-500 text-yellow-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    <Activity className="w-4 h-4" /> Tüketim Kayıtları
                </button>
                <button onClick={() => setActiveTab("locations")} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === "locations" ? "border-yellow-500 text-yellow-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    <MapPin className="w-4 h-4" /> Lokasyonlar
                </button>
            </div>

            {/* Dashboard View */}
            {activeTab === "dashboard" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Filters */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Filter className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Dashboard Karşılaştırma ve Filtreler</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Yıl Seçimi (Maks. 3)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => toggleYear("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardYears.includes("all") ? "bg-yellow-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>Tümü</button>
                                    {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => (
                                        <button key={y} onClick={() => toggleYear(y)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardYears.includes(y) ? "bg-yellow-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>{y}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasyon Seçimi (Maks. 3)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => toggleLocation("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardLocationIds.includes("all") ? "bg-yellow-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>Tümü</button>
                                    {locations.map(l => (
                                        <button key={l.id} onClick={() => toggleLocation(l.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardLocationIds.includes(l.id) ? "bg-yellow-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>{l.name}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card title="Toplam Tüketim (kWh)" value={totalConsumption.toLocaleString()} sub={targetConsumption > 0 ? `Hedef: ${Math.round(targetConsumption).toLocaleString()} kWh` : "Önceki yıl verisi yok"} icon={<Zap className="w-5 h-5 text-yellow-500" />} trend={targetConsumption > 0 ? (totalConsumption <= targetConsumption ? "Hedefte" : "Aşıldı") : undefined} trendUp={targetConsumption > 0 ? totalConsumption > targetConsumption : false} />
                        <Card title="Ort. Verimlilik" value={`${avgEfficiency} kWh`} sub={targetEfficiency > 0 ? `Hedef: ${targetEfficiency.toFixed(1)} kWh` : "Kişi / Gün"} icon={<Users className="w-5 h-5 text-emerald-500" />} trend={targetEfficiency > 0 ? (parseFloat(avgEfficiency) <= targetEfficiency ? "İyi" : "Yüksek") : undefined} trendUp={targetEfficiency > 0 ? parseFloat(avgEfficiency) > targetEfficiency : false} />
                        <Card title="Aktif Lokasyonlar" value={locations.length.toString()} sub="Takip Edilen" icon={<MapPin className="w-5 h-5 text-amber-500" />} />
                        <Card title="Tasarruf Oranı" value={savingsRate !== null ? `%${savingsRate}` : "—"} sub={targetConsumption > 0 ? `Tasarruf Hedefi: %${avgReduction.toFixed(1)}` : "Önceki yıl verisi yok"} icon={<TrendingUp className="w-5 h-5 text-indigo-500" />} trend={savingsRate !== null ? (parseFloat(savingsRate) >= 0 ? "Başarılı" : "Limit Aşımı") : undefined} trendUp={savingsRate !== null ? parseFloat(savingsRate) < 0 : false} />
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aylık Enerji Trendi ve Karşılaştırma</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Seçilen kriterlere göre kWh bazında tüketim karşılaştırması</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {monthlySeries[0].seriesItems.length > 1 && (
                                    <div className="flex flex-wrap justify-end gap-3 px-4 py-2.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest w-full text-right mb-1">Gösterge</span>
                                        {monthlySeries[0].seriesItems.map((s, idx) => (
                                            <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                                                <div className={`w-4 h-4 rounded-md ${s.color} shadow-inner`}></div>
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-end justify-between h-64 gap-3 pt-12 pb-2 px-2">
                            {monthlySeriesWithVariance.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full">
                                    <div className="relative w-full flex-1 flex items-end justify-center bg-slate-50 dark:bg-slate-800/30 rounded-xl pb-1 px-1 gap-1 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                                        {d.variance && (
                                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm z-10 ${d.variance.type === 'up' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                {d.variance.type === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                %{d.variance.val.toFixed(0)}
                                            </div>
                                        )}
                                        {d.seriesItems.map((s, idx) => (
                                            <div key={idx} className={`w-full max-w-[16px] ${s.color} rounded-t-lg transition-all duration-1000 ease-out shadow-lg relative group/bar`} style={{ height: `${s.value > 0 ? Math.max((s.value / maxChartVal) * 100, 4) : 0}%` }}>
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all duration-200 whitespace-nowrap z-20 shadow-2xl border border-slate-700 pointer-events-none mb-1">
                                                    <span className="font-bold">{s.label}:</span> {s.value.toLocaleString()} kWh
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{d.monthName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Records View */}
            {activeTab === "records" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[250px] relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Lokasyon veya kayıt ara..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all" />
                            </div>
                            <div className="flex gap-3 overflow-x-auto">
                                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none">
                                    <option value="all">Tüm Lokasyonlar</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none">
                                    <option value="all">Tüm Yıllar</option>
                                    {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto text-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Lokasyon</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Dönem</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Tüketim</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Kişi</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Verimlilik</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredRecords.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-slate-900 dark:text-white">{r.energy_locations?.name}</div>
                                            </td>
                                            <td className="px-6 py-5 font-medium text-slate-600 dark:text-slate-400">
                                                {new Date(r.period_year, r.period_month - 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                                            </td>
                                            <td className="px-6 py-5 text-right font-bold text-yellow-600">{r.consumption_kwh.toLocaleString()} kWh</td>
                                            <td className="px-6 py-5 text-right">{r.headcount}</td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="font-bold text-slate-900 dark:text-white">{(r.consumption_kwh / r.headcount / 30).toFixed(1)} kWh/gün</div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                                                    <button onClick={() => { setEditingRec(r); setRecForm({ location_id: r.location_id, period_month: r.period_month, period_year: r.period_year, consumption_kwh: r.consumption_kwh.toString(), headcount: r.headcount.toString(), total_cost: r.total_cost?.toString() || "" }); setShowRecModal(true); }} className="p-2 text-slate-400 hover:text-yellow-500"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteRecord(r.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Locations View */}
            {activeTab === "locations" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {locations.map(loc => (
                        <div key={loc.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:shadow-xl transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 group-hover:bg-yellow-500 group-hover:text-white transition-all shadow-inner">
                                    <MapPin className="w-7 h-7" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingLoc(loc); setLocForm({ name: loc.name, total_area_m2: loc.total_area_m2?.toString() || "", personnel_capacity: loc.personnel_capacity?.toString() || "", target_reduction_percent: loc.target_reduction_percent?.toString() || "5" }); setShowLocModal(true); }} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:text-yellow-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteLocation(loc.id)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{loc.name}</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-2"><Maximize className="w-3 h-3" /> Alan</div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{loc.total_area_m2 || 0} m²</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-2"><Users className="w-3 h-3" /> Kapasite</div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{loc.personnel_capacity || 0} Kişi</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setShowLocModal(true)} className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-slate-400 hover:text-yellow-500 hover:border-yellow-500 transition-all group">
                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-white transition-all shadow-lg"><Plus className="w-8 h-8" /></div>
                        <div className="text-center"><span className="block text-base font-bold text-slate-700 dark:text-slate-300">Yeni Lokasyon Ekle</span><span className="text-[11px]">Yeni bir enerji tüketim noktası tanımlayın</span></div>
                    </button>
                </div>
            )}

            {/* Modals */}
            {showLocModal && (
                <Modal title={editingLoc ? "Lokasyonu Düzenle" : "Yeni Lokasyon Ekle"} onClose={() => { setShowLocModal(false); setEditingLoc(null); setLocForm({ name: "", total_area_m2: "", personnel_capacity: "", target_reduction_percent: "5" }); }} onSave={handleSaveLocation} saving={saving}>
                    <div className="space-y-4">
                        <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Lokasyon Adı</label><input type="text" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})} placeholder="Örn: Ana Fabrika Binası" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Toplam Alan (m²)</label><input type="number" value={locForm.total_area_m2} onChange={e => setLocForm({...locForm, total_area_m2: e.target.value})} placeholder="0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all" /></div>
                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Kişi Kapasitesi</label><input type="number" value={locForm.personnel_capacity} onChange={e => setLocForm({...locForm, personnel_capacity: e.target.value})} placeholder="0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all" /></div>
                        </div>
                        <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Hedef Tasarruf Oranı (%)</label><div className="relative"><input type="number" value={locForm.target_reduction_percent} onChange={e => setLocForm({...locForm, target_reduction_percent: e.target.value})} placeholder="5" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span></div></div>
                    </div>
                </Modal>
            )}

            {showRecModal && (
                <Modal title={editingRec ? "Kaydı Düzenle" : "Yeni Tüketim Girişi"} onClose={() => { setShowRecModal(false); setEditingRec(null); setRecForm({ ...recForm, consumption_kwh: "", headcount: "", total_cost: "" }); }} onSave={handleSaveRecord} saving={saving}>
                    <div className="space-y-4">
                        <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Lokasyon</label><select value={recForm.location_id} onChange={e => setRecForm({...recForm, location_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none"><option value="">Lokasyon Seçiniz</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Yıl</label><input type="number" value={recForm.period_year} onChange={e => setRecForm({...recForm, period_year: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Ay</label><select value={recForm.period_month} onChange={e => setRecForm({...recForm, period_month: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none">{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleDateString("tr-TR", { month: "long" })}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Tüketim (kWh)</label><input type="number" value={recForm.consumption_kwh} onChange={e => setRecForm({...recForm, consumption_kwh: e.target.value})} placeholder="0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Aktif Kişi Sayısı</label><input type="number" value={recForm.headcount} onChange={e => setRecForm({...recForm, headcount: e.target.value})} placeholder="0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                        </div>
                    </div>
                </Modal>
            )}

            {showBulkModal && (
                <Modal title="Yıllık Toplu Enerji Girişi" onClose={() => setShowBulkModal(false)} onSave={handleSaveBulk} saving={saving}>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Hedef Lokasyon</label><select value={bulkForm.location_id} onChange={e => setBulkForm({...bulkForm, location_id: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50"><option value="">Seçiniz...</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Hedef Yıl</label><input type="number" value={bulkForm.year} onChange={e => setBulkForm({...bulkForm, year: parseInt(e.target.value)})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50" /></div>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                            {bulkForm.months.map((m, idx) => (
                                <div key={m.month} className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-yellow-500/30 transition-all group">
                                    <div className="col-span-3 text-[11px] font-bold text-slate-500 uppercase">{new Date(2000, m.month-1).toLocaleDateString("tr-TR", { month: "long" })}</div>
                                    <div className="col-span-5"><input type="number" placeholder="kWh" value={m.consumption_kwh} onChange={e => { const newMonths = [...bulkForm.months]; newMonths[idx].consumption_kwh = e.target.value; setBulkForm({...bulkForm, months: newMonths}); }} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-yellow-500/50" /></div>
                                    <div className="col-span-4"><input type="number" placeholder="Kişi" value={m.headcount} onChange={e => { const newMonths = [...bulkForm.months]; newMonths[idx].headcount = e.target.value; setBulkForm({...bulkForm, months: newMonths}); }} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-yellow-500/50" /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
