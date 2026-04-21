import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { 
    FileUp, 
    Loader2, 
    CheckCircle2, 
    History, 
    Eye, 
    EyeOff, 
    Trash2, 
    Calendar, 
    FileText,
    Save,
    X,
    AlertCircle
} from "lucide-react";

export default function PDFRegulationPage() {
    const { profile } = useAuthStore();
    const [status, setStatus] = useState<"idle" | "uploading" | "parsing" | "reviewing">("idle");
    const [parsedData, setParsedData] = useState<any | null>(null);
    const [regulations, setRegulations] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    
    // Metadata for the new regulation
    const [metadata, setMetadata] = useState({
        gazette_date: "",
        gazette_number: "",
        last_mod_date: "",
        last_mod_number: ""
    });

    useEffect(() => {
        fetchRegulations();
    }, []);

    const fetchRegulations = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("pdf_regulations")
                .select("*, articles:pdf_articles(*)")
                .order("created_at", { ascending: false });
            
            if (error) throw error;
            setRegulations(data || []);
        } catch (err: any) {
            console.error("Fetch error:", err);
            setError("Mevzuatlar yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            alert("Lütfen sadece PDF dosyası yükleyin.");
            return;
        }

        setStatus("parsing");
        setError("");
        try {
            // Local Marker Parser API'sini çağır (Vite Middleware)
            const response = await fetch("/api/parse-pdf", {
                method: "POST",
                body: await file.arrayBuffer()
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Ayrıştırma işlemi başarısız.");
            }

            const result = await response.json();
            setParsedData(result);
            setStatus("reviewing");
        } catch (err: any) {
            console.error("Parse error:", err);
            setError(err.message || "PDF ayrıştırılırken bir hata oluştu.");
            alert(err.message);
            setStatus("idle");
        }
    };

    const handleSave = async () => {
        if (!parsedData || !profile?.tenant_id) return;

        setLoading(true);
        try {
            // 1. Save Regulation
            const { data: reg, error: regErr } = await supabase
                .from("pdf_regulations")
                .insert([{
                    title: parsedData.title,
                    gazette_date: metadata.gazette_date || null,
                    gazette_number: metadata.gazette_number || null,
                    last_modification_date: metadata.last_mod_date || null,
                    last_modification_number: metadata.last_mod_number || null,
                    tenant_id: profile.tenant_id,
                    created_by: profile.id
                }])
                .select()
                .single();

            if (regErr) throw regErr;

            // 2. Save Articles
            const articlesToInsert = parsedData.articles.map((art: any) => ({
                reg_id: reg.id,
                article_number: art.article_number,
                content: art.content,
                is_visible: true
            }));

            const { error: artErr } = await supabase
                .from("pdf_articles")
                .insert(articlesToInsert);

            if (artErr) throw artErr;

            alert("Mevzuat başarıyla kaydedildi!");
            setParsedData(null);
            setMetadata({ gazette_date: "", gazette_number: "", last_mod_date: "", last_mod_number: "" });
            setStatus("idle");
            fetchRegulations();
        } catch (err: any) {
            alert("Kaydedilirken hata oluştu: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleRegVisibility = async (id: string, current: boolean) => {
        try {
            await supabase.from("pdf_regulations").update({ is_visible: !current }).eq("id", id);
            fetchRegulations();
        } catch (err) {
            alert("Hata oluştu.");
        }
    };

    const deleteReg = async (id: string) => {
        if (!confirm("Bu mevzuatı tamamen silmek istediğinize emin misiniz?")) return;
        try {
            await supabase.from("pdf_regulations").delete().eq("id", id);
            fetchRegulations();
        } catch (err) {
            alert("Silme hatası.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Akıllı Mevzuat Arşivi</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        PDF dökümanlarını yükleyin, yapay zeka ile otomatik olarak maddelere ayrıştırın.
                    </p>
                </div>
            </div>

            {/* Upload & Parse Section */}
            {status === "idle" && (
                <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
                    <input 
                        type="file" 
                        accept=".pdf" 
                        onChange={handleFileUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full mb-4">
                            <FileUp className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Yeni Mevzuat PDF'i Yükle</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Dosyayı buraya sürükleyin veya tıklayın</p>
                    </div>
                </div>
            )}

            {status === "parsing" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Doküman İşleniyor...</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Yapay zeka dökümanı analiz ediyor ve maddeleri ayrıştırıyor. Bu işlem dosya boyutuna göre birkaç saniye sürebilir.
                    </p>
                </div>
            )}

            {status === "reviewing" && parsedData && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Error Banner */}
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-4 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                <h3 className="text-xl font-bold">Ayrıştırma Başarılı</h3>
                            </div>
                            <button onClick={() => setStatus("idle")} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-8">
                            {/* Header Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider">Mevzuat Adı</label>
                                    <input 
                                        type="text" 
                                        value={parsedData.title}
                                        onChange={(e) => setParsedData({...parsedData, title: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">RG Tarihi</label>
                                        <input type="date" value={metadata.gazette_date} onChange={e => setMetadata({...metadata, gazette_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">RG Sayısı</label>
                                        <input type="text" value={metadata.gazette_number} onChange={e => setMetadata({...metadata, gazette_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent text-sm" placeholder="Örn: 32456" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Son Değ. Tar.</label>
                                        <input type="date" value={metadata.last_mod_date} onChange={e => setMetadata({...metadata, last_mod_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Son Değ. Sayı</label>
                                        <input type="text" value={metadata.last_mod_number} onChange={e => setMetadata({...metadata, last_mod_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Articles List */}
                            <div className="space-y-4">
                                <h4 className="font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-500" />
                                    Ayrıştırılan Maddeler ({parsedData.articles.length})
                                </h4>
                                <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3 scrollbar-hide">
                                    {parsedData.articles.map((art: any, idx: number) => (
                                        <div key={idx} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                                            <div className="flex gap-4">
                                                <input 
                                                    className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border rounded font-bold text-sm"
                                                    value={art.article_number}
                                                    onChange={(e) => {
                                                        const newArts = [...parsedData.articles];
                                                        newArts[idx].article_number = e.target.value;
                                                        setParsedData({...parsedData, articles: newArts});
                                                    }}
                                                />
                                                <textarea 
                                                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border rounded text-sm min-h-[80px]"
                                                    value={art.content}
                                                    onChange={(e) => {
                                                        const newArts = [...parsedData.articles];
                                                        newArts[idx].content = e.target.value;
                                                        setParsedData({...parsedData, articles: newArts});
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    onClick={() => setStatus("idle")}
                                    className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Vazgeç
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-5 h-5" />
                                    Mevzuatı Arşive Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* List Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-500">
                    <History className="w-5 h-5" />
                    <h2 className="font-bold uppercase tracking-widest text-sm">Arşivlenmiş Mevzuatlar</h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {loading && status === "idle" ? (
                        <div className="p-12 text-center text-slate-500">Yükleniyor...</div>
                    ) : regulations.length === 0 ? (
                        <div className="p-12 text-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                            Henüz yüklenmiş bir mevzuat bulunmuyor.
                        </div>
                    ) : (
                        regulations.map(reg => (
                            <div key={reg.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{reg.title}</h3>
                                            {!reg.is_visible && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold tracking-tighter">GİZLİ</span>}
                                        </div>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                                            {reg.gazette_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> RG: {reg.gazette_date} ({reg.gazette_number})</span>}
                                            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {reg.articles?.length || 0} Madde</span>
                                            <span className="flex items-center gap-1 font-medium text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded">Yapay Zeka Onaylı</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <button 
                                            onClick={() => toggleRegVisibility(reg.id, reg.is_visible)}
                                            className={`p-2 rounded-lg transition-colors ${reg.is_visible ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                            title={reg.is_visible ? "Alt kullanıcılardan gizle" : "Alt kullanıcılara göster"}
                                        >
                                            {reg.is_visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                        </button>
                                        <button 
                                            onClick={() => deleteReg(reg.id)}
                                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                                            title="Sil"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Article Quick Stats or Preview could go here */}
                                {reg.articles && reg.articles.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {reg.articles.slice(0, 5).map((art: any) => (
                                            <div key={art.id} className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full text-[10px] font-medium text-slate-500 whitespace-nowrap">
                                                {art.article_number}
                                            </div>
                                        ))}
                                        {reg.articles.length > 5 && <span className="text-[10px] text-slate-400 self-center">+{reg.articles.length - 5} daha</span>}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
