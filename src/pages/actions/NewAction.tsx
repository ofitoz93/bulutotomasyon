import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import ActionFileUploader from "@/components/actions/ActionFileUploader";
import { ArrowLeft, Save, Users, Building2, Plus, Mail } from "lucide-react";

const formSchema = z.object({
    subject_id: z.string().min(1, "Konu seçimi zorunludur"),
    project_id: z.string().min(1, "Proje seçimi zorunludur"),
    total_days: z.number().min(1, "En az 1 gün olmalıdır"),
    action_description: z.string().min(10, "Aksiyon tanımı en az 10 karakter olmalıdır"),
    nonconformity_description: z.string().min(10, "Uygunsuzluk tanımı en az 10 karakter olmalıdır"),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewAction() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    // Dropdown Data
    const [subjects, setSubjects] = useState<{ id: string, name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string, name: string }[]>([]);
    const [subcontractors, setSubcontractors] = useState<{ id: string, name: string, email: string }[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: string, first_name: string, last_name: string, email: string }[]>([]);

    // Firma seçimi (opsiyonel)
    const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>("");

    // Kişi seçimleri
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectedCCUsers, setSelectedCCUsers] = useState<string[]>([]);

    // Manual Emails
    const [externalEmails, setExternalEmails] = useState<string[]>([]);
    const [newEmail, setNewEmail] = useState("");

    // Geçerlilik Tarihi
    const [deadlineDate, setDeadlineDate] = useState<string>("");

    // Files
    const [files, setFiles] = useState<{ url: string, name: string }[]>([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            total_days: 30
        }
    });

    const totalDays = watch("total_days");

    // total_days değiştiğinde deadline_date'i otomatik hesapla
    useEffect(() => {
        if (totalDays && totalDays > 0) {
            const d = new Date();
            d.setDate(d.getDate() + totalDays);
            setDeadlineDate(d.toISOString().split('T')[0]);
        }
    }, [totalDays]);

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [subjRes, projRes, usersRes, subRes] = await Promise.all([
                supabase.from("action_subjects").select("id, name").eq("company_id", profile?.tenant_id),
                supabase.from("action_projects").select("id, name").eq("company_id", profile?.tenant_id),
                supabase.from("profiles").select("id, first_name, last_name, email").eq("tenant_id", profile?.tenant_id),
                supabase.from("subcontractors").select("id, name, email").eq("parent_company_id", profile?.tenant_id).eq("is_active", true),
            ]);

            setSubjects(subjRes.data || []);
            setProjects(projRes.data || []);
            setAllUsers(usersRes.data || []);
            setSubcontractors(subRes.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddEmail = () => {
        if (!newEmail) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            alert("Geçerli bir E-posta adresi giriniz.");
            return;
        }
        if (!externalEmails.includes(newEmail)) {
            setExternalEmails([...externalEmails, newEmail]);
        }
        setNewEmail("");
    };

    const toggleSelection = (id: string, current: string[], setter: (val: string[]) => void) => {
        if (current.includes(id)) setter(current.filter(x => x !== id));
        else setter([...current, id]);
    };

    const onSubmit = async (data: FormValues) => {
        if (!profile?.tenant_id || !profile?.id) return;

        // En az bir alıcı olmalı
        if (selectedUsers.length === 0 && !selectedSubcontractorId && externalEmails.length === 0) {
            alert("Lütfen aksiyon alacak en az bir kişi, firma veya harici email seçin.");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Insert Action
            const { data: actionData, error: actionError } = await supabase.from("actions").insert([{
                company_id: profile.tenant_id,
                subject_id: data.subject_id,
                project_id: data.project_id,
                total_days: data.total_days,
                deadline_date: deadlineDate || null,
                subcontractor_id: selectedSubcontractorId || null,
                action_description: data.action_description,
                nonconformity_description: data.nonconformity_description,
                status: 'open',
                created_by: profile.id
            }]).select().single();

            if (actionError) throw actionError;
            const actionId = actionData.id;

            // 2. Kişilere Atama
            if (selectedUsers.length > 0) {
                await supabase.from("action_assignee_users").insert(
                    selectedUsers.map(u => ({ action_id: actionId, user_id: u }))
                );
            }

            // 3. Harici e-postalar
            if (externalEmails.length > 0) {
                await supabase.from("action_assignee_external").insert(
                    externalEmails.map(e => ({ action_id: actionId, email: e }))
                );
            }

            // 4. Firmaya atama (action_contractors tablosuna da kaydedilir)
            if (selectedSubcontractorId) {
                const selectedSub = subcontractors.find(s => s.id === selectedSubcontractorId);
                if (selectedSub) {
                    let contractorId: string;
                    const { data: existingContractor } = await supabase
                        .from("action_contractors")
                        .select("id")
                        .eq("company_id", profile.tenant_id)
                        .eq("email", selectedSub.email)
                        .single();

                    if (existingContractor) {
                        contractorId = existingContractor.id;
                    } else {
                        const { data: newContractor } = await supabase.from("action_contractors").insert({
                            company_id: profile.tenant_id,
                            name: selectedSub.name,
                            email: selectedSub.email,
                        }).select("id").single();
                        contractorId = newContractor!.id;
                    }

                    await supabase.from("action_assignee_contractors").insert({
                        action_id: actionId,
                        contractor_id: contractorId,
                    });
                }
            }

            // 5. CC Users
            if (selectedCCUsers.length > 0) {
                await supabase.from("action_cc_users").insert(
                    selectedCCUsers.map(u => ({ action_id: actionId, user_id: u }))
                );
            }

            // 6. Files
            if (files.length > 0) {
                await supabase.from("action_files").insert(
                    files.map(f => ({
                        action_id: actionId,
                        uploaded_by: profile.id,
                        file_url: f.url,
                        file_name: f.name
                    }))
                );
            }

            alert("Aksiyon başarıyla oluşturuldu.");
            navigate("/app/aksiyon-takip");

        } catch (error: any) {
            console.error("Save Error:", error);
            alert("Aksiyon kaydedilirken hata oluştu: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-slate-500">Yükleniyor...</div>;

    const inputClass = "w-full bg-slate-800 border-slate-700 text-slate-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-300 mb-1";
    const cardClass = "bg-slate-900 shadow-sm rounded-xl p-6 border border-slate-800 space-y-6";

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800">
                <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-bold text-white flex-1">Yeni Aksiyon Aç</h1>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Genel Bilgiler */}
                <div className={cardClass}>
                    <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Genel Bilgiler</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Konu</label>
                            <select {...register("subject_id")} className={inputClass}>
                                <option value="">Seçiniz...</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {errors.subject_id && <span className="text-rose-400 text-xs mt-1 block">{errors.subject_id.message}</span>}
                            {subjects.length === 0 && <span className="text-amber-400 text-xs mt-1 block">Sistemde kayıtlı konu yok. Lütfen Ayarlar'dan ekleyin.</span>}
                        </div>

                        <div>
                            <label className={labelClass}>Proje / Lokasyon</label>
                            <select {...register("project_id")} className={inputClass}>
                                <option value="">Seçiniz...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {errors.project_id && <span className="text-rose-400 text-xs mt-1 block">{errors.project_id.message}</span>}
                        </div>

                        {/* Firma Seçimi */}
                        <div>
                            <label className={`${labelClass} flex items-center gap-1`}>
                                <Building2 className="w-4 h-4 text-slate-500" /> Firma (Opsiyonel)
                            </label>
                            <select
                                value={selectedSubcontractorId}
                                onChange={e => setSelectedSubcontractorId(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Firma seçilmedi</option>
                                {subcontractors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            {selectedSubcontractorId && (
                                <span className="flex items-center gap-1 text-xs text-amber-400/80 mt-1">
                                    <Mail className="w-3 h-3" /> {subcontractors.find(s => s.id === selectedSubcontractorId)?.email} adresine bildirim gönderilecek
                                </span>
                            )}
                        </div>

                        <div>
                            <label className={labelClass}>Teslim Süresi (Gün)</label>
                            <input type="number" {...register("total_days", { valueAsNumber: true })} className={inputClass} />
                            {errors.total_days && <span className="text-rose-400 text-xs mt-1 block">{errors.total_days.message}</span>}
                        </div>

                        {/* Geçerlilik Tarihi */}
                        <div className="md:col-span-2">
                            <label className={labelClass}>Geçerlilik Tarihi (Son Tarih)</label>
                            <input
                                type="date"
                                value={deadlineDate}
                                onChange={e => {
                                    setDeadlineDate(e.target.value);
                                    // Gün sayısını da güncelle
                                    const diff = Math.ceil((new Date(e.target.value).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    if (diff > 0) setValue("total_days", diff);
                                }}
                                className={`${inputClass} md:w-1/2`}
                            />
                            <p className="text-xs text-slate-500 mt-1">Gün sayısını değiştirirseniz otomatik hesaplanır veya direkt tarih seçebilirsiniz.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}>Tespit Edilen Uygunsuzluk</label>
                            <textarea {...register("nonconformity_description")} rows={3} className={inputClass} placeholder="Tespit edilen problemi veya uygunsuzluğu net bir şekilde tanımlayın..."></textarea>
                            {errors.nonconformity_description && <span className="text-rose-400 text-xs mt-1 block">{errors.nonconformity_description.message}</span>}
                        </div>
                        <div>
                            <label className={labelClass}>Alınacak Aksiyon / Öneri</label>
                            <textarea {...register("action_description")} rows={3} className={inputClass} placeholder="Uygunsuzluğun giderilmesi için yapılması gereken işlemi veya öneriyi yazın..."></textarea>
                            {errors.action_description && <span className="text-rose-400 text-xs mt-1 block">{errors.action_description.message}</span>}
                        </div>
                    </div>
                </div>

                {/* Atamalar */}
                <div className={cardClass}>
                    <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-400" /> Aksiyon Alacaklar & Bildirimler
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Şirket Personeli */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Şirket Personeli (Aksiyon Alan)</label>
                            <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-lg p-2 space-y-1 bg-slate-800/50">
                                {allUsers.map(u => (
                                    <label key={`assign-${u.id}`} className="flex items-center p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                                        <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleSelection(u.id, selectedUsers, setSelectedUsers)} className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50" />
                                        <div className="ml-2">
                                            <span className="text-sm text-slate-200">{u.first_name} {u.last_name}</span>
                                            <span className="text-xs text-slate-500 ml-1">({u.email})</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {selectedUsers.length > 0 && (
                                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> Seçilen {selectedUsers.length} kişiye bildirim e-postası gönderilecek
                                </p>
                            )}
                        </div>

                        {/* Harici Email */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Harici E-postalar</label>
                            <div className="flex gap-2 mb-2">
                                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ornek@firma.com" className={inputClass} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }} />
                                <button type="button" onClick={handleAddEmail} className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-600 transition-colors"><Plus className="w-4 h-4" /></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {externalEmails.map(email => (
                                    <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                        {email} <button type="button" onClick={() => setExternalEmails(externalEmails.filter(e => e !== email))} className="text-indigo-300 hover:text-white">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* CC */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Bilgi Verilecekler (CC - Şirket İçi)</label>
                            <div className="max-h-36 overflow-y-auto border border-slate-700 rounded-lg p-2 space-y-1 bg-slate-800/50">
                                {allUsers.map(u => (
                                    <label key={`cc-${u.id}`} className="flex items-center p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                                        <input type="checkbox" checked={selectedCCUsers.includes(u.id)} onChange={() => toggleSelection(u.id, selectedCCUsers, setSelectedCCUsers)} className="rounded border-slate-600 bg-slate-800 text-slate-500 focus:ring-slate-500/50" />
                                        <span className="ml-2 text-sm text-slate-300">{u.first_name} {u.last_name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dosyalar */}
                <div className="bg-slate-900 shadow-sm rounded-xl p-6 border border-slate-800 shadow-lg shadow-indigo-500/5">
                    <ActionFileUploader
                        currentFiles={files}
                        onUpload={(url, name) => setFiles([...files, { url, name }])}
                        onRemove={(url) => setFiles(files.filter(f => f.url !== url))}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                    <button type="button" onClick={() => navigate(-1)} className="bg-slate-900 text-slate-300 px-6 py-2 border border-slate-700 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                        İptal
                    </button>
                    <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-[0.98]">
                        {submitting ? "Kaydediliyor..." : <><Save className="w-5 h-5" /> Kaydet ve Aksiyon Aç</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
