import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Search, FileText, Mail, Loader2 } from "lucide-react";

export default function ActionDashboard() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [actions, setActions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

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
            const { data, error } = await supabase
                .from("actions")
                .select(`
                    *,
                    action_subjects (name),
                    action_projects (name),
                    profiles!actions_created_by_fkey (first_name, last_name),
                    subcontractors (name, email)
                `)
                .eq("status", "open")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setActions(data || []);
        } catch (error: any) {
            console.error("Fetch errors:", error);
            alert("Aksiyonlar yüklenemedi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async (e: React.MouseEvent, action: any) => {
        e.stopPropagation();
        setSendingId(action.id);
        try {
            const emailTargets: string[] = [];
            if (action.subcontractors?.email) emailTargets.push(action.subcontractors.email);

            const { data: assignees } = await supabase
                .from("action_assignee_users").select("user_id, profiles(email)").eq("action_id", action.id);
            if (assignees) {
                for (const a of assignees) {
                    if ((a as any).profiles?.email) emailTargets.push((a as any).profiles.email);
                }
            }

            const { data: externals } = await supabase
                .from("action_assignee_external").select("email").eq("action_id", action.id);
            if (externals) {
                for (const ext of externals) emailTargets.push(ext.email);
            }

            if (emailTargets.length === 0) {
                alert("Bu aksiyonda e-posta gönderilecek alıcı bulunamadı.");
                setSendingId(null);
                return;
            }

            for (const email of emailTargets) {
                await supabase.rpc('send_action_notification_email', {
                    p_to_email: email,
                    p_firm_name: action.subcontractors?.name || action.profiles?.first_name || 'İlgili',
                    p_tracking_number: action.tracking_number || 'N/A',
                    p_action_description: action.action_description,
                    p_nonconformity_description: action.nonconformity_description,
                    p_total_days: action.total_days,
                });
            }

            const { data: pendingEmails } = await supabase
                .from("notification_queue").select("id").eq("status", "pending").in("to_email", emailTargets);

            const ids = (pendingEmails || []).map((e: any) => e.id);

            const { data: result, error: fnError } = await supabase.functions.invoke('send-email', { body: { ids } });

            if (fnError) {
                alert("E-posta kuyruğa eklendi ama gönderimde hata: " + fnError.message);
            } else if (result?.message) {
                alert(result.message);
            } else {
                alert(`${emailTargets.length} alıcıya e-posta gönderildi!`);
            }
        } catch (err: any) {
            console.error("E-posta gönderim hatası:", err);
            alert("E-posta gönderilemedi: " + err.message);
        } finally {
            setSendingId(null);
        }
    };

    const getDaysLeft = (deadline: string | null) => {
        if (!deadline) return null;
        return Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    };

    const getDeadlineBadge = (deadline: string | null) => {
        const days = getDaysLeft(deadline);
        if (days === null) return <span className="text-xs text-slate-600">—</span>;
        if (days < 0) return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">{Math.abs(days)} gün geçmiş!</span>;
        if (days === 0) return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">Son gün!</span>;
        if (days <= 7) return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">{days} gün kaldı</span>;
        return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">{days} gün kaldı</span>;
    };

    const filteredActions = actions.filter(a => {
        let match = true;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const trackNo = (a.tracking_number || "").toLowerCase();
            const creator = `${a.profiles?.first_name || ""} ${a.profiles?.last_name || ""}`.toLowerCase();
            const firma = (a.subcontractors?.name || "").toLowerCase();
            if (!trackNo.includes(q) && !creator.includes(q) && !firma.includes(q)) match = false;
        }
        if (filterSubject && a.subject_id !== filterSubject) match = false;
        if (filterProject && a.project_id !== filterProject) match = false;
        return match;
    });

    const inputClass = "w-full py-2 px-3 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm placeholder-slate-500";

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Takip No, Açan Kişi veya Firma ara..."
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

            {/* List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
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
                        <p className="text-slate-500 text-sm">Açık aksiyon bulunamadı.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    {["Takip No", "Konu", "Proje", "Firma", "Açan Kişi", "Son Tarih", "Durum", "E-posta"].map(h => (
                                        <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredActions.map((action) => (
                                    <tr
                                        key={action.id}
                                        onClick={() => navigate(`/app/aksiyon-takip/${action.id}`)}
                                        className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-indigo-400 group-hover:text-indigo-300">
                                            {action.tracking_number}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                                            {action.action_subjects?.name || "—"}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                            {action.action_projects?.name || "—"}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">
                                            {action.subcontractors?.name || <span className="text-slate-600">—</span>}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                                            {action.profiles?.first_name} {action.profiles?.last_name}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {action.deadline_date ? (
                                                <div>
                                                    <p className="text-slate-300 text-xs mb-1">{new Date(action.deadline_date).toLocaleDateString('tr-TR')}</p>
                                                    {getDeadlineBadge(action.deadline_date)}
                                                </div>
                                            ) : (
                                                <span className="text-slate-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                Açık
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => handleSendEmail(e, action)}
                                                disabled={sendingId === action.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                                            >
                                                {sendingId === action.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Mail className="w-3.5 h-3.5" />
                                                )}
                                                Gönder
                                            </button>
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
