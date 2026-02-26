import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { JOB_TYPES, HAZARDS, PPE_REQUIREMENTS, PRECAUTIONS } from "./constants";

interface Project {
    id: string;
    name: string;
}

interface Subcontractor {
    id: string;
    name: string;
}

export default function NewWorkPermit() {
    const navigate = useNavigate();
    const { user, profile } = useAuthStore();

    // Core Form Fields
    const [department, setDepartment] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
    const [estimatedHours, setEstimatedHours] = useState("");
    const [projectId, setProjectId] = useState("");

    // Remote Data
    const [projects, setProjects] = useState<Project[]>([]);
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    // Arrays & Others
    const [jobTypes, setJobTypes] = useState<string[]>([]);
    const [jobTypeOther, setJobTypeOther] = useState("");

    const [hazards, setHazards] = useState<string[]>([]);
    const [hazardOther, setHazardOther] = useState("");

    const [ppes, setPpes] = useState<string[]>([]);
    const [ppeOther, setPpeOther] = useState("");

    const [precautions, setPrecautions] = useState<string[]>([]);
    const [precautionOther, setPrecautionOther] = useState("");

    // Coworkers
    const [coworkers, setCoworkers] = useState<{ fullName: string, location: string, sicilTc: string }[]>([]);

    // Final Approval (Creator Pledge)
    const [creatorTcOrSicil, setCreatorTcOrSicil] = useState("");

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!profile?.tenant_id) return;
        const fetchData = async () => {
            const [projRes, subRes] = await Promise.all([
                supabase.from('action_projects').select('id, name').eq('company_id', profile.tenant_id).order('name'),
                supabase.from('subcontractors').select('id, name').eq('parent_company_id', profile.tenant_id).eq('is_active', true).order('name'),
            ]);
            if (projRes.data) setProjects(projRes.data);
            if (subRes.data) setSubcontractors(subRes.data);
            setLoadingProjects(false);
        };
        fetchData();
    }, [profile]);

    const handleCheckboxToggle = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(x => x !== item));
        } else {
            setList([...list, item]);
        }
    };

    const addCoworker = () => {
        setCoworkers([...coworkers, { fullName: "", location: "", sicilTc: "" }]);
    };

    const updateCoworker = (index: number, field: string, value: string) => {
        const newArr = [...coworkers];
        newArr[index] = { ...newArr[index], [field]: value };
        setCoworkers(newArr);
    };

    const removeCoworker = (index: number) => {
        setCoworkers(coworkers.filter((_, i) => i !== index));
    };

    // Warnings
    const showGasWarning = jobTypes.includes("Kapalı Alan") || precautions.includes("Gaz ölçümü");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!profile?.tenant_id) return;
        if (jobTypes.length === 0 || hazards.length === 0 || ppes.length === 0 || precautions.length === 0) {
            setError("Lütfen her listeden (İş Tipleri, Tehlikeler, KKD, Önlemler) en az bir madde seçiniz.");
            window.scrollTo(0, 0);
            return;
        }

        if (creatorTcOrSicil.trim() === "") {
            setError("Taahhütnameyi onaylamak için Sicil / TC Kimlik numaranızı girmelisiniz.");
            window.scrollTo(0, 0);
            return;
        }

        // Verify that the creator's TC or Sicil matches what we have in the DB for them
        // If they enter something else, reject it.
        const isSicilMatch = profile.company_employee_no === creatorTcOrSicil.trim();
        const isTcMatch = profile.tc_no === creatorTcOrSicil.trim();

        if (!isSicilMatch && !isTcMatch) {
            setError("Girdiğiniz Kimlik/Sicil numarası profildeki bilgilerinizle eşleşmedi. Form onaylanamadı.");
            window.scrollTo(0, 0);
            return;
        }

        setSaving(true);
        try {
            // 1. Insert Work Permit
            const { data: wpData, error: wpError } = await supabase
                .from('work_permits')
                .insert({
                    tenant_id: profile.tenant_id,
                    created_by: user!.id,
                    department: department || null,
                    company_name: companyName ? (subcontractors.find(s => s.id === companyName)?.name || null) : null,
                    subcontractor_id: companyName || null,
                    work_date: workDate,
                    estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
                    project_id: projectId || null,

                    job_types: jobTypes,
                    job_type_other: jobTypes.includes("Diğer") ? jobTypeOther : null,

                    hazards: hazards,
                    hazard_other: hazards.includes("Diğer") ? hazardOther : null,

                    ppe_requirements: ppes,
                    ppe_other: ppes.includes("Diğer") ? ppeOther : null,

                    precautions: precautions,
                    precaution_other: precautions.includes("Diğer") ? precautionOther : null,

                    status: 'pending',
                    creator_tc_no: creatorTcOrSicil.trim(),
                    is_creator_approved: true
                })
                .select('id')
                .single();

            if (wpError) throw wpError;
            const permitId = wpData.id;

            // 2. Insert Coworkers
            if (coworkers.length > 0) {
                const inserts = coworkers.map(c => {
                    const cleanSicilTc = c.sicilTc.trim();
                    // Basic logic: if it's 11 digits, we assume it's TC, else Sicil.
                    const isTc = /^\d{11}$/.test(cleanSicilTc);

                    return {
                        permit_id: permitId,
                        full_name: c.fullName,
                        location: c.location || null,
                        tc_no: isTc ? cleanSicilTc : null,
                        sicil_no: !isTc ? cleanSicilTc : null
                    };
                });

                const { error: cwError } = await supabase.from('work_permit_coworkers').insert(inserts);
                if (cwError) throw cwError;
            }

            // Success, navigate back to list
            navigate("/app/work-permits", { state: { message: "İş izni başarıyla oluşturuldu ve onaya gönderildi." } });

        } catch (err: any) {
            console.error(err);
            setError(err.message || "İş izni oluşturulurken bir hata oluştu.");
            window.scrollTo(0, 0);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-24">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Yeni İş İzni Oluştur</h1>
                    <p className="text-sm text-gray-500 mt-1">Lütfen aşağıdaki formu eksiksiz doldurun ve taahhüde onay verin.</p>
                </div>
                <button onClick={() => navigate("/app/work-permits")} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    İptal Et
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Genel Bilgiler */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4">1. Genel Bilgiler</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                            <select value={companyName} onChange={e => setCompanyName(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm">
                                <option value="">Kendi Firmam</option>
                                {subcontractors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Departman</label>
                            <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Örn: Bakım, Üretim" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tarih *</label>
                            <input type="date" required value={workDate} onChange={e => setWorkDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Çalışma Saati (Saat) *</label>
                            <input type="number" required step="0.5" min="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Örn: 4.5" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Proje / Lokasyon (Opsiyonel)</label>
                            <select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={loadingProjects}
                                className="w-full px-3 py-2 border rounded-md text-sm disabled:bg-gray-100">
                                <option value="">Proje Seçiniz...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. İş Tipleri */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center justify-between">
                        2. İş Tipleri (En az 1 seçim zorunlu)
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{jobTypes.length} seçildi</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {JOB_TYPES.map(type => (
                            <label key={type} className="flex items-start space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                <input type="checkbox" className="mt-1 rounded text-indigo-600"
                                    checked={jobTypes.includes(type)}
                                    onChange={() => handleCheckboxToggle(jobTypes, setJobTypes, type)}
                                />
                                <span className="text-sm text-gray-700 leading-snug">{type}</span>
                            </label>
                        ))}
                    </div>
                    {jobTypes.includes("Diğer") && (
                        <div className="mt-4 pt-3 border-t">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Diğer İş Tipi Açıklaması *</label>
                            <input type="text" required value={jobTypeOther} onChange={e => setJobTypeOther(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-indigo-500" placeholder="Lütfen belirtiniz..." />
                        </div>
                    )}
                </div>

                {/* 3. Tehlikelerin Belirlenmesi */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center justify-between">
                        3. Tehlikelerin Belirlenmesi (En az 1 seçim zorunlu)
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{hazards.length} seçildi</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {HAZARDS.map(item => (
                            <label key={item} className="flex items-start space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                <input type="checkbox" className="mt-1 rounded text-red-600"
                                    checked={hazards.includes(item)}
                                    onChange={() => handleCheckboxToggle(hazards, setHazards, item)}
                                />
                                <span className="text-sm text-gray-700 leading-snug">{item}</span>
                            </label>
                        ))}
                    </div>
                    {hazards.includes("Diğer") && (
                        <div className="mt-4 pt-3 border-t">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Diğer Tehlike Açıklaması *</label>
                            <input type="text" required value={hazardOther} onChange={e => setHazardOther(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Lütfen belirtiniz..." />
                        </div>
                    )}
                </div>

                {/* 4. Kişisel Koruyucu Donanımlar */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center justify-between">
                        4. Kişisel Koruyucu Donanımlar (En az 1 seçim zorunlu)
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{ppes.length} seçildi</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {PPE_REQUIREMENTS.map(item => (
                            <label key={item} className="flex items-start space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                <input type="checkbox" className="mt-1 rounded text-blue-600"
                                    checked={ppes.includes(item)}
                                    onChange={() => handleCheckboxToggle(ppes, setPpes, item)}
                                />
                                <span className="text-sm text-gray-700 leading-snug">{item}</span>
                            </label>
                        ))}
                    </div>
                    {ppes.includes("Diğer") && (
                        <div className="mt-4 pt-3 border-t">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Diğer KKD Açıklaması *</label>
                            <input type="text" required value={ppeOther} onChange={e => setPpeOther(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Lütfen belirtiniz..." />
                        </div>
                    )}
                </div>

                {/* 5. Alınması Gereken Önlemler */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center justify-between">
                        5. Alınması Gereken Önlemler / Kontroller
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{precautions.length} seçildi</span>
                    </h2>

                    {showGasWarning && (
                        <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-md flex items-start text-sm">
                            <svg className="w-5 h-5 mr-2 shrink-0 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span><strong>Dikkat:</strong> Kapalı alanda sıcak işlem veya iç mahallerde boya uygulaması gerçekleştiriliyorsa mutlaka gaz ölçümü alınarak kayıt tutulmalıdır!</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {PRECAUTIONS.map(item => (
                            <label key={item} className="flex items-start space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                <input type="checkbox" className="mt-1 rounded text-emerald-600"
                                    checked={precautions.includes(item)}
                                    onChange={() => handleCheckboxToggle(precautions, setPrecautions, item)}
                                />
                                <span className="text-sm text-gray-700 leading-snug">{item}</span>
                            </label>
                        ))}
                    </div>
                    {precautions.includes("Diğer") && (
                        <div className="mt-4 pt-3 border-t">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Diğer Önlem Açıklaması *</label>
                            <input type="text" required value={precautionOther} onChange={e => setPrecautionOther(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Lütfen belirtiniz..." />
                        </div>
                    )}
                </div>

                {/* 6. Beraber Çalışacağı Personeller */}
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">6. Beraber Çalışılan Personeller (Opsiyonel)</h2>
                        <button type="button" onClick={addCoworker} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md font-medium hover:bg-indigo-100 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Personel Ekle
                        </button>
                    </div>

                    {coworkers.length === 0 ? (
                        <p className="text-sm text-gray-500 italic text-center py-4">Eklenmiş personel yok. Yanınızda çalışan biri varsa yukarıdan ekleyebilirsiniz.</p>
                    ) : (
                        <div className="space-y-4">
                            {coworkers.map((cw, idx) => (
                                <div key={idx} className="bg-gray-50 p-4 rounded-md border flex flex-col md:flex-row gap-4 items-start md:items-end">
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Ad Soyad *</label>
                                        <input type="text" required value={cw.fullName} onChange={e => updateCoworker(idx, 'fullName', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Ahmet Yılmaz" />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Lokasyon</label>
                                        <input type="text" value={cw.location} onChange={e => updateCoworker(idx, 'location', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Örn: Kat 2 Alan B" />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Sicil / TC No *</label>
                                        <input type="text" required value={cw.sicilTc} onChange={e => updateCoworker(idx, 'sicilTc', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Onay için gereklidir" />
                                    </div>
                                    <button type="button" onClick={() => removeCoworker(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 7. Taahhütname & Gönderim */}
                <div className="bg-indigo-50 shadow rounded-lg p-6 border border-indigo-100">
                    <h2 className="text-lg font-semibold text-indigo-900 border-b border-indigo-200 pb-3 mb-4">7. Çalışan Taahhütnamesi & Onay</h2>

                    <div className="bg-white p-4 rounded-md text-sm text-gray-700 leading-relaxed mb-5 shadow-sm border border-gray-200">
                        "Çalışma öncesinde belirlenen ve bu formda belirtilen tüm tedbirlere tam olarak uyacağımı, çalışma esnasında ortaya çıkabilecek diğer risk ve tedbirler için ustabaşına ve İSG personeline danışacağımı, tereddüt oluşturan riskli faaliyetleri yerine getirmeyeceğimi, tarafıma temin edilen kişisel koruyucu donanımlarımı yaptığım işe uygun ve eksiksiz olarak kullanacağımı, tebliğ edilen ilgili çalışma talimatlarında ki gerekliliklere harfiyen uyacağımı beyan ederim."
                    </div>

                    <div className="bg-white p-5 rounded-md shadow-sm border border-indigo-100 flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 mb-1">Taahhütnamenin Onayı İçin Sicil/TC Kimlik Giriniz:</p>
                            <p className="text-xs text-gray-500 mb-3">Bu işlem elektronik ıslak imza yerine geçer.</p>
                            <input
                                type="text"
                                required
                                value={creatorTcOrSicil}
                                onChange={e => setCreatorTcOrSicil(e.target.value)}
                                className="w-full max-w-sm px-4 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                placeholder="Sicil veya TC Numarası"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full md:w-auto mt-4 md:mt-0 px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {saving ? 'Gönderiliyor...' : 'TAAHHÜDÜ ONAYLA VE FORMU GÖNDER'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
