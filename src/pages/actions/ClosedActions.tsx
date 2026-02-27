import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Search, FileText } from "lucide-react";

export default function ClosedActions() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [actions, setActions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSubject, setFilterSubject] = useState("");
    const [filterProject, setFilterProject] = useState("");

    const [subjects, setSubjects] = useState<{ id: string, name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchFilters();
            fetchActions();
        }
    }, [profile]);

    const fetchFilters = async () => {
        const [s, p] = await Promise.all([
            supabase.from("action_subjects").select("id, name").eq("company_id", profile?.tenant_id),
            supabase.from("action_projects").select("id, name").eq("company_id", profile?.tenant_id)
        ]);
        if (s.data) setSubjects(s.data);
        if (p.data) setProjects(p.data);
    };

    const fetchActions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("actions")
                .select(`
                    *,
                    action_subjects (name),
                    action_projects (name),
                    profiles!actions_created_by_fkey (first_name, last_name),
                    closer:profiles!actions_closed_by_fkey (first_name, last_name)
                `)
                .eq("status", "closed")
                .order("closed_at", { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            setActions(data || []);
        } catch (error: any) {
            console.error("Fetch errors:", error);
            alert("Aksiyonlar yüklenemedi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredActions = actions.filter(a => {
        let match = true;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const trackNo = (a.tracking_number || "").toLowerCase();
            const creator = `${a.profiles?.first_name || ""} ${a.profiles?.last_name || ""}`.toLowerCase();
            const closer = `${a.closer?.first_name || ""} ${a.closer?.last_name || ""}`.toLowerCase();
            if (!trackNo.includes(q) && !creator.includes(q) && !closer.includes(q)) match = false;
        }

        if (filterSubject && a.subject_id !== filterSubject) match = false;
        if (filterProject && a.project_id !== filterProject) match = false;

        return match;
    });

    const inputClass = "w-full py-2 px-3 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm placeholder-slate-500";

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Takip No, Açan veya Kapatan Kişi ara..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className={`${inputClass} pl-10`}
                    />
                </div>
                <div className="w-full md:w-48">
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={inputClass}>
                        <option value="">Tüm Konular</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-48">
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={inputClass}>
                        <option value="">Tüm Projeler</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 p-12">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-slate-500 text-sm">Yükleniyor...</span>
                    </div>
                ) : filteredActions.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mb-4">
                            <FileText className="w-7 h-7 text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-sm">Kapanan aksiyon bulunamadı.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    {["Takip No", "Konu", "Proje", "Kapatan Kişi", "Kapanış Tarihi", "Durum"].map(h => (
                                        <th key={h} scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                                {filteredActions.map((action) => (
                                    <tr
                                        key={action.id}
                                        onClick={() => navigate(`/app/aksiyon-takip/${action.id}`)}
                                        className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-400 group-hover:text-indigo-300">
                                            {action.tracking_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                            {action.action_subjects?.name || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                            {action.action_projects?.name || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">
                                            {action.closer ? `${action.closer.first_name} ${action.closer.last_name}` : <span className="text-slate-600">—</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                            {action.closed_at ? new Date(action.closed_at).toLocaleDateString('tr-TR') : "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                Kapalı
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
