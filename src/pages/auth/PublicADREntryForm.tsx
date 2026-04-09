import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
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
import { ArrowLeft, CheckCircle, MapPin, UserCheck, ShieldAlert, PenLine } from "lucide-react";

export default function PublicADREntryForm() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0); // 0 = Identity Auth, 1+ = Form Steps
    const [loading, setLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [images, setImages] = useState<{ url: string; name: string }[]>([]);
    const [driverSignature, setDriverSignature] = useState<string | null>(null);
    const [driverSignatureError, setDriverSignatureError] = useState(false);

    // Identity Data
    const [identityNo, setIdentityNo] = useState("");

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

    // Form tipleri
    const [activeForms, setActiveForms] = useState<ADRFormDefinition[]>([]);

    useEffect(() => {
        let forms: ADRFormDefinition[] = [];
        if (processType === "ALIM") {
            if (subType === "TANKER") forms = [TANK_ALICI_FORM];
            if (subType === "AMBALAJ") forms = [AMBALAJ_ALICI_FORM];
        } else if (processType === "GONDERIM") {
            if (subType === "KATI") forms = [YUKLEYEN_GONDEREN_FORM, PAKETLEYEN_FORM];
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
                alert("Konum alınamadı. Lütfen konum erişimine izin verin. Hata: " + err.message);
                setLocationLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    // Kimlik Doğrulama Adımı
    const handleIdentityCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        if (!identityNo || identityNo.length < 3) {
            setAuthError("Lütfen geçerli bir T.C. Kimlik veya Sicil Numarası giriniz.");
            return;
        }

        setLoading(true);
        try {
            // Check if profile exists with this identity via our public RPC
            const { data: isValid, error: checkError } = await supabase.rpc('check_employee_identity', {
                p_identity_no: identityNo
            });

            if (checkError) throw checkError;

            if (!isValid) {
                setAuthError("Girdiğiniz T.C. Kimlik veya Sicil Numarası sistemde bulunamadı. Lütfen kontrol edip tekrar deneyin.");
                return;
            }

            setStep(1);
        } catch (error: any) {
            setAuthError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const onSubmitFinal = async (data: any) => {
        if (!location) {
            alert("Lütfen konum bilgisini ekleyin.");
            return;
        }
        if (!driverSignature) {
            setDriverSignatureError(true);
            // Scroll to signature area
            document.getElementById('public-signature-section')?.scrollIntoView({ behavior: 'smooth' });
            alert("Şoför imzası zorunludur. Lütfen imzayı ekleyin.");
            return;
        }
        setDriverSignatureError(false);

        setLoading(true);
        try {
            const mainFormType = activeForms[0].type;

            // Media formatting
            const mediaArray = images.map(img => img.url);

            // Call the secure RPC function
            const { data: formId, error: submitError } = await supabase.rpc('submit_public_adr_form', {
                p_identity_no: identityNo,
                p_form_type: mainFormType,
                p_plate_no: data.plate_no,
                p_driver_name: data.driver_name,
                p_location_lat: location.lat,
                p_location_lng: location.lng,
                p_notes: data.notes,
                p_form_answers: data.answers,
                p_form_media: mediaArray,
                p_driver_signature: driverSignature
            });

            if (submitError) {
                // Return to step 0 if identity was invalid
                if (submitError.message.includes("bulunamadı")) {
                    setStep(0);
                    setAuthError("Girdiğiniz Kimlik/Sicil Numarası sistemde bulunamadı.");
                } else {
                    throw new Error(submitError.message);
                }
                return;
            }

            alert("Form başarıyla kaydedildi! Form ID: " + formId);
            navigate("/auth/login");

        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            <div className="max-w-3xl mx-auto pb-20 pt-8 px-4 sm:px-0">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => { if (step > 0) setStep(step - 1); else navigate("/auth/login"); }} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="w-6 h-6 text-indigo-500" />
                            ADR Formu Girişi
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">Tehlikeli Madde Yükleme / Boşaltma Kontrolü</p>
                    </div>
                </div>

                {/* STEP 0: Kimlik Doğrulama */}
                {step === 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl max-w-md mx-auto mt-10">
                        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UserCheck className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold text-center text-white mb-2">Personel Doğrulama</h2>
                        <p className="text-sm text-slate-400 text-center mb-8">Devam etmek için T.C. Kimlik Numaranızı veya Sicil Numaranızı girmelisiniz.</p>

                        <form onSubmit={handleIdentityCheck} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">TC Kimlik veya Sicil No</label>
                                <input
                                    type="text"
                                    required
                                    value={identityNo}
                                    onChange={(e) => setIdentityNo(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="11 Haneli TC No veya Sicil"
                                />
                            </div>

                            {authError && (
                                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                                    {authError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !identityNo}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? "Doğrulanıyor..." : "Doğrula ve Başla"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Progress Bar for Form Steps */}
                {step > 0 && (
                    <div className="mb-8">
                        <div className="w-full bg-slate-800 h-2 rounded-full mt-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/20" style={{ width: `${(step / 4) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>İşlem Türü</span>
                            <span>Detay</span>
                            <span>Sorular</span>
                            <span>Kaydet</span>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {/* STEP 1: İşlem Türü */}
                    {step === 1 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
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
                        <div className="space-y-4 max-w-2xl mx-auto">
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
                        <form id="adr-form" onSubmit={handleSubmit(() => {
                            setStep(4);
                        })} className="space-y-8">

                            {/* Genel Bilgiler */}
                            <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800">
                                <h3 className="font-semibold text-indigo-400 border-b border-slate-800 pb-3 mb-5">Araç ve Şoför Bilgileri</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Araç Plakası</label>
                                        <input {...register("plate_no", { required: true })} className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none uppercase placeholder:normal-case placeholder:text-slate-600" placeholder="34 ABC 123" />
                                        {errors.plate_no && <span className="text-rose-500 text-xs mt-1 block">Bu alan zorunludur</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Şoför Adı Soyadı</label>
                                        <input {...register("driver_name", { required: true })} className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-600" placeholder="Ad Soyad" />
                                        {errors.driver_name && <span className="text-rose-500 text-xs mt-1 block">Bu alan zorunludur</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Dinamik Form Bölümleri */}
                            {activeForms.map((formDef, fIndex) => (
                                <div key={fIndex} className="space-y-6">
                                    <div className="bg-indigo-500/10 p-4 rounded-lg text-indigo-300 font-bold text-center uppercase tracking-wide border border-indigo-500/20">
                                        {formDef.title}
                                    </div>

                                    {formDef.sections.map((section, sIndex) => (
                                        <div key={sIndex} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 space-y-5">
                                            <h4 className="text-base font-bold text-slate-300 uppercase">{section.title}</h4>
                                            <div className="space-y-4">
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
                                <Button type="submit">Önizleme ve Devam Et</Button>
                            </div>
                        </form>
                    )}

                    {/* STEP 4: Özet, Fotoğraf, Konum */}
                    {step === 4 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="bg-emerald-500/10 p-5 rounded-xl border border-emerald-500/20 text-emerald-400 flex items-start gap-4 shadow-lg shadow-emerald-500/5">
                                <CheckCircle className="w-8 h-8 flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-lg">Son Adım: Fotoğraf ve Konum</h3>
                                    <p className="text-sm text-emerald-400/80 mt-1">İşlemi tamamlamak için mevcut konumunuzu onaylayın ve varsa fotoğrafları ekleyin.</p>
                                </div>
                            </div>

                            {/* Fotoğraf Yükleme */}
                            <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800">
                                <h3 className="font-semibold text-slate-300 mb-4">Fotoğraflar (Opsiyonel)</h3>
                                <ImageUploader
                                    currentImages={images}
                                    onUpload={(url, name) => setImages([...images, { url, name }])}
                                    onRemove={(url) => setImages(images.filter(i => i.url !== url))}
                                />
                                <p className="text-xs text-slate-500 mt-2">Doldurulan formun veya aracın genel fotoğraflarını yükleyebilirsiniz.</p>
                            </div>

                            {/* Konum */}
                            <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-300">Konum Bilgisi</h3>
                                    {location && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">Konum Kaydedildi ✓</span>}
                                </div>

                                {!location ? (
                                    <button
                                        onClick={getLocation}
                                        disabled={locationLoading}
                                        className="w-full flex items-center justify-center gap-2 py-4 border-2 border-indigo-500/20 bg-indigo-500/5 text-indigo-400 rounded-lg font-medium hover:bg-indigo-500/10 transition-colors"
                                    >
                                        <MapPin className="w-5 h-5" />
                                        {locationLoading ? "Konum Alınıyor..." : "Mevcut Konumu Kaydet (Zorunlu)"}
                                    </button>
                                ) : (
                                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-700 text-sm text-slate-300 flex justify-between items-center">
                                        <span className="font-mono flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-emerald-500" />
                                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                        </span>
                                        <button onClick={getLocation} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Güncelle</button>
                                    </div>
                                )}
                            </div>

                            {/* Şoför İmzası */}
                            <div
                                id="public-signature-section"
                                className={`bg-slate-900 p-6 rounded-xl shadow-lg border transition-colors ${
                                    driverSignatureError ? 'border-rose-500/60' : 'border-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <PenLine className="w-5 h-5 text-indigo-400" />
                                    <h3 className="font-semibold text-slate-300">Şoför İmzası</h3>
                                    <span className="text-rose-400 text-sm ml-1">*</span>
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
                                    <p className="text-rose-500 text-sm mt-2 font-medium">⚠️ Şoför imzası zorunludur</p>
                                )}
                                <p className="text-xs text-slate-600 mt-3">Tablette veya telefonda parmak ile, bilgisayarda mouse ile imza atabilirsiniz.</p>
                            </div>

                            {/* Notlar */}
                            <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800">
                                <label className="block font-semibold text-slate-300 mb-3">Ek Notlar (Opsiyonel)</label>
                                <textarea
                                    {...register("notes")}
                                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-4 py-3 text-sm min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-600"
                                    placeholder="Belirtmek istediğiniz diğer hususlar..."
                                />
                            </div>

                            <div className="flex justify-end pt-6 gap-3 border-t border-slate-800">
                                <Button variant="secondary" onClick={() => setStep(3)}>Sorulara Dön</Button>
                                <Button onClick={handleSubmit(onSubmitFinal)} disabled={loading || !location || !driverSignature}>
                                    {loading ? "Kaydediliyor..." : "FORMU GÖNDER"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// UI Helpers
function SelectionCard({ title, desc, selected, onClick }: { title: string, desc: string, selected: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${selected
                ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10"
                : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/80"
                }`}
        >
            <h3 className={`text-xl font-bold mb-2 ${selected ? "text-indigo-400" : "text-slate-100"}`}>{title}</h3>
            <p className={`text-sm leading-relaxed ${selected ? "text-indigo-300/80" : "text-slate-400"}`}>{desc}</p>
        </div>
    );
}

function Button({ children, onClick, disabled, type = "button", variant = "primary" }: any) {
    const base = "px-6 py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center min-w-[140px]";
    const styles = variant === "primary"
        ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
        : "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700";

    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
            {children}
        </button>
    );
}
