import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, Save } from "lucide-react";

interface EducationClass {
    id: string;
    name: string;
    type?: any;
}

export default function NewCourseForm() {
    const { profile } = useAuthStore();
    const navigate = useNavigate();

    const [classes, setClasses] = useState<EducationClass[]>([]);
    const [loading, setLoading] = useState(false);

    // Form states
    const [title, setTitle] = useState("");
    const [classId, setClassId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [passingScore, setPassingScore] = useState("70");

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchClasses();
        }
    }, [profile]);

    const fetchClasses = async () => {
        try {
            const { data, error } = await supabase
                .from("education_classes")
                .select("id, name, type:education_types(name)")
                .eq("tenant_id", profile?.tenant_id)
                .order("name");

            if (error) throw error;
            setClasses(data || []);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !classId || !startDate || !endDate || !profile?.tenant_id) {
            alert("Lütfen tüm zorunlu alanları doldurun.");
            return;
        }

        setLoading(true);
        try {
            // Sadece kursun temel bilgilerini "draft" olarak kaydediyoruz
            const { data, error } = await supabase
                .from("courses")
                .insert([{
                    tenant_id: profile.tenant_id,
                    class_id: classId,
                    title: title,
                    start_date: new Date(startDate).toISOString(),
                    end_date: new Date(endDate).toISOString(),
                    passing_score: parseFloat(passingScore),
                    status: 'draft',
                    creator_id: profile.id
                }])
                .select("id")
                .single();

            if (error) throw error;

            // Başarıyla oluşturulduğunda datay sayfasına yönlendir (içerik ve sınav eklemek için)
            if (data?.id) {
                navigate(`/app/education/manage/${data.id}`);
            }
        } catch (error: any) {
            console.error("Error creating course:", error);
            alert("Kurs oluşturulurken bir hata oluştu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link to="/app/education/manage" className="p-2 text-gray-500 hover:text-gray-700 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Yeni Eğitim Oluştur</h2>
                        <p className="text-sm text-gray-500">Temel bilgileri girerek eğitimi taslak olarak kaydedin</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Eğitim Başlığı *</label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Örn: 2026 Yılı Temel İSG Eğitimi"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Sınıf *</label>
                            <select
                                required
                                value={classId}
                                onChange={(e) => setClassId(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                            >
                                <option value="">-- Sınıf Seçin --</option>
                                {classes.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.type?.name ? `(${c.type.name})` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Eğer uygun sınıf yoksa önce Ayarlar bölümünden yeni bir "Eğitim Sınıfı" oluşturun.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi *</label>
                                <input
                                    type="date"
                                    required
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi *</label>
                                <input
                                    type="date"
                                    required
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Geçme Notu (0-100) *</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                required
                                value={passingScore}
                                onChange={(e) => setPassingScore(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t flex justify-end">
                        <Link
                            to="/app/education/manage"
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition mr-3"
                        >
                            İptal
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || classes.length === 0}
                            className="flex items-center px-6 py-2.5 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50"
                        >
                            {loading ? "Kaydediliyor..." : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Devam Et (İçerik Ekle)
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
