import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Rocket, Clock, CheckCircle, Search, PlayCircle } from "lucide-react";

interface Course {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    passing_score: number;
    status: string;
    education_classes?: {
        name: string;
        education_types?: {
            name: string;
        }
    };
}

export default function ActiveCourses() {
    const { profile } = useAuthStore();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.id) {
            fetchMyCourses();
        }
    }, [profile]);

    const fetchMyCourses = async () => {
        setLoading(true);
        try {
            // Fetch courses where user is a participant AND course is published
            const { data, error } = await supabase
                .from("course_participants")
                .select(`
                    course_id,
                    courses (
                        id, title, start_date, end_date, passing_score, status,
                        education_classes ( name, education_types(name) )
                    )
                `)
                .eq("user_id", profile?.id);

            if (error) throw error;

            if (data) {
                // Filter published courses
                const publishedCourses = data
                    .map((p: any) => p.courses)
                    .filter((c: any) => c && c.status === 'published');

                setCourses(publishedCourses);
            }
        } catch (error) {
            console.error("Eğitimler yüklenirken hata:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-gray-500 p-6">Eğitimleriniz yükleniyor...</div>;

    const renderCourseCard = (course: Course) => {
        return (
            <div key={course.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition group flex flex-col">
                <div className="h-32 bg-indigo-50 relative p-6">
                    <div className="absolute top-4 right-4 bg-white px-2 py-1 rounded text-xs font-semibold text-indigo-700 shadow-sm flex items-center gap-1">
                        <Rocket className="w-3 h-3" /> Aktif
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition line-clamp-2">
                        {course.title}
                    </h3>
                    <p className="text-sm text-indigo-600 mt-1 font-medium">
                        {course.education_classes?.name} {course.education_classes?.education_types?.name && `(${course.education_classes.education_types.name})`}
                    </p>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center text-sm text-gray-600">
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            Son Tarih: <span className="font-medium text-gray-900 ml-1">{new Date(course.end_date).toLocaleDateString("tr-TR")}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                            <CheckCircle className="w-4 h-4 mr-2 text-gray-400" />
                            Geçme Notu: <span className="font-medium text-gray-900 ml-1">{course.passing_score}</span>
                        </div>
                    </div>
                    <Link
                        to={`/app/education/course/${course.id}`} // We'll create this route next
                        className="w-full flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-600 hover:text-white transition"
                    >
                        <PlayCircle className="w-5 h-5 mr-2" />
                        Eğitime Başla / Devam Et
                    </Link>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Eğitimlerim</h2>
                    <p className="text-sm text-gray-500">Size atanmış online eğitimleri ve sınavları buradan takip edebilirsiniz.</p>
                </div>
            </div>

            {courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                        <Search className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Henüz Atanmış Eğitim Yok</h3>
                    <p className="text-sm text-gray-500 max-w-sm">
                        Şu anda size atanmış aktif bir eğitim bulunmuyor. Yeni bir eğitim atandığında burada listelenecektir.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(renderCourseCard)}
                </div>
            )}
        </div>
    );
}
