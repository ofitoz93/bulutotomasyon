import React from "react";
import { Printer, Home, Edit2 } from "lucide-react";

interface ADRDocumentPrintProps {
    clientData: {
        title: string;
        address: string;
        tel: string;
        logo_url?: string;
        tmgd_logo_url?: string;
    };
    doc: any;
    items: any[];
    onBack?: () => void;
    onEdit?: () => void;
    catalog?: any[]; // Optionel, eğer items içinde product datası yoksa kullanılır
}

export default function ADRDocumentPrint({ clientData, doc, items, onBack, onEdit, catalog }: ADRDocumentPrintProps) {
    const totalQuantity = items?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

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

            <div className="max-w-[210mm] mx-auto bg-white mb-10 print:mb-0 shadow-lg print:shadow-none min-h-[297mm] p-[10mm] force-print-theme text-black">
                {/* 1. SAYFA: TAŞIMA EVRAKI */}
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
                        {items?.map((it, idx) => {
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
                            <span className="font-mono text-xl font-black">{doc.total_1136_points?.toFixed(2) || '0.00'}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 text-xs border-t border-black pt-4">
                    <div className="text-center">
                        <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Gönderen Yetkili Sorumlu</h4>
                        <div className="font-bold mb-1">{doc.sender_name}</div>
                        {doc.sender_signature && <img src={doc.sender_signature} className="h-20 mx-auto object-contain" alt="imza" />}
                    </div>
                    <div className="text-center">
                        <h4 className="font-bold border-b border-black/20 pb-1 mb-2 uppercase">Taşıyıcı / Teslim Alan Sürücü</h4>
                        <div className="font-bold">{doc.driver_name}</div>
                        <div className="mb-1 text-[10px]">{doc.carrier_company} | <span className="font-mono font-bold uppercase border border-black px-1">{doc.driver_plate}</span></div>
                        {doc.driver_signature && <img src={doc.driver_signature} className="h-20 mx-auto object-contain" alt="imza" />}
                    </div>
                </div>

                <div className="mt-8 text-[9px] text-justify text-gray-800 italic border-t border-black pt-2">
                    * Bu taşıma evrakı "Tehlikeli Maddelerin Karayolu ile Taşınması Hakkında Yönetmelik" kapsamında ADR 5.4.1'e göre düzenlenmiştir. Taraflar, yukarıda belirtilen madde ve malların geçerli yönetmeliklere uygun şekilde paketlendiğini, etiketlendiğini ve karayolu taşımacılığına uygun durumda olduğunu beyan eder. İşbu belge, sevk işlemi süresince sürücü kabininde görünür biçimde bulundurulmak mecburiyetindedir.
                </div>
            </div>

            {/* 2. SAYFA: ARAÇ KONTROL FORMU */}
            <div className="max-w-[210mm] mx-auto bg-white mb-10 print:mb-0 shadow-lg print:shadow-none min-h-[297mm] p-[10mm] force-print-theme text-black print:break-before-page mt-8 print:mt-0">
                <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                    {clientData?.tmgd_logo_url ? (
                        <img src={clientData.tmgd_logo_url} className="h-14 object-contain" alt="TMGD Logo" />
                    ) : (
                        <div className="font-bold text-xl">TMGD Firması</div>
                    )}
                    <h1 className="text-xl font-black text-center flex-1 leading-tight">
                        TEHLİKELİ MADDE / ATIK GÖNDERİMİ<br />
                        <span className="text-lg">ARAÇ KONTROL FORMU</span>
                    </h1>
                    {clientData?.logo_url ? (
                        <img src={clientData.logo_url} className="h-14 object-contain" alt="Client Logo" />
                    ) : (
                        <div className="font-bold text-xl">{clientData?.title}</div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="border border-black p-3 space-y-2">
                        <div><b>Gönderen Firma:</b> {clientData?.title}</div>
                        <div><b>Adres:</b> {clientData?.address}</div>
                        <div><b>Yetkili Sorumlu:</b> {doc.sender_name}</div>
                    </div>
                    <div className="border border-black p-3 space-y-2">
                        <div><b>Tarih:</b> {new Date(doc.date).toLocaleDateString("tr-TR")}</div>
                        <div><b>Taşıyıcı Lojistik:</b> {doc.carrier_company || "-"}</div>
                        <div><b>Sürücü Adı / Çekici Plaka:</b> {doc.driver_name} / {doc.driver_plate}</div>
                    </div>
                </div>

                <div className="mb-4 text-xs font-bold bg-gray-200 border border-black p-2 text-center uppercase tracking-wide">
                    Gönderim (Yükleyen) Kontrol Aşamaları
                </div>

                <table className="w-full text-xs box-border border-collapse border border-black mb-10">
                    <thead className="bg-gray-100 font-bold text-left">
                        <tr>
                            <th className="border border-black p-2 w-3/4">Kontrol Kriteri</th>
                            <th className="border border-black p-2 w-1/4 text-center">Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { group: 'Ambalaj Uygunluğu', items: [
                                { key: 'ambalaj_hasar', text: 'Ambalaj dış yüzeyinde hasar var mı?' },
                                { key: 'etiketleme_uygunluk', text: 'Etiketlemeler uygun mu?' }
                            ]},
                            { group: 'Taşıt ve Ambalaj İşaret-Etiket Zorunlulukları', items: [
                                { key: 'arac_plaka_levha', text: 'Araç ön/arka turuncu plaka var mı?' },
                                { key: 'ambalaj_sizdirmazlik', text: 'Ambalaj sızdırmazlığı uygun mu?' },
                                { key: 'palet_konteyner', text: 'Palet/Konteyner uygun mu?' },
                                { key: 'yuk_guvenligi', text: 'Yükler güvenli yerleştirildi mi?' }
                            ]},
                            { group: 'Karışık Yükleme/Ambalajlama & Belge Kontrolü', items: [
                                { key: 'karisik_yukleme', text: 'İzin verilen sınıflar kontrol edildi mi?' },
                                { key: 'sizinti_onlem', text: 'Sızıntı riskine karşı önlem alındı mı?' },
                                { key: 'tasima_evraki', text: 'Taşıma Evrakı (ADR 5.4.1) düzenlendi mi?' },
                                { key: 'src5', text: 'Sürücünün SRC-5 Belgesi var mı?' },
                                { key: 'mali_sorumluluk', text: 'Tehlikeli Madde Zorunlu Mali Sorumluluk Sigortası var mı?' }
                            ]}
                        ].map((g, gi) => (
                            <React.Fragment key={gi}>
                                <tr>
                                    <td colSpan={2} className="border border-black p-1.5 bg-gray-50 font-bold uppercase text-[10px] text-gray-700">{g.group}</td>
                                </tr>
                                {g.items.map((it) => {
                                    const val = doc.adr_checklist?.[it.key];
                                    let badgeColor = "font-normal";
                                    if (val === 'evet') badgeColor = "font-bold text-black";
                                    if (val === 'hayır') badgeColor = "font-bold text-gray-800 line-through";
                                    return (
                                        <tr key={it.key}>
                                            <td className="border border-black p-2">{it.text}</td>
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

                <div className="grid grid-cols-2 gap-8 text-sm mt-auto border-t border-black pt-6">
                    <div className="text-center">
                        <h4 className="font-bold pb-2 mb-2 uppercase">Gönderici Sorumlusu</h4>
                        <div className="mb-4">{doc.sender_name}</div>
                        {doc.sender_signature && <img src={doc.sender_signature} className="h-24 mx-auto object-contain" alt="imza" />}
                    </div>
                    <div className="text-center">
                        <h4 className="font-bold pb-2 mb-2 uppercase">Teslim Alan Sürücü</h4>
                        <div className="mb-1">{doc.driver_name}</div>
                        <div className="mb-3 text-xs">Plaka: <span className="font-mono font-bold uppercase">{doc.driver_plate}</span></div>
                        {doc.driver_signature && <img src={doc.driver_signature} className="h-24 mx-auto object-contain" alt="imza" />}
                    </div>
                </div>
            </div>

            {/* Print Aksiyon Butonları (Yalnızca ekranda görünür) */}
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
                    onClick={() => window.print()}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 font-bold flex items-center gap-2 relative overflow-hidden group"
                >
                    <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full"></span>
                    <Printer className="w-5 h-5 relative z-10" /> <span className="relative z-10">A4 Yazdır / İndir (PDF)</span>
                </button>
            </div>
        </div>
    );
}
