import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface EquipmentDetail {
    id: string;
    code: string;
    name: string;
    type: string | null;
    serial_no: string | null;
    brand: string | null;
    model: string | null;
    purpose: string | null;
    assigned_to: string | null;
    risk_level: "düşük" | "orta" | "yüksek";
    inspection_period_months: number;
    default_location: string | null;
    current_location: string | null;
    last_inspection_date: string | null;
    next_inspection_date: string | null;
    last_result: string | null;
    last_inspector: string | null;
}

const RISK_COLORS: Record<string, string> = {
    düşük: "bg-green-100 text-green-700 border-green-200",
    orta: "bg-yellow-100 text-yellow-700 border-yellow-200",
    yüksek: "bg-red-100 text-red-700 border-red-200",
};

export default function QRScanPage() {
    const { token } = useParams<{ token: string }>();
    const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Location update form
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [scannedBy, setScannedBy] = useState("");
    const [newLocation, setNewLocation] = useState("");
    const [updating, setUpdating] = useState(false);
    const [updated, setUpdated] = useState(false);

    const [locationPermission, setLocationPermission] = useState<"pending" | "granted" | "denied">("pending");
    const [gpsLoading, setGpsLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [locationErrorMsg, setLocationErrorMsg] = useState("");

    // Damage / Fault reporting
    const [showDamageForm, setShowDamageForm] = useState(false);
    const [damageDesc, setDamageDesc] = useState("");
    const [reportingDamage, setReportingDamage] = useState(false);
    const [damageReported, setDamageReported] = useState(false);

    useEffect(() => {
        // Basit mobil cihaz kontrolü
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
                return true;
            }
            return false;
        };
        setIsMobile(checkMobile());
    }, []);

    useEffect(() => {
        if (!token) { setNotFound(true); setLoading(false); return; }
        // Ekipman detaylarını çekmeden önce / veya paralelde konum izni isteyeceğiz.
        // Ancak ID lazım. Önce yükleyelim, sonra lokasyon soralım.
        fetchEquipment();
    }, [token]);

    const fetchEquipment = async () => {
        setLoading(true);
        const { data: eq, error } = await supabase
            .from("equipments")
            .select("*")
            .eq("qr_token", token)
            .eq("is_active", true)
            .single();

        if (error || !eq) { setNotFound(true); setLoading(false); return; }

        const { data: lastInsp } = await supabase
            .from("equipment_inspections")
            .select("inspection_date, next_inspection_date, result, inspector_name_override, equipment_inspectors(name)")
            .eq("equipment_id", eq.id)
            .order("inspection_date", { ascending: false })
            .limit(1)
            .maybeSingle();

        setEquipment({
            ...eq,
            last_inspection_date: lastInsp?.inspection_date || null,
            next_inspection_date: lastInsp?.next_inspection_date || null,
            last_result: lastInsp?.result || null,
            last_inspector: lastInsp?.inspector_name_override || (lastInsp?.equipment_inspectors as any)?.name || null,
        });
        setNewLocation(eq.current_location || eq.default_location || "");
        setLoading(false);

        // Ekipman yüklendi, şimdi GPS zorunlu.
        requestLocationUpdate(eq);
    };

    const requestLocationUpdate = (eq: any) => {
        if (!navigator.geolocation) {
            setLocationPermission("denied");
            setLocationErrorMsg("Cihazınız konum servisini desteklemiyor.");
            return;
        }

        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            setLocationPermission("granted");
            const { latitude, longitude } = pos.coords;
            try {
                // Reverse Geocoding (OpenStreetMap Nominatim)
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                const data = await res.json();

                let loc = "";
                if (data.address) {
                    const parts = [
                        data.address.road || data.address.pedestrian,
                        data.address.house_number,
                        data.address.suburb || data.address.neighbourhood,
                        data.address.city || data.address.town || data.address.county
                    ].filter(Boolean);
                    loc = parts.join(", ");
                }
                const finalLoc = loc || data.display_name?.split(",")[0] || `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

                // Adresi DB'ye yaz
                await updateLocationDB(finalLoc, "Oto-GPS", eq.id);
            } catch (e) {
                console.error("GPS Reverse Geocode Error", e);
                // Reverse geocode çalışmasa bile GPS ile koordinat kaydedelim:
                await updateLocationDB(`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, "Oto-GPS", eq.id);
            } finally {
                setGpsLoading(false);
            }
        }, (err) => {
            console.warn("GPS Error", err);
            setLocationPermission("denied");
            setLocationErrorMsg("Ekipman bilgilerini görmek için konum izni vermeniz gerekmektedir.");
            setGpsLoading(false);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    };

    const updateLocationDB = async (loc: string, by: string, eqId?: string) => {
        const targetId = eqId || equipment?.id;
        if (!targetId) return;
        setUpdating(true);
        try {
            await supabase.from("equipment_locations").insert([{
                equipment_id: targetId,
                location: loc,
                scanned_by: by || null,
            }]);
            await supabase.from("equipments").update({
                current_location: loc,
                updated_at: new Date().toISOString(),
            }).eq("id", targetId);
            setEquipment(e => e ? { ...e, current_location: loc } : e);
            setNewLocation(loc);
            setUpdated(true);
            setShowUpdateForm(false);
        } catch (e: any) {
            console.error("Update DB Error", e);
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateLocation = async () => {
        if (!newLocation.trim()) { alert("Lütfen lokasyon girin."); return; }
        await updateLocationDB(newLocation.trim(), scannedBy.trim());
    };

    const submitDamageReport = async () => {
        if (!damageDesc.trim()) { alert("Lütfen hasar/arıza durumunu açıklayın."); return; }
        setReportingDamage(true);
        try {
            await supabase.from("equipment_fault_reports").insert([{
                equipment_id: equipment!.id,
                tenant_id: (equipment as any).tenant_id,
                reported_by_name: scannedBy.trim() || "Anonim (QR İzleyici)",
                description: damageDesc.trim(),
                location: equipment!.current_location || "Bilinmeyen Konum"
            }]);

            await supabase.from("equipments").update({
                is_damaged: true,
                updated_at: new Date().toISOString()
            }).eq("id", equipment!.id);

            setDamageReported(true);
            setShowDamageForm(false);
        } catch (e: any) {
            console.error(e);
            alert("Bildirim gönderilirken hata oluştu.");
        } finally {
            setReportingDamage(false);
        }
    };

    const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

    const getDaysUntilInspection = () => {
        if (!equipment?.next_inspection_date) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const t = new Date(equipment.next_inspection_date);
        return Math.ceil((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    const days = equipment ? getDaysUntilInspection() : null;
    const daysLabel = days === null ? "Bakım kaydı yok" : days < 0 ? `${Math.abs(days)} gün gecikmiş` : days === 0 ? "Bugün!" : `${days} gün kaldı`;
    const daysColor = days === null ? "bg-gray-100 text-gray-500 border-gray-200" : days < 0 ? "bg-red-100 text-red-700 border-red-200" : days <= 30 ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-green-100 text-green-700 border-green-200";

    if (loading || gpsLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-gray-500 font-medium">
                    {loading ? "Ekipman bilgileri yükleniyor..." : "Konumunuz alınıyor, lütfen bekleyin..."}
                </p>
            </div>
        );
    }

    if (notFound || !equipment) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-xl font-bold text-gray-700">Ekipman bulunamadı</h1>
                    <p className="text-gray-400 mt-2">Bu QR kod geçersiz veya ekipman devre dışı bırakılmış.</p>
                </div>
            </div>
        );
    }

    if (locationPermission === "denied") {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 mb-2">Konum İzni Gerekli</h1>
                    <p className="text-gray-600 text-sm mb-6">
                        {locationErrorMsg || "Bu ekipmanın bilgilerini görüntüleyebilmek ve işleme devam edebilmek için cihazınızın konum (GPS) iznini vermeniz gerekmektedir."}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition"
                    >
                        Tekrar Dene
                    </button>
                    <p className="text-xs text-gray-400 mt-4 px-2">
                        Tarayıcınızın ayarlarından veya adres çubuğundan konum erişimine izin vermeyi unutmayın.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-lg mx-auto space-y-4">

                {/* Header */}
                <div className="text-center mb-4">
                    <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                        <span>📋</span> Ekipman Bilgi Kartı
                    </div>
                </div>

                {/* Ana Kart */}
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <div className="bg-indigo-600 px-6 py-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-indigo-200 text-xs font-mono">{equipment.code}</p>
                                <h1 className="text-white text-2xl font-bold mt-0.5">{equipment.name}</h1>
                                {equipment.type && <p className="text-indigo-200 text-sm mt-1">{equipment.type}</p>}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${RISK_COLORS[equipment.risk_level]}`}>
                                {equipment.risk_level} risk
                            </span>
                        </div>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        {/* Sonraki bakıma kalan */}
                        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${daysColor}`}>
                            <div>
                                <p className="text-xs font-semibold uppercase opacity-70">Sonraki Bakıma</p>
                                <p className="text-xl font-bold">{daysLabel}</p>
                                {equipment.next_inspection_date && (
                                    <p className="text-xs opacity-70 mt-0.5">{formatDate(equipment.next_inspection_date)}</p>
                                )}
                            </div>
                            <span className="text-3xl">{days === null ? "❓" : days < 0 ? "🔴" : days <= 30 ? "🟡" : "🟢"}</span>
                        </div>

                        {/* Detaylar */}
                        <div className="grid grid-cols-2 gap-3">
                            <InfoCard label="Teslim Edilen" value={equipment.assigned_to} />
                            <InfoCard label="Güncel Lokasyon" value={equipment.current_location || equipment.default_location} />
                            <InfoCard label="Son Bakım" value={formatDate(equipment.last_inspection_date)} />
                            <InfoCard label="Son Bakım Sonucu" value={equipment.last_result} />
                            {equipment.serial_no && <InfoCard label="Seri No" value={equipment.serial_no} />}
                            {equipment.brand && <InfoCard label="Marka / Model" value={`${equipment.brand} ${equipment.model || ""}`.trim()} />}
                            {equipment.last_inspector && <InfoCard label="Son Kontrol Eden" value={equipment.last_inspector} />}
                            <InfoCard label="Periyot" value={`${equipment.inspection_period_months} ay`} />
                        </div>

                        {equipment.purpose && (
                            <div className="bg-gray-50 rounded-xl px-4 py-3">
                                <p className="text-xs text-gray-400 font-medium mb-1">Kullanım Amacı</p>
                                <p className="text-sm text-gray-700">{equipment.purpose}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Hasar / Arıza Bildir */}
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    {damageReported ? (
                        <div className="px-6 py-5 text-center">
                            <div className="text-4xl mb-2">✅</div>
                            <p className="text-green-700 font-medium">Arıza/Hasar kaydı alındı!</p>
                            <p className="text-sm text-gray-400 mt-1">İlgili yöneticilere iletildi.</p>
                        </div>
                    ) : !showDamageForm ? (
                        <div className="px-6 py-5 text-center bg-red-50">
                            <p className="text-sm text-red-800 font-medium mb-3">Ekipmanda bir arıza veya fiziksel hasar mı tespit ettiniz?</p>
                            <button onClick={() => setShowDamageForm(true)}
                                className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition">
                                ⚠️ Arıza / Hasar Bildir
                            </button>
                        </div>
                    ) : (
                        <div className="px-6 py-5 space-y-3 bg-red-50 border-t-4 border-red-500">
                            <h3 className="font-bold text-red-800 text-sm">Hasar Bildirim Formu</h3>
                            <div>
                                <label className="block text-xs text-red-700 font-medium mb-1">Arıza / Hasar Detayı *</label>
                                <textarea rows={3} value={damageDesc} onChange={e => setDamageDesc(e.target.value)}
                                    placeholder="Lütfen tespit ettiğiniz sorunu kısaca açıklayın..."
                                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-red-700 font-medium mb-1">Adınız (opsiyonel)</label>
                                <input type="text" value={scannedBy} onChange={e => setScannedBy(e.target.value)}
                                    placeholder="Örn: Ahmet Yılmaz"
                                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowDamageForm(false)}
                                    className="flex-1 border border-red-200 text-red-700 bg-white px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition font-medium">
                                    İptal
                                </button>
                                <button onClick={submitDamageReport} disabled={reportingDamage}
                                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">
                                    {reportingDamage ? "Gönderiliyor..." : "Bildirimi Gönder"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lokasyon Güncelle */}
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    {updated ? (
                        <div className="px-6 py-5 text-center">
                            <div className="text-4xl mb-2">✅</div>
                            <p className="text-green-700 font-medium">Lokasyon güncellendi!</p>
                            <p className="text-sm text-gray-400 mt-1">{newLocation}</p>
                        </div>
                    ) : !isMobile ? (
                        <div className="px-6 py-5 text-center bg-yellow-50">
                            <div className="text-4xl mb-2">📱</div>
                            <p className="text-sm text-yellow-800 font-medium">Bu cihazdan konum güncellenemez.</p>
                            <p className="text-xs text-yellow-600 mt-1">Konum güncellemesi sadece mobil cihazlardan QR kod okutularak yapılabilir.</p>
                        </div>
                    ) : !showUpdateForm ? (
                        <div className="px-6 py-5 text-center">
                            <p className="text-sm text-gray-500 mb-3">Bu ekipmanı teslim aldınız veya yerini değiştirdiniz mi?</p>
                            <button onClick={() => setShowUpdateForm(true)}
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                                📍 Lokasyonu Güncelle
                            </button>
                        </div>
                    ) : (
                        <div className="px-6 py-5 space-y-3">
                            <h3 className="font-medium text-gray-800 text-sm">Lokasyon Güncelle</h3>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Güncel Lokasyon *</label>
                                <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)}
                                    placeholder="Depo A / 2. Kat / Üretim Hattı..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Adınız (opsiyonel)</label>
                                <input type="text" value={scannedBy} onChange={e => setScannedBy(e.target.value)}
                                    placeholder="Ahmet Yılmaz"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowUpdateForm(false)}
                                    className="flex-1 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                                    İptal
                                </button>
                                <button onClick={handleUpdateLocation} disabled={updating}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                                    {updating ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-gray-300 pb-4">
                    BulutOtomasyon • Ekipman Takip Sistemi
                </p>
            </div>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-sm text-gray-800 mt-0.5 font-medium">{value || "—"}</p>
        </div>
    );
}
