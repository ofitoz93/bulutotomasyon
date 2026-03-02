import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Users, FileText, Settings, Rocket, BarChart2 } from "lucide-react";
import CourseParticipants from "./components/CourseParticipants";
import CourseContent from "./components/CourseContent";
import CourseExam from "./components/CourseExam";
import CourseReport from "./components/CourseReport";

export default function CourseDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [course, setCourse] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("info");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchCourse();
    }, [id]);

    const fetchCourse = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("courses")
                .select(`
                    *,
                    education_classes ( name, education_types(name) )
                `)
                .eq("id", id)
                .single();

            if (error) throw error;
            setCourse(data);
        } catch (error) {
            console.error("Error fetching course:", error);
            alert("Kurs bilgileri alınamadı.");
            navigate("/app/education/manage");
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm("Bu eğitimi yayınlamak istediğinize emin misiniz? Yayınlandıktan sonra katılımcılar eğitimleri görebilir.")) return;

        try {
            const { error } = await supabase
                .from("courses")
                .update({ status: 'published' })
                .eq("id", id);

            if (error) throw error;
            setCourse({ ...course, status: 'published' });
            alert("Eğitim başarıyla yayınlandı!");
        } catch (error) {
            console.error(error);
            alert("Yayınlama sırasında hata oluştu.");
        }
    };

    if (loading || !course) return <div className="p-6 text-slate-500">Yükleniyor...</div>;

    const tabs = [
        { id: "info", name: "Genel Bilgiler", icon: Settings },
        { id: "participants", name: "Katılımcılar", icon: Users },
        { id: "content", name: "Müfredat & İçerik", icon: BookOpen },
        { id: "exam", name: "Sınav Soruları", icon: FileText },
        { id: "reports", name: "Raporlar", icon: BarChart2 },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Link to="/app/education/manage" className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 rounded-full shadow-lg border border-slate-800 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-xl font-bold text-white">{course.title}</h2>
                            {course.status === 'draft' && <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-xs font-semibold border border-slate-700">Taslak</span>}
                            {course.status === 'published' && <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded text-xs font-semibold border border-emerald-500/30">Yayında</span>}
                            {course.status === 'archived' && <span className="bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded text-xs font-semibold border border-amber-500/30">Arşivli</span>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {course.education_classes?.name} {course.education_classes?.education_types?.name && `(${course.education_classes.education_types.name})`}
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    {course.status === 'draft' && (
                        <button
                            onClick={handlePublish}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition shadow-sm"
                        >
                            <Rocket className="w-4 h-4 mr-2" />
                            Eğitimi Yayınla
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 overflow-hidden">
                <div className="flex border-b border-slate-800 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                                    : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                    }`}
                            >
                                <Icon className={`w-4 h-4 mr-2 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                                {tab.name}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6 min-h-[400px]">
                    {activeTab === "info" && (
                        <div className="max-w-2xl">
                            <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-indigo-400" />
                                Eğitim Detayları
                            </h3>
                            <div className="grid grid-cols-2 gap-y-8 gap-x-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Başlangıç Tarihi</label>
                                    <p className="text-sm text-slate-200 font-medium">{new Date(course.start_date).toLocaleDateString("tr-TR")}</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Bitiş Tarihi</label>
                                    <p className="text-sm text-slate-200 font-medium">{new Date(course.end_date).toLocaleDateString("tr-TR")}</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Geçme Notu</label>
                                    <p className="text-sm text-slate-200 font-medium">{course.passing_score} Puan</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Durum</label>
                                    <p className="text-sm text-slate-200 font-medium">{course.status === 'draft' ? "Taslak" : course.status === 'published' ? "Yayında" : "Arşiv"}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "participants" && (
                        <CourseParticipants courseId={course.id} />
                    )}

                    {activeTab === "content" && (
                        <CourseContent courseId={course.id} />
                    )}

                    {activeTab === "exam" && (
                        <CourseExam courseId={course.id} />
                    )}

                    {activeTab === "reports" && (
                        <CourseReport courseId={course.id} />
                    )}
                </div>
            </div>
        </div>
    );
}
