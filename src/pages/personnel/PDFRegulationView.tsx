import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Search, 
    BookOpen, 
    Calendar, 
    FileText, 
    ChevronRight, 
    MessageCircle,
    Info
} from "lucide-react";

export default function PDFRegulationView() {
    const [regulations, setRegulations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedReg, setSelectedReg] = useState<any | null>(null);

    useEffect(() => {
        fetchRegulations();
    }, []);

    const fetchRegulations = async () => {
        setLoading(true);
        try {
            // Only visible regulations
            const { data, error } = await supabase
                .from("pdf_regulations")
                .select("*, articles:pdf_articles(*)")
                .eq("is_visible", true)
                .order("created_at", { ascending: false });
            
            if (error) throw error;
            
            // Filter out invisible articles within visible regulations
            const filtered = (data || []).map(reg => ({
                ...reg,
                articles: reg.articles.filter((a: any) => a.is_visible)
            }));

            setRegulations(filtered);
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredRegs = regulations.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8 h-[calc(100vh-120px)]">
            {/* List Sidebar */}
            <div className={`flex-1 md:w-1/3 flex flex-col gap-6 ${selectedReg ? 'hidden md:flex' : 'flex'}`}>
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BookOpen className="w-7 h-7 text-indigo-600" />
                        Mevzuat Kütüphanesi
                    </h1>
                    
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Mevzuat ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm shadow-slate-100 dark:shadow-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-hide">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
                    ) : filteredRegs.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic">Mevzuat bulunamadı.</div>
                    ) : (
                        filteredRegs.map(reg => (
                            <button 
                                key={reg.id}
                                onClick={() => setSelectedReg(reg)}
                                className={`w-full text-left p-5 rounded-2xl transition-all border ${
                                    selectedReg?.id === reg.id 
                                    ? "bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none translate-x-1" 
                                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`}
                            >
                                <h3 className={`font-bold mb-2 line-clamp-2 ${selectedReg?.id === reg.id ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                    {reg.title}
                                </h3>
                                <div className={`flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-wider ${selectedReg?.id === reg.id ? "text-indigo-100" : "text-slate-500"}`}>
                                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {reg.articles.length} Madde</span>
                                    {reg.gazette_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {reg.gazette_date}</span>}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-[2] md:w-2/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden flex flex-col ${!selectedReg ? 'hidden md:flex items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-950/20' : 'flex animate-in fade-in slide-in-from-right-4 duration-500'}`}>
                {!selectedReg ? (
                    <div className="text-center space-y-4 max-w-sm">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <BookOpen className="w-10 h-10" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Okumaya Başlayın</h2>
                        <p className="text-sm">Sol taraftaki listeden bir yönetmelik veya kanun seçerek maddelerini inceleyebilirsiniz.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 sticky top-0 z-10 backdrop-blur-sm">
                            <button onClick={() => setSelectedReg(null)} className="md:hidden flex items-center gap-1 text-xs font-bold text-indigo-600 mb-4">
                                <ChevronRight className="w-4 h-4 rotate-180" /> Geri Dön
                            </button>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-6">{selectedReg.title}</h2>
                            <div className="flex flex-wrap gap-6">
                                {selectedReg.gazette_date && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resmi Gazete</p>
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Calendar className="w-4 h-4 text-indigo-500" />
                                            {selectedReg.gazette_date} {selectedReg.gazette_number && <span className="opacity-50">({selectedReg.gazette_number})</span>}
                                        </div>
                                    </div>
                                )}
                                {(selectedReg.last_modification_date) && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Son Değişiklik</p>
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Calendar className="w-4 h-4 text-rose-500" />
                                            {selectedReg.last_modification_date} {selectedReg.last_modification_number && <span className="opacity-50">({selectedReg.last_modification_number})</span>}
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1 ml-auto">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Durum</p>
                                    <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        GÜNCEL
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Articles */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-12 scroll-smooth">
                            {selectedReg.articles.map((art: any) => (
                                <div key={art.id} className="group relative">
                                    <div className="flex gap-8">
                                        <div className="hidden sm:block">
                                            <div className="text-lg font-black text-slate-200 dark:text-slate-800 group-hover:text-indigo-200 dark:group-hover:text-indigo-900/50 transition-colors py-1">
                                                {art.article_number.replace(/Madde|MADDE/i, "")}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                {art.article_number}
                                            </h4>
                                            <div className="text-slate-600 dark:text-slate-400 leading-relaxed text-[15px] whitespace-pre-wrap">
                                                {art.content}
                                            </div>
                                            
                                            {/* Admin Comment */}
                                            {art.admin_comment && (
                                                <div className="mt-6 p-5 bg-amber-500/5 border-l-4 border-amber-500 rounded-r-2xl">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2 bg-amber-500 text-white rounded-lg">
                                                            <MessageCircle className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 italic">Yönetici Notu</p>
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{art.admin_comment}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -left-8 top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors"></div>
                                </div>
                            ))}

                            <div className="pt-12 text-center text-slate-400 border-t border-slate-100 dark:border-slate-800">
                                <Info className="w-5 h-5 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">Mevzuatın sonuna ulaştınız.</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
