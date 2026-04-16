import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Lock, FileText, Printer, Plus, Trash2, ArrowRight, Home, Edit2 } from "lucide-react";
import SignaturePad from "@/components/adr/SignaturePad";

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
        total_1136_points: 0
    };
    
    const [doc, setDoc] = useState(emptyDoc);
    const [items, setItems] = useState<any[]>([]);
    
    // Current state indicators
    const [currentDocId, setCurrentDocId] = useState<string | null>(null);
    const [printDocId, setPrintDocId] = useState<string | null>(null);

    const totalQuantity = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

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
        
        // Fetch products & past docs
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

    const handlePrintOldDoc = (d: any) => {
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
        
        setLoading(true);
        if (currentDocId) {
            // Update
            const { error } = await supabase.rpc("tmgd_public_update_doc", {
                p_doc_id: currentDocId, p_client_id: clientData.id, p_doc: doc, p_items: items
            });
            if (error) alert("Güncelleme hatası: " + error.message);
            else setStep("print");
        } else {
            // Create
            const { data: generatedDocId, error } = await supabase.rpc("tmgd_public_create_doc", {
                p_client_id: clientData.id, p_doc: doc, p_items: items
            });
            if (error) alert("Oluşturma hatası: " + error.message);
            else {
                setCurrentDocId(generatedDocId);
                setStep("print");
            }
        }
        setLoading(false);
    };

    const backToDashboard = async () => {
        // Refresh docs
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Hoş Geldiniz, {clientData?.title}</h2>
                            <p className="text-slate-500 text-sm mt-1">Sisteme kayıtlı geçmiş tehlikeli madde sevkiyat evraklarınızı yönetin veya yenisini oluşturun.</p>
                        </div>
                        <button onClick={handleCreateNew} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 whitespace-nowrap">
                            <Plus className="w-5 h-5"/> Yeni Taşıma Evrakı
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Geçmiş Evraklarınız ({pastDocs.length})</h3>
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
                                    {pastDocs.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Henüz oluşturulmuş evrakınız bulunmamaktadır.</td></tr>
                                    ) : pastDocs.map(d => (
                                        <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{new Date(d.date).toLocaleDateString('tr-TR')}</td>
                                            <td className="px-6 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{d.driver_plate || '-'}</td>
                                            <td className="px-6 py-3">{d.waybill_no || '-'}</td>
                                            <td className="px-6 py-3 max-w-[200px] truncate" title={d.receiver_title}>{d.receiver_title}</td>
                                            <td className="px-6 py-3 text-right flex justify-end gap-2">
                                                <button onClick={() => handleEditDoc(d)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 text-xs font-medium">
                                                    <Edit2 className="w-3.5 h-3.5"/> Düzenle
                                                </button>
                                                <button onClick={() => handlePrintOldDoc(d)} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center gap-1.5 text-xs font-medium">
                                                    <Printer className="w-3.5 h-3.5"/> Yazdır
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
            <div className="min-h-screen bg-slate-100 print:bg-white p-4 print:p-0">
                <style>
                    {/* ZORUNLU EKRAN VE YAZICI STILLERİ (Gece modu çakışmalarını ezer) */}
                    {`
                    @media print {
                        * { color: black !important; border-color: black !important; }
                        @page { margin: 10mm; }
                        body { background-color: white !important; }
                        .no-print { display: none !important; }
                    }
                    .force-print-theme * { color: black; border-color: black; }
                    `}
                </style>

                <div className="max-w-[210mm] mx-auto bg-white mb-10 print:mb-0 shadow-lg print:shadow-none min-h-[297mm] p-[10mm] force-print-theme text-black">
                    <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
                        {clientData?.tmgd_logo_url ? <img src={clientData.tmgd_logo_url} className="h-14 object-contain" alt="TMGD Logo" /> : <div className="font-bold text-xl">TMGD Firması</div>}
                        <h1 className="text-2xl font-black text-center flex-1">TAŞIMA EVRAKI<br/><span className="text-sm font-normal">TRANSPORT DOCUMENT</span></h1>
                        {clientData?.logo_url ? <img src={clientData.logo_url} className="h-14 object-contain" alt="Client Logo" /> : <div className="font-bold text-xl">{clientData?.title}</div>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="border border-black p-2 rounded">
                            <h3 className="font-bold border-b border-black/20 pb-1 mb-1 text-xs uppercase">Gönderici (Sender)</h3>
                            <div className="font-bold text-[13px]">{clientData?.title}</div>
                            <div className="text-[11px] leading-tight mt-1">{clientData?.address}</div>
                            <div className="text-[11px] mt-1">Tel: {clientData?.tel}</div>
                        </div>
                        <div className="border border-black p-2 rounded">
                            <h3 className="font-bold border-b border-black/20 pb-1 mb-1 text-xs uppercase">Alıcı (Consignee)</h3>
                            <div className="font-bold text-[13px]">{doc.receiver_title}</div>
                            <div className="text-[11px] leading-tight mt-1">{doc.receiver_address}</div>
                            <div className="text-[11px] mt-1">Tel: {doc.receiver_tel}</div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-xs font-medium">
                        <div><b>Tarih:</b> {new Date(doc.date).toLocaleDateString("tr-TR")}</div>
                        <div><b>İrsaliye No:</b> {doc.waybill_no || "-"}</div>
                        <div><b>Sipariş No:</b> {doc.order_no || "-"}</div>
                        <div><b>Taşıma Kimlik No:</b> {doc.transport_id_no || "-"}</div>
                    </div>

                    <table className="w-full text-xs box-border border-collapse border border-black mb-4">
                        <thead className="bg-gray-100 font-bold uppercase text-center">
                            <tr>
                                <th className="border border-black p-1">UN No.</th>
                                <th className="border border-black p-1">Tam Sevkiyat İsmi ve Sınıf Detayları</th>
                                <th className="border border-black p-1">Ambalaj Özellikleri</th>
                                <th className="border border-black p-1">Tünel K.</th>
                                <th className="border border-black p-1">Miktar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, idx) => {
                                const p = catalog.find(c => c.id === it.product_id);
                                return (
                                <tr key={idx}>
                                    <td className="border border-black p-1.5 text-center font-bold text-[13px]">UN {p?.un_nr}</td>
                                    <td className="border border-black p-1.5">
                                        <b>{p?.shipping_name}</b>, {p?.class_nr}, {p?.pg} <br/>
                                        <span className="text-[9px] text-gray-800">Özel Hükümler: {p?.special_provisions || '-'}</span>
                                    </td>
                                    <td className="border border-black p-1.5 text-center">{it.package_count} x {it.package_type}</td>
                                    <td className="border border-black p-1.5 text-center font-bold">({p?.tunnel_code})</td>
                                    <td className="border border-black p-1.5 text-center font-bold text-[13px] leading-tight">
                                        {it.quantity} {p?.unit} <br/><span className="text-[9px] font-normal text-gray-600">Puan: {it.total_points}</span>
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    <div className="flex gap-4 mb-6 text-sm">
                        <div className="flex-1 space-y-1 text-xs border border-black p-2 rounded">
                            <div className="font-bold border-b border-black pb-1 mb-1 uppercase">Kargo Beyanları</div>
                            <div>Çok Modlu Taşıma?: <b>{doc.is_multimodal ? 'Evet' : 'Hayır'}</b></div>
                            <div>Sınırlı Miktar?: <b>{doc.is_limited ? 'Evet' : 'Hayır'}</b></div>
                            <div>Çevreye Zararlı?: <b>{doc.is_env_hazardous ? 'Evet' : 'Hayır'}</b></div>
                        </div>
                        <div className="w-1/2 flex flex-col gap-2">
                            <div className="border border-black p-2 rounded bg-gray-100 flex justify-between items-center h-full">
                                <b className="text-sm">Toplam Yük Miktarı:</b> 
                                <span className="font-mono text-xl font-black">{totalQuantity.toFixed(2)}</span>
                            </div>
                            <div className="border border-black p-2 rounded bg-gray-200 flex justify-between items-center h-full">
                                <b className="text-sm">1.1.3.6 Toplam MUA Puanı:</b> 
                                <span className="font-mono text-xl font-black">{doc.total_1136_points.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-xs border-t border-black pt-4">
                        <div className="text-center">
                            <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Gönderen Yetkili Sorumlu</h4>
                            <div className="font-bold mb-1">{doc.sender_name}</div>
                            {doc.sender_signature && <img src={doc.sender_signature} className="h-20 mx-auto object-contain" alt="imza"/>}
                        </div>
                        <div className="text-center">
                            <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Taşıyıcı / Teslim Alan Sürücü</h4>
                            <div className="font-bold">{doc.driver_name}</div>
                            <div className="mb-1 text-[10px]">{doc.carrier_company} | <span className="font-mono font-bold uppercase border border-black px-1">{doc.driver_plate}</span></div>
                            {doc.driver_signature && <img src={doc.driver_signature} className="h-20 mx-auto object-contain" alt="imza"/>}
                        </div>
                    </div>

                    <div className="mt-8 text-[9px] text-justify text-gray-800 italic border-t border-black pt-2">
                        * Bu taşıma evrakı "Tehlikeli Maddelerin Karayolu ile Taşınması Hakkında Yönetmelik" kapsamında ADR 5.4.1'e göre düzenlenmiştir. Taraflar, yukarıda belirtilen madde ve malların geçerli yönetmeliklere uygun şekilde paketlendiğini, etiketlendiğini ve karayolu taşımacılığına uygun durumda olduğunu beyan eder. İşbu belge, sevk işlemi süresince sürücü kabininde görünür biçimde bulundurulmak mecburiyetindedir.
                    </div>
                </div>

                <div className="fixed bottom-6 right-6 flex gap-3 print:hidden z-50">
                    <button onClick={backToDashboard} className="px-6 py-3 bg-white text-slate-800 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 font-bold flex items-center gap-2">
                        <Home className="w-5 h-5"/> Menüye Dön
                    </button>
                    <button onClick={() => window.print()} className="px-8 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 font-bold flex items-center gap-2 relative overflow-hidden group">
                        <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full"></span>
                        <Printer className="w-5 h-5 relative z-10"/> <span className="relative z-10">A4 Yazdır / Kaydet</span>
                    </button>
                </div>
            </div>
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
                                <input placeholder="Alıcı Ünvanı / Firma Adı" value={doc.receiver_title} onChange={e=>setDoc({...doc, receiver_title: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/>
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
                        {items.map((item, index) => {
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

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                        <h2 className="text-md font-bold mb-4 text-slate-800 dark:text-slate-100 border-b pb-2">Taşıyıcı ve Sürücü</h2>
                        <div><label className="block text-sm font-medium mb-1">Taşıyıcı Lojistik Firma</label><input value={doc.carrier_company} onChange={e=>setDoc({...doc, carrier_company: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Araç Plakası</label><input value={doc.driver_plate} onChange={e=>setDoc({...doc, driver_plate: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm font-mono font-bold uppercase"/></div>
                            <div><label className="block text-sm font-medium mb-1">Sürücü Adı</label><input value={doc.driver_name} onChange={e=>setDoc({...doc, driver_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-sm"/></div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl">
                                <SignaturePad label="Teslim Alan (Sürücü) İmzası" value={doc.driver_signature} onChange={s => setDoc(prev => ({...prev, driver_signature: s||""}))} required />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Action */}
                <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 fixed bottom-0 left-0 right-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] print:hidden">
                    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm font-medium text-slate-500">Mevzuat: ADR 5.4.1</div>
                        <button 
                            disabled={loading || !doc.sender_signature || !doc.driver_signature || items.length === 0} 
                            onClick={handleSubmitDoc} 
                            className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition disabled:opacity-50 flex gap-2 items-center justify-center"
                        >
                            {loading ? "Kaydediliyor..." : (currentDocId ? "Güncellemeyi Kaydet" : "Evrakı Oluştur")} <ArrowRight className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
