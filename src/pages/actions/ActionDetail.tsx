import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, CheckCircle, Trash2, Send, File } from "lucide-react";
import ActionFileUploader from "@/components/actions/ActionFileUploader";

export default function ActionDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    const [action, setAction] = useState<any>(null);
    const [assigneesUser, setAssigneesUser] = useState<any[]>([]);
    const [assigneesContractor, setAssigneesContractor] = useState<any[]>([]);
    const [assigneesExternal, setAssigneesExternal] = useState<any[]>([]);
    const [ccUsers, setCcUsers] = useState<any[]>([]);

    const [comments, setComments] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [commenting, setCommenting] = useState(false);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Main Action
            const { data: act, error: actErr } = await supabase
                .from("actions")
                .select(`
                    *,
                    action_subjects(name),
                    action_projects(name),
                    profiles!actions_created_by_fkey(first_name, last_name, email),
                    closer:profiles!actions_closed_by_fkey(first_name, last_name)
                `)
                .eq("id", id)
                .single();
            if (actErr) throw actErr;
            setAction(act);

            // Related data
            const [uRes, cRes, eRes, ccRes, commRes, fileRes] = await Promise.all([
                supabase.from("action_assignee_users").select("profiles(first_name, last_name)").eq("action_id", id),
                supabase.from("action_assignee_contractors").select("action_contractors(name)").eq("action_id", id),
                supabase.from("action_assignee_external").select("email").eq("action_id", id),
                supabase.from("action_cc_users").select("profiles(first_name, last_name)").eq("action_id", id),
                supabase.from("action_comments").select("*, profiles(first_name, last_name)").eq("action_id", id).order("created_at", { ascending: true }),
                supabase.from("action_files").select("*, profiles(first_name, last_name)").eq("action_id", id).order("uploaded_at", { ascending: false })
            ]);

            setAssigneesUser(uRes.data || []);
            setAssigneesContractor(cRes.data || []);
            setAssigneesExternal(eRes.data || []);
            setCcUsers(ccRes.data || []);
            setComments(commRes.data || []);
            setFiles((fileRes.data || []).map((f: any) => ({
                ...f,
                url: f.file_url,
                name: f.file_name
            })));

        } catch (error: any) {
            console.error("Fetch error:", error);
            alert("Aksiyon detayı yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !profile?.id) return;
        setCommenting(true);
        try {
            const { error } = await supabase.from("action_comments").insert([{
                action_id: id,
                user_id: profile.id,
                comment: newComment.trim()
            }]);
            if (error) throw error;
            setNewComment("");
            fetchData(); // reload comments
        } catch (err: any) {
            alert("Yorum eklenemedi: " + err.message);
        } finally {
            setCommenting(false);
        }
    };

    const handleUploadFile = async (url: string, name: string) => {
        if (!profile?.id) return;
        try {
            await supabase.from("action_files").insert([{
                action_id: id,
                uploaded_by: profile.id,
                file_url: url,
                file_name: name
            }]);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemoveFile = async (url: string) => {
        if (!window.confirm("Dosyayı silmek istediğinize emin misiniz?")) return;
        try {
            await supabase.from("action_files").delete().eq("file_url", url);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCloseAction = async () => {
        if (!window.confirm("Bu aksiyonu kapatmak istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("actions").update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: profile?.id
            }).eq("id", id);

            if (error) throw error;
            alert("Aksiyon kapatıldı.");
            fetchData();
            navigate("/app/aksiyon-takip/closed");
        } catch (err: any) {
            alert("Kapatma başarısız: " + (err.message || "Yetkiniz yok."));
        }
    };

    const handleDeleteAction = async () => {
        if (!window.confirm("DİKKAT! Bu aksiyonu kalıcı olarak silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("actions").delete().eq("id", id);
            if (error) throw error;
            alert("Aksiyon silindi.");
            navigate("/app/aksiyon-takip");
        } catch (err: any) {
            alert("Silme başarısız: " + (err.message || "Yetkiniz yok."));
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;
    if (!action) return <div className="p-8 text-center text-rose-500">Aksiyon bulunamadı.</div>;

    const isCreatorOrManager = action.created_by === profile?.id || profile?.role === 'company_manager' || profile?.role === 'system_admin';
    const isOpen = action.status === 'open';

    const cardClass = "bg-slate-900 shadow-sm rounded-xl p-6 border border-slate-800";

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-white">{action.tracking_number}</h1>
                            <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${isOpen ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {isOpen ? 'AÇIK' : 'KAPALI'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500">
                            Açan: {action.profiles?.first_name} {action.profiles?.last_name} • {new Date(action.created_at).toLocaleString('tr-TR')}
                        </p>
                    </div>
                </div>

                {isOpen && isCreatorOrManager && (
                    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <button onClick={handleDeleteAction} className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors">
                            <Trash2 className="w-4 h-4" /> <span className="text-sm font-medium">Sil</span>
                        </button>
                        <button onClick={handleCloseAction} className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-1.5 rounded-lg border border-emerald-500/20 transition-colors">
                            <CheckCircle className="w-4 h-4" /> <span className="text-sm font-medium">Aksiyonu Kapat</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Kapalı Bildirimi */}
            {!isOpen && (
                <div className="bg-emerald-500/10 border-l-4 border-emerald-500 p-4 rounded-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-emerald-100">
                                Bu aksiyon <strong>{action.closer?.first_name} {action.closer?.last_name}</strong> tarafından <strong>{new Date(action.closed_at).toLocaleString('tr-TR')}</strong> tarihinde kapatılmıştır.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Sol Taraf - Detaylar */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Metinler */}
                    <div className={cardClass}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4 border-b border-slate-800">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Konu</p>
                                <p className="text-sm font-medium text-slate-200">{action.action_subjects?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Proje/Lokasyon</p>
                                <p className="text-sm font-medium text-slate-200">{action.action_projects?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Süre</p>
                                <p className="text-sm font-medium text-slate-200">{action.total_days} Gün</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-white mb-2">Tespit Edilen Uygunsuzluk</h3>
                            <div className="bg-rose-500/10 text-rose-200 p-4 rounded-xl text-sm border border-rose-500/20 whitespace-pre-wrap">
                                {action.nonconformity_description}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-white mb-2">Alınacak Aksiyon / Öneri</h3>
                            <div className="bg-indigo-500/10 text-indigo-200 p-4 rounded-xl text-sm border border-indigo-500/20 whitespace-pre-wrap">
                                {action.action_description}
                            </div>
                        </div>
                    </div>

                    {/* Yorumlar */}
                    <div className={cardClass}>
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">Gelişmeler & Yorumlar</h3>
                        <div className="space-y-4 mb-6">
                            {comments.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Henüz yorum yapılmamış.</p>
                            ) : (
                                comments.map(c => (
                                    <div key={c.id} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold flex-shrink-0 border border-indigo-500/30">
                                            {c.profiles?.first_name?.[0]}{c.profiles?.last_name?.[0]}
                                        </div>
                                        <div className="bg-slate-800/50 rounded-xl p-3 flex-1 border border-slate-700/50">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-slate-300">{c.profiles?.first_name} {c.profiles?.last_name}</span>
                                                <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString('tr-TR')}</span>
                                            </div>
                                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.comment}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {isOpen && (
                            <div className="flex gap-2">
                                <textarea
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    placeholder="Gelişmeleri yazın..."
                                    rows={2}
                                    className="flex-1 bg-slate-800 border-slate-700 text-slate-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500/50 sm:text-sm border px-3 py-2 placeholder-slate-500"
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={commenting || !newComment.trim()}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    <Send className="w-4 h-4" /> <span className="hidden sm:inline">Gönder</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sağ Taraf - İlgililer ve Dosyalar */}
                <div className="space-y-6">
                    {/* Dosyalar */}
                    <div className="bg-slate-900 shadow-sm rounded-xl p-5 border border-slate-800">
                        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider border-b border-slate-800 pb-2">Ekler & Dosyalar</h3>
                        {isOpen ? (
                            <ActionFileUploader
                                currentFiles={files}
                                onUpload={handleUploadFile}
                                onRemove={handleRemoveFile}
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {files.length === 0 && <span className="text-sm text-slate-500 italic">Dosya yok.</span>}
                                {files.map((f, index) => (
                                    <a key={index} href={f.url} target="_blank" rel="noopener noreferrer" className="relative group aspect-square bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col items-center justify-center p-2 hover:bg-slate-700 transition-colors">
                                        <File className="w-8 h-8 text-slate-500 mb-1" />
                                        <span className="text-xs text-slate-400 truncate w-full text-center px-1" title={f.name}>{f.name}</span>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* İlgililer */}
                    <div className="bg-slate-900 shadow-sm rounded-xl p-5 border border-slate-800 space-y-4">
                        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2 uppercase tracking-wider">İlgililer</h3>

                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Aksiyon Atanan Personel</p>
                            {assigneesUser.length === 0 ? <span className="text-sm text-slate-600 italic">-</span> : (
                                <ul className="text-sm text-slate-300 space-y-1">
                                    {assigneesUser.map((u, i) => <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 bg-indigo-500 rounded-full"></span> {u.profiles?.first_name} {u.profiles?.last_name}</li>)}
                                </ul>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Aksiyon Atanan Firma</p>
                            {assigneesContractor.length === 0 ? <span className="text-sm text-slate-600 italic">-</span> : (
                                <ul className="text-sm text-slate-300 space-y-1">
                                    {assigneesContractor.map((c, i) => <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 bg-indigo-500 rounded-full"></span> {c.action_contractors?.name}</li>)}
                                </ul>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Harici E-postalar</p>
                            {assigneesExternal.length === 0 ? <span className="text-sm text-slate-600 italic">-</span> : (
                                <ul className="text-sm text-slate-300 space-y-1">
                                    {assigneesExternal.map((e, i) => <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 bg-indigo-500 rounded-full"></span> {e.email}</li>)}
                                </ul>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bilgi Verilen (CC)</p>
                            {ccUsers.length === 0 ? <span className="text-sm text-slate-600 italic">-</span> : (
                                <ul className="text-sm text-slate-300 space-y-1">
                                    {ccUsers.map((u, i) => <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 bg-slate-600 rounded-full"></span> {u.profiles?.first_name} {u.profiles?.last_name}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
