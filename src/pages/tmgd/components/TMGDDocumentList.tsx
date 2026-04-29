import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Folder, FileText, Printer, CheckSquare, ArrowLeft, CheckCircle2, Download } from "lucide-react";
import ADRDocumentPrint from "./ADRDocumentPrint";
import JSZip from "jszip";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import ReactDOM from "react-dom/client";

export default function TMGDDocumentList() {
    const profile = useAuthStore(state => state.profile);
    const [clients, setClients] = useState<any[]>([]);
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'clients' | 'docs'>('clients');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
    const [printDocs, setPrintDocs] = useState<any[] | null>(null);
    const [mainCompany, setMainCompany] = useState<any>(null);

    useEffect(() => {
        if (profile) {
            fetchClientsAndDocs();
            fetchMainCompany();
        }
    }, [profile]);

    const fetchMainCompany = async () => {
        const { data } = await supabase.from("companies").select("*").eq("id", profile?.tenant_id).single();
        if (data) setMainCompany(data);
    };

    const fetchClientsAndDocs = async () => {
        setLoading(true);
        // Fetch all docs for tenant
        const { data: allDocs } = await supabase
            .from("tmgd_transport_docs")
            .select("*, tmgd_clients(*), tmgd_transport_items(*, tmgd_products(*))")
            .eq("tenant_id", profile?.tenant_id)
            .order("created_at", { ascending: false });
        
        if (allDocs) {
            setDocs(allDocs);
            // Group by client
            const clientMap = new Map();
            allDocs.forEach(doc => {
                const client = doc.tmgd_clients;
                if (!client) return;
                if (!clientMap.has(client.id)) {
                    clientMap.set(client.id, {
                        ...client,
                        totalDocs: 0,
                        newDocs: 0
                    });
                }
                const c = clientMap.get(client.id);
                c.totalDocs += 1;
                if (!doc.is_downloaded) c.newDocs += 1;
            });
            setClients(Array.from(clientMap.values()));
        }
        setLoading(false);
    };

    const handleClientClick = (client: any) => {
        setSelectedClient(client);
        setViewMode('docs');
        setSelectedDocIds([]);
    };

    const handleBackToClients = () => {
        setViewMode('clients');
        setSelectedClient(null);
        setSelectedDocIds([]);
        fetchClientsAndDocs(); // Refresh counts
    };

    const toggleDocSelection = (id: string) => {
        setSelectedDocIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleAllSelection = (clientDocs: any[]) => {
        if (selectedDocIds.length === clientDocs.length) {
            setSelectedDocIds([]);
        } else {
            setSelectedDocIds(clientDocs.map(d => d.id));
        }
    };

    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);

    const handleBulkDownload = async () => {
        if (selectedDocIds.length === 0) return;
        setIsZipping(true);
        setZipProgress(0);
        
        try {
            const zip = new JSZip();
            const docsToProcess = docs.filter(d => selectedDocIds.includes(d.id));
            
            // Gizli bir div oluştur
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '210mm';
            document.body.appendChild(container);
            const root = ReactDOM.createRoot(container);

            for (let i = 0; i < docsToProcess.length; i++) {
                const doc = docsToProcess[i];
                setZipProgress(Math.round((i / docsToProcess.length) * 100));
                
                // Dokümanı render et
                await new Promise<void>((resolve) => {
                    root.render(
                        <div id="print-capture-area">
                            <ADRDocumentPrint 
                                clientData={{
                                    ...(doc.tmgd_clients || {}),
                                    tmgd_logo_url: mainCompany?.tmgd_logo_url
                                }}
                                doc={doc}
                            />
                        </div>
                    );
                    // Render olması için bekle
                    setTimeout(resolve, 500);
                });

                // Sayfaları yakala (ADRDocumentPrint içindeki .max-w-[210mm] div'leri)
                const pages = container.querySelectorAll('.max-w-\\[210mm\\]');
                const pdf = new jsPDF('p', 'mm', 'a4');

                for (let p = 0; p < pages.length; p++) {
                    const canvas = await html2canvas(pages[p] as HTMLElement, {
                        scale: 2,
                        useCORS: true,
                        logging: false
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    if (p > 0) pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                }

                const pdfBlob = pdf.output('blob');
                const fileName = `${doc.receiver_title || 'evrak'}_${new Date(doc.date).toLocaleDateString('tr-TR')}_${doc.id.slice(0,5)}.pdf`.replace(/\s+/g, '_');
                zip.file(fileName, pdfBlob);
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `tmgd_evraklar_${new Date().toLocaleDateString('tr-TR')}.zip`;
            link.click();

            // DB güncelleme
            await supabase.rpc("tmgd_mark_docs_downloaded", { p_doc_ids: selectedDocIds });
            setDocs(prev => prev.map(d => selectedDocIds.includes(d.id) ? { ...d, is_downloaded: true } : d));
            
            root.unmount();
            document.body.removeChild(container);
        } catch (error) {
            console.error("Zip hatası:", error);
            alert("Toplu indirme sırasında bir hata oluştu.");
        } finally {
            setIsZipping(false);
            setZipProgress(0);
            setSelectedDocIds([]);
        }
    };

    const handleSingleDownload = (doc: any) => {
        setPrintDocs([doc]);
    };

    const handlePrintComplete = async () => {
        if (!printDocs) return;
        const ids = printDocs.map(d => d.id);
        
        // Mark as downloaded in DB
        await supabase.rpc("tmgd_mark_docs_downloaded", { p_doc_ids: ids });
        
        // Update local state
        setDocs(prev => prev.map(d => ids.includes(d.id) ? { ...d, is_downloaded: true } : d));
    };

    if (printDocs) {
        return (
            <ADRDocumentPrint 
                clientData={{
                    ...(printDocs[0]?.tmgd_clients || {}),
                    tmgd_logo_url: mainCompany?.tmgd_logo_url
                }}
                docs={printDocs}
                onBack={() => setPrintDocs(null)}
                onPrint={handlePrintComplete}
            />
        );
    }

    if (viewMode === 'clients') {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Firma Evrak Klasörleri</h2>
                    <p className="text-sm text-slate-500 mt-1">Sistemdeki firmalara ait oluşturulmuş evrakları firma bazında görüntüleyin.</p>
                </div>
                
                {loading ? (
                    <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
                ) : clients.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
                        Henüz hiçbir firma için evrak oluşturulmamış.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {clients.map(client => (
                            <div 
                                key={client.id}
                                onClick={() => handleClientClick(client)}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-0 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform">
                                        {client.logo_url ? (
                                            <img src={client.logo_url} className="w-full h-full object-contain" alt="Logo" />
                                        ) : (
                                            <Folder className="w-6 h-6 text-indigo-600" />
                                        )}
                                    </div>
                                    {client.newDocs > 0 && (
                                        <span className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                            {client.newDocs} Yeni
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 min-h-[40px]">{client.title}</h3>
                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-xs">
                                    <span className="text-slate-500">Toplam {client.totalDocs} Evrak</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">Görüntüle</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // DOCS VIEW
    const clientDocs = docs.filter(d => d.client_id === selectedClient?.id);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleBackToClients}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Folder className="w-5 h-5 text-indigo-500" />
                            {selectedClient?.title}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Bu firmaya ait toplam {clientDocs.length} evrak bulundu.</p>
                    </div>
                </div>

                {selectedDocIds.length > 0 && (
                    <button 
                        disabled={isZipping}
                        onClick={handleBulkDownload}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition disabled:bg-slate-400"
                    >
                        {isZipping ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Hazırlanıyor... %{zipProgress}
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" /> Seçilenleri Toplu İndir (ZIP) ({selectedDocIds.length})
                            </>
                        )}
                    </button>
                )}
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input 
                                        type="checkbox" 
                                        checked={clientDocs.length > 0 && selectedDocIds.length === clientDocs.length}
                                        onChange={() => toggleAllSelection(clientDocs)}
                                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                    />
                                </th>
                                <th className="px-4 py-3 font-medium">Durum</th>
                                <th className="px-4 py-3 font-medium">Tarih</th>
                                <th className="px-4 py-3 font-medium">İrsaliye No</th>
                                <th className="px-4 py-3 font-medium">Alıcı</th>
                                <th className="px-4 py-3 font-medium">Araç / Sürücü</th>
                                <th className="px-4 py-3 font-medium text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {clientDocs.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Henüz evrak oluşturulmamış.</td></tr>
                            ) : clientDocs.map(doc => {
                                const isSelected = selectedDocIds.includes(doc.id);
                                return (
                                    <tr 
                                        key={doc.id} 
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => toggleDocSelection(doc.id)}
                                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            {doc.is_downloaded ? (
                                                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                                    <CheckCircle2 className="w-3 h-3" /> İndirildi
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                                    Yeni
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{new Date(doc.created_at).toLocaleDateString('tr-TR')}</td>
                                        <td className="px-4 py-3">{doc.waybill_no || '-'}</td>
                                        <td className="px-4 py-3 max-w-[200px] truncate" title={doc.receiver_title}>{doc.receiver_title}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900 dark:text-white">{doc.driver_plate}</div>
                                            <div className="text-xs text-slate-500">{doc.driver_name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => handleSingleDownload(doc)}
                                                className="p-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-medium flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors ml-auto"
                                            >
                                                <Printer className="w-3.5 h-3.5" /> İndir
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
