import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Save, FileText } from "lucide-react";
import SignaturePad from "@/components/adr/SignaturePad";
import { getQuestionsForFlow } from "./TMGDFormUtils";

interface Props {
    clientData: any;
    onSuccess: (flow: string, category: string, formData: any) => void;
    onCancel: () => void;
}

export default function TMGDFieldFormWizard({ clientData, onSuccess, onCancel }: Props) {
    const [step, setStep] = useState(1);
    
    // Config States
    const [flowType, setFlowType] = useState<"alim" | "gonderim" | null>(null);
    const [subType, setSubType] = useState<string | null>(null); // ambalaj, tanker, konteyner, vidanjor, dokme
    const [wasteType, setWasteType] = useState<"atik" | "urun" | null>(null);

    // Form Data
    const [formData, setFormData] = useState({
        driver_plate: "",
        driver_name: "",
        date: new Date().toISOString().split("T")[0],
        
        // Alım Tanker specific
        tank_onay: "",
        arac_uygunluk_pre2015: "",
        son_muayene: "",
        un_no: "",
        sinif: "",
        pg: "",

        // Signatures
        sender_name: "",
        sender_signature: "",
        driver_signature: "",

        // Checklist Answers
        checklist: {} as Record<string, string>
    });

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateChecklist = (id: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            checklist: { ...prev.checklist, [id]: value }
        }));
    };

    const handleNext = () => setStep(s => s + 1);
    const handlePrev = () => setStep(s => s - 1);

    const handleSubmit = () => {
        if (!formData.sender_signature || !formData.driver_signature) {
            alert("Lütfen tüm imzaları tamamlayın.");
            return;
        }
        
        let finalFormType = subType;
        if (flowType === "gonderim") {
            finalFormType = `${wasteType}_${subType}`; // e.g., atik_vidanjor
        }
        
        onSuccess(flowType!, finalFormType!, formData);
    };

    const renderRadioGroup = (q: any, options: {val: string, label: string}[]) => (
        <div key={q.id} className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{q.text}</label>
            <div className="flex flex-wrap gap-3">
                {options.map(opt => (
                    <label key={opt.val} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 transition-colors">
                        <input 
                            type="radio" 
                            name={`chk_${q.id}`} 
                            value={opt.val} 
                            checked={formData.checklist[q.id] === opt.val}
                            onChange={(e) => updateChecklist(q.id, e.target.value)}
                            className="text-indigo-600"
                        />
                        <span className="text-xs font-medium">{opt.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    const renderSection = (section: any) => {
        const type = section.type;
        return (
            <div key={section.section} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                <h3 className="font-bold text-sm text-indigo-600 uppercase mb-4">{section.section}</h3>
                <div className="space-y-3">
                    {section.questions.map((q: any) => {
                        const actualType = q.typeOverride || type;
                        if (actualType === "yes_no") {
                            return renderRadioGroup(q, [{val: 'evet', label: 'Evet'}, {val: 'hayir', label: 'Hayır'}]);
                        } else if (actualType === "yes_no_na") {
                            return renderRadioGroup(q, [{val: 'evet', label: 'Evet'}, {val: 'hayir', label: 'Hayır'}, {val: 'ilgisiz', label: 'İlgisiz'}]);
                        } else if (actualType === "var_yok") {
                            return renderRadioGroup(q, [{val: 'var', label: 'Var'}, {val: 'yok', label: 'Yok'}]);
                        } else if (actualType === "uygun_degil") {
                            return renderRadioGroup(q, [{val: 'uygun', label: 'Uygun'}, {val: 'uygun_degil', label: 'Uygun Değil'}]);
                        }
                        return null;
                    })}
                </div>
            </div>
        );
    };

    const getQuestionsForCurrentFlow = () => {
        if (!flowType || !subType) return [];
        return getQuestionsForFlow(flowType, flowType === "gonderim" ? `${wasteType}_${subType}` : subType);
    };

    // Her flow/subType değiştiğinde default cevapları ayarla
    React.useEffect(() => {
        const questions = getQuestionsForCurrentFlow();
        const defaultChecklist: Record<string, string> = {};
        questions.forEach((sec: any) => {
            sec.questions.forEach((q: any) => {
                const actualType = q.typeOverride || sec.type;
                if (actualType === "yes_no" || actualType === "yes_no_na") defaultChecklist[q.id] = 'evet';
                else if (actualType === "var_yok") defaultChecklist[q.id] = 'var';
                else if (actualType === "uygun_degil") defaultChecklist[q.id] = 'uygun';
                else defaultChecklist[q.id] = 'evet';
            });
        });
        setFormData(prev => ({ ...prev, checklist: defaultChecklist }));
    }, [flowType, subType, wasteType]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
                <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500"/> Yeni Kontrol Formu Sihirbazı</h2>
                <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 text-sm font-medium">İptal / Çıkış</button>
            </div>

            <div className="p-6">
                {/* STEP 1: Flow Type */}
                {step === 1 && (
                    <div className="space-y-6 text-center py-10">
                        <h3 className="text-xl font-bold mb-6">İşlem Türü Nedir?</h3>
                        <div className="flex flex-col sm:flex-row justify-center gap-6">
                            <button onClick={() => { setFlowType("alim"); handleNext(); }} className="p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group">
                                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition">ALIM</div>
                                <div className="text-sm text-slate-500 mt-2">İşletmeye mal/madde kabul ediliyor</div>
                            </button>
                            <button onClick={() => { setFlowType("gonderim"); handleNext(); }} className="p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition group">
                                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition">GÖNDERİM</div>
                                <div className="text-sm text-slate-500 mt-2">İşletmeden mal/atık gönderiliyor</div>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Alım Sub Type */}
                {step === 2 && flowType === "alim" && (
                    <div className="space-y-6 text-center py-10">
                        <button onClick={handlePrev} className="absolute left-6 top-20 text-slate-500 flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Geri</button>
                        <h3 className="text-xl font-bold mb-6">Taşıma / Ambalaj Türü Nedir?</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                            {['Ambalaj', 'Tanker', 'Konteyner'].map(t => (
                                <button key={t} onClick={() => { setSubType(t.toLowerCase()); handleNext(); }} className="px-8 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition font-bold text-lg">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 2: Gönderim Waste Type */}
                {step === 2 && flowType === "gonderim" && (
                    <div className="space-y-6 text-center py-10">
                        <button onClick={handlePrev} className="absolute left-6 top-20 text-slate-500 flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Geri</button>
                        <h3 className="text-xl font-bold mb-6">Gönderilen Madde Nedir?</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                            {['Atık', 'Ürün'].map(t => (
                                <button key={t} onClick={() => { setWasteType(t.toLowerCase() as any); handleNext(); }} className="px-8 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition font-bold text-lg">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 3: Gönderim Sub Type */}
                {step === 3 && flowType === "gonderim" && (
                    <div className="space-y-6 text-center py-10">
                        <button onClick={handlePrev} className="absolute left-6 top-20 text-slate-500 flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Geri</button>
                        <h3 className="text-xl font-bold mb-6">Taşıma / Ambalaj Türü Nedir? ({wasteType?.toUpperCase()})</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                            {[
                                { label: 'Vidanjör / Tanker', val: 'vidanjor' },
                                { label: 'Ambalaj', val: 'ambalaj' },
                                { label: 'Dökme', val: 'dokme' }
                            ].map(t => (
                                <button key={t.val} onClick={() => { setSubType(t.val); handleNext(); }} className="px-8 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition font-bold text-lg">
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* FINAL STEP: Form Veri Girişi */}
                {((step === 3 && flowType === "alim") || (step === 4 && flowType === "gonderim")) && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="flex items-center justify-between border-b pb-4 mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase">
                                    {flowType === 'alim' ? 'ALICI - BOŞALTAN FORMU' : 'GÖNDERİM KONTROL FORMLARI'}
                                </h3>
                                <p className="text-sm text-slate-500">Kategori: {subType?.toUpperCase()} {wasteType ? `(${wasteType.toUpperCase()})` : ''}</p>
                            </div>
                            <button onClick={handlePrev} className="text-slate-500 flex items-center gap-1 text-sm font-medium"><ArrowLeft className="w-4 h-4"/> Başlangıca Dön</button>
                        </div>

                        {/* Genel Bilgiler */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Tarih</label><input type="date" value={formData.date} onChange={e=>updateField('date', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"/></div>
                            <div><label className="block text-sm font-medium mb-1">Araç Plakası</label><input value={formData.driver_plate} onChange={e=>updateField('driver_plate', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 font-mono uppercase text-sm"/></div>
                            <div><label className="block text-sm font-medium mb-1">Şoför Adı Soyadı</label><input value={formData.driver_name} onChange={e=>updateField('driver_name', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"/></div>
                        </div>

                        {flowType === "alim" && subType === "tanker" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Tank Son Muayene Tarihi</label><input type="date" value={formData.son_muayene} onChange={e=>updateField('son_muayene', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"/></div>
                                <div><label className="block text-sm font-medium mb-1">Tehlikeli Madde UN Numarası</label><input placeholder="Örn: 1203" value={formData.un_no} onChange={e=>updateField('un_no', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"/></div>
                                <div><label className="block text-sm font-medium mb-1">Sınıf / PG</label><div className="flex gap-2"><input placeholder="Sınıf" value={formData.sinif} onChange={e=>updateField('sinif', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"/><input placeholder="PG" value={formData.pg} onChange={e=>updateField('pg', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"/></div></div>
                            </div>
                        )}

                        {flowType === "gonderim" && subType === "ambalaj" && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Not: İşletmede dolumu yapılan taşınabilir basınçlı ekipman yoktur.</p>
                            </div>
                        )}

                        {/* Sorular */}
                        <div className="mt-8">
                            {getQuestionsForCurrentFlow().map(renderSection)}
                        </div>

                        {/* İmzalar */}
                        <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-sm mb-3 text-slate-700">Hazırlayan (Saha Personeli)</h4>
                                <input placeholder="Ad Soyad" value={formData.sender_name} onChange={e=>updateField('sender_name', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm mb-3"/>
                                <SignaturePad label="İmza" value={formData.sender_signature} onChange={s=>updateField('sender_signature', s||"")} required/>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm mb-3 text-slate-700">Teslim Alan (Sürücü)</h4>
                                <div className="text-sm font-medium mb-3 h-10 flex items-center">{formData.driver_name || "Sürücü Adı Girilmedi"}</div>
                                <SignaturePad label="İmza" value={formData.driver_signature} onChange={s=>updateField('driver_signature', s||"")} required/>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                            <button onClick={handleSubmit} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex gap-2 items-center shadow-lg shadow-indigo-600/20">
                                <Save className="w-5 h-5"/> {flowType === 'alim' ? 'Formu Onayla ve Kaydet' : 'Taslak Olarak Kaydet (Taşıma Evrağı Oluşturulacak)'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
