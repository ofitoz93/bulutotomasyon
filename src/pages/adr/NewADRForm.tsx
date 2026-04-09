
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import QuestionBlock from "@/components/adr/QuestionBlock";
import ImageUploader from "@/components/adr/ImageUploader";
import SignaturePad from "@/components/adr/SignaturePad";
import {
    TANK_ALICI_FORM,
    AMBALAJ_ALICI_FORM,
    YUKLEYEN_GONDEREN_FORM,
    PAKETLEYEN_FORM,
    DOLDURAN_FORM,
    type ADRFormDefinition
} from "@/components/adr/formDefinitions";
import { ArrowLeft, CheckCircle, MapPin, PenLine } from "lucide-react";

export default function NewADRForm() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [images, setImages] = useState<{ url: string; name: string }[]>([]);
    const [driverSignature, setDriverSignature] = useState<string | null>(null);
    const [driverSignatureError, setDriverSignatureError] = useState(false);

    // Form Data
    const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm({
        defaultValues: {
            processType: "", // ALIM, GONDERIM
            subType: "", // TANKER, AMBALAJ, KATI, SIVI
            plate_no: "",
            driver_name: "",
            notes: "",
            answers: {} as Record<string, any>
        }
    });

    const processType = watch("processType");
    const subType = watch("subType");

    // Seçilen formları belirle
    const [activeForms, setActiveForms] = useState<ADRFormDefinition[]>([]);

    useEffect(() => {
        let forms: ADRFormDefinition[] = [];
        if (processType === "ALIM") {
            if (subType === "TANKER") forms = [TANK_ALICI_FORM];
            if (subType === "AMBALAJ") forms = [AMBALAJ_ALICI_FORM];
        } else if (processType === "GONDERIM") {
            if (subType === "KATI") forms = [YUKLEYEN_GONDEREN_FORM, PAKETLEYEN_FORM]; // Stepper mantığı
            if (subType === "SIVI") forms = [YUKLEYEN_GONDEREN_FORM, DOLDURAN_FORM];
        }
        setActiveForms(forms);
    }, [processType, subType]);

    // Konum Alma
    const getLocation = () => {
        if (!navigator.geolocation) {
            alert("Tarayıcınız konum servisini desteklemiyor.");
            return;
        }
        setLocationLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationLoading(false);
            },
            (err) => {
                alert("Konum alınamadı: " + err.message);
                setLocationLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const onSubmit = async (data: any) => {
        if (!profile?.tenant_id || !profile?.id) {
            alert("Kullanıcı bilgisi eksik.");
            return;
        }
        if (!location) {
            alert("Lütfen konum bilgisini ekleyin.");
            return;
        }
        if (!driverSignature) {
            setDriverSignatureError(true);
            alert("Lütfen şoför imzasını ekleyin.");
            return;
        }
        setDriverSignatureError(false);

        setLoading(true);
        try {
            // 1. Ana Form Kaydı (İlk formu baz alalım veya birleştirilmiş tip)
            // Gönderim senaryosunda birden fazla form olsa da tek bir DB kaydı altında toplayabiliriz
            // veya form_type olarak ana tipi (YUKLEYEN-GONDEREN) seçip detayları cevaplara gömebiliriz.
            // Burada basitlik için ilk formun tipini ana tip olarak kullanalım.

            const mainFormType = activeForms[0].type;

            const { data: formRes, error: formError } = await supabase.from("adr_forms").insert({
                company_id: profile.tenant_id,
                user_id: profile.id,
                form_type: mainFormType,
                status: "pending",
                plate_no: data.plate_no,
                driver_name: data.driver_name,
                driver_signature: driverSignature,
                location_lat: location.lat,
                location_lng: location.lng,
                notes: data.notes
            }).select().single();

            if (formError) throw formError;

            // 2. Cevapların Kaydı
            const answersToInsert = Object.entries(data.answers).map(([key, value]: [string, any]) => ({
                form_id: formRes.id,
                question_key: key,
                answer_value: value
            }));

            if (answersToInsert.length > 0) {
                const { error: ansError } = await supabase.from("form_answers").insert(answersToInsert);
                if (ansError) throw ansError;
            }

            // 3. Medya Kaydı
            if (images.length > 0) {
                const mediaToInsert = images.map(img => ({
                    form_id: formRes.id,
                    file_url: img.url,
                    file_name: img.name
                }));
                const { error: mediaError } = await supabase.from("form_media").insert(mediaToInsert);
                if (mediaError) throw mediaError;
            }

            alert("Form başarıyla kaydedildi!");
            navigate("/app/adr");

        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- STEP WIZARD RENDER ---

    return (
        <div className="max-w-3xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 py-4 px-4 sm:px-0 border-b border-slate-800 md:border-none">
                <button onClick={() => { if (step > 1) setStep(step - 1); else navigate("/app/adr"); }} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white">
                        {step === 1 ? "İşlem Türü" : step === 2 ? "Detay Seçimi" : step === 3 ? "Form Doldurma" : "Özet ve Onay"}
                    </h1>
                    <div className="w-full bg-slate-800 h-2 rounded-full mt-2">
                        <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/20" style={{ width: `${(step / 4) * 100}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-0 space-y-6">

                {/* STEP 1: İşlem Türü */}
                {step === 1 && (
                    <div className="space-y-4">
                        <SelectionCard
                            title="Tehlikeli Madde Alımı"
                            desc="Tesise gelen tehlikeli maddelerin kabulü"
                            selected={processType === "ALIM"}
                            onClick={() => setValue("processType", "ALIM")}
                        />
                        <SelectionCard
                            title="Tehlikeli Madde / Atık Gönderimi"
                            desc="Tesisten çıkan madde veya atıkların sevkıyatı"
                            selected={processType === "GONDERIM"}
                            onClick={() => setValue("processType", "GONDERIM")}
                        />
                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setStep(2)} disabled={!processType}>Devam Et</Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Alt Tip */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-100 mb-4">
                            {processType === "ALIM" ? "Araç / Ambalaj Tipi" : "Gönderilen Materyal Tipi"}
                        </h2>

                        {processType === "ALIM" ? (
                            <>
                                <SelectionCard
                                    title="Ambalajlı / Konteyner"
                                    desc="Silindirik tüp, IBC, bidon, varil vb."
                                    selected={subType === "AMBALAJ"}
                                    onClick={() => setValue("subType", "AMBALAJ")}
                                />
                                <SelectionCard
                                    title="Tanker / Dökme"
                                    desc="Sıvı veya dökme yük taşıyan tankerler"
                                    selected={subType === "TANKER"}
                                    onClick={() => setValue("subType", "TANKER")}
                                />
                            </>
                        ) : (
                            <>
                                <SelectionCard
                                    title="Katı / Ambalajlı"
                                    desc="Katı atık veya paketli ürün gönderimi"
                                    selected={subType === "KATI"}
                                    onClick={() => setValue("subType", "KATI")}
                                />
                                <SelectionCard
                                    title="Sıvı / Tanker / Vidanjör"
                                    desc="Sıvı ürün veya atık gönderimi"
                                    selected={subType === "SIVI"}
                                    onClick={() => setValue("subType", "SIVI")}
                                />
                            </>
                        )}
                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setStep(3)} disabled={!subType}>Forma Başla</Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Form Soruları */}
                {step === 3 && (
                    <form id="adr-form" onSubmit={handleSubmit((_data) => {
                        // Validasyon manuel olarak adım geçişinde yapılabilir ama burada sadece summary'e geçiş
                        setStep(4);
                    })} className="space-y-8">

                        {/* Genel Bilgiler */}
                        <div className="bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-800">
                            <h3 className="font-semibold text-indigo-400 border-b border-slate-800 pb-2 mb-4">Sefer Bilgileri</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Araç Plakası</label>
                                    <input {...register("plate_no", { required: true })} className="w-full bg-slate-800 border-slate-700 text-slate-100 rounded px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="34 ABC 123" />
                                    {errors.plate_no && <span className="text-rose-500 text-xs">Gerekli</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Şoför Adı Soyadı</label>
                                    <input {...register("driver_name", { required: true })} className="w-full bg-slate-800 border-slate-700 text-slate-100 rounded px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Ad Soyad" />
                                    {errors.driver_name && <span className="text-rose-500 text-xs">Gerekli</span>}
                                </div>
                            </div>
                        </div>

                        {/* Dinamik Form Bölümleri */}
                        {activeForms.map((formDef, fIndex) => (
                            <div key={fIndex} className="space-y-6">
                                <div className="bg-indigo-500/10 p-3 rounded text-indigo-300 font-bold text-center uppercase tracking-wide border border-indigo-500/20">
                                    {formDef.title}
                                </div>

                                {formDef.sections.map((section, sIndex) => (
                                    <div key={sIndex} className="space-y-3">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase ml-1">{section.title}</h4>
                                        <div className="space-y-3">
                                            {section.questions.map((q) => (
                                                <QuestionBlock
                                                    key={q.key}
                                                    question={q}
                                                    control={control}
                                                    register={register}
                                                    setValue={setValue}
                                                    error={errors.answers?.[q.key]}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="flex justify-end pt-4">
                            {/* Buton type="submit" olduğu için form submit handler'ı çalışacak */}
                            <Button type="submit">Önizleme ve Kaydet</Button>
                        </div>
                    </form>
                )}

                {/* STEP 4: Özet, Fotoğraf, Konum */}
                {step === 4 && (
                    <div className="space-y-6">
                        <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20 text-emerald-400 flex items-start gap-3 shadow-lg shadow-emerald-500/5">
                            <CheckCircle className="w-6 h-6 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold">Form Verileri Hazır</h3>
                                <p className="text-sm text-emerald-400/80">Lütfen son olarak fotoğraf ve konum ekleyerek kaydı tamamlayın.</p>
                            </div>
                        </div>

                        {/* Fotoğraf Yükleme */}
                        <div className="bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-800">
                            <ImageUploader
                                currentImages={images}
                                onUpload={(url, name) => setImages([...images, { url, name }])}
                                onRemove={(url) => setImages(images.filter(i => i.url !== url))}
                            />
                        </div>

                        {/* Konum */}
                        <div className="bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-slate-400">Konum Bilgisi</h3>
                                {location && <span className="text-xs text-emerald-400 font-medium">Konum Alındı ✓</span>}
                            </div>

                            {!location ? (
                                <button
                                    onClick={getLocation}
                                    disabled={locationLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-indigo-500/20 bg-indigo-500/5 text-indigo-400 rounded-lg font-medium hover:bg-indigo-500/10 transition-colors"
                                >
                                    <MapPin className="w-5 h-5" />
                                    {locationLoading ? "Konum Alınıyor..." : "Mevcut Konumu Kaydet"}
                                </button>
                            ) : (
                                <div className="bg-slate-800 p-3 rounded border border-slate-700 text-sm text-slate-300 flex justify-between items-center">
                                    <span className="font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                                    <button onClick={getLocation} className="text-xs text-indigo-400 underline hover:text-indigo-300">Güncelle</button>
                                </div>
                            )}
                        </div>

                        {/* Şoför İmzası */}
                        <div className={`bg-slate-900 p-4 rounded-lg shadow-sm border transition-colors ${
                            driverSignatureError ? "border-rose-500/50" : "border-slate-800"
                        }`}>
                            <div className="flex items-center gap-2 mb-4">
                                <PenLine className="w-4 h-4 text-indigo-400" />
                                <h3 className="text-sm font-bold text-slate-300 uppercase">Şoför Bilgileri ve İmza</h3>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Şoför Adı Soyadı <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    {...register("driver_name", { required: true })}
                                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    placeholder="Ad Soyad"
                                />
                                {errors.driver_name && <span className="text-rose-500 text-xs mt-1 block">Şoför adı soyadı gerekli</span>}
                            </div>

                            <SignaturePad
                                label="Şoför İmzası"
                                required
                                value={driverSignature || undefined}
                                onChange={(dataUrl) => {
                                    setDriverSignature(dataUrl);
                                    setDriverSignatureError(false);
                                }}
                            />
                            {driverSignatureError && (
                                <p className="text-rose-500 text-xs mt-2">Şoför imzası zorunludur</p>
                            )}
                        </div>

                        {/* Notlar */}
                        <div className="bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-800">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Notlar (Opsiyonel)</label>
                            <textarea
                                {...register("notes")}
                                className="w-full bg-slate-800 border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm h-24 focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="Varsa ek açıklamalar..."
                            />
                        </div>

                        <div className="flex justify-end pt-4 gap-3">
                            <Button variant="secondary" onClick={() => setStep(3)}>Düzenle</Button>
                            <Button onClick={handleSubmit(onSubmit)} disabled={loading}>
                                {loading ? "Kaydediliyor..." : "KAYDET VE BİTİR"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// UI Helpers
function SelectionCard({ title, desc, selected, onClick }: { title: string, desc: string, selected: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${selected
                ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10"
                : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/80"
                }`}
        >
            <h3 className={`text-lg font-bold mb-1 ${selected ? "text-indigo-400" : "text-slate-100"}`}>{title}</h3>
            <p className={`text-sm ${selected ? "text-indigo-300/80" : "text-slate-400"}`}>{desc}</p>
        </div>
    );
}

function Button({ children, onClick, disabled, type = "button", variant = "primary" }: any) {
    const base = "px-6 py-3 rounded-md font-bold text-sm transition-colors flex items-center justify-center min-w-[120px]";
    const styles = variant === "primary"
        ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
        : "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700";

    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
            {children}
        </button>
    );
}
