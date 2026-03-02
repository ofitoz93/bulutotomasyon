import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { JOB_TYPES, HAZARDS, PPE_REQUIREMENTS, PRECAUTIONS } from "../work-permits/constants";

interface Project {
    id: string;
    name: string;
}

interface MyPermit {
    id: string;
    work_date: string;
    company_name: string;
    department: string;
    estimated_hours: number;
    status: string;
    created_at: string;
    job_types: string[];
    job_type_other: string;
    hazards: string[];
    hazard_other: string;
    ppe_requirements: string[];
    ppe_other: string;
    precautions: string[];
    precaution_other: string;
    project_id: string;
    coworkers: any[];
}

export default function PublicWorkPermitForm() {
    const navigate = useNavigate();

    // Steps: 1 = Auth, 2 = My Permits List, 3 = The Form
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Auth & Context State
    const [authInput, setAuthInput] = useState("");
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const [userId, setUserId] = useState("");
    const [tenantId, setTenantId] = useState("");
    const [fullName, setFullName] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [myPermits, setMyPermits] = useState<MyPermit[]>([]);
    const [listLoading, setListLoading] = useState(false);

    // Step 3 State - Form Fields
    const [editingPermitId, setEditingPermitId] = useState<string | null>(null);

    const [department, setDepartment] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
    const [estimatedHours, setEstimatedHours] = useState("");
    const [projectId, setProjectId] = useState("");

    const [jobTypes, setJobTypes] = useState<string[]>([]);
    const [jobTypeOther, setJobTypeOther] = useState("");

    const [hazards, setHazards] = useState<string[]>([]);
    const [hazardOther, setHazardOther] = useState("");

    const [ppes, setPpes] = useState<string[]>([]);
    const [ppeOther, setPpeOther] = useState("");

    const [precautions, setPrecautions] = useState<string[]>([]);
    const [precautionOther, setPrecautionOther] = useState("");

    const [coworkers, setCoworkers] = useState<{ fullName: string, location: string, sicilTc: string }[]>([]);

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);


    const fetchMyPermits = async (tcSicil: string) => {
        setListLoading(true);
        try {
            const { data, error } = await supabase.rpc('public_get_my_created_permits', {
                p_sicil_tc: tcSicil
            });
            if (error) throw error;
            setMyPermits(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setListLoading(false);
        }
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setAuthLoading(true);

        try {
            const cleanInput = authInput.trim();
            if (!cleanInput) throw new Error("Lütfen TC Kimlik veya Sicil numaranızı girin.");

            const { data, error } = await supabase.rpc('public_get_permit_context', {
                p_sicil_tc: cleanInput
            });

            if (error) throw new Error(error.message || "Kimlik doğrulama başarısız. Lütfen bilgilerinizi kontrol edin.");

            if (data) {
                setUserId(data.user_id);
                setTenantId(data.tenant_id);
                setFullName(data.full_name);
                setProjects(data.projects || []);
                await fetchMyPermits(cleanInput);
                setStep(2); // Go to My Permits list
            }
        } catch (err: any) {
            setAuthError(err.message || "Bilinmeyen bir hata oluştu.");
        } finally {
            setAuthLoading(false);
        }
    };

    const resetForm = () => {
        setEditingPermitId(null);
        setDepartment("");
        setCompanyName("");
        setWorkDate(new Date().toISOString().split('T')[0]);
        setEstimatedHours("");
        setProjectId("");
        setJobTypes([]);
        setJobTypeOther("");
        setHazards([]);
        setHazardOther("");
        setPpes([]);
        setPpeOther("");
        setPrecautions([]);
        setPrecautionOther("");
        setCoworkers([]);
        setFormError(null);
    };

    const handleCreateNew = () => {
        resetForm();
        setStep(3);
    };

    const handleEditPermit = (permit: MyPermit) => {
        if (permit.status !== 'pending') {
            alert("Sadece 'Onay Bekliyor' durumundaki izinleri düzenleyebilirsiniz.");
            return;
        }

        resetForm();
        setEditingPermitId(permit.id);

        setDepartment(permit.department || "");
        setCompanyName(permit.company_name || "");
        setWorkDate(permit.work_date ? new Date(permit.work_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setEstimatedHours(permit.estimated_hours ? permit.estimated_hours.toString() : "");
        setProjectId(permit.project_id || "");

        setJobTypes(permit.job_types || []);
        setJobTypeOther(permit.job_type_other || "");

        setHazards(permit.hazards || []);
        setHazardOther(permit.hazard_other || "");

        setPpes(permit.ppe_requirements || []);
        setPpeOther(permit.ppe_other || "");

        setPrecautions(permit.precautions || []);
        setPrecautionOther(permit.precaution_other || "");

        if (permit.coworkers && Array.isArray(permit.coworkers)) {
            // Unpack coworkers (filtering out any nulls if the json structure varied)
            const mappedCoworkers = permit.coworkers.filter(c => c && c.id).map(c => ({
                fullName: c.full_name || "",
                location: c.location || "",
                sicilTc: c.tc_no || c.sicil_no || ""
            }));
            setCoworkers(mappedCoworkers);
        }

        setStep(3);
    };

    const handleCheckboxToggle = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        if (list.includes(item)) setList(list.filter(x => x !== item));
        else setList([...list, item]);
    };

    const addCoworker = () => setCoworkers([...coworkers, { fullName: "", location: "", sicilTc: "" }]);
    const updateCoworker = (index: number, field: string, value: string) => {
        const newArr = [...coworkers];
        newArr[index] = { ...newArr[index], [field]: value };
        setCoworkers(newArr);
    };
    const removeCoworker = (index: number) => setCoworkers(coworkers.filter((_, i) => i !== index));

    const showGasWarning = jobTypes.includes("Kapalı Alan") || precautions.includes("Gaz ölçümü");

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (jobTypes.length === 0 || hazards.length === 0 || ppes.length === 0 || precautions.length === 0) {
            setFormError("Lütfen her listeden (İş Tipleri, Tehlikeler, KKD, Önlemler) en az bir madde seçiniz.");
            window.scrollTo(0, 0);
            return;
        }

        setSaving(true);
        try {
            const permitData = {
                work_date: workDate,
                estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
                company_name: companyName || null,
                department: department || null,
                project_id: projectId || null,
                job_types: jobTypes,
                job_type_other: jobTypes.includes("Diğer") ? jobTypeOther : null,
                hazards: hazards,
                hazard_other: hazards.includes("Diğer") ? hazardOther : null,
                ppe_requirements: ppes,
                ppe_other: ppes.includes("Diğer") ? ppeOther : null,
                precautions: precautions,
                precaution_other: precautions.includes("Diğer") ? precautionOther : null,
                creator_tc_no: authInput.trim(),
                coworkers: coworkers.map(c => {
                    const cleanSicilTc = c.sicilTc.trim();
                    const isTc = /^\d{11}$/.test(cleanSicilTc);
                    return {
                        full_name: c.fullName,
                        location: c.location,
                        tc_no: isTc ? cleanSicilTc : null,
                        sicil_no: !isTc ? cleanSicilTc : null
                    };
                })
            };

            if (editingPermitId) {
                // Update existing
                const { error } = await supabase.rpc('public_update_work_permit', {
                    p_permit_id: editingPermitId,
                    p_sicil_tc: authInput.trim(),
                    p_permit_data: permitData
                });
                if (error) throw error;
                setSuccessMessage(`İş izni başarıyla güncellendi! Referans Kodunuz: ${editingPermitId}.`);
            } else {
                // Create new
                const { data: permitId, error } = await supabase.rpc('public_create_work_permit', {
                    p_user_id: userId,
                    p_tenant_id: tenantId,
                    p_permit_data: permitData
                });
                if (error) throw error;
                setSuccessMessage(`İş izni başarıyla oluşturuldu! Referans Kodunuz: ${permitId}.`);
            }

        } catch (err: any) {
            console.error(err);
            setFormError(err.message || "İş izni kaydedilirken bir hata oluştu. Lütfen bilgilerinizi (özellikle personel TC/Sicil kayıtlarını) kontrol edin.");
            window.scrollTo(0, 0);
        } finally {
            setSaving(false);
        }
    };


    if (successMessage) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
                <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white dark:bg-slate-900 p-8 shadow-xl border border-transparent dark:border-slate-800 sm:rounded-2xl text-center">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Başarılı!</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">{successMessage}</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition">
                        Yeni İşlem Yap
                    </button>
                    <button onClick={() => navigate('/')} className="w-full mt-4 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-400 py-3 px-4 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-slate-750 transition">
                        Ana Sayfaya Dön
                    </button>
                </div>
            </div>
        );
    }

    if (step === 1) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <h2 className="mt-2 text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                        İş İzni İşlemleri
                    </h2>
                    <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">
                        İzinlerinizi görmek veya yeni başvuruda bulunmak için kimliğinizi doğrulayın.
                    </p>
                </div>

                <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white dark:bg-slate-900 py-10 px-6 shadow-2xl border border-transparent dark:border-slate-800 sm:rounded-3xl sm:px-10">
                        {authError && (
                            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-sm font-medium">
                                {authError}
                            </div>
                        )}
                        <form className="space-y-6" onSubmit={handleAuthSubmit}>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                                    Sicil veya TC Kimlik Numaranız
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="text"
                                        required
                                        value={authInput}
                                        onChange={(e) => setAuthInput(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all sm:text-sm"
                                        placeholder="Kimlik doğrulaması"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-xl shadow-indigo-600/20 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-950 transition-all disabled:opacity-50"
                                >
                                    {authLoading ? 'Doğrulanıyor...' : 'Devam Et'}
                                </button>
                            </div>

                            <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col gap-4">
                                <button type="button" onClick={() => navigate('/login')} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
                                    Sisteme Giriş Yap
                                </button>
                                <button type="button" onClick={() => navigate('/quick-approve')} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 border border-indigo-200 dark:border-indigo-900/50 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 transition shadow-sm">
                                    Hızlı İzin Onayla
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 2) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mevcut İş İzinleriniz</h1>
                            <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">Hoş Geldiniz, <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{fullName}</strong>. Buradan önceki izinlerinizi düzenleyebilir veya yeni başvuruda bulunabilirsiniz.</p>
                        </div>
                        <button onClick={handleCreateNew} className="bg-indigo-600 text-white px-6 py-3 flex-shrink-0 rounded-xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center justify-center transition order-first md:order-last">
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Yeni Başvuru
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 overflow-hidden sm:rounded-3xl">
                        {listLoading ? (
                            <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium animate-pulse">Yükleniyor...</div>
                        ) : myPermits.length === 0 ? (
                            <div className="p-20 text-center text-slate-500 dark:text-slate-500 flex flex-col items-center">
                                <svg className="w-20 h-20 text-slate-200 dark:text-slate-800 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <p className="text-xl font-bold mb-2">Henüz kayıt yok</p>
                                <p className="text-sm">Sistemde size ait hiçbir iş izni bulunamadı.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {myPermits.map((permit) => (
                                    <li key={permit.id}>
                                        <div className="px-6 py-6 sm:px-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition duration-200">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex flex-col">
                                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 truncate group cursor-pointer">
                                                        {permit.company_name || "Bilinmeyen Firma"} - {permit.department || "Departman Belirtilmedi"}
                                                    </p>
                                                    <div className="mt-3 flex flex-wrap items-center text-sm font-medium text-slate-500 dark:text-slate-400 gap-4">
                                                        <span className="flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                                            <svg className="flex-shrink-0 mr-2 h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                            {new Date(permit.work_date).toLocaleDateString("tr-TR")}
                                                        </span>
                                                        <span className="flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                                            <svg className="flex-shrink-0 mr-2 h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                            {permit.estimated_hours} Saat
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4">
                                                    {permit.status === 'pending' ? (
                                                        <span className="px-4 py-1.5 inline-flex text-xs leading-5 font-bold rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">Onay Bekliyor</span>
                                                    ) : permit.status === 'approved' ? (
                                                        <span className="px-4 py-1.5 inline-flex text-xs leading-5 font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">Onaylandı</span>
                                                    ) : (
                                                        <span className="px-4 py-1.5 inline-flex text-xs leading-5 font-bold rounded-full bg-rose-100 dark:bg-rose-900/20 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30">Reddedildi</span>
                                                    )}

                                                    {permit.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleEditPermit(permit)}
                                                            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition shadow-sm whitespace-nowrap"
                                                        >
                                                            Formu Düzenle
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Step 3: The actual form
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-4xl mx-auto pb-24">
                <div className="mb-8 flex items-center gap-6">
                    <button onClick={() => setStep(2)} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 shadow-sm flex-shrink-0 transition" title="Listeye Dön">
                        <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {editingPermitId ? "İş İznini Düzenle" : "Yeni İş İzni Başvurusu"}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Lütfen formu eksiksiz doldurun.</p>
                    </div>
                </div>

                {formError && (
                    <div className="mb-8 p-5 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-sm font-bold shadow-sm">
                        {formError}
                    </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-10">
                    {/* 1. Genel Bilgiler */}
                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 rounded-3xl p-8">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">1. Genel Bilgiler</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Firma</label>
                                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Taşeron veya kendi firmanız" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Departman</label>
                                <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Örn: Bakım, Üretim" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Tarih *</label>
                                <input type="date" required value={workDate} onChange={e => setWorkDate(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Tahmini Çalışma Saati (Saat) *</label>
                                <input type="number" required step="0.5" min="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Örn: 4.5" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Proje / Lokasyon (Opsiyonel)</label>
                                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition">
                                    <option value="">Proje Seçiniz...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 2. İş Tipleri */}
                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 rounded-3xl p-8">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <span>2. İş Tipleri <span className="text-sm text-slate-400 dark:text-slate-500 font-bold ml-2">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full self-start md:self-auto uppercase tracking-wider">{jobTypes.length} seçildi</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {JOB_TYPES.map(type => (
                                <label key={type} className={`flex items-start space-x-3 cursor-pointer p-3 rounded-xl border transition-all ${jobTypes.includes(type) ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                    <input type="checkbox" className="mt-1.5 rounded text-indigo-600 focus:ring-indigo-500"
                                        checked={jobTypes.includes(type)}
                                        onChange={() => handleCheckboxToggle(jobTypes, setJobTypes, type)}
                                    />
                                    <span className={`text-sm leading-snug font-medium ${jobTypes.includes(type) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{type}</span>
                                </label>
                            ))}
                        </div>
                        {jobTypes.includes("Diğer") && (
                            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Diğer İş Tipi Açıklaması *</label>
                                <input type="text" required value={jobTypeOther} onChange={e => setJobTypeOther(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Lütfen belirtiniz..." />
                            </div>
                        )}
                    </div>

                    {/* 3. Tehlikelerin Belirlenmesi */}
                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 rounded-3xl p-8">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <span>3. Tehlikelerin Belirlenmesi <span className="text-sm text-slate-400 dark:text-slate-500 font-bold ml-2">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-full self-start md:self-auto uppercase tracking-wider">{hazards.length} seçildi</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {HAZARDS.map(item => (
                                <label key={item} className={`flex items-start space-x-3 cursor-pointer p-3 rounded-xl border transition-all ${hazards.includes(item) ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                    <input type="checkbox" className="mt-1.5 rounded text-rose-600 focus:ring-rose-500"
                                        checked={hazards.includes(item)}
                                        onChange={() => handleCheckboxToggle(hazards, setHazards, item)}
                                    />
                                    <span className={`text-sm leading-snug font-medium ${hazards.includes(item) ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400'}`}>{item}</span>
                                </label>
                            ))}
                        </div>
                        {hazards.includes("Diğer") && (
                            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Diğer Tehlike Açıklaması *</label>
                                <input type="text" required value={hazardOther} onChange={e => setHazardOther(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Lütfen belirtiniz..." />
                            </div>
                        )}
                    </div>

                    {/* 4. Kişisel Koruyucu Donanımlar */}
                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 rounded-3xl p-8">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <span>4. Kişisel Koruyucu Donanımlar <span className="text-sm text-slate-400 dark:text-slate-500 font-bold ml-2">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full self-start md:self-auto uppercase tracking-wider">{ppes.length} seçildi</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {PPE_REQUIREMENTS.map(item => (
                                <label key={item} className={`flex items-start space-x-3 cursor-pointer p-3 rounded-xl border transition-all ${ppes.includes(item) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                    <input type="checkbox" className="mt-1.5 rounded text-blue-600 focus:ring-blue-500"
                                        checked={ppes.includes(item)}
                                        onChange={() => handleCheckboxToggle(ppes, setPpes, item)}
                                    />
                                    <span className={`text-sm leading-snug font-medium ${ppes.includes(item) ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>{item}</span>
                                </label>
                            ))}
                        </div>
                        {ppes.includes("Diğer") && (
                            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Diğer KKD Açıklaması *</label>
                                <input type="text" required value={ppeOther} onChange={e => setPpeOther(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Lütfen belirtiniz..." />
                            </div>
                        )}
                    </div>

                    {/* 5. Alınması Gereken Önlemler */}
                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 rounded-3xl p-8">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <span>5. Alınması Gereken Önlemler <span className="text-sm text-slate-400 dark:text-slate-500 font-bold ml-2">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full self-start md:self-auto uppercase tracking-wider">{precautions.length} seçildi</span>
                        </h2>

                        {showGasWarning && (
                            <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 text-orange-800 dark:text-orange-400 p-4 rounded-xl flex items-start text-sm font-medium animate-pulse">
                                <svg className="w-6 h-6 mr-3 shrink-0 text-orange-600 dark:text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span><strong className="font-black underline mr-1">Dikkat:</strong> Kapalı alanda sıcak işlem veya iç mahallerde boya uygulaması gerçekleştiriliyorsa mutlaka gaz ölçümü alınarak kayıt tutulmalıdır!</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {PRECAUTIONS.map(item => (
                                <label key={item} className={`flex items-start space-x-3 cursor-pointer p-3 rounded-xl border transition-all ${precautions.includes(item) ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                    <input type="checkbox" className="mt-1.5 rounded text-emerald-600 focus:ring-emerald-500"
                                        checked={precautions.includes(item)}
                                        onChange={() => handleCheckboxToggle(precautions, setPrecautions, item)}
                                    />
                                    <span className={`text-sm leading-snug font-medium ${precautions.includes(item) ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>{item}</span>
                                </label>
                            ))}
                        </div>
                        {precautions.includes("Diğer") && (
                            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Diğer Önlem Açıklaması *</label>
                                <input type="text" required value={precautionOther} onChange={e => setPrecautionOther(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Lütfen belirtiniz..." />
                            </div>
                        )}
                    </div>

                    {/* 6. Beraber Çalışacağı Personeller */}
                    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-transparent dark:border-slate-800 rounded-3xl p-8">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">6. Beraber Çalışılan Personeller <span className="text-sm text-slate-400 font-bold ml-1">(Opsiyonel)</span></h2>
                            <button type="button" onClick={addCoworker} className="text-sm bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center transition shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                                <svg className="w-5 h-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                Personel Ekle
                            </button>
                        </div>

                        {coworkers.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <p className="text-sm text-slate-500 dark:text-slate-500 italic">Eklenmiş personel yok. Yanınızda çalışan biri varsa yukarıdan ekleyebilirsiniz.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {coworkers.map((cw, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-start md:items-end group relative transition-all hover:shadow-lg">
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Ad Soyad *</label>
                                            <input type="text" required value={cw.fullName} onChange={e => updateCoworker(idx, 'fullName', e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Ahmet Yılmaz" />
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Lokasyon</label>
                                            <input type="text" value={cw.location} onChange={e => updateCoworker(idx, 'location', e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Örn: Kat 2 Alan B" />
                                        </div>
                                        <div className="flex-1 w-full relative">
                                            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Sicil / TC No *</label>
                                            <input type="text" required value={cw.sicilTc} onChange={e => updateCoworker(idx, 'sicilTc', e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition" placeholder="Onay için gereklidir" />
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium leading-tight">Sadece şirketinize kayıtlı personelleri ekleyebilirsiniz.</p>
                                        </div>
                                        <button type="button" onClick={() => removeCoworker(idx)} className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all self-center md:self-auto mb-1">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 7. Taahhütname & Gönderim */}
                    <div className="bg-indigo-600 rounded-3xl p-8 border border-transparent shadow-2xl shadow-indigo-600/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 -m-12 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition duration-500"></div>
                        <div className="absolute bottom-0 left-0 -m-12 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl"></div>

                        <div className="relative z-10">
                            <h2 className="text-2xl font-black text-white border-b border-white/20 pb-4 mb-6">7. Çalışan Taahhütnamesi & Onay</h2>

                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl text-sm text-indigo-50 leading-relaxed mb-8 border border-white/10 shadow-inner italic">
                                "Çalışma öncesinde belirlenen ve bu formda belirtilen tüm tedbirlere tam olarak uyacağımı, çalışma esnasında ortaya çıkabilecek diğer risk ve tedbirler için ustabaşına ve İSG personeline danışacağımı, tereddüt oluşturan riskli faaliyetleri yerine getirmeyeceğimi, tarafıma temin edilen kişisel koruyucu donanımlarımı yaptığım işe uygun ve eksiksiz olarak kullanacağımı, tebliğ edilen ilgili çalışma talimatlarında ki gerekliliklere harfiyen uyacağımı beyan ederim."
                            </div>

                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center px-5 py-3 bg-white/20 rounded-2xl border border-white/20 text-white font-black tracking-wide shadow-sm">
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                                        <svg className="w-5 h-5 text-emerald-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                                    </div>
                                    E-İmza: {authInput}
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full md:w-auto px-10 py-4 bg-white text-indigo-700 font-black rounded-2xl shadow-2xl hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 uppercase tracking-widest text-base shadow-indigo-900/50"
                                >
                                    {saving ? 'Kaydediliyor...' : (editingPermitId ? 'GÜNCELLE' : 'TAAHHÜDÜ ONAYLA VE GÖNDER')}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
