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
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white p-8 shadow sm:rounded-lg text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Başarılı!</h2>
                    <p className="text-gray-600 mb-6">{successMessage}</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md font-medium hover:bg-indigo-700">
                        Yeni İşlem Yap
                    </button>
                    <button onClick={() => navigate('/')} className="w-full mt-3 bg-white text-indigo-600 border border-indigo-600 py-2 px-4 rounded-md font-medium hover:bg-indigo-50">
                        Ana Sayfaya Dön
                    </button>
                </div>
            </div>
        );
    }

    if (step === 1) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                        İş İzni İşlemleri
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        İzinlerinizi görmek veya yeni başvuruda bulunmak için kimliğinizi doğrulayın.
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        {authError && (
                            <div className="mb-4 p-4 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">
                                {authError}
                            </div>
                        )}
                        <form className="space-y-6" onSubmit={handleAuthSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Sicil veya TC Kimlik Numaranız
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="text"
                                        required
                                        value={authInput}
                                        onChange={(e) => setAuthInput(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="Kimlik doğrulaması"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {authLoading ? 'Doğrulanıyor...' : 'Devam Et'}
                                </button>
                            </div>

                            <div className="mt-4 text-center border-t pt-4">
                                <button type="button" onClick={() => navigate('/login')} className="text-sm text-gray-500 hover:text-gray-900 mr-4">
                                    Sisteme Giriş Yap
                                </button>
                                <button type="button" onClick={() => navigate('/quick-approve')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 border border-indigo-200 px-3 py-1 rounded bg-indigo-50">
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
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Mevcut İş İzinleriniz</h1>
                            <p className="text-sm text-gray-500 mt-1">Hoş Geldiniz, <strong>{fullName}</strong>. Buradan önceki izinlerinizi düzenleyebilir veya yeni başvuruda bulunabilirsiniz.</p>
                        </div>
                        <button onClick={handleCreateNew} className="bg-indigo-600 text-white px-4 py-2 flex-shrink-0 rounded-md font-medium hover:bg-indigo-700 shadow flex items-center justify-center">
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Yeni Başvuru
                        </button>
                    </div>

                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                        {listLoading ? (
                            <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
                        ) : myPermits.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                Sistemde size ait hiçbir iş izni bulunamadı.
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-200">
                                {myPermits.map((permit) => (
                                    <li key={permit.id}>
                                        <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex flex-col">
                                                    <p className="text-sm font-medium text-indigo-600 truncate">
                                                        {permit.company_name || "Bilinmeyen Firma"} - {permit.department || "Departman Belirtilmedi"}
                                                    </p>
                                                    <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                                                        <span className="flex items-center">
                                                            <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                            {new Date(permit.work_date).toLocaleDateString("tr-TR")}
                                                        </span>
                                                        <span className="flex items-center">
                                                            <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                            {permit.estimated_hours} Saat
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2">
                                                    {permit.status === 'pending' ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">Onay Bekliyor</span>
                                                    ) : permit.status === 'approved' ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Onaylandı</span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Reddedildi</span>
                                                    )}

                                                    {permit.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleEditPermit(permit)}
                                                            className="text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition whitespace-nowrap"
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
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto pb-24">
                <div className="mb-6 flex items-center gap-4">
                    <button onClick={() => setStep(2)} className="p-2 border rounded-md hover:bg-gray-100 bg-white shadow-sm flex-shrink-0" title="Listeye Dön">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {editingPermitId ? "İş İznini Düzenle" : "Yeni İş İzni Başvurusu"}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Lütfen formu eksiksiz doldurun.</p>
                    </div>
                </div>

                {formError && (
                    <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                        {formError}
                    </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-8">
                    {/* 1. Genel Bilgiler */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4">1. Genel Bilgiler</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Taşeron veya kendi firmanız" />
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
                                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md text-sm">
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
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <span>2. İş Tipleri <span className="text-sm text-gray-500 font-normal">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full self-start md:self-auto">{jobTypes.length} seçildi</span>
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
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <span>3. Tehlikelerin Belirlenmesi <span className="text-sm text-gray-500 font-normal">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full self-start md:self-auto">{hazards.length} seçildi</span>
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
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <span>4. Kişisel Koruyucu Donanımlar <span className="text-sm text-gray-500 font-normal">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full self-start md:self-auto">{ppes.length} seçildi</span>
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
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <span>5. Alınması Gereken Önlemler <span className="text-sm text-gray-500 font-normal">(En az 1 seçim zorunlu)</span></span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full self-start md:self-auto">{precautions.length} seçildi</span>
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
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50" placeholder="Onay için gereklidir" />
                                            <p className="text-[10px] text-gray-500 mt-1">Sadece şirketinize kayıtlı personelleri ekleyebilirsiniz. Kayıtsız girişler kabul edilmeyecektir.</p>
                                        </div>
                                        <button type="button" onClick={() => removeCoworker(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-2 md:mt-0 flex-shrink-0">
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

                        <div className="bg-white p-5 rounded-md shadow-sm border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center text-sm font-medium text-gray-900">
                                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                E-İmza: {authInput}
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full md:w-auto mt-4 md:mt-0 px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : (editingPermitId ? 'GÜNCELLE' : 'TAAHHÜDÜ ONAYLA VE GÖNDER')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
