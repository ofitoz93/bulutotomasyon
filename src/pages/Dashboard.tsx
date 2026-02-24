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
    const { profile } = useAuthStore();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

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

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoadingAnnouncements(true);
        try {
            // RLS will handle filtering out announcements the user shouldn't see
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
                .limit(10); // Show latest 10

            if (error) {
                console.error("Error fetching announcements:", error);
            } else if (data) {
                // @ts-ignore - Supabase types might be tricky with joins
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

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Ana Sayfa</h1>
                <p className="text-sm text-gray-500 mt-1">
                    İşletim Sistemine Hoş Geldiniz! Modüllere sol menüden erişebilirsiniz.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sol Taraf: Duyurular */}
                <div className="bg-white rounded-lg shadow border overflow-hidden">
                    <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path>
                            </svg>
                            Duyurular
                        </h2>
                    </div>

                    <div className="p-0">
                        {loadingAnnouncements ? (
                            <div className="p-8 text-center text-gray-500 text-sm">Duyurular yükleniyor...</div>
                        ) : announcements.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center">
                                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                Henüz yayınlanmış bir duyuru bulunmuyor.
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                                {announcements.map((ann) => (
                                    <li
                                        key={ann.id}
                                        onClick={() => openModal(ann)}
                                        className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-gray-900 text-md group-hover:text-indigo-600 transition-colors">{ann.title}</h3>
                                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                                {new Date(ann.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed line-clamp-2">
                                            {ann.content}
                                        </p>
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${ann.profiles?.role === 'system_admin' ? 'bg-red-500' : 'bg-indigo-500'}`}>
                                                    {getSenderName(ann).charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-medium text-gray-500">
                                                    Gönderen: <span className="text-gray-700">{getSenderName(ann)}</span>
                                                </span>
                                            </div>
                                            <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Detayları Gör &rarr;
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {profile?.role !== "system_admin" && (
                    <div className="bg-white rounded-lg shadow border overflow-hidden flex flex-col items-center justify-center p-10 text-center">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">Hızlı Erişim</h2>
                        <p className="text-sm text-gray-500 mb-6">İşlemlerinize sol menüden ilgili modülü seçerek devam edebilirsiniz.</p>
                    </div>
                )}
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
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white ${selectedAnn.profiles?.role === 'system_admin' ? 'bg-red-500' : 'bg-indigo-500'}`}>
                                    {getSenderName(selectedAnn).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{getSenderName(selectedAnn)}</p>
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
