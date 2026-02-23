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

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Takip No, Açan veya Kapatan Kişi ara..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="w-full md:w-48">
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="">Tüm Konular</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-48">
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="">Tüm Projeler</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
                ) : filteredActions.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <FileText className="w-12 h-12 text-gray-300 mb-2" />
                        <p>Kapanan aksiyon bulunamadı.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Takip No</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konu</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proje</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapatan Kişi</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapanış Tarihi</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredActions.map((action) => (
                                    <tr
                                        key={action.id}
                                        onClick={() => navigate(`/app/aksiyon-takip/${action.id}`)}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                            {action.tracking_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {action.action_subjects?.name || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {action.action_projects?.name || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {action.closer ? `${action.closer.first_name} ${action.closer.last_name}` : "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {action.closed_at ? new Date(action.closed_at).toLocaleDateString('tr-TR') : "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
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
