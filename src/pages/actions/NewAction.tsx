import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import ActionFileUploader from "@/components/actions/ActionFileUploader";
import { ArrowLeft, Save, Users, Building2, Plus, X } from "lucide-react";

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
    const [contractors, setContractors] = useState<{ id: string, name: string, email: string }[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: string, first_name: string, last_name: string, email: string }[]>([]);

    // Selections
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]); // user_id
    const [selectedContractors, setSelectedContractors] = useState<string[]>([]); // contractor_id
    const [selectedCCUsers, setSelectedCCUsers] = useState<string[]>([]); // user_id

    // Manual Emails
    const [externalEmails, setExternalEmails] = useState<string[]>([]);
    const [newEmail, setNewEmail] = useState("");

    // Files
    const [files, setFiles] = useState<{ url: string, name: string }[]>([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            total_days: 1
        }
    });

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [subjRes, projRes, contRes, usersRes] = await Promise.all([
                supabase.from("action_subjects").select("id, name").eq("company_id", profile?.tenant_id),
                supabase.from("action_projects").select("id, name").eq("company_id", profile?.tenant_id),
                supabase.from("action_contractors").select("id, name, email").eq("company_id", profile?.tenant_id),
                supabase.from("profiles").select("id, first_name, last_name, email").eq("tenant_id", profile?.tenant_id)
            ]);

            setSubjects(subjRes.data || []);
            setProjects(projRes.data || []);
            setContractors(contRes.data || []);
            setAllUsers(usersRes.data || []);
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

        if (selectedUsers.length === 0 && selectedContractors.length === 0 && externalEmails.length === 0) {
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
                action_description: data.action_description,
                nonconformity_description: data.nonconformity_description,
                status: 'open',
                created_by: profile.id
            }]).select().single();

            if (actionError) throw actionError;
            const actionId = actionData.id;

            // 2. Insert Assignees (Users)
            if (selectedUsers.length > 0) {
                await supabase.from("action_assignee_users").insert(
                    selectedUsers.map(u => ({ action_id: actionId, user_id: u }))
                );
            }

            // 3. Insert Assignees (Contractors)
            if (selectedContractors.length > 0) {
                await supabase.from("action_assignee_contractors").insert(
                    selectedContractors.map(c => ({ action_id: actionId, contractor_id: c }))
                );
            }

            // 4. Insert Assignees (External)
            if (externalEmails.length > 0) {
                await supabase.from("action_assignee_external").insert(
                    externalEmails.map(e => ({ action_id: actionId, email: e }))
                );
            }

            // 5. Insert CC Users
            if (selectedCCUsers.length > 0) {
                await supabase.from("action_cc_users").insert(
                    selectedCCUsers.map(u => ({ action_id: actionId, user_id: u }))
                );
            }

            // 6. Insert Files
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

    if (loading) return <div className="p-8 text-gray-500">Yükleniyor...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-900">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-bold text-gray-900 flex-1">Yeni Aksiyon Aç</h1>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Genel Bilgiler */}
                <div className="bg-white shadow rounded-lg p-6 border border-gray-100 space-y-6">
                    <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Genel Bilgiler</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Konu</label>
                            <select {...register("subject_id")} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                                <option value="">Seçiniz...</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {errors.subject_id && <span className="text-red-500 text-xs mt-1 block">{errors.subject_id.message}</span>}
                            {subjects.length === 0 && <span className="text-orange-500 text-xs mt-1 block">Sistemde kayıtlı konu yok. Lütfen Ayarlar'dan ekleyin.</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Proje / Lokasyon</label>
                            <select {...register("project_id")} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                                <option value="">Seçiniz...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {errors.project_id && <span className="text-red-500 text-xs mt-1 block">{errors.project_id.message}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teslim Süresi (Tüm Gün Sayısı)</label>
                            <input type="number" {...register("total_days", { valueAsNumber: true })} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                            {errors.total_days && <span className="text-red-500 text-xs mt-1 block">{errors.total_days.message}</span>}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tespit Edilen Uygunsuzluk</label>
                            <textarea {...register("nonconformity_description")} rows={3} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" placeholder="Tespit edilen problemi veya uygunsuzluğu net bir şekilde tanımlayın..."></textarea>
                            {errors.nonconformity_description && <span className="text-red-500 text-xs mt-1 block">{errors.nonconformity_description.message}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alınacak Aksiyon / Öneri</label>
                            <textarea {...register("action_description")} rows={3} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" placeholder="Uygunsuzluğun giderilmesi için yapılması gereken işlemi veya öneriyi yazın..."></textarea>
                            {errors.action_description && <span className="text-red-500 text-xs mt-1 block">{errors.action_description.message}</span>}
                        </div>
                    </div>
                </div>

                {/* Atamalar */}
                <div className="bg-white shadow rounded-lg p-6 border border-gray-100 space-y-6">
                    <h2 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" /> Aksiyon Alacaklar & Bildirimler
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Şirket Personeli */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Şirket Personeli (Aksiyon Alan)</label>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                                {allUsers.map(u => (
                                    <label key={`assign-${u.id}`} className="flex items-center p-2 hover:bg-white rounded cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                                        <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleSelection(u.id, selectedUsers, setSelectedUsers)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="ml-2 text-sm text-gray-700">{u.first_name} {u.last_name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Firmalar */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Building2 className="w-4 h-4 text-gray-400" /> Alt İşveren / Firmalar (Aksiyon Alan)</label>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                                {contractors.map(c => (
                                    <label key={`cont-${c.id}`} className="flex items-center p-2 hover:bg-white rounded cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                                        <input type="checkbox" checked={selectedContractors.includes(c.id)} onChange={() => toggleSelection(c.id, selectedContractors, setSelectedContractors)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="ml-2 text-sm text-gray-700 flex flex-col">
                                            <span>{c.name}</span>
                                            <span className="text-xs text-gray-400">{c.email}</span>
                                        </span>
                                    </label>
                                ))}
                                {contractors.length === 0 && <div className="p-2 text-xs text-gray-500">Kayıtlı firma yok. Ayarlardan ekleyebilirsiniz.</div>}
                            </div>
                        </div>

                        {/* Harici / Özel Email */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Harici E-postalar (Aksiyon Alan veya Bilgi)</label>
                            <div className="flex gap-2 mb-2">
                                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ornek@firma.com" className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }} />
                                <button type="button" onClick={handleAddEmail} className="bg-gray-800 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"><Plus className="w-4 h-4" /></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {externalEmails.map(email => (
                                    <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                        {email} <button type="button" onClick={() => setExternalEmails(externalEmails.filter(e => e !== email))} className="text-blue-500 hover:text-blue-800">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* CC Personel */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Bilgi Verilecekler (CC - Şirket İçi)</label>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                                {allUsers.map(u => (
                                    <label key={`cc-${u.id}`} className="flex items-center p-2 hover:bg-white rounded cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                                        <input type="checkbox" checked={selectedCCUsers.includes(u.id)} onChange={() => toggleSelection(u.id, selectedCCUsers, setSelectedCCUsers)} className="rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                                        <span className="ml-2 text-sm text-gray-700">{u.first_name} {u.last_name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Dosyalar */}
                <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
                    <ActionFileUploader
                        currentFiles={files}
                        onUpload={(url, name) => setFiles([...files, { url, name }])}
                        onRemove={(url) => setFiles(files.filter(f => f.url !== url))}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => navigate(-1)} className="bg-white text-gray-700 px-6 py-2 border border-gray-300 rounded-md font-medium hover:bg-gray-50">
                        İptal
                    </button>
                    <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-8 py-2 rounded-md font-medium hover:bg-indigo-700 shadow flex items-center gap-2">
                        {submitting ? "Kaydediliyor..." : <><Save className="w-5 h-5" /> Kaydet ve Aksiyon Aç</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
