import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface TeamMember {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    is_global: boolean;
    created_at: string;
}

export default function ManagerAnnouncementsPage() {
    const { user, profile } = useAuthStore();
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = (ann: Announcement) => {
        setSelectedAnn(ann);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedAnn(null), 200); // Clear after animation
    };

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [targetType, setTargetType] = useState<"global" | "specific">("global");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchData();
        }
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Personelleri getir
            const { data: teamData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, email")
                .eq("tenant_id", profile!.tenant_id)
                .eq("role", "employee")
                .order("first_name");
            if (teamData) setTeam(teamData);

            // Duyuruları getir (Manager kendi tenant'ındakileri görür)
            const { data: annData } = await supabase
                .from("announcements")
                .select("*")
                .eq("tenant_id", profile!.tenant_id)
                .order("created_at", { ascending: false });
            if (annData) setAnnouncements(annData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;
        if (targetType === "specific" && selectedUserIds.length === 0) {
            alert("Lütfen en az bir personel seçin");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Duyuruyu oluştur
            const { data: newAnn, error: annError } = await supabase
                .from("announcements")
                .insert([
                    {
                        title: title.trim(),
                        content: content.trim(),
                        created_by: user!.id,
                        tenant_id: profile!.tenant_id,
                        is_global: targetType === "global"
                    }
                ])
                .select()
                .single();

            if (annError) throw annError;

            // 2. Specific ise target ekle
            if (targetType === "specific" && newAnn) {
                const targetInserts = selectedUserIds.map(id => ({
                    announcement_id: newAnn.id,
                    target_user_id: id
                }));

                const { error: targetError } = await supabase
                    .from("announcement_targets")
                    .insert(targetInserts);
                if (targetError) throw targetError;
            }

            alert("Duyuru başarıyla gönderildi!");
            setTitle("");
            setContent("");
            setTargetType("global");
            setSelectedUserIds([]);
            setUserSearchTerm("");
            fetchData();
        } catch (error: any) {
            console.error("Error sending announcement:", error);
            alert("Hata: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
        try {
            await supabase.from("announcements").delete().eq("id", id);
            fetchData();
        } catch (error: any) {
            alert("Hata: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Şirket Duyuruları</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol Taraf: Duyuru Gönderme Formu */}
                <div className="lg:col-span-1 border rounded-lg bg-white shadow p-5">
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2">Yeni Duyuru Gönder</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duyuru Başlığı</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">İçerik</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={4}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Hedef Kitle</label>
                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={targetType === "global"}
                                        onChange={() => setTargetType("global")}
                                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Tüm Personel</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={targetType === "specific"}
                                        onChange={() => setTargetType("specific")}
                                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Belirli Bir Personele Özel</span>
                                </label>
                            </div>
                        </div>

                        {targetType === "specific" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Personel Seçin</label>
                                <div className="border border-gray-300 rounded-md overflow-hidden">
                                    <div className="p-2 border-b bg-gray-50">
                                        <input
                                            type="text"
                                            placeholder="İsim veya e-posta ara..."
                                            value={userSearchTerm}
                                            onChange={(e) => setUserSearchTerm(e.target.value)}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                                        {team
                                            .filter(m => {
                                                const searchStr = `${m.first_name || ""} ${m.last_name || ""} ${m.email}`.toLowerCase();
                                                return searchStr.includes(userSearchTerm.toLowerCase());
                                            })
                                            .map(m => {
                                                const isSelected = selectedUserIds.includes(m.id);
                                                return (
                                                    <label
                                                        key={m.id}
                                                        className={`flex items-center p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-gray-50'} border border-transparent`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedUserIds(prev => [...prev, m.id]);
                                                                } else {
                                                                    setSelectedUserIds(prev => prev.filter(id => id !== m.id));
                                                                }
                                                            }}
                                                            className="text-indigo-600 focus:ring-indigo-500 h-4 w-4 rounded border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">
                                                            {m.first_name || m.last_name ? `${m.first_name || ""} ${m.last_name || ""}` : m.email}
                                                        </span>
                                                        <span className="ml-auto text-xs text-gray-400">{m.email}</span>
                                                    </label>
                                                );
                                            })
                                        }
                                        {team.length > 0 && team.filter(m => `${m.first_name || ""} ${m.last_name || ""} ${m.email}`.toLowerCase().includes(userSearchTerm.toLowerCase())).length === 0 && (
                                            <div className="text-center text-sm text-gray-500 py-2">Sonuç bulunamadı.</div>
                                        )}
                                    </div>
                                    <div className="p-2 border-t bg-gray-50 flex justify-between items-center">
                                        <span className="text-xs text-gray-600">{selectedUserIds.length} kişi seçildi</span>
                                        {selectedUserIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedUserIds([])}
                                                className="text-xs text-red-600 hover:underline"
                                            >
                                                Tümünü Temizle
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {submitting ? "Gönderiliyor..." : "Duyuru Gönder"}
                        </button>
                    </form>
                </div>

                {/* Sağ Taraf: Geçmiş Duyurular */}
                <div className="lg:col-span-2 border rounded-lg bg-white shadow overflow-hidden">
                    <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Gönderilmiş Duyurular</h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
                    ) : announcements.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Henüz duyuru gönderilmemiş.</div>
                    ) : (
                        <div className="divide-y">
                            {announcements.map((ann) => (
                                <div
                                    key={ann.id}
                                    onClick={() => openModal(ann)}
                                    className="p-5 hover:bg-gray-50 transition relative group cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{ann.title}</h3>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2 py-1 rounded-full ${ann.is_global ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800"}`}>
                                                {ann.is_global ? "Şirket Geneli" : "Özel Hedefli"}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3 line-clamp-2">{ann.content}</p>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-400">
                                                {new Date(ann.created_at).toLocaleString('tr-TR')}
                                            </span>
                                            <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Detayları Gör &rarr;
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // prevent modal opening
                                                handleDelete(ann.id);
                                            }}
                                            className="text-red-500 hover:text-red-700 text-sm opacity-0 group-hover:opacity-100 transition"
                                        >
                                            Sil
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Duyuru Detay Modalı */}
            {isModalOpen && selectedAnn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div
                        className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900 truncate pr-4">
                                {selectedAnn.title}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-5">
                            <div className="flex items-center gap-3 mb-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white bg-indigo-500">
                                    {profile?.first_name?.charAt(0).toUpperCase() || "Y"}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
                                    <p className="text-xs mt-0.5">{new Date(selectedAnn.created_at).toLocaleString('tr-TR')}</p>
                                </div>
                            </div>

                            <div className="mt-4 proze text-sm text-gray-700 whitespace-pre-wrap break-words max-h-96 overflow-y-auto pr-2">
                                {selectedAnn.content}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={closeModal}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
