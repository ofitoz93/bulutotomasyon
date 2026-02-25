import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Calendar, GraduationCap, Users } from "lucide-react";

interface Course {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    passing_score: number;
    status: string;
    education_classes?: any;
}

export default function CourseManagement() {
    const { profile } = useAuthStore();
    const navigate = useNavigate();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchCourses();
        }
    }, [profile]);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("courses")
                .select(`
                    id, title, start_date, end_date, passing_score, status,
                    education_classes (
                        name,
                        education_types ( name )
                    )
                `)
                .eq("tenant_id", profile?.tenant_id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setCourses(data || []);
        } catch (error) {
            console.error("Error fetching courses:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = async () => {
        // Quick way: Navigate to a "new" route, or create a draft immediately and redirect to edit.
        // Let's create a draft right away to simplify relations.
        try {
            // But we need a class_id to create a course. So let's ask for the basic info in a modal first, or just redirect to a create form.
            navigate("/app/education/manage/new");
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="text-gray-500 p-6">Yükleniyor...</div>;

    const translateStatus = (status: string) => {
        switch (status) {
            case 'draft': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Taslak</span>;
            case 'published': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Yayında</span>;
            case 'archived': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Arşivlendi</span>;
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">Eğitim & Kurs Yönetimi</h2>
                    <p className="text-sm text-gray-500">Çalışanlar için yeni bir eğitim oluşturun, yayınlananları takip edin.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
                >
                    <Plus className="w-5 h-5 mr-1" />
                    Yeni Eğitim Oluştur
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eğitim Adı & Sınıf</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih Aralığı</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {courses.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                                    Henüz oluşturulmuş bir eğitim yok.
                                </td>
                            </tr>
                        ) : (
                            courses.map((course) => (
                                <tr key={course.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-lg">
                                                <GraduationCap className="h-6 w-6" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{course.title}</div>
                                                <div className="text-sm text-gray-500 flex items-center mt-1">
                                                    <Users className="w-3.5 h-3.5 mr-1" />
                                                    {course.education_classes?.name || "Bilinmeyen Sınıf"}
                                                    {course.education_classes?.education_types?.name && ` (${course.education_classes.education_types.name})`}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 flex items-center">
                                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                            {course.start_date ? new Date(course.start_date).toLocaleDateString("tr-TR") : "-"}
                                            <span className="mx-1 text-gray-400">/</span>
                                            {course.end_date ? new Date(course.end_date).toLocaleDateString("tr-TR") : "-"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {translateStatus(course.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link to={`/app/education/manage/${course.id}`} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition">
                                            Yönet & Düzenle
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
