import React from "react";
import { Printer, Home, Edit2 } from "lucide-react";
import { getQuestionsForFlow } from "./TMGDFormUtils";

interface ADRDocumentPrintProps {
    clientData: {
        title: string;
        address: string;
        tel: string;
        logo_url?: string;
        tmgd_logo_url?: string;
    };
    doc?: any;
    items?: any[];
    docs?: any[]; // For bulk printing
    onBack?: () => void;
    onEdit?: () => void;
    catalog?: any[]; // Optionel, eğer items içinde product datası yoksa kullanılır
    onPrint?: () => void; // Optional hook for print action
}

export default function ADRDocumentPrint({ clientData, doc, items, docs, onBack, onEdit, catalog, onPrint }: ADRDocumentPrintProps) {
    const documentsToPrint = docs && docs.length > 0 ? docs : (doc ? [doc] : []);

    const handlePrintClick = () => {
        if (onPrint) onPrint();
        setTimeout(() => window.print(), 100);
    };

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white p-4 print:p-0">
            <style>
                {`
                @media print {
                    * { color: black !important; border-color: black !important; -webkit-print-color-adjust: exact; }
                    @page { margin: 10mm; size: A4; }
                    body { background-color: white !important; }
                    .no-print { display: none !important; }
                }
                .force-print-theme * { color: black; border-color: black; }
                `}
            </style>

            {documentsToPrint.map((currentDoc, index) => {
                const currentItems = currentDoc.tmgd_transport_items || items || [];
                const totalQuantity = currentItems.reduce((acc: any, curr: any) => acc + (curr.quantity || 0), 0) || 0;
                
                return (
                    <div key={currentDoc.id || index} className="print:break-after-page">
                        {currentItems && currentItems.length > 0 && (
                            <div className="max-w-[210mm] mx-auto bg-white mb-10 print:mb-0 shadow-lg print:shadow-none min-h-[297mm] p-[10mm] force-print-theme text-black relative">
                        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
                            {clientData?.tmgd_logo_url ? (
                                <img src={clientData.tmgd_logo_url} className="h-14 object-contain" alt="TMGD Logo" />
                            ) : (
                                <div className="font-bold text-xl">TMGD Firması</div>
                            )}
                            <h1 className="text-2xl font-black text-center flex-1">
                                TAŞIMA EVRAKI<br />
                                <span className="text-sm font-normal">TRANSPORT DOCUMENT</span>
                            </h1>
                            {clientData?.logo_url ? (
                                <img src={clientData.logo_url} className="h-14 object-contain" alt="Client Logo" />
                            ) : (
                                <div className="font-bold text-xl">{clientData?.title}</div>
                            )}
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
                                <div className="font-bold text-[13px]">{currentDoc.receiver_title}</div>
                                <div className="text-[11px] leading-tight mt-1">{currentDoc.receiver_address}</div>
                                <div className="text-[11px] mt-1">Tel: {currentDoc.receiver_tel}</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-xs font-medium">
                            <div><b>Tarih:</b> {new Date(currentDoc.date).toLocaleDateString("tr-TR")}</div>
                            <div><b>İrsaliye No:</b> {currentDoc.waybill_no || "-"}</div>
                            <div><b>Sipariş No:</b> {currentDoc.order_no || "-"}</div>
                            <div><b>Taşıma Kimlik No:</b> {currentDoc.transport_id_no || "-"}</div>
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
                                {currentItems?.map((it: any, idx: number) => {
                                    const p = it.tmgd_products || catalog?.find(c => c.id === it.product_id);
                                    return (
                                        <tr key={idx}>
                                            <td className="border border-black p-1.5 text-center font-bold text-[13px]">UN {p?.un_nr}</td>
                                            <td className="border border-black p-1.5">
                                                <b>{p?.shipping_name}</b>, {p?.class_nr}, {p?.pg} <br />
                                                <span className="text-[9px] text-gray-800">Özel Hükümler: {p?.special_provisions || '-'}</span>
                                            </td>
                                            <td className="border border-black p-1.5 text-center">{it.package_count} x {it.package_type}</td>
                                            <td className="border border-black p-1.5 text-center font-bold">({p?.tunnel_code})</td>
                                            <td className="border border-black p-1.5 text-center font-bold text-[13px] leading-tight">
                                                {it.quantity} {p?.unit} <br /><span className="text-[9px] font-normal text-gray-600">Puan: {it.total_points}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        <div className="flex gap-4 mb-6 text-sm">
                            <div className="flex-1 space-y-1 text-xs border border-black p-2 rounded">
                                <div className="font-bold border-b border-black pb-1 mb-1 uppercase">Kargo Beyanları</div>
                                <div>Çok Modlu Taşıma?: <b>{currentDoc.is_multimodal ? 'Evet' : 'Hayır'}</b></div>
                                <div>Sınırlı Miktar?: <b>{currentDoc.is_limited ? 'Evet' : 'Hayır'}</b></div>
                                <div>Çevreye Zararlı?: <b>{currentDoc.is_env_hazardous ? 'Evet' : 'Hayır'}</b></div>
                            </div>
                            <div className="w-1/2 flex flex-col gap-2">
                                <div className="border border-black p-2 rounded bg-gray-100 flex justify-between items-center h-full">
                                    <b className="text-sm">Toplam Yük Miktarı:</b>
                                    <span className="font-mono text-xl font-black">{totalQuantity.toFixed(2)}</span>
                                </div>
                                <div className="border border-black p-2 rounded bg-gray-200 flex justify-between items-center h-full">
                                    <b className="text-sm">1.1.3.6 Toplam MUA Puanı:</b>
                                    <span className="font-mono text-xl font-black">{(currentDoc.total_1136_points||0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 text-xs border-t border-black pt-4">
                            <div className="text-center">
                                <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Gönderen Yetkili Sorumlu</h4>
                                <div className="font-bold mb-1">{currentDoc.sender_name}</div>
                                {currentDoc.sender_signature && <img src={currentDoc.sender_signature} className="h-20 mx-auto object-contain" alt="imza" />}
                            </div>
                            <div className="text-center">
                                <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Taşıyıcı / Teslim Alan Sürücü</h4>
                                <div className="font-bold">{currentDoc.driver_name}</div>
                                <div className="mb-1 text-[10px]">{currentDoc.carrier_company} | <span className="font-mono font-bold uppercase border border-black px-1">{currentDoc.driver_plate}</span></div>
                                {currentDoc.driver_signature && <img src={currentDoc.driver_signature} className="h-20 mx-auto object-contain" alt="imza" />}
                            </div>
                        </div>

                        <div className="mt-8 text-[9px] text-justify text-gray-800 italic border-t border-black pt-2">
                            * Bu taşıma evrakı "Tehlikeli Maddelerin Karayolu ile Taşınması Hakkında Yönetmelik" kapsamında ADR 5.4.1'e göre düzenlenmiştir. Taraflar, yukarıda belirtilen madde ve malların geçerli yönetmeliklere uygun şekilde paketlendiğini, etiketlendiğini ve karayolu taşımacılığına uygun durumda olduğunu beyan eder. İşbu belge, sevk işlemi süresince sürücü kabininde görünür biçimde bulundurulmak mecburiyetindedir.
                        </div>
                    </div>
                )}

                    {/* Kontrol Formu Sayfaları (Role bazlı ayrılmış) */}
                    {(() => {
                        const allSections = currentDoc.flow_type ? getQuestionsForFlow(currentDoc.flow_type, currentDoc.form_type || "") : [];
                        
                        // Bölümleri rollerine göre grupla
                        const packerSections = allSections.filter((s: any) => 
                            s.section.includes("PAKETLEME") || s.section.includes("PAKETLEYEN")
                        );
                        const loaderSections = allSections.filter((s: any) => 
                            s.section.includes("YÜKLEYEN") || s.section.includes("İŞARET-ETİKET-LEVHA") || s.section.includes("TAŞIMA BELGELERİ") || s.section.includes("AMBALAJLARIN UYGUNLUĞU")
                        );
                        const fillerSections = allSections.filter((s: any) => 
                            s.section.includes("DOLUM") || s.section.includes("TANK") || s.section.includes("BOŞALTIM") || s.section.includes("TMFB")
                        );

                        const roles = [
                            { title: "PAKETLEYEN KONTROL FORMU", sections: packerSections },
                            { title: "YÜKLEYEN / GÖNDEREN KONTROL FORMU", sections: loaderSections },
                            { title: "DOLDURAN KONTROL FORMU", sections: fillerSections }
                        ].filter(r => r.sections.length > 0);

                        // Eğer hiç gruplanmamış bölüm kaldıysa (örn: eski formlar) hepsini bir sayfaya koy
                        if (roles.length === 0 && allSections.length > 0) {
                            roles.push({ title: "ARAÇ KONTROL FORMU", sections: allSections });
                        }

                        return roles.map((role, ri) => (
                            <div key={ri} className="max-w-[210mm] mx-auto bg-white mb-10 print:mb-0 shadow-lg print:shadow-none min-h-[297mm] p-[10mm] force-print-theme text-black print:break-before-page mt-8 print:mt-0 relative flex flex-col">
                                <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                                    {clientData?.tmgd_logo_url ? (
                                        <img src={clientData.tmgd_logo_url} className="h-14 object-contain" alt="TMGD Logo" />
                                    ) : (
                                        <div className="font-bold text-xl">TMGD Firması</div>
                                    )}
                                    <h1 className="text-xl font-black text-center flex-1 leading-tight">
                                        TEHLİKELİ MADDE / ATIK GÖNDERİMİ<br />
                                        <span className="text-lg">{role.title}</span>
                                    </h1>
                                    {clientData?.logo_url ? (
                                        <img src={clientData.logo_url} className="h-14 object-contain" alt="Client Logo" />
                                    ) : (
                                        <div className="font-bold text-xl">{clientData?.title}</div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                    <div className="border border-black p-3 space-y-1">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">İşletme Bilgileri</div>
                                        <div><b>Firma:</b> {clientData?.title}</div>
                                        <div><b>Yetkili Sorumlu:</b> {currentDoc.sender_name}</div>
                                    </div>
                                    <div className="border border-black p-3 space-y-1">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Sevkiyat Detayları</div>
                                        <div><b>Tarih:</b> {new Date(currentDoc.date).toLocaleDateString("tr-TR")}</div>
                                        <div><b>Araç / Plaka:</b> {currentDoc.driver_name} / {currentDoc.driver_plate}</div>
                                    </div>
                                </div>

                                <table className="w-full text-[11px] box-border border-collapse border border-black mb-6">
                                    <thead className="bg-gray-100 font-bold text-left">
                                        <tr>
                                            <th className="border border-black p-2 w-3/4">Kontrol Kriteri</th>
                                            <th className="border border-black p-2 w-1/4 text-center">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {role.sections.map((g: any, gi: number) => (
                                            <React.Fragment key={gi}>
                                                <tr>
                                                    <td colSpan={2} className="border border-black p-1.5 bg-gray-50 font-bold uppercase text-[9px] text-gray-700">{g.section}</td>
                                                </tr>
                                                {g.questions.map((it: any) => {
                                                    const val = currentDoc.adr_checklist?.[it.id];
                                                    let badgeColor = "font-normal";
                                                    if (val && ['evet', 'uygun', 'var'].includes(val)) badgeColor = "font-bold text-black";
                                                    if (val && ['hayir', 'hayır', 'uygun_degil', 'yok'].includes(val)) badgeColor = "font-bold text-gray-800 line-through";
                                                    return (
                                                        <tr key={it.id}>
                                                            <td className="border border-black p-2 leading-tight">{it.text}</td>
                                                            <td className="border border-black p-2 text-center uppercase">
                                                                <span className={badgeColor}>{val || "-"}</span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="grid grid-cols-3 gap-4 text-[10px] mt-auto border-t border-black pt-4">
                                    <div className="text-center">
                                        <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">İşlemi Yapan</h4>
                                        <div className="mb-1">{currentDoc.sender_name}</div>
                                        {currentDoc.sender_signature && <img src={currentDoc.sender_signature} className="h-14 mx-auto object-contain" alt="imza" />}
                                    </div>
                                    <div className="text-center">
                                        <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Kontrol Eden (TMGD)</h4>
                                        <div className="h-14 flex items-center justify-center text-gray-300 italic">Kaşe / İmza</div>
                                    </div>
                                    <div className="text-center">
                                        <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Sürücü (Teslim Alan)</h4>
                                        <div className="mb-1">{currentDoc.driver_name}</div>
                                        {currentDoc.driver_signature && <img src={currentDoc.driver_signature} className="h-14 mx-auto object-contain" alt="imza" />}
                                    </div>
                                </div>
                            </div>
                        ));
                    })()}
                    </div>
                );
            })}

            <div className="fixed bottom-6 right-6 flex gap-3 print:hidden z-50">
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="px-6 py-3 bg-white text-slate-800 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 font-bold flex items-center gap-2"
                    >
                        <Edit2 className="w-5 h-5" /> Düzenle
                    </button>
                )}
                {onBack && (
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-white text-slate-800 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 font-bold flex items-center gap-2"
                    >
                        <Home className="w-5 h-5" /> Panele Dön
                    </button>
                )}
                <button
                    onClick={handlePrintClick}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 font-bold flex items-center gap-2 relative overflow-hidden group"
                >
                    <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full"></span>
                    <Printer className="w-5 h-5 relative z-10" /> <span className="relative z-10">A4 Yazdır / İndir (PDF)</span>
                </button>
            </div>
        </div>
    );
}
