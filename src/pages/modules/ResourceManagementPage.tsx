import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { 
    Droplets, 
    Zap, 
    Users, 
    TrendingUp, 
    Plus, 
    Search,
    MapPin,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    Trash2,
    Edit2,
    Activity,
    Maximize,
    ChevronRight,
    Settings,
    Save,
    ChevronLeft,
    ClipboardPaste,
    Info,
    LayoutGrid,
    CheckCircle2,
    AlertCircle,
    BarChart3,
    LineChart,
    PieChart,
    CalendarDays
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart as ReLineChart,
    Line,
    AreaChart,
    Area,
    Cell,
    LabelList
} from 'recharts';

// ===================== TYPES =====================
interface Location {
    id: string;
    name: string;
    total_area_m2: number | null;
    target_reduction_percent: number | null;
}

interface ConsumptionRecord {
    id: string;
    resource_location_id: string;
    period_month: number;
    period_year: number;
    consumption: number;
    total_cost: number | null;
    created_at: string;
    locations: { name: string; total_area_m2: number | null } | null;
}

interface HeadcountRecord {
    id: string;
    resource_location_id: string;
    period_month: number;
    period_year: number;
    headcount: number;
}

// ===================== COMPONENTS =====================
const Card = ({ title, value, sub, icon, colorClass = "blue", trend }: any) => {
    const colors: any = {
        blue: "bg-blue-500 text-white shadow-blue-500/20",
        yellow: "bg-yellow-500 text-white shadow-yellow-500/20",
        emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
        indigo: "bg-indigo-500 text-white shadow-indigo-500/20"
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md relative overflow-hidden group">
            <div className={`p-3 rounded-2xl w-fit mb-4 shadow-lg transition-transform group-hover:scale-110 duration-300 ${colors[colorClass]}`}>{icon}</div>
            <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.1em]">{title}</h3>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight flex items-baseline gap-2">
                {value}
                {trend !== undefined && (
                    <span className={`text-[11px] font-black flex items-center px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5"/> : <ArrowDownRight className="w-3 h-3 mr-0.5"/>}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-tight">{sub}</p>
        </div>
    );
};

const Modal = ({ title, children, onClose, onSave, saving, color = "blue", wide = false }: any) => {
    const btnColors: any = {
        blue: "bg-blue-600 hover:bg-blue-500",
        yellow: "bg-yellow-500 hover:bg-yellow-400",
        indigo: "bg-indigo-600 hover:bg-indigo-500",
        emerald: "bg-emerald-600 hover:bg-emerald-500"
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className={`bg-white dark:bg-slate-900 rounded-[40px] w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200`}>
                <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors"><Trash2 className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="p-10 max-h-[70vh] overflow-y-auto">{children}</div>
                {onSave && (
                    <div className="px-10 py-8 border-t border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <button onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700">İptal</button>
                        <button onClick={onSave} disabled={saving} className={`flex-[2] ${btnColors[color] || 'bg-indigo-600'} disabled:opacity-50 text-white px-6 py-4 rounded-2xl text-sm font-black shadow-xl transition-all flex items-center justify-center gap-3`}>
                            {saving ? "Kaydediliyor..." : <><Save className="w-5 h-5"/> Verileri Kaydet</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function ResourceManagementPage() {
    const { profile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"dashboard" | "water" | "energy" | "headcount" | "locations">("dashboard");
    
    // Filters
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedLocId, setSelectedLocId] = useState<string>("all");

    // Data States
    const [locations, setLocations] = useState<Location[]>([]);
    const [waterRecs, setWaterRecs] = useState<ConsumptionRecord[]>([]);
    const [energyRecs, setEnergyRecs] = useState<ConsumptionRecord[]>([]);
    const [headcounts, setHeadcounts] = useState<HeadcountRecord[]>([]);

    // Modals
    const [showLocModal, setShowLocModal] = useState(false);
    const [showRecModal, setShowRecModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingLoc, setEditingLoc] = useState<any>(null);
    const [editingRec, setEditingRec] = useState<any>(null);

    const [locForm, setLocForm] = useState({ name: "", total_area_m2: "", target_reduction_percent: "5" });
    const [recForm, setRecForm] = useState({ resource_location_id: "", period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear(), consumption: "", total_cost: "", type: "water" });
    
    // Bulk States
    const [bulkType, setBulkType] = useState<"headcount" | "water" | "energy">("headcount");
    const [bulkValues, setBulkValues] = useState<{ [key: number]: string }>({});
    const [pasteArea, setPasteArea] = useState("");

    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (profile?.tenant_id) fetchAll();
    }, [profile?.tenant_id]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Explicitly joining resource_locations to avoid 500 ambiguity if schema is not fully sync'd
            const [locs, wR, eR, hc] = await Promise.all([
                supabase.from("resource_locations").select("*").eq("tenant_id", profile!.tenant_id).order("name"),
                supabase.from("water_consumption_records").select("*, locations:resource_locations(name, total_area_m2)").eq("tenant_id", profile!.tenant_id),
                supabase.from("energy_consumption_records").select("*, locations:resource_locations(name, total_area_m2)").eq("tenant_id", profile!.tenant_id),
                supabase.from("monthly_headcounts").select("*").eq("tenant_id", profile!.tenant_id).order("period_year", { ascending: false }).order("period_month", { ascending: false })
            ]);

            if (locs.error) console.error("Locs Error:", locs.error);
            if (wR.error) console.error("Water Error:", wR.error);
            if (eR.error) console.error("Energy Error:", eR.error);
            if (hc.error) console.error("Headcount Error:", hc.error);

            setLocations(locs.data || []);
            setWaterRecs((wR.data || []).map((r: any) => ({ ...r, consumption: r.consumption_m3, locations: r.locations })));
            setEnergyRecs((eR.data || []).map((r: any) => ({ ...r, consumption: r.consumption_kwh, locations: r.locations })));
            setHeadcounts(hc.data || []);
        } catch (err: any) {
            console.error("Fetch All Critical Error:", err);
            showStatus("Veriler yüklenirken sunucu hatası oluştu.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 5000);
    };

    // --- Filtered Data ---
    const filteredWater = useMemo(() => {
        return waterRecs.filter(r => r.period_year === selectedYear && (selectedLocId === "all" || r.resource_location_id === selectedLocId));
    }, [waterRecs, selectedYear, selectedLocId]);

    const prevYearWater = useMemo(() => {
        return waterRecs.filter(r => r.period_year === selectedYear - 1 && (selectedLocId === "all" || r.resource_location_id === selectedLocId));
    }, [waterRecs, selectedYear, selectedLocId]);

    const filteredEnergy = useMemo(() => {
        return energyRecs.filter(r => r.period_year === selectedYear && (selectedLocId === "all" || r.resource_location_id === selectedLocId));
    }, [energyRecs, selectedYear, selectedLocId]);

    const prevYearEnergy = useMemo(() => {
        return energyRecs.filter(r => r.period_year === selectedYear - 1 && (selectedLocId === "all" || r.resource_location_id === selectedLocId));
    }, [energyRecs, selectedYear, selectedLocId]);

    const filteredHeadcounts = useMemo(() => {
        return headcounts.filter(h => h.period_year === selectedYear && (selectedLocId === "all" || h.resource_location_id === selectedLocId));
    }, [headcounts, selectedYear, selectedLocId]);

    const histogramData = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const currentWater = filteredWater.filter(r => r.period_month === month).reduce((a,b)=>a+b.consumption, 0);
            const prevWater = prevYearWater.filter(r => r.period_month === month).reduce((a,b)=>a+b.consumption, 0);
            const currentEnergy = filteredEnergy.filter(r => r.period_month === month).reduce((a,b)=>a+b.consumption, 0);
            const prevEnergy = prevYearEnergy.filter(r => r.period_month === month).reduce((a,b)=>a+b.consumption, 0);

            const waterChange = prevWater > 0 ? Math.round(((currentWater - prevWater) / prevWater) * 100) : 0;
            const energyChange = prevEnergy > 0 ? Math.round(((currentEnergy - prevEnergy) / prevEnergy) * 100) : 0;

            return {
                name: new Date(2000, i).toLocaleDateString("tr-TR", { month: "short" }),
                currentWater,
                prevWater,
                currentEnergy,
                prevEnergy,
                waterChange: waterChange > 0 ? `+%${waterChange}` : `%${waterChange}`,
                energyChange: energyChange > 0 ? `+%${energyChange}` : `%${energyChange}`
            };
        });
    }, [filteredWater, prevYearWater, filteredEnergy, prevYearEnergy]);

    const efficiencyData = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const wVal = filteredWater.filter(r => r.period_month === month).reduce((a,b)=>a+b.consumption, 0) * 1000;
            const eVal = filteredEnergy.filter(r => r.period_month === month).reduce((a,b)=>a+b.consumption, 0);
            const hc = filteredHeadcounts.filter(h => h.period_month === month).reduce((a,b)=>a+b.headcount, 0) || 1;
            return {
                name: new Date(2000, i).toLocaleDateString("tr-TR", { month: "short" }),
                waterEff: (wVal / hc / 30).toFixed(1),
                energyEff: (eVal / hc / 30).toFixed(1)
            };
        });
    }, [filteredWater, filteredEnergy, filteredHeadcounts]);

    // KPI Trends
    const curWaterTot = filteredWater.reduce((a,b)=>a+b.consumption,0);
    const preWaterTot = prevYearWater.reduce((a,b)=>a+b.consumption,0);
    const waterTrend = preWaterTot > 0 ? Math.round(((curWaterTot - preWaterTot) / preWaterTot) * 100) : 0;

    const curEnergyTot = filteredEnergy.reduce((a,b)=>a+b.consumption,0);
    const preEnergyTot = prevYearEnergy.reduce((a,b)=>a+b.consumption,0);
    const energyTrend = preEnergyTot > 0 ? Math.round(((curEnergyTot - preEnergyTot) / preEnergyTot) * 100) : 0;

    // --- Actions ---
    const handleSaveBulk = async () => {
        if (selectedLocId === "all") { showStatus("Lütfen bir lokasyon seçin.", 'error'); return; }
        setSaving(true);
        const records = Object.entries(bulkValues)
            .filter(([_, val]) => val !== "" && val !== null)
            .map(([month, val]) => {
                const base: any = { tenant_id: profile!.tenant_id, resource_location_id: selectedLocId, period_year: selectedYear, period_month: parseInt(month), headcount: 0 };
                if (bulkType === "headcount") return { ...base, headcount: parseInt(val) };
                if (bulkType === "water") return { ...base, consumption_m3: parseFloat(val) };
                return { ...base, consumption_kwh: parseFloat(val) };
            });

        try {
            if (records.length > 0) {
                const table = bulkType === "headcount" ? "monthly_headcounts" : bulkType === "water" ? "water_consumption_records" : "energy_consumption_records";
                const { error } = await supabase.from(table).upsert(records, { onConflict: "resource_location_id, period_month, period_year" });
                if (error) throw error;
                showStatus("Tüm veriler başarıyla kaydedildi.");
            }
            setShowBulkModal(false);
            fetchAll();
        } catch (e: any) { showStatus(e.message, 'error'); } finally { setSaving(false); }
    };

    const handlePaste = () => {
        const cleanedPaste = pasteArea.replace(/\./g, '').replace(/,/g, '.');
        const values = cleanedPaste.split(/[\s\n\t;]+/).map(v => v.trim()).filter(v => v !== "" && !isNaN(parseFloat(v)));
        const newVals: any = { ...bulkValues };
        values.forEach((v, i) => { if (i < 12) newVals[i + 1] = v; });
        setBulkValues(newVals);
        setPasteArea("");
    };

    const deleteItem = async (table: string, id: string) => {
        if (!window.confirm("Emin misiniz?")) return;
        await supabase.from(table).delete().eq("id", id);
        showStatus("Kayıt silindi.");
        fetchAll();
    };

    const getHeadcountFor = (locId: string, year: number, month: number) => {
        return headcounts.find(h => h.resource_location_id === locId && h.period_year === year && h.period_month === month)?.headcount || 0;
    };

    const activeRecs = activeTab === "water" ? waterRecs : energyRecs;
    const unit = activeTab === "water" ? "m³" : "kWh";
    const colorClass = activeTab === "water" ? "blue" : "yellow";

    if (loading) return <div className="flex items-center justify-center h-64"><Activity className="w-8 h-8 animate-spin text-indigo-600"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12 relative">
            {statusMsg && (
                <div className={`fixed bottom-8 right-8 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 border ${statusMsg.type === 'success' ? 'bg-emerald-600 border-emerald-50 text-white' : 'bg-rose-600 border-rose-50 text-white'}`}>
                    {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                    <span className="font-bold text-sm">{statusMsg.text}</span>
                </div>
            )}

            {/* Global Header & Filters */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20"><Activity className="w-7 h-7 text-white" /></div>
                        Kaynak ve Verimlilik Yönetimi
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasyon Filtresi</label>
                        <select value={selectedLocId} onChange={e => setSelectedLocId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-3.5 font-bold text-slate-900 dark:text-white outline-none ring-1 ring-slate-100 dark:ring-slate-700">
                            <option value="all">Tüm Lokasyonlar</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yıl</label>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700">
                            <button onClick={() => setSelectedYear(prev => prev - 1)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm"><ChevronLeft className="w-4 h-4"/></button>
                            <span className="text-lg font-black px-6 text-slate-900 dark:text-white">{selectedYear}</span>
                            <button onClick={() => setSelectedYear(prev => prev + 1)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm"><ChevronRight className="w-4 h-4"/></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide">
                {["dashboard", "water", "energy", "headcount", "locations"].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-5 text-sm font-black transition-all border-b-2 whitespace-nowrap capitalize ${activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                        {tab === "headcount" ? "Çalışan Sayısı" : tab === "locations" ? "Lokasyonlar" : tab === "water" ? "Su" : tab === "energy" ? "Enerji" : "Özet Panel"}
                    </button>
                ))}
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === "dashboard" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card title="Yıllık Su Tüketimi" value={curWaterTot.toLocaleString() + " m³"} sub={`${selectedYear} Toplamı`} icon={<Droplets className="w-6 h-6"/>} colorClass="blue" trend={waterTrend} />
                        <Card title="Yıllık Enerji Tüketimi" value={curEnergyTot.toLocaleString() + " kWh"} sub={`${selectedYear} Toplamı`} icon={<Zap className="w-6 h-6"/>} colorClass="yellow" trend={energyTrend} />
                        <Card title="Ortalama Çalışan" value={Math.round(filteredHeadcounts.length > 0 ? filteredHeadcounts.reduce((a,b)=>a+b.headcount,0)/filteredHeadcounts.length : 0).toString()} sub="Yıl Ortalaması" icon={<Users className="w-6 h-6"/>} colorClass="emerald" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3"><BarChart3 className="w-5 h-5 text-blue-500"/> Su Tüketimi Yıllık Karşılaştırma</h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                        <Legend />
                                        <Bar dataKey="prevWater" name={`${selectedYear - 1} Yılı`} fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={20} />
                                        <Bar dataKey="currentWater" name={`${selectedYear} Yılı`} fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20}>
                                            <LabelList dataKey="waterChange" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3"><BarChart3 className="w-5 h-5 text-yellow-500"/> Enerji Tüketimi Yıllık Karşılaştırma</h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                        <Legend />
                                        <Bar dataKey="prevEnergy" name={`${selectedYear - 1} Yılı`} fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={20} />
                                        <Bar dataKey="currentEnergy" name={`${selectedYear} Yılı`} fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={20}>
                                            <LabelList dataKey="energyChange" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3"><LineChart className="w-5 h-5 text-emerald-500"/> Kaynak Verimlilik Analizi</h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ReLineChart data={efficiencyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                        <Legend verticalAlign="top" align="right" />
                                        <Line type="monotone" dataKey="waterEff" stroke="#3b82f6" strokeWidth={4} name="Su (L/Kişi-Gün)" />
                                        <Line type="monotone" dataKey="energyEff" stroke="#f59e0b" strokeWidth={4} name="Enerji (kWh/Kişi-Gün)" />
                                    </ReLineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WATER / ENERGY TABS */}
            {(activeTab === "water" || activeTab === "energy") && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl bg-${colorClass}-500/10 text-${colorClass}-500`}>
                                {activeTab === "water" ? <Droplets className="w-6 h-6"/> : <Zap className="w-6 h-6"/>}
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">{activeTab === "water" ? "Su" : "Enerji"} Yönetim Merkezi</h2>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setBulkType(activeTab as any); setShowBulkModal(true); }} className={`bg-${colorClass}-600 hover:bg-${colorClass}-500 text-white px-5 py-3 rounded-2xl text-sm font-black transition-all shadow-lg flex items-center gap-2`}><LayoutGrid className="w-4 h-4" /> Toplu Giriş</button>
                            <button onClick={() => { setRecForm({ ...recForm, type: activeTab }); setShowRecModal(true); }} className={`bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2`}><Plus className="w-4 h-4" /> Tekil Kayıt</button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-8 py-6">Lokasyon</th>
                                    <th className="px-8 py-6">Dönem</th>
                                    <th className="px-8 py-6 text-right">Tüketim ({unit})</th>
                                    <th className="px-8 py-6 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {activeRecs.filter(r => r.period_year === selectedYear && (selectedLocId === "all" || r.resource_location_id === selectedLocId)).map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group transition-all text-sm">
                                        <td className="px-8 py-6 font-black text-slate-900 dark:text-white">{r.locations?.name || 'Bilinmeyen'}</td>
                                        <td className="px-8 py-6 text-slate-500 font-bold">{new Date(r.period_year, r.period_month - 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</td>
                                        <td className={`px-8 py-6 text-right font-black text-lg ${activeTab === "water" ? 'text-blue-600' : 'text-yellow-600'}`}>{r.consumption.toLocaleString()}</td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditingRec(r); setRecForm({ resource_location_id: r.resource_location_id, period_month: r.period_month, period_year: r.period_year, consumption: r.consumption.toString(), total_cost: r.total_cost?.toString() || "", type: activeTab }); setShowRecModal(true); }} className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-white rounded-xl shadow-sm transition-all"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => deleteItem(activeTab === "water" ? "water_consumption_records" : "energy_consumption_records", r.id)} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-xl shadow-sm transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* HEADCOUNT TAB */}
            {activeTab === "headcount" && (
                <div className="bg-white dark:bg-slate-900 rounded-[40px] p-10 border border-slate-200 dark:border-slate-800 shadow-xl">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3 mb-10"><Users className="w-7 h-7 text-emerald-500"/> Çalışan Sayısı Yönetimi</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-10">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <div key={month} className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3">{new Date(2000, month - 1).toLocaleDateString("tr-TR", { month: "long" })}</label>
                                <input type="number" value={bulkValues[month] || ""} onChange={e => setBulkValues({ ...bulkValues, [month]: e.target.value })} className="w-full bg-transparent border-none p-0 text-2xl font-black text-slate-900 dark:text-white outline-none" placeholder="0" />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-10 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex-1 w-full max-w-md relative group">
                            <ClipboardPaste className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                            <input type="text" value={pasteArea} onChange={e => setPasteArea(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePaste()} placeholder="Excel verisini yapıştırıp Enter'a basın..." className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[22px] pl-12 pr-4 py-4 text-sm font-bold outline-none" />
                        </div>
                        <button onClick={() => { setBulkType("headcount"); handleSaveBulk(); }} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-5 rounded-[24px] font-black shadow-2xl active:scale-95 disabled:opacity-50 flex items-center gap-3">
                            <Save className="w-6 h-6"/> {saving ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </div>
            )}

            {/* LOCATIONS TAB */}
            {activeTab === "locations" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-3 flex justify-between items-center"><h2 className="text-2xl font-black text-indigo-600 flex items-center gap-3"><MapPin className="w-6 h-6"/> Lokasyonlar</h2><button onClick={() => { setLocForm({ name: "", total_area_m2: "", target_reduction_percent: "5" }); setEditingLoc(null); setShowLocModal(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black shadow-xl flex items-center gap-2"><Plus className="w-5 h-5"/> Yeni Lokasyon</button></div>
                    {locations.map(loc => (
                        <div key={loc.id} className="bg-white dark:bg-slate-900 p-8 rounded-[48px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                            <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingLoc(loc); setLocForm({ name: loc.name, total_area_m2: loc.total_area_m2?.toString() || "", target_reduction_percent: loc.target_reduction_percent?.toString() || "5" }); setShowLocModal(true); }} className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-blue-500 shadow-sm transition-all"><Edit2 className="w-5 h-5" /></button>
                                <button onClick={() => deleteItem("resource_locations", loc.id)} className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-rose-500 shadow-sm transition-all"><Trash2 className="w-5 h-5" /></button>
                            </div>
                            <div className="p-4 bg-indigo-600 text-white rounded-2xl w-fit mb-8 shadow-xl"><MapPin className="w-7 h-7"/></div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">{loc.name}</h3>
                            <div className="space-y-4"><div className="flex justify-between text-xs font-black"><span className="text-slate-400 uppercase">Alan</span><span className="text-slate-900 dark:text-white text-base">{loc.total_area_m2 || 0} m²</span></div><div className="flex justify-between text-xs font-black pt-4 border-t border-slate-50 dark:border-slate-800"><span className="text-slate-400 uppercase">Hedef</span><span className="text-emerald-500 text-base">%{loc.target_reduction_percent} Azaltma</span></div></div>
                        </div>
                    ))}
                </div>
            )}

            {/* BULK MODAL */}
            {showBulkModal && (
                <Modal title={`${selectedYear} Yılı Toplu Giriş`} onClose={() => setShowBulkModal(false)} onSave={handleSaveBulk} saving={saving} color={bulkType === 'headcount' ? 'emerald' : bulkType === 'water' ? 'blue' : 'yellow'} wide={true}>
                    <div className="space-y-10">
                        <div className="p-6 bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 rounded-[32px]">
                            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-4 font-black text-sm"><ClipboardPaste className="w-5 h-5"/> Excel Verisini Yapıştırın</div>
                            <textarea value={pasteArea} onChange={e => setPasteArea(e.target.value)} placeholder="Verileri buraya kopyalayın..." className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 text-lg font-black outline-none min-h-[120px] shadow-inner" />
                            <button onClick={handlePaste} className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-lg hover:scale-105 transition-all">Verileri Dağıt</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <div key={month} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-[28px] border border-slate-100 dark:border-slate-800">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-3">{new Date(2000, month - 1).toLocaleDateString("tr-TR", { month: "long" })}</label>
                                    <input type="number" value={bulkValues[month] || ""} onChange={e => setBulkValues({ ...bulkValues, [month]: e.target.value })} className="w-full bg-transparent border-none p-0 text-xl font-black text-slate-900 dark:text-white outline-none" placeholder="0" />
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {/* LOCATION MODAL */}
            {showLocModal && (
                <Modal title={editingLoc ? "Lokasyonu Düzenle" : "Yeni Lokasyon Ekle"} onClose={() => setShowLocModal(false)} onSave={handleSaveLocation} saving={saving} color="indigo">
                    <div className="space-y-6">
                        <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Lokasyon Adı</label><input type="text" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold outline-none ring-1 ring-slate-100" /></div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Alan (m²)</label><input type="number" value={locForm.total_area_m2} onChange={e => setLocForm({...locForm, total_area_m2: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold outline-none ring-1 ring-slate-100" /></div>
                            <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Hedef (%)</label><input type="number" value={locForm.target_reduction_percent} onChange={e => setLocForm({...locForm, target_reduction_percent: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold outline-none ring-1 ring-slate-100" /></div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* RECORD MODAL */}
            {showRecModal && (
                <Modal title={editingRec ? "Kaydı Düzenle" : "Hızlı Kayıt"} onClose={() => setShowRecModal(false)} onSave={handleSaveRecord} saving={saving} color={colorClass === 'blue' ? 'blue' : 'yellow'}>
                    <div className="space-y-6">
                        <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Lokasyon</label><select value={recForm.resource_location_id} onChange={e => setRecForm({...recForm, resource_location_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold outline-none ring-1 ring-slate-100"><option value="">Seçiniz</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Yıl</label><input type="number" value={recForm.period_year} onChange={e => setRecForm({...recForm, period_year: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold outline-none" /></div>
                            <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Ay</label><select value={recForm.period_month} onChange={e => setRecForm({...recForm, period_month: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold outline-none">{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleDateString("tr-TR", { month: "long" })}</option>)}</select></div>
                        </div>
                        <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Tüketim ({unit})</label><input type="number" value={recForm.consumption} onChange={e => setRecForm({...recForm, consumption: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-2xl font-black outline-none ring-1 ring-slate-100" /></div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
