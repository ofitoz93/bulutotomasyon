import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, CheckCircle2, Circle, Clock, FileText, Video, Award } from "lucide-react";

interface Material {
    id: string;
    title: string;
    order_num: number;
    content_type: 'pdf' | 'video';
    file_url: string;
    min_duration_minutes: number;
}

export default function CoursePlayer() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    const [course, setCourse] = useState<any>(null);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [progress, setProgress] = useState<any[]>([]); // list of completed material_ids
    const [loading, setLoading] = useState(true);

    const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
    const [showExam, setShowExam] = useState(false);

    // Timer logic for active material
    const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);

    useEffect(() => {
        if (id && profile?.id) {
            fetchData();
        }
    }, [id, profile]);

    useEffect(() => {
        let timer: any;
        if (activeMaterial && timeLeftSeconds > 0) {
            timer = setInterval(() => {
                setTimeLeftSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        markMaterialCompleted(activeMaterial.id);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (activeMaterial && timeLeftSeconds === 0) {
            // Already 0 when loaded, ensure it's marked
            const isCompleted = progress.find(p => p.material_id === activeMaterial.id)?.is_completed;
            if (!isCompleted) {
                markMaterialCompleted(activeMaterial.id);
            }
        }
        return () => clearInterval(timer);
    }, [activeMaterial, timeLeftSeconds]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Check if user is enrolled
            const { data: enrollment } = await supabase
                .from("course_participants")
                .select("id")
                .eq("course_id", id)
                .eq("user_id", profile!.id)
                .single();

            if (!enrollment) {
                alert("Bu eğitime katılma yetkiniz yok.");
                navigate("/app/education");
                return;
            }

            // Get Course
            const { data: cData } = await supabase
                .from("courses")
                .select("title, end_date, passing_score")
                .eq("id", id)
                .single();
            setCourse(cData);

            // Get Materials
            const { data: mData } = await supabase
                .from("course_materials")
                .select("*")
                .eq("course_id", id)
                .order("order_num", { ascending: true });
            setMaterials(mData || []);

            // Get Progress
            const { data: pData } = await supabase
                .from("user_course_progress")
                .select("*")
                .eq("course_id", id)
                .eq("user_id", profile!.id);
            setProgress(pData || []);

            // Auto-select first incomplete material, or the exam if all completed
            if (mData && mData.length > 0) {
                const pList = pData || [];
                const firstIncomplete = mData.find(m => !pList.some(p => p.material_id === m.id && p.is_completed));
                if (firstIncomplete) {
                    selectMaterial(firstIncomplete, pList);
                } else {
                    // All materials completed, show exam
                    setShowExam(true);
                }
            } else {
                // No materials? straight to exam
                setShowExam(true);
            }

        } catch (error) {
            console.error("Error fetching course data:", error);
        } finally {
            setLoading(false);
        }
    };

    const markMaterialCompleted = async (materialId: string) => {
        try {
            // check if already completed
            const already = progress.find(p => p.material_id === materialId)?.is_completed;
            if (already) return;

            await supabase.from("user_course_progress").upsert({
                course_id: id,
                user_id: profile!.id,
                material_id: materialId,
                is_completed: true,
                time_spent_seconds: activeMaterial?.min_duration_minutes ? activeMaterial.min_duration_minutes * 60 : 0
            });

            // Update local state
            setProgress(prev => [...prev, { material_id: materialId, is_completed: true }]);
        } catch (error) {
            console.error("Error saving progress:", error);
        }
    };

    const selectMaterial = (m: Material, pList = progress) => {
        setShowExam(false);
        setActiveMaterial(m);

        // Check if already completed
        const isCompleted = pList.some(p => p.material_id === m.id && p.is_completed);
        if (isCompleted) {
            setTimeLeftSeconds(0);
        } else {
            setTimeLeftSeconds(m.min_duration_minutes * 60);
        }
    };

    const allMaterialsCompleted = materials.every(m => progress.some(p => p.material_id === m.id && p.is_completed));

    const handleNext = () => {
        if (!activeMaterial) return;
        const idx = materials.findIndex(m => m.id === activeMaterial.id);
        if (idx < materials.length - 1) {
            selectMaterial(materials[idx + 1]);
        } else {
            setShowExam(true);
            setActiveMaterial(null);
        }
    };

    if (loading) return <div className="text-center p-12 text-gray-500">Eğitim yükleniyor...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <div className="flex items-center space-x-4 mb-4">
                <Link to="/app/education" className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 rounded-full shadow-lg border border-slate-800 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-white">{course?.title}</h1>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Sidebar */}
                <div className="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                        <h3 className="font-semibold text-white">Eğitim İçeriği</h3>
                        <p className="text-xs text-slate-500 mt-1">İlerleyebilmek için mevcut içeriğin süresini doldurmalısınız.</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {materials.map((m, idx) => {
                            const isCompleted = progress.some(p => p.material_id === m.id && p.is_completed);
                            const isActive = activeMaterial?.id === m.id;

                            // A material is locked if the PREVIOUS material is not completed.
                            const isLocked = idx > 0 && !progress.some(p => p.material_id === materials[idx - 1].id && p.is_completed);

                            return (
                                <button
                                    key={m.id}
                                    disabled={isLocked}
                                    onClick={() => selectMaterial(m)}
                                    className={`w-full flex items-start text-left p-3 rounded-lg transition-colors border
                                        ${isActive ? 'bg-indigo-500/10 border-indigo-500/30' : 'hover:bg-slate-800/50 border-transparent'}
                                        ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    <div className="mr-3 mt-0.5">
                                        {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-700" />}
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${isActive ? 'text-indigo-400' : 'text-slate-300'}`}>{m.order_num}. {m.title}</p>
                                        <div className="flex items-center text-xs text-slate-500 mt-1">
                                            {m.content_type === 'pdf' ? <FileText className="w-3.5 h-3.5 mr-1" /> : <Video className="w-3.5 h-3.5 mr-1" />}
                                            <span className="uppercase font-bold tracking-wider">{m.content_type}</span>
                                            {m.min_duration_minutes > 0 && <span className="ml-2 flex items-center"><Clock className="w-3 h-3 mr-0.5" /> {m.min_duration_minutes} dk</span>}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        <button
                            disabled={!allMaterialsCompleted}
                            onClick={() => { setShowExam(true); setActiveMaterial(null); }}
                            className={`w-full flex items-center p-3 rounded-lg border transition-colors mt-4
                                ${showExam ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'border-slate-800 text-slate-500'}
                                ${allMaterialsCompleted ? 'hover:bg-indigo-500/5 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
                            `}
                        >
                            <Award className={`w-5 h-5 mr-3 ${allMaterialsCompleted ? 'text-indigo-500' : 'text-slate-600'}`} />
                            <span className="font-bold uppercase text-xs tracking-widest">Değerlendirme Sınavı</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col relative">
                    {showExam ? (
                        <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
                            <div className="text-center max-w-md mx-auto">
                                <Award className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-white mb-2">Eğitimi Tamamladınız!</h2>
                                <p className="text-slate-400 mb-8">Tüm içerikleri izlediniz/okudunuz. Şimdi kurs sonu değerlendirme sınavına katılabilirsiniz. Geçme Notu: {course?.passing_score}</p>
                                <Link to={`/app/education/course/${id}/exam`} className="inline-flex items-center justify-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all">
                                    Sınava Başla
                                </Link>
                            </div>
                        </div>
                    ) : activeMaterial ? (
                        <>
                            {/* Toolbar */}
                            <div className="h-14 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between px-6">
                                <h2 className="font-medium text-slate-200 line-clamp-1">{activeMaterial.title}</h2>
                                <div className="flex items-center gap-4">
                                    {timeLeftSeconds > 0 ? (
                                        <div className="flex items-center text-amber-400 bg-amber-500/10 px-3 py-1 rounded text-sm font-medium border border-amber-500/20">
                                            <Clock className="w-4 h-4 mr-1.5" />
                                            Kalan Süre: {Math.floor(timeLeftSeconds / 60)}:{String(timeLeftSeconds % 60).padStart(2, '0')}
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded text-sm font-medium border border-emerald-500/20">
                                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Tamamlandı
                                        </div>
                                    )}
                                    <button
                                        onClick={handleNext}
                                        disabled={timeLeftSeconds > 0}
                                        className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Sonraki Adım
                                    </button>
                                </div>
                            </div>

                            {/* Embed */}
                            <div className="flex-1 bg-slate-950">
                                {activeMaterial.file_url ? (
                                    <iframe
                                        src={activeMaterial.file_url}
                                        className="w-full h-full border-0"
                                        title={activeMaterial.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        İçerik Linki Bulunamadı
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            Lütfen yandan bir içerik seçin.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
