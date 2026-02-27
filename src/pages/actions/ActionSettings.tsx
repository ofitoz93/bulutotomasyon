import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

type Subject = { id: string; name: string };
type Project = { id: string; name: string };
type Contractor = { id: string; name: string; email: string };

export default function ActionSettings() {
    const { profile } = useAuthStore();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);

    const [newSubject, setNewSubject] = useState("");
    const [newProject, setNewProject] = useState("");
    const [newContractorName, setNewContractorName] = useState("");
    const [newContractorEmail, setNewContractorEmail] = useState("");

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchData();
        }
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [subjRes, projRes, contRes] = await Promise.all([
                supabase.from("action_subjects").select("id, name").order("name"),
                supabase.from("action_projects").select("id, name").order("name"),
                supabase.from("action_contractors").select("id, name, email").order("name"),
            ]);

            if (subjRes.data) setSubjects(subjRes.data);
            if (projRes.data) setProjects(projRes.data);
            if (contRes.data) setContractors(contRes.data);
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const addSubject = async () => {
        if (!newSubject.trim() || !profile?.tenant_id) return;
        const { data, error } = await supabase.from("action_subjects").insert([{ name: newSubject.trim(), company_id: profile.tenant_id }]).select().single();
        if (!error && data) {
            setSubjects([...subjects, data]);
            setNewSubject("");
        } else {
            alert("Ekleme başarısız.");
        }
    };

    const deleteSubject = async (id: string) => {
        if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
        await supabase.from("action_subjects").delete().eq("id", id);
        setSubjects(subjects.filter(s => s.id !== id));
    };

    const addProject = async () => {
        if (!newProject.trim() || !profile?.tenant_id) return;
        const { data, error } = await supabase.from("action_projects").insert([{ name: newProject.trim(), company_id: profile.tenant_id }]).select().single();
        if (!error && data) {
            setProjects([...projects, data]);
            setNewProject("");
        } else {
            alert("Ekleme başarısız.");
        }
    };

    const deleteProject = async (id: string) => {
        if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
        await supabase.from("action_projects").delete().eq("id", id);
        setProjects(projects.filter(p => p.id !== id));
    };

    const addContractor = async () => {
        if (!newContractorName.trim() || !newContractorEmail.trim() || !profile?.tenant_id) {
            alert("Firma adı ve email zorunludur.");
            return;
        }
        const { data, error } = await supabase.from("action_contractors").insert([{
            name: newContractorName.trim(),
            email: newContractorEmail.trim(),
            company_id: profile.tenant_id
        }]).select().single();

        if (!error && data) {
            setContractors([...contractors, data]);
            setNewContractorName("");
            setNewContractorEmail("");
        } else {
            alert("Ekleme başarısız.");
        }
    };

    const deleteContractor = async (id: string) => {
        if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
        await supabase.from("action_contractors").delete().eq("id", id);
        setContractors(contractors.filter(c => c.id !== id));
    };

    if (loading) return <div className="p-4 text-slate-500">Yükleniyor...</div>;

    const isAuthorized = profile?.role === 'company_manager' || profile?.role === 'system_admin';

    if (!isAuthorized) {
        return <div className="p-8 text-center text-red-400 bg-slate-900 border border-slate-800 shadow rounded-xl">Bu sayfayı görüntüleme ve düzenleme yetkiniz yok. (Sadece Yöneticiler)</div>;
    }

    const cardClass = "bg-slate-900 shadow-sm rounded-xl p-6 border border-slate-800";
    const headerClass = "text-lg font-bold text-white mb-4";
    const inputClass = "flex-1 bg-slate-800 border-slate-700 text-slate-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border placeholder-slate-500";
    const itemClass = "flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors";

    return (
        <div className="space-y-8">
            <div className={cardClass}>
                <h2 className={headerClass}>Aksiyon Konuları</h2>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                        placeholder="Yeni konu adı..."
                        className={inputClass}
                        onKeyDown={e => e.key === 'Enter' && addSubject()}
                    />
                    <button onClick={addSubject} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/20 flex items-center gap-1 transition-colors">
                        <Plus className="w-4 h-4" /> Ekle
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {subjects.map(s => (
                        <div key={s.id} className={itemClass}>
                            <span className="text-sm font-medium text-slate-300">{s.name}</span>
                            <button onClick={() => deleteSubject(s.id)} className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {subjects.length === 0 && <span className="text-sm text-slate-500">Kayıtlı konu yok.</span>}
                </div>
            </div>

            <div className={cardClass}>
                <h2 className={headerClass}>Projeler / Lokasyonlar</h2>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newProject}
                        onChange={e => setNewProject(e.target.value)}
                        placeholder="Yeni proje / lokasyon adı..."
                        className={inputClass}
                        onKeyDown={e => e.key === 'Enter' && addProject()}
                    />
                    <button onClick={addProject} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/20 flex items-center gap-1 transition-colors">
                        <Plus className="w-4 h-4" /> Ekle
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {projects.map(p => (
                        <div key={p.id} className={itemClass}>
                            <span className="text-sm font-medium text-slate-300">{p.name}</span>
                            <button onClick={() => deleteProject(p.id)} className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {projects.length === 0 && <span className="text-sm text-slate-500">Kayıtlı proje yok.</span>}
                </div>
            </div>

            <div className={cardClass}>
                <h2 className={headerClass}>Aksiyon Alacak Firmalar (Alt İşveren vb.)</h2>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        value={newContractorName}
                        onChange={e => setNewContractorName(e.target.value)}
                        placeholder="Firma Unvanı..."
                        className={inputClass}
                    />
                    <input
                        type="email"
                        value={newContractorEmail}
                        onChange={e => setNewContractorEmail(e.target.value)}
                        placeholder="Email Adresi (Zorunlu)..."
                        className={inputClass}
                        onKeyDown={e => e.key === 'Enter' && addContractor()}
                    />
                    <button onClick={addContractor} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/20 flex items-center gap-1 justify-center transition-colors">
                        <Plus className="w-4 h-4" /> Ekle
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contractors.map(c => (
                        <div key={c.id} className={itemClass}>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">{c.name}</span>
                                <span className="text-xs text-slate-500">{c.email}</span>
                            </div>
                            <button onClick={() => deleteContractor(c.id)} className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {contractors.length === 0 && <span className="text-sm text-slate-500">Kayıtlı firma yok.</span>}
                </div>
            </div>

        </div>
    );
}
