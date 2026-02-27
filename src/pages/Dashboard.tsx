import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
    profiles: {
        first_name: string | null;
        last_name: string | null;
        role: string;
    } | null;
}

export default function Dashboard() {
    const { profile, user } = useAuthStore();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
    const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = (ann: Announcement) => {
        setSelectedAnn(ann);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedAnn(null), 200);
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoadingAnnouncements(true);
        try {
            const { data, error } = await supabase
                .from("announcements")
                .select(`
                    id, 
                    title, 
                    content, 
                    created_at,
                    profiles:created_by (first_name, last_name, role)
                `)
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) {
                console.error("Error fetching announcements:", error);
            } else if (data) {
                // @ts-ignore
                setAnnouncements(data);
            }
        } catch (error) {
            console.error("Failed to fetch announcements", error);
        } finally {
            setLoadingAnnouncements(false);
        }
    };

    const getSenderName = (ann: Announcement) => {
        if (!ann.profiles) return "Bilinmeyen Gönderici";
        if (ann.profiles.role === "system_admin") return "Sistem Yönetimi";
        const firstName = ann.profiles.first_name || "";
        const lastName = ann.profiles.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || "Şirket Yöneticisi";
    };

    const firstName = profile?.first_name || user?.email?.split("@")[0] || "Kullanıcı";

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Merhaba, {firstName} 👋
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Platforma hoş geldiniz. Güncel duyuruları buradan takip edebilirsiniz.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Duyurular - 2/3 */}
                <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    {/* Card Header */}
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </div>
                            <h2 className="text-sm font-semibold text-slate-200">Duyurular</h2>
                        </div>
                        {announcements.length > 0 && (
                            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                                {announcements.length} yeni
                            </span>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        {loadingAnnouncements ? (
                            <div className="flex items-center justify-center p-12 gap-3">
                                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm text-slate-500">Duyurular yükleniyor...</span>
                            </div>
                        ) : announcements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                                    <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <p className="text-slate-500 text-sm">Henüz yayınlanmış bir duyuru yok.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-800 max-h-[480px] overflow-y-auto">
                                {announcements.map((ann) => (
                                    <li
                                        key={ann.id}
                                        onClick={() => openModal(ann)}
                                        className="px-5 py-4 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <h3 className="font-medium text-slate-200 text-sm group-hover:text-indigo-400 transition-colors line-clamp-1">
                                                {ann.title}
                                            </h3>
                                            <span className="text-[10px] text-slate-600 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full ml-3 flex-shrink-0">
                                                {new Date(ann.created_at).toLocaleDateString("tr-TR", {
                                                    day: "numeric", month: "short",
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                                            {ann.content}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${ann.profiles?.role === "system_admin" ? "bg-rose-600" : "bg-indigo-600"}`}>
                                                    {getSenderName(ann).charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[11px] text-slate-500">
                                                    {getSenderName(ann)}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                Detay
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Sağ: Bilgi Kartları - 1/3 */}
                <div className="flex flex-col gap-4">
                    {/* Hızlı Erişim */}
                    {profile?.role !== "system_admin" && (
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl p-5 text-white shadow-lg shadow-indigo-500/20">
                            <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center mb-3">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-sm mb-1">Hızlı Erişim</h3>
                            <p className="text-xs text-indigo-200 leading-relaxed">
                                Sol menüden ilgili modülü seçerek işlemlerinize devam edin.
                            </p>
                        </div>
                    )}

                    {/* Platform Bilgisi */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex-1">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-200">Sistem Durumu</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="text-xs text-slate-400">Tüm sistemler çalışıyor</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span className="text-xs text-slate-400">Veritabanı bağlantısı aktif</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span className="text-xs text-slate-400">API servisleri çevrimiçi</span>
                            </div>
                        </div>
                    </div>

                    {/* Yardım */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-200">Destek</h3>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Herhangi bir sorun yaşarsanız sistem yöneticinizle iletişime geçin.
                        </p>
                    </div>
                </div>
            </div>

            {/* Duyuru Detay Modalı */}
            {isModalOpen && selectedAnn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4">
                            <h3 className="text-base font-semibold text-white leading-snug">{selectedAnn.title}</h3>
                            <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-0.5">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-5">
                            <div className="flex items-center gap-3 mb-5 bg-slate-800/60 border border-slate-700 p-3 rounded-lg">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${selectedAnn.profiles?.role === "system_admin" ? "bg-rose-600" : "bg-indigo-600"}`}>
                                    {getSenderName(selectedAnn).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-200">{getSenderName(selectedAnn)}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {new Date(selectedAnn.created_at).toLocaleString("tr-TR")}
                                    </p>
                                </div>
                            </div>
                            <div className="text-sm text-slate-300 whitespace-pre-wrap break-words max-h-80 overflow-y-auto leading-relaxed">
                                {selectedAnn.content}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={closeModal}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
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
