import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Profile {
    id: string;
    first_name: string;
    last_name: string;
    tc_no: string;
}

export default function CourseParticipants({ courseId }: { courseId: string }) {
    const { profile } = useAuthStore();
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id && courseId) {
            fetchData();
        }
    }, [profile, courseId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all active employees in the tenant
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, tc_no")
                .eq("tenant_id", profile?.tenant_id);

            if (profilesError) throw profilesError;
            setAllProfiles(profilesData || []);

            // 2. Fetch currently assigned participants
            const { data: participantsData, error: participantsError } = await supabase
                .from("course_participants")
                .select("user_id")
                .eq("course_id", courseId);

            if (participantsError) throw participantsError;

            const existingIds = new Set(participantsData?.map(p => p.user_id) || []);
            setSelectedUserIds(existingIds);
        } catch (error) {
            console.error("Error fetching participants:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (userId: string) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUserIds(newSet);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Very simple approach for now: Delete all existing, then insert new.
            // A more optimized approach would diff the arrays, but for normal company sizes this is fine.
            const { error: deleteError } = await supabase
                .from("course_participants")
                .delete()
                .eq("course_id", courseId);

            if (deleteError) throw deleteError;

            if (selectedUserIds.size > 0) {
                const inserts = Array.from(selectedUserIds).map(userId => ({
                    course_id: courseId,
                    user_id: userId
                }));

                const { error: insertError } = await supabase
                    .from("course_participants")
                    .insert(inserts);

                if (insertError) throw insertError;
            }

            alert("Katılımcılar başarıyla kaydedildi.");
        } catch (error) {
            console.error("Error saving participants:", error);
            alert("Kaydedilirken hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-slate-500 text-sm">Katılımcı listesi yükleniyor...</div>;

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Katılımcı Atama</h3>
                    <p className="text-xs text-slate-500 mt-1">Bu eğitimi alması gereken personelleri seçin.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all uppercase tracking-widest flex items-center justify-center min-w-[140px]"
                >
                    {saving ? "Kaydediliyor..." : "Seçimi Kaydet"}
                </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-2xl max-h-[500px] overflow-y-auto bg-slate-900">
                <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-md">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seç</th>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ad Soyad</th>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">TC Kimlik / Sicil</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {allProfiles.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-800/60 cursor-pointer transition-colors group" onClick={() => toggleSelection(p.id)}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.has(p.id)}
                                            readOnly
                                            className="h-4 w-4 bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 rounded transition-all cursor-pointer"
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                                    {p.first_name} {p.last_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                    {p.tc_no || "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-xs text-slate-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                Toplam <span className="font-bold text-slate-300">{selectedUserIds.size}</span> personel seçildi.
            </div>
        </div>
    );
}
