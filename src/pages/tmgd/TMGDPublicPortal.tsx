import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Lock, FileText, Printer, Plus, Trash2, ArrowRight, Home, Edit2, Eye, Search, AlertTriangle } from "lucide-react";
import SignaturePad from "@/components/adr/SignaturePad";
import ADRDocumentPrint from "./components/ADRDocumentPrint";

export default function TMGDPublicPortal() {
    const { slug } = useParams();
    const [step, setStep] = useState<"login" | "dashboard" | "form" | "print">("login");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Core Data
    const [clientData, setClientData] = useState<any>(null);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [pastDocs, setPastDocs] = useState<any[]>([]);

    // Form States
    const emptyDoc = {
        date: new Date().toISOString().split("T")[0],
        waybill_no: "", order_no: "", transport_id_no: "",
        receiver_title: "", receiver_address: "", receiver_tel: "",
        is_multimodal: false, is_limited: false, is_excepted: false, is_env_hazardous: false,
        sender_name: "", sender_signature: "",
        carrier_company: "", driver_name: "", driver_plate: "", driver_signature: "",
        total_1136_points: 0,
        adr_checklist: {
            ambalaj_hasar: 'evet',
            etiketleme_uygunluk: 'evet',
            arac_plaka_levha: 'evet',
            ambalaj_sizdirmazlik: 'evet',
            palet_konteyner: 'evet',
            yuk_guvenligi: 'evet',
            karisik_yukleme: 'evet',
            sizinti_onlem: 'evet',
            tasima_evraki: 'evet',
            src5: 'evet',
            mali_sorumluluk: 'evet'
        } as Record<string, string>
    };
    
    const [doc, setDoc] = useState(emptyDoc);
    const [items, setItems] = useState<any[]>([]);
    
    // Current state indicators
    const [currentDocId, setCurrentDocId] = useState<string | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [includeArchive, setIncludeArchive] = useState(false);

    // Düzenleme Onay Modal
    const [showEditConfirm, setShowEditConfirm] = useState(false);

    const totalQuantity = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

    const uniqueReceivers = Array.from(new Map(pastDocs.map(d => [d.receiver_title, {
        title: d.receiver_title,
        address: d.receiver_address,
        tel: d.receiver_tel
    }])).values()).filter((r: any) => r.title);

    // 5 Yıl filtresi + arama
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const filteredDocs = pastDocs.filter(d => {
        const docDate = new Date(d.date);

        // 5 yıl arşiv filtresi (arşiv modu açık değilse)
        if (!includeArchive && docDate < fiveYearsAgo) return false;

        // Tarih aralığı
        if (dateFrom && docDate < new Date(dateFrom)) return false;
        if (dateTo && docDate > new Date(dateTo + "T23:59:59")) return false;

        // Metin arama
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                (d.receiver_title || "").toLowerCase().includes(q) ||
                (d.waybill_no || "").toLowerCase().includes(q) ||
                (d.driver_plate || "").toLowerCase().includes(q) ||
                (d.driver_name || "").toLowerCase().includes(q) ||
                (d.order_no || "").toLowerCase().includes(q)
            );
        }
        return true;
    });

    const archivedCount = pastDocs.filter(d => new Date(d.date) < fiveYearsAgo).length;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const { data, error: err } = await supabase.rpc("tmgd_public_auth", { p_slug: slug, p_password: password });
        if (err || !data) {
            setError("Geçersiz şifre veya bağlantı süresi dolmuş.");
            setLoading(false);
            return;
        }
        setClientData(data);
        
        const [{ data: prodData }, { data: docsData }] = await Promise.all([
            supabase.rpc("tmgd_public_get_products", { p_client_id: data.id }),
            supabase.rpc("tmgd_public_get_docs", { p_client_id: data.id })
        ]);
        
        if (prodData) setCatalog(prodData);
        if (docsData) setPastDocs(docsData);
        
        setStep("dashboard");
        setLoading(false);
    };

    const handleCreateNew = () => {
        setDoc(emptyDoc);
        setItems([]);
        setCurrentDocId(null);
        setStep("form");
    };

    const handleEditDoc = (d: any) => {
        setDoc(d);
        setItems(d.items || []);
        setCurrentDocId(d.id);
        setStep("form");
    };

    const handleViewDoc = (d: any) => {
        setDoc(d);
        setItems(d.items || []);
        setCurrentDocId(d.id);
        setStep("print");
    };

    const addItem = () => {
        setItems([...items, { id: Date.now().toString(), product_id: "", package_type: "", package_count: 1, quantity: 0, total_points: 0 }]);
    };
    
    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
        calculateTotalPoints(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: string, value: any) => {
        const newItems = items.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            if (field === "product_id" || field === "quantity") {
                const prod = catalog.find(p => p.id === updated.product_id);
                if (prod && updated.quantity > 0) {
                    updated.total_points = updated.quantity * (prod.multiplier || 1);
                } else {
                    updated.total_points = 0;
                }
            }
            return updated;
        });
        setItems(newItems);
        calculateTotalPoints(newItems);
    };

    const calculateTotalPoints = (currItems: any[]) => {
        const total = currItems.reduce((acc, curr) => acc + (curr.total_points || 0), 0);
        setDoc(prev => ({...prev, total_1136_points: total }));
    };

    // Yeni evrak oluşturma / Düzenleme onay akışı
    const handleSubmitDoc = async () => {
        if (!doc.date || !doc.sender_signature || !doc.driver_signature) {
            alert("Lütfen tarih ve tüm imzaları onaylayarak tamamlayın.");
            return;
        }
        if (items.length === 0) {
            alert("En az bir madde/yük eklemelisiniz.");
            return;
        }
        if (items.some(i => !i.product_id || i.quantity <= 0)) {
            alert("Lütfen tüm maddeler için ürün seçin ve miktarlarını 0'dan büyük girin.");
            return;
        }
        
        if (currentDocId) {
            // Düzenleme modunda → önce onay modal göster
            setShowEditConfirm(true);
            return;
        }
        
        // Yeni evrak oluşturma
        setLoading(true);
        const { data: generatedDocId, error } = await supabase.rpc("tmgd_public_create_doc", {
            p_client_id: clientData.id, p_doc: doc, p_items: items
        });
        if (error) alert("Oluşturma hatası: " + error.message);
        else {
            setCurrentDocId(generatedDocId);
            setStep("print");
        }
        setLoading(false);
    };

    // Düzenleme onaylandıktan sonra kayıt
    const handleConfirmEdit = async () => {
        setShowEditConfirm(false);
        setLoading(true);
        const { error } = await supabase.rpc("tmgd_public_update_doc", {
            p_doc_id: currentDocId, p_client_id: clientData.id, p_doc: doc, p_items: items
        });
        if (error) alert("Güncelleme hatası: " + error.message);
        else setStep("print");
        setLoading(false);
    };

    const backToDashboard = async () => {
        setLoading(true);
        const { data: docsData } = await supabase.rpc("tmgd_public_get_docs", { p_client_id: clientData.id });
        if (docsData) setPastDocs(docsData);
        setStep("dashboard");
        setLoading(false);
    };

    // ------------------------------------------
    // 1. LOGIN UI
    // ------------------------------------------
    if (step === "login") {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 print:hidden">
                <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="p-8 text-center bg-indigo-600">
                        <Lock className="w-12 h-12 text-white/90 mx-auto mb-3" />
                        <h1 className="text-xl font-bold text-white mb-2">Güvenli Müşteri Girişi</h1>
                        <p className="text-indigo-100 text-sm">Adres: /tmgd/{slug}</p>
                    </div>
                    <form onSubmit={handleLogin} className="p-8">
                        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg text-sm text-center">{error}</div>}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Erişim Şifresi</label>
                            <input 
                                type="password" required value={password} onChange={e=>setPassword(e.target.value)} 
                                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 shadow-inner" 
                                placeholder="••••••••"
                            />
                        </div>
                        <button disabled={loading} type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
                            {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ------------------------------------------
    // 2. DASHBOARD UI
    // ------------------------------------------
    if (step === "dashboard") {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 print:hidden">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 sticky top-0 z-10 shadow-sm">
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                                <FileText className="w-6 h-6 text-indigo-600" /> TMGD Evrak Portalı
                            </h1>
                            <p className="text-sm text-slate-500 font-medium">{clientData?.title}</p>
                        </div>
                        <button onClick={() => {setStep('login'); setClientData(null)}} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition">Çıkış</button>
                    </div>
                </header>

                <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
                    {/* Hoş geldiniz + Yeni Evrak */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Hoş Geldiniz, {clientData?.title}</h2>
                            <p className="text-slate-500 text-sm mt-1">Sisteme kayıtlı tehlikeli madde sevkiyat evraklarınızı yönetin veya yenisini oluşturun.</p>
                        </div>
                        <button onClick={handleCreateNew} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 whitespace-nowrap">
                            <Plus className="w-5 h-5"/> Yeni Taşıma Evrakı
                        </button>
                    </div>

                    {/* Arama & Filtre */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            {/* Metin arama */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="İrsaliye no, plaka, alıcı adı, sipariş no..."
                                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            {/* Tarih aralığı */}
                            <div className="flex gap-2 items-center">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    title="Başlangıç tarihi"
                                />
                                <span className="text-slate-400 text-sm">—</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    title="Bitiş tarihi"
                                />
                            </div>
                            {/* Arşiv toggle */}
                            {archivedCount > 0 && (
                                <label className="flex items-center gap-2 cursor-pointer px-3 py-2.5 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm font-medium text-amber-800 dark:text-amber-400 whitespace-nowrap select-none">
                                    <input
                                        type="checkbox"
                                        checked={includeArchive}
                                        onChange={e => setIncludeArchive(e.target.checked)}
                                        className="text-amber-600 rounded"
                                    />
                                    Arşivde Ara ({archivedCount} kayıt)
                                </label>
                            )}
                        </div>
                        {(searchQuery || dateFrom || dateTo) && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-slate-500">{filteredDocs.length} sonuç bulundu</span>
                                <button onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); }} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Filtreyi Temizle</button>
                            </div>
                        )}
                    </div>

                    {/* Evrak Listesi */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">
                                Geçmiş Evraklarınız
                                <span className="ml-2 text-slate-400 font-normal text-sm">({filteredDocs.length} / {pastDocs.length})</span>
                            </h3>
                            {!includeArchive && archivedCount === 0 && (
                                <span className="text-xs text-slate-400">Son 5 yıl gösteriliyor</span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Tarih</th>
                                        <th className="px-6 py-3 font-medium">Araç / Plaka</th>
                                        <th className="px-6 py-3 font-medium">İrsaliye</th>
                                        <th className="px-6 py-3 font-medium">Alıcı</th>
                                        <th className="px-6 py-3 font-medium text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {filteredDocs.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                            {pastDocs.length === 0
                                                ? "Henüz oluşturulmuş evrakınız bulunmamaktadır."
                                                : "Arama kriterlerinize uygun evrak bulunamadı."}
                                        </td></tr>
                                    ) : filteredDocs.map(d => {
                                        const isOld = new Date(d.date) < fiveYearsAgo;
                                        return (
                                            <tr 
                                                key={d.id} 
                                                onClick={() => handleViewDoc(d)}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer group ${isOld ? 'opacity-60' : ''}`}
                                            >
                                                <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                                                    {new Date(d.date).toLocaleDateString('tr-TR')}
                                                    {isOld && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">ARŞİV</span>}
                                                </td>
                                                <td className="px-6 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{d.driver_plate || '-'}</td>
                                                <td className="px-6 py-3">{d.waybill_no || '-'}</td>
                                                <td className="px-6 py-3 max-w-[180px] truncate" title={d.receiver_title}>{d.receiver_title}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleViewDoc(d); }} 
                                                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 flex items-center gap-1.5 text-xs font-medium" 
                                                            title="Görüntüle"
                                                        >
                                                            <Eye className="w-3.5 h-3.5"/> Görüntüle
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleEditDoc(d); }} 
                                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 text-xs font-medium" 
                                                            title="Düzenle"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5"/> Düzenle
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleViewDoc(d); setTimeout(() => window.print(), 800); }} 
                                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1.5 text-xs font-medium shadow-sm" 
                                                            title="İndir / Yazdır"
                                                        >
                                                            <Printer className="w-3.5 h-3.5"/> İndir
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {archivedCount > 0 && !includeArchive && (
                            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10">
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    <span className="font-bold">{archivedCount} adet arşivlenmiş kayıt</span> gizleniyor (5 yıldan eski).
                                    <button onClick={() => setIncludeArchive(true)} className="ml-2 underline font-semibold hover:no-underline">Arşivde Ara</button>
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // ------------------------------------------
    // 3. PRINT UI
    // ------------------------------------------
    if (step === "print") {
        return (
            <ADRDocumentPrint 
                clientData={clientData} 
                doc={doc} 
                items={items} 
                catalog={catalog}
                onBack={backToDashboard}
                onEdit={() => setStep("form")}
            />
        );
    }

    // ------------------------------------------
    // 4. FORM UI
    // ------------------------------------------
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-600" />
                            {currentDocId ? "Evrak Düzenleme" : "Yeni Evrak Oluştur"}
                        </h1>
                    </div>
                    <button onClick={backToDashboard} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"><Home className="w-4 h-4"/> Panele Dön</button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
                
                {/* Genel Bilgiler */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100 border-b pb-2">Evrak Genel Bilgileri</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Sevk Tarihi</label><input type="date" value={doc.date} onChange={e=>setDoc({...doc, date: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                        <div><label className="block text-sm font-medium mb-1">İrsaliye No</label><input value={doc.waybill_no} onChange={e=>setDoc({...doc, waybill_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                        <div><label className="block text-sm font-medium mb-1">Sipariş No</label><input value={doc.order_no} onChange={e=>setDoc({...doc, order_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                        <div><label className="block text-sm font-medium mb-1">TKN (Kimlik No)</label><input value={doc.transport_id_no} onChange={e=>setDoc({...doc, transport_id_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-sm text-slate-500 uppercase mb-3">Gönderici (Otomatik)</h3>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{clientData?.title}</div>
                            <div className="text-sm mt-1">{clientData?.address}</div>
                            <div className="text-sm mt-1">{clientData?.tel}</div>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-500 uppercase mb-3">Alıcı Bilgileri</h3>
                            <div className="space-y-3">
                                <input 
                                    list="past-receivers" 
                                    placeholder="Alıcı Ünvanı / Firma Adı" 
                                    value={doc.receiver_title} 
                                    onChange={e=>{
                                        const val = e.target.value;
                                        const found = uniqueReceivers.find(r => r.title === val);
                                        if (found) {
                                            setDoc({...doc, receiver_title: val, receiver_address: found.address || "", receiver_tel: found.tel || ""});
                                        } else {
                                            setDoc({...doc, receiver_title: val});
                                        }
                                    }} 
                                    className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"
                                />
                                <datalist id="past-receivers">
                                    {uniqueReceivers.map(r => <option key={r.title} value={r.title} />)}
                                </datalist>

                                <input placeholder="Açık Adres" value={doc.receiver_address} onChange={e=>setDoc({...doc, receiver_address: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/>
                                <input placeholder="Telefon / İletişim" value={doc.receiver_tel} onChange={e=>setDoc({...doc, receiver_tel: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Yük Kalemleri */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Sevk Edilecek Ürünler</h2>
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="text-xs sm:text-sm font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md">
                                    <span className="text-slate-500">Miktar:</span> <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold ml-1">{totalQuantity.toFixed(2)}</span>
                                </div>
                                <div className="text-xs sm:text-sm font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md">
                                    <span className="text-slate-500">1.1.3.6 Puan:</span> <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold ml-1">{doc.total_1136_points.toFixed(2)}</span>
                                </div>
                                <button onClick={addItem} type="button" className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700 font-medium"> <Plus className="w-4 h-4"/> Yük Ekle</button>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {items.length === 0 && <div className="text-center p-8 text-slate-500 italic">Yük eklemek için "Yük Ekle" butonuna tıklayınız.</div>}
                        {items.map((item) => {
                            const p = catalog.find(c => c.id === item.product_id);
                            return (
                                <div key={item.id} className="relative bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <button onClick={() => removeItem(item.id)} className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-full shadow-sm transition"><Trash2 className="w-4 h-4"/></button>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-5">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tehlikeli Madde (UN Kataloğu)</label>
                                            <select value={item.product_id} onChange={e=>updateItem(item.id, 'product_id', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm font-medium">
                                                <option value="">-- Listeden Seçin --</option>
                                                {catalog.map(c => <option key={c.id} value={c.id}>{c.short_name} // {c.shipping_name} (UN {c.un_nr})</option>)}
                                            </select>
                                            {p && <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                                                <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">Sınıf: {p.class_nr}</span>
                                                <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">PG: {p.pg}</span>
                                                <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">Tünel: {p.tunnel_code}</span>
                                                <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-bold">Çarpan: {p.multiplier}</span>
                                            </div>}
                                        </div>
                                        
                                        <div className="md:col-span-2">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ambalaj Tipi</label>
                                            <input placeholder="Örn: Varil" value={item.package_type} onChange={e=>updateItem(item.id, 'package_type', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"/>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ambalaj Adedi</label>
                                            <input type="number" min="1" value={item.package_count} onChange={e=>updateItem(item.id, 'package_count', parseInt(e.target.value)||0)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm text-center"/>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Miktar ({p?.unit || 'Kg/Lt'})</label>
                                            <input type="number" step="0.01" value={item.quantity} onChange={e=>updateItem(item.id, 'quantity', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"/>
                                        </div>
                                        
                                        <div className="md:col-span-1 flex flex-col justify-end">
                                            <div className="text-center pb-2">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Puan</div>
                                                <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.total_points}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Ek Özellikler & Taraflar & İmzalar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                        <h2 className="text-md font-bold mb-4 text-slate-800 dark:text-slate-100 border-b pb-2">Sevk Detayları & Kurallar</h2>
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-700">
                            <input type="checkbox" checked={doc.is_multimodal} onChange={e=>setDoc({...doc, is_multimodal: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                            <span className="text-sm font-medium">Çoklu Modlu Taşıma (Multimodal Cargo)</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-700">
                            <input type="checkbox" checked={doc.is_limited} onChange={e=>setDoc({...doc, is_limited: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                            <span className="text-sm font-medium">Sınırlı Miktar (Limited Quantity - LQ)</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-700">
                            <input type="checkbox" checked={doc.is_env_hazardous} onChange={e=>setDoc({...doc, is_env_hazardous: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                            <span className="text-sm font-medium">Tüm Yük Çevreye Zararlı</span>
                        </label>

                        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-medium mb-1">Gönderen Sorumlu Adı Soyadı</label>
                            <input placeholder="Yetkili Kişi" value={doc.sender_name} onChange={e=>setDoc({...doc, sender_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm mb-4"/>
                            
                            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl">
                                <SignaturePad label="Gönderici (Sizin) İmzanız" value={doc.sender_signature} onChange={s => setDoc(prev => ({...prev, sender_signature: s||""}))} required />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h2 className="text-md font-bold mb-4 text-slate-800 dark:text-slate-100 border-b pb-2">Taşıyıcı ve Sürücü</h2>
                            <div><label className="block text-sm font-medium mb-1">Taşıyıcı Lojistik Firma</label><input value={doc.carrier_company} onChange={e=>setDoc({...doc, carrier_company: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Araç Plakası</label><input value={doc.driver_plate} onChange={e=>setDoc({...doc, driver_plate: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm font-mono font-bold uppercase"/></div>
                                <div><label className="block text-sm font-medium mb-1">Sürücü Adı</label><input value={doc.driver_name} onChange={e=>setDoc({...doc, driver_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl">
                                <SignaturePad label="Teslim Alan (Sürücü) İmzası" value={doc.driver_signature} onChange={s => setDoc(prev => ({...prev, driver_signature: s||""}))} required />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ARAÇ KONTROL FORMU (YÜKLEYEN-GÖNDEREN) */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Araç Kontrol Formu (Yükleyen-Gönderen)</h2>
                            <p className="text-sm text-slate-500">Mevzuata uygun olarak sevkiyat kontrol aşamalarını işaretleyiniz. İşaretlenen veriler çıktı sayfasına otomatik yansır.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {[
                            { title: 'Ambalaj Uygunluğu', items: [
                                { key: 'ambalaj_hasar', text: 'Ambalaj dış yüzeyinde hasar var mı?' },
                                { key: 'etiketleme_uygunluk', text: 'Etiketlemeler uygun mu?' }
                            ]},
                            { title: 'Taşıt ve Ambalaj İşaret-Etiket Zorunlulukları', items: [
                                { key: 'arac_plaka_levha', text: 'Araç ön/arka turuncu plaka var mı?' },
                                { key: 'ambalaj_sizdirmazlik', text: 'Ambalaj sızdırmazlığı uygun mu?' },
                                { key: 'palet_konteyner', text: 'Palet/Konteyner uygun mu?' },
                                { key: 'yuk_guvenligi', text: 'Yükler güvenli yerleştirildi mi?' }
                            ]},
                            { title: 'Karışık Yükleme/Ambalajlama & Belge', items: [
                                { key: 'karisik_yukleme', text: 'İzin verilen sınıflar kontrol edildi mi?' },
                                { key: 'sizinti_onlem', text: 'Sızıntı riskine karşı önlem alındı mı?' },
                                { key: 'tasima_evraki', text: 'Taşıma Evrakı Var mı?' },
                                { key: 'src5', text: 'SRC-5 Belgesi Var mı?' },
                                { key: 'mali_sorumluluk', text: 'Sigorta Poliçesi Var mı?' }
                            ]}
                        ].map((section, idx) => (
                            <div key={idx} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold text-sm text-indigo-600 uppercase mb-4">{section.title}</h3>
                                <div className="space-y-4">
                                    {section.items.map(item => (
                                        <div key={item.key} className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-tight block">{item.text}</label>
                                            <div className="flex gap-4">
                                                {['Evet', 'Hayır', 'Kısmen'].map((opt) => (
                                                    <label key={opt} className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-colors">
                                                        <input 
                                                            type="radio" 
                                                            name={`chk_${item.key}`} 
                                                            value={opt.toLowerCase()} 
                                                            checked={doc.adr_checklist?.[item.key] === opt.toLowerCase()}
                                                            onChange={(e) => setDoc(prev => ({
                                                                ...prev, 
                                                                adr_checklist: { ...prev.adr_checklist, [item.key]: e.target.value }
                                                            }))}
                                                            className="text-indigo-600"
                                                        />
                                                        <span className="text-xs font-medium">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Action */}
                <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 fixed bottom-0 left-0 right-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] print:hidden">
                    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm font-medium text-slate-500">Mevzuat: ADR 5.4.1 & Kontrol Formu</div>
                        <button 
                            disabled={loading || !doc.sender_signature || !doc.driver_signature || items.length === 0} 
                            onClick={handleSubmitDoc} 
                            className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition disabled:opacity-50 flex gap-2 items-center justify-center"
                        >
                            {loading ? "Kaydediliyor..." : (currentDocId ? "Düzenlemeyi Kaydet" : "2 Sayfa Evrakı Oluştur")} <ArrowRight className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </main>

            {/* ─── Düzenleme Onay Modal ─── */}
            {showEditConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-8">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Düzenlemeyi Onaylayın</h3>
                                <p className="text-sm text-slate-500">Bu işlem geri alınamaz.</p>
                            </div>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">
                            Bu evrakta değişiklik yaptınız. Düzenlemeyi onaylıyor musunuz?<br/>
                            <span className="text-xs text-slate-400 mt-1 block">Mevcut evrak güncellenecek ve yeni veriler kaydedilecektir.</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEditConfirm(false)}
                                className="flex-1 px-5 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleConfirmEdit}
                                disabled={loading}
                                className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                            >
                                {loading ? "Kaydediliyor..." : "Evet, Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
