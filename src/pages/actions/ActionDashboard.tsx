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
        e.stopPropagation(); // Satır tıklamayı engelle
        setSendingId(action.id);

        try {
            // Alıcıları belirle
            const emailTargets: string[] = [];

            // 1. Firmaya mail
            if (action.subcontractors?.email) {
                emailTargets.push(action.subcontractors.email);
            }

            // 2. Atanmış kişilere mail
            const { data: assignees } = await supabase
                .from("action_assignee_users")
                .select("user_id, profiles(email)")
                .eq("action_id", action.id);
            if (assignees) {
                for (const a of assignees) {
                    if ((a as any).profiles?.email) emailTargets.push((a as any).profiles.email);
                }
            }

            // 3. Harici e-postalara mail
            const { data: externals } = await supabase
                .from("action_assignee_external")
                .select("email")
                .eq("action_id", action.id);
            if (externals) {
                for (const ext of externals) emailTargets.push(ext.email);
            }

            if (emailTargets.length === 0) {
                alert("Bu aksiyonda e-posta gönderilecek alıcı bulunamadı.");
                setSendingId(null);
                return;
            }

            // Her alıcıya bildirim kuyruğuna ekle
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

            // Sadece bu aksiyona ait pending e-postaları bul
            const { data: pendingEmails } = await supabase
                .from("notification_queue")
                .select("id")
                .eq("status", "pending")
                .in("to_email", emailTargets);

            const ids = (pendingEmails || []).map((e: any) => e.id);

            // Edge Function'a sadece bu ID'leri gönder
            const { data: result, error: fnError } = await supabase.functions.invoke('send-email', {
                body: { ids }
            });

            console.log("Edge Function Sonucu:", result, fnError);

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
        const diff = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getDeadlineBadge = (deadline: string | null) => {
        const days = getDaysLeft(deadline);
        if (days === null) return <span className="text-xs text-gray-400">—</span>;
        if (days < 0) return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200">{Math.abs(days)} gün geçmiş!</span>;
        if (days === 0) return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">Son gün!</span>;
        if (days <= 7) return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">{days} gün kaldı</span>;
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">{days} gün kaldı</span>;
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

    return (
        <div className="space-y-6">
            {/* Filtre Çubuğu */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Takip No, Açan Kişi veya Firma ara..."
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

            {/* Liste */}
            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
                ) : filteredActions.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <FileText className="w-12 h-12 text-gray-300 mb-2" />
                        <p>Açık aksiyon bulunamadı.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Takip No</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konu</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proje</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açan Kişi</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Son Tarih</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">E-posta</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredActions.map((action) => (
                                    <tr
                                        key={action.id}
                                        onClick={() => navigate(`/app/aksiyon-takip/${action.id}`)}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                                            {action.tracking_number}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {action.action_subjects?.name || "-"}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {action.action_projects?.name || "-"}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                            {action.subcontractors?.name || <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {action.profiles?.first_name} {action.profiles?.last_name}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {action.deadline_date ? (
                                                <div>
                                                    <p className="text-gray-700">{new Date(action.deadline_date).toLocaleDateString('tr-TR')}</p>
                                                    {getDeadlineBadge(action.deadline_date)}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                Açık
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                            <button
                                                onClick={(e) => handleSendEmail(e, action)}
                                                disabled={sendingId === action.id}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                                                title="Bildirim e-postası gönder"
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
