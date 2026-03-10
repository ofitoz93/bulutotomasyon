import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { FileText } from "lucide-react";
import ClassQuestionManagerModal from "./components/ClassQuestionManagerModal";

interface EducationType {
    id: string;
    name: string;
}

interface EducationClass {
    id: string;
    type_id: string;
    name: string;
    type?: EducationType;
}

interface AgreementTemplate {
    id: string;
    title: string;
    agreement_text: string;
}

export default function EducationSettings() {
    const { profile } = useAuthStore();

    const [types, setTypes] = useState<EducationType[]>([]);
    const [classes, setClasses] = useState<EducationClass[]>([]);
    const [agreementTemplates, setAgreementTemplates] = useState<AgreementTemplate[]>([]);

    // Manager Assign States
    const [users, setUsers] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState("");
    const [assigningManager, setAssigningManager] = useState(false);

    // Form States
    const [newTypeName, setNewTypeName] = useState("");
    const [addingType, setAddingType] = useState(false);

    // Class Form States
    const [newClassName, setNewClassName] = useState("");
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [addingClass, setAddingClass] = useState(false);

    // Agreement Template States
    const [newTemplateTitle, setNewTemplateTitle] = useState("");
    const [newTemplateText, setNewTemplateText] = useState("");
    const [addingTemplate, setAddingTemplate] = useState(false);

    const [loading, setLoading] = useState(true);

    // Class Questions Modal State
    const [selectedClassForQuestions, setSelectedClassForQuestions] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (profile?.tenant_id || profile?.role === "system_admin") {
            fetchSettings();
        }
    }, [profile?.tenant_id, profile?.role]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // Fetch Types
            let typesQuery = supabase
                .from("education_types")
                .select("*")
                .order("name", { ascending: true });

            // Fetch Classes with embedded type
            let classesQuery = supabase
                .from("education_classes")
                .select("*, type:education_types(id, name)")
                .order("name", { ascending: true });

            // Fetch users for manager assignment
            let usersQuery = supabase
                .from("profiles")
                .select("id, first_name, last_name, email")
                .order("first_name", { ascending: true });

            // Fetch education managers
            let managersQuery = supabase
                .from("education_managers")
                .select("id, user_id, profiles(first_name, last_name, email)");

            // Fetch Agreement Templates
            let templatesQuery = supabase
                .from("exam_agreement_templates")
                .select("*")
                .order("created_at", { ascending: false });

            if (profile?.role !== "system_admin") {
                typesQuery = typesQuery.eq("tenant_id", profile!.tenant_id);
                classesQuery = classesQuery.eq("tenant_id", profile!.tenant_id);
                usersQuery = usersQuery.eq("tenant_id", profile!.tenant_id);
                managersQuery = managersQuery.eq("tenant_id", profile!.tenant_id);
                templatesQuery = templatesQuery.eq("tenant_id", profile!.tenant_id);
            }

            const [typesRes, classesRes, usersRes, managersRes, templatesRes] = await Promise.all([
                typesQuery,
                classesQuery,
                usersQuery,
                managersQuery,
                templatesQuery
            ]);

            if (typesRes.error) throw typesRes.error;
            if (classesRes.error) throw classesRes.error;

            setTypes(typesRes.data || []);
            setClasses(classesRes.data || []);
            setUsers(usersRes.data || []);
            setManagers(managersRes.data || []);
            setAgreementTemplates(templatesRes.data || []);

        } catch (error) {
            console.error("Error fetching education settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTypeName.trim() || !profile?.tenant_id) return;
        setAddingType(true);
        try {
            const { error } = await supabase
                .from("education_types")
                .insert([{ tenant_id: profile.tenant_id, name: newTypeName.trim() }]);

            if (error) throw error;
            setNewTypeName("");
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Kurs tipi eklenirken hata oluştu.");
        } finally {
            setAddingType(false);
        }
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm("Bu kurs tipini (ve ona bağlı eğitim sınıflarını) silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("education_types").delete().eq("id", id);
            if (error) throw error;
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Kurs tipi silinirken hata oluştu.");
        }
    };

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClassName.trim() || !selectedTypeId || !profile?.tenant_id) return;
        setAddingClass(true);
        try {
            const { error } = await supabase
                .from("education_classes")
                .insert([{
                    tenant_id: profile.tenant_id,
                    type_id: selectedTypeId,
                    name: newClassName.trim()
                }]);

            if (error) throw error;
            setNewClassName("");
            setSelectedTypeId("");
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Sınıf eklenirken hata oluştu.");
        } finally {
            setAddingClass(false);
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm("Bu sınıfı (ve bağlı olan taslak kursları) silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("education_classes").delete().eq("id", id);
            if (error) throw error;
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Sınıf silinirken hata oluştu.");
        }
    };

    const handleAssignManager = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedManagerId || !profile?.tenant_id) return;
        setAssigningManager(true);
        try {
            const { error } = await supabase.from("education_managers").insert([{
                tenant_id: profile.tenant_id,
                user_id: selectedManagerId
            }]);
            if (error) throw error;
            setSelectedManagerId("");
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Yönetici atanırken hata oluştu (zaten ekli olabilir).");
        } finally {
            setAssigningManager(false);
        }
    };

    const handleRemoveManager = async (id: string) => {
        if (!confirm("Bu kişinin eğitim yöneticisi yetkisini kaldırmak istediğinize emin misiniz?")) return;
        try {
            await supabase.from("education_managers").delete().eq("id", id);
            fetchSettings();
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTemplateTitle.trim() || !newTemplateText.trim() || !profile?.tenant_id) return;
        setAddingTemplate(true);
        try {
            const { error } = await supabase
                .from("exam_agreement_templates")
                .insert([{
                    tenant_id: profile.tenant_id,
                    title: newTemplateTitle.trim(),
                    agreement_text: newTemplateText.trim()
                }]);

            if (error) throw error;
            setNewTemplateTitle("");
            setNewTemplateText("");
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Şablon eklenirken hata oluştu.");
        } finally {
            setAddingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm("Bu taahhütname şablonunu silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("exam_agreement_templates").delete().eq("id", id);
            if (error) throw error;
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Şablon silinirken hata oluştu.");
        }
    };

    if (loading) return <div className="text-gray-500">Kayıtlar yükleniyor...</div>;

    const isSystemAdminOrCompanyManager = profile?.role === "system_admin" || profile?.role === "company_manager";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Education Types Panel */}
                <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 mb-4 hover:text-indigo-400 transition-colors uppercase tracking-wider">Kurs Tipleri</h2>
                    <p className="text-xs text-slate-500 mb-6">"İSG Eğitimi", "Kalite Eğitimi" gibi ana başlıklar oluşturun.</p>

                    <form onSubmit={handleAddType} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            required
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder="Yeni Tip Adı (Örn: İSG Eğitimi)"
                            className="flex-1 bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none placeholder-slate-500 transition-all"
                        />
                        <button
                            type="submit"
                            disabled={addingType}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
                        >
                            {addingType ? "..." : "Ekle"}
                        </button>
                    </form>

                    <div className="mt-4 border border-slate-800 rounded-xl max-h-64 overflow-y-auto bg-slate-950/30">
                        <table className="min-w-full divide-y divide-slate-800">
                            <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tip Adı</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {types.length === 0 ? (
                                    <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500 italic">Henüz kurs tipi eklenmedi.</td></tr>
                                ) : (
                                    types.map((type) => (
                                        <tr key={type.id} className="hover:bg-slate-800/40 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-200 border-l-4 border-l-indigo-600 group-hover:bg-indigo-600/5 transition-all">{type.name}</td>
                                            <td className="px-6 py-4 text-sm text-right">
                                                <button onClick={() => handleDeleteType(type.id)} className="text-rose-400 hover:text-rose-300 bg-rose-500/10 p-2 rounded-lg hover:bg-rose-500/20 transition-all border border-rose-500/20" title="Sil">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Education Classes Panel */}
                <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 mb-4 hover:text-emerald-400 transition-colors uppercase tracking-wider">Eğitim Sınıfları</h2>
                    <p className="text-xs text-slate-500 mb-6">Bir tipe bağlı olan hedef kitle grupları. Örn: "2026 Yılı Temel İSG Sınıfı"</p>

                    <form onSubmit={handleAddClass} className="flex flex-col gap-3 mb-6">
                        <select
                            required
                            value={selectedTypeId}
                            onChange={(e) => setSelectedTypeId(e.target.value)}
                            className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm border focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                        >
                            <option value="">-- Bağlı Olacağı Kurs Tipini Seçin --</option>
                            {types.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>)}
                        </select>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                required
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="Sınıf Adı (Örn: 2026 Yılı Mavi Yaka İSG)"
                                className="flex-1 bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm border focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none placeholder-slate-500 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={addingClass || types.length === 0}
                                className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
                            >
                                {addingClass ? "..." : "Sınıf Ekle"}
                            </button>
                        </div>
                    </form>

                    <div className="mt-4 border border-slate-800 rounded-xl max-h-64 overflow-y-auto bg-slate-950/30">
                        <table className="min-w-full divide-y divide-slate-800">
                            <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sınıf Adı</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bağlı Tip</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {classes.length === 0 ? (
                                    <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500 italic">Henüz sınıf eklenmedi. Önce Tip oluşturun.</td></tr>
                                ) : (
                                    classes.map((cls) => (
                                        <tr key={cls.id} className="hover:bg-slate-800/40 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-200 border-l-4 border-l-emerald-600 group-hover:bg-emerald-600/5 transition-all">{cls.name}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">
                                                <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700">{cls.type?.name || 'Bilinmiyor'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setSelectedClassForQuestions({ id: cls.id, name: cls.name })} className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 p-2 rounded-lg hover:bg-emerald-500/20 transition-all border border-emerald-500/20 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" title="Soruları Yönet">
                                                        <FileText className="w-3.5 h-3.5" /> Şablon Sorular
                                                    </button>
                                                    <button onClick={() => handleDeleteClass(cls.id)} className="text-rose-400 hover:text-rose-300 bg-rose-500/10 p-2 rounded-lg hover:bg-rose-500/20 transition-all border border-rose-500/20" title="Sil">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Education Managers Panel (Only for Company Managers) */}
            {isSystemAdminOrCompanyManager && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800">
                        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 mb-4 hover:text-orange-400 transition-colors uppercase tracking-wider">Eğitim Yöneticileri</h2>
                        <p className="text-xs text-slate-500 mb-6">Bu yetkiye sahip personeller modülün yönetimine sınırsız erişebilir (Kurs açma, atama yapma vb.).</p>

                        <form onSubmit={handleAssignManager} className="flex gap-2 mb-6">
                            <select
                                required
                                value={selectedManagerId}
                                onChange={(e) => setSelectedManagerId(e.target.value)}
                                className="flex-1 bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm border focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                            >
                                <option value="">-- Personel Seçin --</option>
                                {users.map(u => <option key={u.id} value={u.id} className="bg-slate-900">{u.first_name} {u.last_name}</option>)}
                            </select>
                            <button
                                type="submit"
                                disabled={assigningManager}
                                className="bg-orange-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-500 shadow-lg shadow-orange-600/20 disabled:opacity-50 transition-all"
                            >
                                {assigningManager ? "..." : "Yetki Ver"}
                            </button>
                        </form>

                        <div className="mt-4 border border-slate-800 rounded-xl max-h-64 overflow-y-auto bg-slate-950/30">
                            <table className="min-w-full divide-y divide-slate-800">
                                <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-md">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ad Soyad</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {managers.length === 0 ? (
                                        <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500 italic">Henüz yönetici atanmamış. Şirket yöneticileri varsayılan olarak her şeye yetkilidir.</td></tr>
                                    ) : (
                                        managers.map((m) => (
                                            <tr key={m.id} className="hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-6 py-4 text-sm font-bold text-slate-200 border-l-4 border-l-orange-600 group-hover:bg-orange-600/5 transition-all">
                                                    {m.profiles?.first_name} {m.profiles?.last_name}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-right">
                                                    <button onClick={() => handleRemoveManager(m.id)} className="text-rose-400 hover:text-rose-300 bg-rose-500/10 p-2 rounded-lg hover:bg-rose-500/20 transition-all border border-rose-500/20" title="Sil">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Agreement Templates Panel */}
                    <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800">
                        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 mb-4 hover:text-blue-400 transition-colors uppercase tracking-wider">Sınav Taahhütname Şablonları</h2>
                        <p className="text-xs text-slate-500 mb-6">Fiziki sınavlarda kullanmak üzere sık kullanılan taahhütname metinlerini kaydedin.</p>

                        <form onSubmit={handleAddTemplate} className="flex flex-col gap-3 mb-6">
                            <input
                                type="text"
                                required
                                value={newTemplateTitle}
                                onChange={(e) => setNewTemplateTitle(e.target.value)}
                                placeholder="Şablon Adı (Örn: Çevre Sınavı Taahhütnamesi)"
                                className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none placeholder-slate-500 transition-all"
                            />
                            <textarea
                                required
                                rows={3}
                                value={newTemplateText}
                                onChange={(e) => setNewTemplateText(e.target.value)}
                                placeholder="Taahhütname Metni..."
                                className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none placeholder-slate-500 transition-all resize-none"
                            />
                            <button
                                type="submit"
                                disabled={addingTemplate}
                                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all self-end"
                            >
                                {addingTemplate ? "..." : "Şablonu Ekle"}
                            </button>
                        </form>

                        <div className="mt-4 border border-slate-800 rounded-xl max-h-64 overflow-y-auto bg-slate-950/30">
                            <table className="min-w-full divide-y divide-slate-800">
                                <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-md">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Şablon Adı</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {agreementTemplates.length === 0 ? (
                                        <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500 italic">Henüz şablon eklenmemiş.</td></tr>
                                    ) : (
                                        agreementTemplates.map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-6 py-4 text-sm font-bold text-slate-200 border-l-4 border-l-blue-600 group-hover:bg-blue-600/5 transition-all">
                                                    {t.title}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-right">
                                                    <button onClick={() => handleDeleteTemplate(t.id)} className="text-rose-400 hover:text-rose-300 bg-rose-500/10 p-2 rounded-lg hover:bg-rose-500/20 transition-all border border-rose-500/20" title="Sil">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {selectedClassForQuestions && (
                <ClassQuestionManagerModal
                    classId={selectedClassForQuestions.id}
                    className={selectedClassForQuestions.name}
                    onClose={() => setSelectedClassForQuestions(null)}
                />
            )}
        </div>
    );
}
