import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, MapPin, Plus, Trash2, Edit2, Check, X, Clock, ChevronDown, ChevronRight, AlertCircle, Trash } from "lucide-react";

export type LegalArticle = {
    id?: string;
    regulation_id?: string;
    article_number: string;
    provision: string;
    period: string;
    is_active: boolean;
};

export type LegalTracking = {
    id: string;
    article_id: string;
    location: string;
    current_status: string | null;
    is_applicable: boolean;
    is_compliant: boolean | null;
    action_required: string | null;
    responsible_persons: string | null;
    due_date: string | null;
};

export type LegalArticleWithTrackings = LegalArticle & { trackings?: LegalTracking[] };
export type LegalRegulationWithTrackings = {
    id: string;
    name: string;
    gazette_date: string | null;
    gazette_number: string | null;
    last_modification_date: string | null;
    effective_date: string | null;
    is_active: boolean;
    created_at: string;
    articles?: LegalArticleWithTrackings[];
};

export default function LegalListTab() {
    const [regulations, setRegulations] = useState<LegalRegulationWithTrackings[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    
    // Reg/Art Form
    const [isRegModalOpen, setIsRegModalOpen] = useState(false);
    const [editingReg, setEditingReg] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [regFormData, setRegFormData] = useState({ name: "", gazette_date: "", gazette_number: "", last_modification_date: "", effective_date: "", is_active: true });
    const [articlesData, setArticlesData] = useState<LegalArticle[]>([]);

    // Tracking Form
    const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
    const [actArtForTrack, setActArtForTrack] = useState<LegalArticleWithTrackings | null>(null);
    const [actRegForTrack, setActRegForTrack] = useState<LegalRegulationWithTrackings | null>(null);
    const [editingTrack, setEditingTrack] = useState<LegalTracking | null>(null);
    const [trackFormData, setTrackFormData] = useState({
        location: "", current_status: "", is_applicable: true, is_compliant: "null" as "true"|"false"|"null", action_required: "", responsible_persons: "", due_date: ""
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: regsData, error: regsError } = await supabase.from("legal_regulations").select("*").order("name", { ascending: true });
        if (regsError) { console.error(regsError); setLoading(false); return; }

        const { data: artsData } = await supabase.from("legal_articles").select("*").order("created_at", { ascending: true });
        const { data: tracksData } = await supabase.from("legal_tracking").select("*").order("location", { ascending: true });

        if (regsData) {
            const compiled = regsData.map(reg => {
                const regArts = (artsData || []).filter(a => a.regulation_id === reg.id).map(a => ({
                    ...a, trackings: (tracksData || []).filter(t => t.article_id === a.id)
                }));
                return { ...reg, articles: regArts };
            });
            setRegulations(compiled as LegalRegulationWithTrackings[]);
        }
        setLoading(false);
    };

    // -- REGULATION & ARTICLE LOGIC --
    const handleSaveReg = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(""); setIsSaving(true);
        try {
            const regPayload = {
                name: regFormData.name, gazette_date: regFormData.gazette_date || null, gazette_number: regFormData.gazette_number || null,
                last_modification_date: regFormData.last_modification_date || null, effective_date: regFormData.effective_date || null, is_active: regFormData.is_active
            };
            let currentRegId = editingReg?.id;
            if (editingReg) {
                const { error } = await supabase.from("legal_regulations").update(regPayload).eq("id", editingReg.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from("legal_regulations").insert([regPayload]).select().single();
                if (error) throw error;
                currentRegId = data.id;
            }
            if (!currentRegId) throw new Error("ID alınamadı.");

            const { data: currArts } = await supabase.from("legal_articles").select("id").eq("regulation_id", currentRegId);
            const existingIds = (currArts || []).map(a => a.id);
            const newSubmittedIds = articlesData.filter(a => a.id).map(a => a.id!);
            
            const idsToDelete = existingIds.filter(id => !newSubmittedIds.includes(id));
            if (idsToDelete.length > 0) { await supabase.from("legal_articles").delete().in("id", idsToDelete); }

            for (const item of articlesData) {
                const artPayload = { regulation_id: currentRegId, article_number: item.article_number, provision: item.provision, period: item.period || null, is_active: item.is_active };
                if (item.id) await supabase.from("legal_articles").update(artPayload).eq("id", item.id);
                else await supabase.from("legal_articles").insert([artPayload]);
            }
            setIsRegModalOpen(false); fetchData();
        } catch (err: any) { setErrorMsg(err.message || "Bilinmeyen Hata."); } finally { setIsSaving(false); }
    };

    const deleteReg = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Bu yönetmeliği tamamen silmek istediğinize emin misiniz?")) return;
        await supabase.from("legal_regulations").delete().eq("id", id);
        fetchData();
    };

    const openEditReg = (reg: LegalRegulationWithTrackings, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingReg(reg);
        setRegFormData({ name: reg.name, gazette_date: reg.gazette_date || "", gazette_number: reg.gazette_number || "", last_modification_date: reg.last_modification_date || "", effective_date: reg.effective_date || "", is_active: reg.is_active });
        setArticlesData(JSON.parse(JSON.stringify(reg.articles || [])));
        setErrorMsg(""); setIsRegModalOpen(true);
    };

    const openAddReg = () => {
        setEditingReg(null);
        setRegFormData({ name: "", gazette_date: "", gazette_number: "", last_modification_date: "", effective_date: "", is_active: true });
        setArticlesData([{ article_number: "", provision: "", period: "", is_active: true }]);
        setErrorMsg(""); setIsRegModalOpen(true);
    };

    const openAddArticleFromList = (reg: LegalRegulationWithTrackings, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingReg(reg);
        setRegFormData({ name: reg.name, gazette_date: reg.gazette_date || "", gazette_number: reg.gazette_number || "", last_modification_date: reg.last_modification_date || "", effective_date: reg.effective_date || "", is_active: reg.is_active });
        const curArts = JSON.parse(JSON.stringify(reg.articles || []));
        setArticlesData([...curArts, { article_number: "", provision: "", period: "", is_active: true }]);
        setErrorMsg(""); setIsRegModalOpen(true);
        setExpandedIds(new Set(expandedIds).add(reg.id));
    };

    // -- TRACKING LOGIC --
    const openAddTrack = (art: LegalArticleWithTrackings, reg: LegalRegulationWithTrackings) => {
        setActArtForTrack(art); setActRegForTrack(reg); setEditingTrack(null);
        setTrackFormData({ location: "", current_status: "", is_applicable: true, is_compliant: "null", action_required: "", responsible_persons: "", due_date: "" });
        setIsTrackModalOpen(true);
    };
    const openEditTrack = (t: LegalTracking, art: LegalArticleWithTrackings, reg: LegalRegulationWithTrackings) => {
        setActArtForTrack(art); setActRegForTrack(reg); setEditingTrack(t);
        setTrackFormData({ location: t.location, current_status: t.current_status || "", is_applicable: t.is_applicable, is_compliant: t.is_compliant === true ? "true" : t.is_compliant === false ? "false" : "null", action_required: t.action_required || "", responsible_persons: t.responsible_persons || "", due_date: t.due_date || "" });
        setIsTrackModalOpen(true);
    };
    const saveTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!actArtForTrack?.id) return;
        const payload = {
            article_id: actArtForTrack.id, location: trackFormData.location, current_status: trackFormData.current_status || null,
            is_applicable: trackFormData.is_applicable, is_compliant: trackFormData.is_compliant === "true" ? true : trackFormData.is_compliant === "false" ? false : null,
            action_required: trackFormData.action_required || null, responsible_persons: trackFormData.responsible_persons || null, due_date: trackFormData.due_date || null
        };
        if(editingTrack) await supabase.from("legal_tracking").update(payload).eq("id", editingTrack.id);
        else await supabase.from("legal_tracking").insert([payload]);
        setIsTrackModalOpen(false); fetchData();
    };
    const deleteTrack = async (id: string) => {
        if(!confirm("Kaydı silmek istiyor musunuz?")) return;
        await supabase.from("legal_tracking").delete().eq("id", id);
        fetchData();
    };

    // Calculate Due Days Date
    const renderDueDaysInfo = (dueStr: string | null) => {
        if(!dueStr) return <span className="text-slate-400">-</span>;
        const due = new Date(dueStr); const now = new Date();
        due.setHours(0,0,0,0); now.setHours(0,0,0,0);
        const diff = due.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 3600 * 24));
        
        const text = days < 0 ? `${Math.abs(days)} Gün Gecikti` : days === 0 ? "Bugün" : `${days} Gün Kaldı`;
        const cls = days < 0 ? "text-rose-600 font-bold" : days <= 7 ? "text-amber-600 font-semibold" : "text-emerald-600 font-medium";
        
        return (
            <div className="flex flex-col">
                <span className="text-slate-700 dark:text-slate-300">{dueStr}</span>
                <span className={`text-[10px] uppercase ${cls}`}>{text}</span>
            </div>
        );
    };

    const toggleExpand = (id: string) => {
        const n = new Set(expandedIds);
        n.has(id) ? n.delete(id) : n.add(id);
        setExpandedIds(n);
    };

    const filtered = regulations.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Yönetmelik ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64 dark:bg-slate-900" />
                </div>
                <button onClick={openAddReg} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
                    <Plus className="w-4 h-4" /> Yeni Yönetmelik Ekle
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {loading ? <div className="p-8 text-center text-slate-500">Yükleniyor...</div> : filtered.length === 0 ? <div className="p-8 text-center text-slate-500">Kayıt bulunamadı.</div> : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filtered.map(reg => (
                            <div key={reg.id} className="flex flex-col">
                                <div onClick={() => toggleExpand(reg.id)} className="flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                                    <button className="mr-3 text-slate-400 hover:text-indigo-600 focus:outline-none">
                                        {expandedIds.has(reg.id) ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                                    </button>
                                    <div className="flex-1 flex items-center justify-between pl-2">
                                        <div className="flex flex-col">
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">{reg.name}</div>
                                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                                {reg.gazette_date && <span><strong>RG Tarihi:</strong> {reg.gazette_date}</span>}
                                                {reg.gazette_number && <span><strong>RG Sayı:</strong> {reg.gazette_number}</span>}
                                                {reg.effective_date && <span><strong>Yürürlük:</strong> {reg.effective_date}</span>}
                                                {reg.last_modification_date && <span><strong>Son Değişiklik:</strong> {reg.last_modification_date}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 ml-4">
                                            {!reg.is_active && <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">GEÇERSİZ</span>}
                                            <span className="shrink-0 text-xs text-slate-500">{reg.articles?.length || 0} Madde</span>
                                            <div className="flex space-x-1">
                                                <button title="Yeni Madde Ekle" onClick={(e) => openAddArticleFromList(reg, e)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-indigo-500 rounded hover:bg-indigo-50"><Plus className="w-4 h-4" /></button>
                                                <button title="Düzenle" onClick={(e) => openEditReg(reg, e)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded hover:bg-indigo-50 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                                <button title="Sil" onClick={(e) => deleteReg(reg.id, e)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {expandedIds.has(reg.id) && (
                                    <div className="bg-slate-50/50 dark:bg-slate-800/20 pl-14 pr-4 py-4 border-t border-slate-100 dark:border-slate-800/50 space-y-4">
                                        {reg.articles?.length === 0 && <p className="text-sm text-slate-500 italic">Madde bulunmuyor.</p>}
                                        {reg.articles?.map(art => (
                                            <div key={art.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start gap-3">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                            {art.article_number}
                                                            {!art.is_active && <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-100 text-rose-800">GEÇERSİZ</span>}
                                                        </h4>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{art.provision}</p>
                                                    </div>
                                                    <button onClick={() => openAddTrack(art, reg)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold">
                                                        <Plus className="w-3.5 h-3.5"/> Lokasyon Ekle
                                                    </button>
                                                </div>
                                                
                                                <div className="p-0">
                                                    {!art.trackings || art.trackings.length === 0 ? (
                                                        <div className="p-3 text-center text-xs text-slate-400">Lokasyon / Takip eklenmemiş.</div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-xs whitespace-nowrap">
                                                                <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-slate-500 font-medium">Lokasyon</th>
                                                                        <th className="px-4 py-2 text-slate-500 font-medium">Uygunluk</th>
                                                                        <th className="px-4 py-2 text-slate-500 font-medium max-w-[200px]">Mevcut Durum / Aksiyon</th>
                                                                        <th className="px-4 py-2 text-slate-500 font-medium">Sorumlu</th>
                                                                        <th className="px-4 py-2 text-slate-500 font-medium">Termin</th>
                                                                        <th className="px-4 py-2 text-right">İşlem</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                                    {art.trackings.map(t => (
                                                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                                            <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                                                                                {t.location}
                                                                                {!t.is_applicable && <div className="text-[10px] text-rose-500 mt-0.5 font-normal">Bu lokasyonda ARANMAZ</div>}
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                {t.is_compliant === true ? <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><Check className="w-3 h-3"/> Uygun</span> : 
                                                                                 t.is_compliant === false ? <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"><X className="w-3 h-3"/> Çarpı</span> : 
                                                                                 <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"><Clock className="w-3 h-3"/> Bekliyor</span>}
                                                                            </td>
                                                                            <td className="px-4 py-2 max-w-[200px] truncate" title={t.current_status || ""}>
                                                                                {t.current_status ? <span className="text-slate-600 dark:text-slate-400">{t.current_status}</span> : "-"}
                                                                                {t.action_required && <div className="text-[10px] text-indigo-500 mt-0.5">Aksiyon: {t.action_required}</div>}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{t.responsible_persons || "-"}</td>
                                                                            <td className="px-4 py-2">{renderDueDaysInfo(t.due_date)}</td>
                                                                            <td className="px-4 py-2 text-right space-x-1">
                                                                                <button onClick={() => openEditTrack(t, art, reg)} className="p-1 px-2 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 hover:text-indigo-600">Düzenle</button>
                                                                                <button onClick={() => deleteTrack(t.id)} className="p-1 px-2 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 hover:text-rose-600">Sil</button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Regulation / Article Form Modal */}
            {isRegModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between">
                            <h3 className="font-semibold text-slate-900 dark:text-white">Yönetmelik/Madde Düzenle</h3>
                            <button onClick={() => setIsRegModalOpen(false)} className="text-slate-400">×</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {errorMsg && <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-sm rounded flex items-center"><AlertCircle className="w-5 h-5 mr-2"/>{errorMsg}</div>}
                            <form id="regForm" onSubmit={handleSaveReg} className="space-y-6">
                                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
                                    <h4 className="text-sm font-semibold">1. Yönetmelik Künyesi</h4>
                                    <div className="space-y-1">
                                        <label className="text-xs">Yönetmelik Adı *</label>
                                        <input required value={regFormData.name} onChange={e => setRegFormData({...regFormData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-600" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-xs">Resmi Gazete Tarihi</label><input type="date" value={regFormData.gazette_date} onChange={e => setRegFormData({...regFormData, gazette_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-600" /></div>
                                        <div className="space-y-1"><label className="text-xs">Sayısı</label><input type="text" value={regFormData.gazette_number} onChange={e => setRegFormData({...regFormData, gazette_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-600" /></div>
                                        <div className="space-y-1"><label className="text-xs">Yürürlük Tarihi</label><input type="date" value={regFormData.effective_date} onChange={e => setRegFormData({...regFormData, effective_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-600" /></div>
                                        <div className="space-y-1"><label className="text-xs">Son Değişiklik</label><input type="date" value={regFormData.last_modification_date} onChange={e => setRegFormData({...regFormData, last_modification_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-600" /></div>
                                    </div>
                                    <div><input type="checkbox" checked={regFormData.is_active} onChange={e => setRegFormData({...regFormData, is_active: e.target.checked})} className="mr-2"/>Geçerliliğini koruyor</div>
                                </div>
                                <div className="space-y-4 p-4 border rounded-xl">
                                    <div className="flex justify-between items-center"><h4 className="text-sm font-semibold">2. İlgili Maddeler</h4><button type="button" onClick={() => setArticlesData([...articlesData, { article_number:"", provision:"", period:"", is_active:true }])} className="text-xs text-indigo-600 flex"><Plus className="w-3 h-3 mr-1"/>Madde Ekle</button></div>
                                    {articlesData.map((art, idx) => (
                                        <div key={idx} className="p-4 border rounded-lg relative space-y-3">
                                            {articlesData.length>1&&<button type="button" onClick={()=>setArticlesData(articlesData.filter((_,i)=>i!==idx))} className="absolute top-2 right-2 text-rose-500"><Trash className="w-4 h-4"/></button>}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1"><label className="text-xs">Madde No *</label><input required value={art.article_number} onChange={e => {const n=[...articlesData];n[idx].article_number=e.target.value;setArticlesData(n)}} className="w-full px-3 py-1.5 border rounded-md text-sm bg-transparent" /></div>
                                                <div className="space-y-1"><label className="text-xs">Periyod</label><input value={art.period} onChange={e => {const n=[...articlesData];n[idx].period=e.target.value;setArticlesData(n)}} className="w-full px-3 py-1.5 border rounded-md text-sm bg-transparent" /></div>
                                            </div>
                                            <div className="space-y-1"><label className="text-xs">Hükmü *</label><textarea required value={art.provision} onChange={e => {const n=[...articlesData];n[idx].provision=e.target.value;setArticlesData(n)}} className="w-full px-3 py-1.5 border rounded-md text-sm h-16 bg-transparent" /></div>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2 bg-slate-50"><button onClick={()=>setIsRegModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">İptal</button><button form="regForm" type="submit" disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{isSaving?"Kaydediliyor...":"Kaydet"}</button></div>
                    </div>
                </div>
            )}

            {/* Tracking Modify Modal */}
            {isTrackModalOpen && actArtForTrack && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl flex flex-col">
                        <div className="p-4 border-b flex justify-between"><h3 className="font-semibold text-slate-900 dark:text-white">Lokasyon Takibi Ekle/Düzenle</h3><button onClick={()=>setIsTrackModalOpen(false)} className="text-slate-400">×</button></div>
                        <div className="p-4 overflow-y-auto max-h-[70vh]">
                            <form id="trackForm" onSubmit={saveTrack} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label className="text-xs">Lokasyon Adı *</label><input required value={trackFormData.location} onChange={e=>setTrackFormData({...trackFormData, location:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent" /></div>
                                    <div className="space-y-1"><label className="text-xs">Uygunluk Durumu</label><select value={trackFormData.is_compliant} onChange={e=>setTrackFormData({...trackFormData, is_compliant:e.target.value as any})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"><option value="null">Bekliyor</option><option value="true">Uygun</option><option value="false">Uygun Değil</option></select></div>
                                </div>
                                <div className="space-y-1"><label className="text-xs">Mevcut Durum</label><textarea value={trackFormData.current_status} onChange={e=>setTrackFormData({...trackFormData, current_status:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent h-14" /></div>
                                <div className="space-y-1"><label className="text-xs">Alınacak Aksiyon</label><textarea value={trackFormData.action_required} onChange={e=>setTrackFormData({...trackFormData, action_required:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent h-14" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label className="text-xs">Sorumlu</label><input value={trackFormData.responsible_persons} onChange={e=>setTrackFormData({...trackFormData, responsible_persons:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent" /></div>
                                    <div className="space-y-1"><label className="text-xs">Termin Tarihi</label><input type="date" value={trackFormData.due_date} onChange={e=>setTrackFormData({...trackFormData, due_date:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent" /></div>
                                </div>
                                <div><input type="checkbox" checked={trackFormData.is_applicable} onChange={e=>setTrackFormData({...trackFormData, is_applicable:e.target.checked})} className="mr-2 text-indigo-600" />Lokasyonda Aranmaktadır</div>
                            </form>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2 bg-slate-50"><button onClick={()=>setIsTrackModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">İptal</button><button form="trackForm" type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Kaydet</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
