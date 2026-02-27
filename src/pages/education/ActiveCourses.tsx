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

    if (loading) return (
        <div className="flex items-center justify-center gap-3 p-12">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-500 text-sm">Eğitimleriniz yükleniyor...</span>
        </div>
    );

    const renderCourseCard = (course: Course) => {
        return (
            <div key={course.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group flex flex-col">
                <div className="h-32 bg-gradient-to-br from-indigo-900/50 to-violet-900/50 relative p-5 border-b border-slate-800">
                    <div className="absolute top-3 right-3 bg-indigo-500/20 border border-indigo-500/30 px-2 py-1 rounded-full text-xs font-semibold text-indigo-300 flex items-center gap-1">
                        <Rocket className="w-3 h-3" /> Aktif
                    </div>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 mt-1">
                        {course.title}
                    </h3>
                    <p className="text-xs text-indigo-400 mt-1.5 font-medium">
                        {course.education_classes?.name} {course.education_classes?.education_types?.name && `(${course.education_classes.education_types.name})`}
                    </p>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5 mb-5">
                        <div className="flex items-center text-sm text-slate-400">
                            <Clock className="w-4 h-4 mr-2 text-slate-500" />
                            Son Tarih: <span className="font-medium text-slate-200 ml-1">{new Date(course.end_date).toLocaleDateString("tr-TR")}</span>
                        </div>
                        <div className="flex items-center text-sm text-slate-400">
                            <CheckCircle className="w-4 h-4 mr-2 text-slate-500" />
                            Geçme Notu: <span className="font-medium text-slate-200 ml-1">{course.passing_score}</span>
                        </div>
                    </div>
                    <Link
                        to={`/app/education/course/${course.id}`}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-600 text-indigo-300 hover:text-white font-medium rounded-lg transition-all text-sm"
                    >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Eğitime Başla / Devam Et
                    </Link>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white">Eğitimlerim</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Size atanmış online eğitimleri ve sınavları buradan takip edebilirsiniz.</p>
                </div>
            </div>

            {courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900 border border-dashed border-slate-700 rounded-xl">
                    <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mb-4">
                        <Search className="w-7 h-7 text-slate-600" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-300 mb-1">Henüz Atanmış Eğitim Yok</h3>
                    <p className="text-sm text-slate-500 max-w-sm">
                        Şu anda size atanmış aktif bir eğitim bulunmuyor. Yeni bir eğitim atandığında burada listelenecektir.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courses.map(renderCourseCard)}
                </div>
            )}
        </div>
    );
}
