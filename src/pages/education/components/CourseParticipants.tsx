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

    if (loading) return <div className="text-gray-500 text-sm">Katılımcı listesi yükleniyor...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Bu eğitimi alması gereken personelleri seçin.</p>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                    {saving ? "Kaydediliyor..." : "Seçimi Kaydet"}
                </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seç</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Soyad</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TC Kimlik / Sicil</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {allProfiles.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelection(p.id)}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.has(p.id)}
                                        readOnly
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {p.first_name} {p.last_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {p.tc_no || "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-3 text-sm text-gray-500">
                Toplam <span className="font-semibold text-gray-900">{selectedUserIds.size}</span> personel seçildi.
            </div>
        </div>
    );
}
