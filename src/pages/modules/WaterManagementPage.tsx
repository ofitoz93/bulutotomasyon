import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { 
    Droplets, 
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
    Download
} from "lucide-react";

// ===================== TYPES =====================
interface WaterLocation {
    id: string;
    name: string;
    total_area_m2: number | null;
    personnel_capacity: number | null;
    target_reduction_percent: number | null;
}

interface WaterConsumptionRecord {
    id: string;
    location_id: string;
    period_month: number;
    period_year: number;
    consumption_m3: number;
    headcount: number;
    total_cost: number | null;
    created_at: string;
    water_locations: { name: string; total_area_m2: number | null } | null;
}

export default function WaterManagementPage() {
    const { profile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<WaterLocation[]>([]);
    const [records, setRecords] = useState<WaterConsumptionRecord[]>([]);
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
    const [editingLoc, setEditingLoc] = useState<WaterLocation | null>(null);
    const [editingRec, setEditingRec] = useState<WaterConsumptionRecord | null>(null);
    const [dashboardYears, setDashboardYears] = useState<string[]>([new Date().getFullYear().toString()]);
    const [dashboardLocationIds, setDashboardLocationIds] = useState<string[]>(["all"]);

    // Form States
    const [locForm, setLocForm] = useState({ name: "", total_area_m2: "", personnel_capacity: "", target_reduction_percent: "5" });
    const [recForm, setRecForm] = useState({ 
        location_id: "", 
        period_month: new Date().getMonth() + 1, 
        period_year: new Date().getFullYear(),
        consumption_m3: "",
        headcount: "",
        total_cost: ""
    });

    const [bulkForm, setBulkForm] = useState({
        location_id: "",
        year: new Date().getFullYear(),
        months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            consumption_m3: "",
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
                supabase.from("water_locations").select("*").eq("tenant_id", profile!.tenant_id).order("name"),
                supabase.from("water_consumption_records").select("*, water_locations(name, total_area_m2)").eq("tenant_id", profile!.tenant_id).order("period_year", { ascending: false }).order("period_month", { ascending: false })
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
                const { error } = await supabase.from("water_locations").update(data).eq("id", editingLoc.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("water_locations").insert([data]);
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
            const { error } = await supabase.from("water_locations").delete().eq("id", id);
            if (error) throw error;
            fetchAll();
        } catch (e: any) {
            alert("Hata: " + e.message);
        }
    };

    const handleSaveRecord = async () => {
        if (!recForm.location_id || !recForm.consumption_m3 || !recForm.headcount) return;
        setSaving(true);
        try {
            const data = {
                ...recForm,
                consumption_m3: parseFloat(recForm.consumption_m3),
                headcount: parseInt(recForm.headcount),
                total_cost: recForm.total_cost ? parseFloat(recForm.total_cost) : null,
                tenant_id: profile!.tenant_id
            };

            if (editingRec) {
                const { error } = await supabase.from("water_consumption_records").update(data).eq("id", editingRec.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("water_consumption_records").insert([data]);
                if (error) throw error;
            }

            setShowRecModal(false);
            setEditingRec(null);
            setRecForm({ ...recForm, consumption_m3: "", headcount: "", total_cost: "" });
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
            const { error } = await supabase.from("water_consumption_records").delete().eq("id", id);
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
                .filter(m => m.consumption_m3 !== "" && m.headcount !== "")
                .map(m => ({
                    tenant_id: profile!.tenant_id,
                    location_id: bulkForm.location_id,
                    period_year: bulkForm.year,
                    period_month: m.month,
                    consumption_m3: parseFloat(m.consumption_m3),
                    headcount: parseInt(m.headcount),
                    total_cost: m.total_cost ? parseFloat(m.total_cost) : null
                }));

            if (recordsToSave.length === 0) {
                alert("Lütfen en az bir ay için veri giriniz.");
                return;
            }

            const { error } = await supabase
                .from("water_consumption_records")
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

    const totalConsumption = dashboardRecords.reduce((acc, curr) => acc + curr.consumption_m3, 0);
    const avgEfficiency = dashboardRecords.length > 0 
        ? (dashboardRecords.reduce((acc, curr) => acc + (curr.consumption_m3 * 1000 / curr.headcount / 30), 0) / dashboardRecords.length).toFixed(1)
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
            const locPrevYearTotal = prevYearRecords.filter(r => r.location_id === id).reduce((acc, curr) => acc + curr.consumption_m3, 0);
            targetConsumption += locPrevYearTotal * (1 - reduction / 100);
        });
    } else {
        locations.forEach(loc => {
            const locPrevYearTotal = prevYearRecords.filter(r => r.location_id === loc.id).reduce((acc, curr) => acc + curr.consumption_m3, 0);
            const reduction = loc.target_reduction_percent || 5;
            targetConsumption += locPrevYearTotal * (1 - reduction / 100);
        });
    }

    const savingsRate = targetConsumption > 0 
        ? (((targetConsumption - totalConsumption) / targetConsumption) * 100).toFixed(1)
        : null;

    const prevYearAvgEfficiency = prevYearRecords.length > 0
        ? prevYearRecords.reduce((acc, curr) => acc + (curr.consumption_m3 * 1000 / curr.headcount / 30), 0) / prevYearRecords.length
        : 0;
    
    let targetEfficiency = 0;
    const activeReductions = dashboardLocationIds.includes("all") 
        ? locations.map(l => l.target_reduction_percent || 5)
        : dashboardLocationIds.map(id => locations.find(l => l.id === id)?.target_reduction_percent || 5);
    const avgReduction = activeReductions.length > 0 ? activeReductions.reduce((a, b) => a + b, 0) / activeReductions.length : 5;
    targetEfficiency = prevYearAvgEfficiency * (1 - avgReduction / 100);

    // Chart Comparison Logic
    // We compare either multiple years for one/all locations OR multiple locations for one/all years
    const chartColors = ["bg-blue-600", "bg-emerald-500", "bg-indigo-500", "bg-amber-500", "bg-rose-500"];
    
    const monthlySeries = Array.from({ length: 12 }).map((_, i) => {
        const month = i + 1;
        const monthName = new Date(2000, i).toLocaleDateString("tr-TR", { month: "short" });
        
        const seriesItems: { label: string; value: number; color: string }[] = [];

        if (dashboardYears.length > 1 && (dashboardLocationIds.length === 1)) {
            // Compare Years
            dashboardYears.forEach((y, idx) => {
                const val = records
                    .filter(r => r.period_year.toString() === y && r.period_month === month && (dashboardLocationIds.includes("all") || dashboardLocationIds.includes(r.location_id)))
                    .reduce((acc, curr) => acc + Number(curr.consumption_m3), 0);
                seriesItems.push({ label: `${y}`, value: val, color: chartColors[idx % chartColors.length] });
            });
        } else if (dashboardLocationIds.length > 1 && (dashboardYears.length === 1)) {
            // Compare Locations
            dashboardLocationIds.filter(id => id !== "all").forEach((id, idx) => {
                const locName = locations.find(l => l.id === id)?.name || "Bilinmeyen";
                const val = records
                    .filter(r => r.location_id === id && r.period_month === month && (dashboardYears.includes("all") || dashboardYears.includes(r.period_year.toString())))
                    .reduce((acc, curr) => acc + Number(curr.consumption_m3), 0);
                seriesItems.push({ label: locName, value: val, color: chartColors[idx % chartColors.length] });
            });
        } else {
            // Default Single Series
            const val = records
                .filter(r => {
                    const yearMatch = dashboardYears.includes("all") || dashboardYears.includes(r.period_year.toString());
                    const monthMatch = r.period_month === month;
                    const locMatch = dashboardLocationIds.includes("all") || dashboardLocationIds.includes(r.location_id);
                    return yearMatch && monthMatch && locMatch;
                })
                .reduce((acc, curr) => acc + Number(curr.consumption_m3), 0);
            seriesItems.push({ label: "Tüketim", value: val, color: chartColors[0] });
        }

        return { monthName, seriesItems };
    });

    // Add Variance (Percentage Change) for comparisons
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

    // Filtered Records for the Records Tab
    const filteredRecords = records.filter(r => {
        const matchesSearch = searchQuery === "" || 
            r.water_locations?.name.toLowerCase().includes(searchQuery.toLowerCase());
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
                        <div className="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20">
                            <Droplets className="w-6 h-6 text-white" />
                        </div>
                        Su Yönetimi ve Verimlilik
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Tüketim analizi, kişi başı verimlilik ve sürdürülebilirlik takibi
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowLocModal(true)}
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                    >
                        <MapPin className="w-4 h-4" />
                        Lokasyon Ekle
                    </button>
                    <button 
                        onClick={() => setShowBulkModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        <Calendar className="w-4 h-4" />
                        Yıllık Toplu Giriş
                    </button>
                    <button 
                        onClick={() => setShowRecModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Veri Girişi
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 scrollbar-hide overflow-x-auto">
                <button 
                    onClick={() => setActiveTab("dashboard")}
                    className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === "dashboard" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                    <TrendingUp className="w-4 h-4" />
                    Özet Panel
                </button>
                <button 
                    onClick={() => setActiveTab("records")}
                    className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === "records" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                    <Droplets className="w-4 h-4" />
                    Tüketim Kayıtları
                </button>
                <button 
                    onClick={() => setActiveTab("locations")}
                    className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === "locations" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                    <MapPin className="w-4 h-4" />
                    Lokasyonlar
                </button>
            </div>

            {/* VIEW: Dashboard */}
            {activeTab === "dashboard" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Dashboard Filters */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Filter className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Dashboard Karşılaştırma ve Filtreler</span>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Year Selector */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Yıl Seçimi (Maks. 3)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => toggleYear("all")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardYears.includes("all") ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                                    >
                                        Tümü
                                    </button>
                                    {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => (
                                        <button 
                                            key={y}
                                            onClick={() => toggleYear(y)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardYears.includes(y) ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Location Selector */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasyon Seçimi (Maks. 3)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => toggleLocation("all")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardLocationIds.includes("all") ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                                    >
                                        Tümü
                                    </button>
                                    {locations.map(l => (
                                        <button 
                                            key={l.id}
                                            onClick={() => toggleLocation(l.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardLocationIds.includes(l.id) ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card 
                            title="Toplam Tüketim (m³)" 
                            value={totalConsumption.toLocaleString()} 
                            sub={targetConsumption > 0 ? `Hedef: ${Math.round(targetConsumption).toLocaleString()} m³` : "Önceki yıl verisi yok"} 
                            icon={<Droplets className="w-5 h-5 text-blue-500" />}
                            trend={targetConsumption > 0 ? (totalConsumption <= targetConsumption ? "Hedefte" : "Aşıldı") : undefined}
                            trendUp={targetConsumption > 0 ? totalConsumption > targetConsumption : false}
                        />
                        <Card 
                            title="Ort. Verimlilik" 
                            value={`${avgEfficiency} L`} 
                            sub={targetEfficiency > 0 ? `Hedef: ${targetEfficiency.toFixed(1)} L` : "Kişi / Gün"} 
                            icon={<Users className="w-5 h-5 text-emerald-500" />}
                            trend={targetEfficiency > 0 ? (parseFloat(avgEfficiency) <= targetEfficiency ? "İyi" : "Yüksek") : undefined}
                            trendUp={targetEfficiency > 0 ? parseFloat(avgEfficiency) > targetEfficiency : false}
                        />
                        <Card 
                            title="Aktif Lokasyonlar" 
                            value={locations.length.toString()} 
                            sub="Takip Edilen" 
                            icon={<MapPin className="w-5 h-5 text-amber-500" />}
                        />
                        <Card 
                            title="Tasarruf Oranı" 
                            value={savingsRate !== null ? `%${savingsRate}` : "—"} 
                            sub={targetConsumption > 0 ? `Tasarruf Hedefi: %${(locations.length > 0 ? (locations.reduce((acc, curr) => acc + (curr.target_reduction_percent || 5), 0) / locations.length).toFixed(1) : 5)}` : "Önceki yıl verisi yok"} 
                            icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
                            trend={savingsRate !== null ? (parseFloat(savingsRate) >= 0 ? "Başarılı" : "Limit Aşımı") : undefined}
                            trendUp={savingsRate !== null ? parseFloat(savingsRate) < 0 : false}
                        />
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aylık Tüketim Trendi ve Karşılaştırma</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Seçilen kriterlere göre m³ bazında tüketim karşılaştırması</p>
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
                                        {/* Variance Indicator */}
                                        {d.variance && (
                                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm z-10 ${d.variance.type === 'up' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                {d.variance.type === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                %{d.variance.val.toFixed(0)}
                                            </div>
                                        )}
                                        {d.seriesItems.map((s, idx) => (
                                            <div 
                                                key={idx}
                                                className={`w-full max-w-[16px] ${s.color} rounded-t-lg transition-all duration-1000 ease-out shadow-lg relative group/bar`}
                                                style={{ height: `${s.value > 0 ? Math.max((s.value / maxChartVal) * 100, 4) : 0}%` }}
                                            >
                                                {/* Tooltip for individual bar */}
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all duration-200 whitespace-nowrap z-20 shadow-2xl border border-slate-700 pointer-events-none mb-1">
                                                    <span className="font-bold">{s.label}:</span> {s.value.toLocaleString()} m³
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

            {activeTab === "records" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[250px] relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Lokasyon veya kayıt ara..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                />
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 sm:pb-0">
                                <select 
                                    value={filterLocation}
                                    onChange={e => setFilterLocation(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    <option value="all">Tüm Lokasyonlar</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <select 
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    <option value="all">Tüm Yıllar</option>
                                    {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <select 
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    <option value="all">Tüm Aylar</option>
                                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(m => (
                                        <option key={m} value={m}>{new Date(2000, parseInt(m) - 1).toLocaleDateString("tr-TR", { month: "long" })}</option>
                                    ))}
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
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Maliyet</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredRecords.map(r => {
                                        const efficiency = r.headcount > 0 
                                            ? (r.consumption_m3 * 1000 / r.headcount / 30).toFixed(1)
                                            : "0";
                                        const isHigh = parseFloat(efficiency) > 50;

                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                                                <td className="px-6 py-5">
                                                    <div className="font-bold text-slate-900 dark:text-white">{r.water_locations?.name}</div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <Maximize className="w-3 h-3" />
                                                        {r.water_locations?.total_area_m2 ? `${r.water_locations.total_area_m2} m² Alan` : "—"}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-400">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        {new Date(r.period_year, r.period_month - 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-blue-600">
                                                    {r.consumption_m3.toLocaleString()} m³
                                                </td>
                                                <td className="px-6 py-5 text-right text-slate-600 dark:text-slate-400">
                                                    {r.headcount}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className={`font-bold ${isHigh ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                        {efficiency} L/gün
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium">kişi başı</div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-medium text-slate-700 dark:text-slate-300">
                                                    {r.total_cost ? `₺${r.total_cost.toLocaleString()}` : "—"}
                                                </td>
                                                <td className="px-6 py-5 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingRec(r);
                                                                setRecForm({
                                                                    location_id: r.location_id,
                                                                    period_month: r.period_month,
                                                                    period_year: r.period_year,
                                                                    consumption_m3: r.consumption_m3.toString(),
                                                                    headcount: r.headcount.toString(),
                                                                    total_cost: r.total_cost?.toString() || ""
                                                                });
                                                                setShowRecModal(true);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteRecord(r.id)}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredRecords.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3 grayscale opacity-50">
                                                    <Search className="w-12 h-12 text-slate-300" />
                                                    <p className="text-sm font-medium text-slate-500 italic">Aranan kriterlere uygun kayıt bulunamadı.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "locations" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {locations.map(loc => (
                        <div key={loc.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-inner">
                                    <MapPin className="w-7 h-7" />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setEditingLoc(loc);
                                            setLocForm({
                                                name: loc.name,
                                                total_area_m2: loc.total_area_m2?.toString() || "",
                                                personnel_capacity: loc.personnel_capacity?.toString() || "",
                                                target_reduction_percent: loc.target_reduction_percent?.toString() || "5"
                                            });
                                            setShowLocModal(true);
                                        }}
                                        className="p-2.5 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-xl"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteLocation(loc.id)}
                                        className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-xl"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{loc.name}</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                        <Maximize className="w-3 h-3" />
                                        Alan
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{loc.total_area_m2?.toLocaleString() || "0"} m²</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                        <Users className="w-3 h-3" />
                                        Kapasite
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{loc.personnel_capacity?.toLocaleString() || "0"} Kişi</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={() => setShowLocModal(true)}
                        className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-slate-400 hover:text-blue-500 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg">
                            <Plus className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                            <span className="block text-base font-bold text-slate-700 dark:text-slate-300">Yeni Lokasyon Ekle</span>
                            <span className="text-[11px] text-slate-500">Yeni bir operasyon alanı tanımlayın</span>
                        </div>
                    </button>
                </div>
            )}

            {/* MODAL: Lokasyon Ekle */}
            {showLocModal && (
                <Modal 
                    title={editingLoc ? "Lokasyonu Düzenle" : "Yeni Lokasyon Ekle"} 
                    onClose={() => {
                        setShowLocModal(false);
                        setEditingLoc(null);
                        setLocForm({ name: "", total_area_m2: "", personnel_capacity: "", target_reduction_percent: "5" });
                    }} 
                    onSave={handleSaveLocation} 
                    saving={saving}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Lokasyon Adı *</label>
                            <input 
                                type="text" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})}
                                placeholder="ör. Gebze Fabrika, Merkez Ofis"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Alan (m²)</label>
                                <input 
                                    type="number" value={locForm.total_area_m2} onChange={e => setLocForm({...locForm, total_area_m2: e.target.value})}
                                    placeholder="0.00"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Kapasite (Kişi)</label>
                                <input 
                                    type="number" value={locForm.personnel_capacity} onChange={e => setLocForm({...locForm, personnel_capacity: e.target.value})}
                                    placeholder="0"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Hedef Tasarruf Oranı (%)</label>
                            <div className="relative">
                                <input 
                                    type="number" value={locForm.target_reduction_percent} onChange={e => setLocForm({...locForm, target_reduction_percent: e.target.value})}
                                    placeholder="5"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 italic">Önceki yıla göre hedeflenen azaltma oranı (Varsayılan: %5)</p>
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL: Veri Girişi */}
            {showRecModal && (
                <Modal 
                    title={editingRec ? "Kaydı Düzenle" : "Tüketim Verisi Girişi"} 
                    onClose={() => {
                        setShowRecModal(false);
                        setEditingRec(null);
                        setRecForm({ 
                            location_id: "", 
                            period_month: new Date().getMonth() + 1, 
                            period_year: new Date().getFullYear(),
                            consumption_m3: "",
                            headcount: "",
                            total_cost: ""
                        });
                    }} 
                    onSave={handleSaveRecord} 
                    saving={saving}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Lokasyon Seçin *</label>
                            <select 
                                value={recForm.location_id} onChange={e => setRecForm({...recForm, location_id: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            >
                                <option value="">Seçin...</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Yıl</label>
                                <input type="number" value={recForm.period_year} onChange={e => setRecForm({...recForm, period_year: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Ay (1-12)</label>
                                <input type="number" min={1} max={12} value={recForm.period_month} onChange={e => setRecForm({...recForm, period_month: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Tüketim (m³) *</label>
                                <input 
                                    type="number" value={recForm.consumption_m3} onChange={e => setRecForm({...recForm, consumption_m3: e.target.value})}
                                    placeholder="0.00"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">O Ayki Personel *</label>
                                <input 
                                    type="number" value={recForm.headcount} onChange={e => setRecForm({...recForm, headcount: e.target.value})}
                                    placeholder="0"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Toplam Maliyet (₺)</label>
                            <input 
                                type="number" value={recForm.total_cost} onChange={e => setRecForm({...recForm, total_cost: e.target.value})}
                                placeholder="0.00"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL: Yıllık Toplu Giriş */}
            {showBulkModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Yıllık Toplu Veri Girişi</h3>
                            <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <div className="px-6 py-6 max-h-[75vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Lokasyon Seçin *</label>
                                    <select 
                                        value={bulkForm.location_id} onChange={e => setBulkForm({...bulkForm, location_id: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    >
                                        <option value="">Seçin...</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Yıl</label>
                                    <input 
                                        type="number" value={bulkForm.year} onChange={e => setBulkForm({...bulkForm, year: parseInt(e.target.value)})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Ay</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Tüketim (m³)</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Personel Sayısı</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Maliyet (₺)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {bulkForm.months.map((m, idx) => (
                                            <tr key={m.month} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {new Date(2000, m.month - 1).toLocaleDateString("tr-TR", { month: "long" })}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" value={m.consumption_m3} 
                                                        onChange={e => {
                                                            const newMonths = [...bulkForm.months];
                                                            newMonths[idx].consumption_m3 = e.target.value;
                                                            setBulkForm({...bulkForm, months: newMonths});
                                                        }}
                                                        placeholder="0.00"
                                                        className="w-full bg-transparent border-none focus:ring-0 text-sm p-1"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" value={m.headcount} 
                                                        onChange={e => {
                                                            const newMonths = [...bulkForm.months];
                                                            newMonths[idx].headcount = e.target.value;
                                                            setBulkForm({...bulkForm, months: newMonths});
                                                        }}
                                                        placeholder="0"
                                                        className="w-full bg-transparent border-none focus:ring-0 text-sm p-1"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" value={m.total_cost} 
                                                        onChange={e => {
                                                            const newMonths = [...bulkForm.months];
                                                            newMonths[idx].total_cost = e.target.value;
                                                            setBulkForm({...bulkForm, months: newMonths});
                                                        }}
                                                        placeholder="0.00"
                                                        className="w-full bg-transparent border-none focus:ring-0 text-sm p-1"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button 
                                onClick={() => setShowBulkModal(false)}
                                className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handleSaveBulk}
                                disabled={saving || !bulkForm.location_id}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                            >
                                {saving ? "Kaydediliyor..." : "Tümünü Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===================== HELPER COMPONENTS =====================

function Card({ title, value, sub, icon, trend, trendUp }: any) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    {icon}
                </div>
                {trend && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${trendUp ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {trendUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</span>
                    <span className="text-[10px] text-slate-500">{sub}</span>
                </div>
            </div>
        </div>
    );
}

function Modal({ title, children, onClose, onSave, saving }: any) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>
                <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={onSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                        {saving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                </div>
            </div>
        </div>
    );
}
