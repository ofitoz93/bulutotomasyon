import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Clock, CheckCircle, AlertCircle, Award, FileText } from "lucide-react";

export default function CourseExamPlayer() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    const [course, setCourse] = useState<any>(null);
    const [exam, setExam] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [started, setStarted] = useState(false);
    const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> answer_id
    const [submitting, setSubmitting] = useState(false);

    const [result, setResult] = useState<any>(null);
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        if (id && profile?.id) fetchData();
    }, [id, profile]);

    useEffect(() => {
        let timer: any;
        if (started && timeLeftSeconds > 0 && !result) {
            timer = setInterval(() => {
                setTimeLeftSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleSubmitExam(true); // Auto-submit when time is up
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [started, timeLeftSeconds, result]);

    const fetchData = async () => {
        try {
            // Check if already taken
            const { data: previousResult } = await supabase
                .from("user_exam_results")
                .select("*")
                .eq("user_id", profile!.id)
            // Need to match exam_id, so we must find it first.

            // Get Course & Exam
            const { data: cData } = await supabase.from("courses").select("id, title, passing_score, start_date").eq("id", id).single();
            setCourse(cData);

            const { data: eData } = await supabase.from("course_exams").select("*").eq("course_id", id).single();
            if (!eData) {
                alert("Bu kurs için henüz sınav tanımlanmamış.");
                navigate(`/app/education/course/${id}`);
                return;
            }
            setExam(eData);

            // Check expiration
            if (cData?.start_date && eData.exam_type === 'physical_only') {
                const examDate = new Date(cData.start_date);
                // We add 24 hours to the start_date to allow users to take it until end of day/next day.
                const expiryDate = new Date(examDate.getTime() + 24 * 60 * 60 * 1000);
                if (new Date() > expiryDate) {
                    alert("Bu sınavın tarihi geçmiştir. Sınava katılım süresi dolmuştur.");
                    navigate(`/app/education`);
                    return;
                }
            }

            // Now check previous result properly
            const pRes = previousResult?.find(r => r.exam_id === eData.id);
            if (pRes) {
                alert("Bu sınava daha önce katıldınız. Yeni bir sınava girmek için farklı bir tarihli oturuma kaydolmalısınız.");
                navigate(`/app/education`);
                return; // Already completed
            }

            // Get questions
            const { data: qData } = await supabase
                .from("exam_questions")
                .select(`id, question_text, order_num, exam_answers(id, answer_text, order_num)`)
                .eq("exam_id", eData.id)
                .order("order_num", { ascending: true });

            if (qData) {
                // sort answers
                qData.forEach(q => q.exam_answers.sort((a: any, b: any) => a.order_num - b.order_num));
                setQuestions(qData);
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = () => {
        setStarted(true);
        setTimeLeftSeconds((exam?.time_limit_minutes || 0) * 60);
    };

    const handleAnswer = (qId: string, aId: string) => {
        setAnswers(prev => ({ ...prev, [qId]: aId }));
    };

    const handleSubmitExam = async (autoSubmit = false) => {
        if (!autoSubmit && !confirm("Sınavı bitirmek istediğinize emin misiniz?")) return;

        setSubmitting(true);
        try {
            // Calculate Score: 
            // We need to know which ones are correct. Easiest way is to fetch correct answers securely here.
            // (Normally done on backend via RPC, but for MVP we do it frontend).
            const { data: correctAnswers } = await supabase
                .from("exam_answers")
                .select("id, question_id")
                .eq("is_correct", true)
                .in("question_id", questions.map(q => q.id));

            let correctCount = 0;
            if (correctAnswers) {
                for (const q of questions) {
                    const userAns = answers[q.id];
                    const isCorr = correctAnswers.some(ca => ca.question_id === q.id && ca.id === userAns);
                    if (isCorr) correctCount++;
                }
            }

            const total = questions.length;
            const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
            const status = score >= course.passing_score ? 'passed' : 'failed';

            const newResult = {
                exam_id: exam.id,
                user_id: profile!.id,
                tc_no: profile!.tc_no,
                full_name: `${profile!.first_name} ${profile!.last_name}`,
                score: score,
                status: status,
                agreed: true, // we enforce agreement before start
            };

            const { data, error } = await supabase
                .from("user_exam_results")
                .insert([newResult])
                .select("*")
                .single();

            if (error) throw error;
            setResult(data);

        } catch (error) {
            console.error(error);
            alert("Sonuç kaydedilirken hata oluştu.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500 dark:text-slate-400 animate-pulse bg-slate-50 dark:bg-slate-950 min-h-[400px]">Yükleniyor...</div>;

    // View: Already completed or just finished
    if (result) {
        const isPassed = result.status === 'passed';
        return (
            <div className="max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-center transition-all">
                <div className={`p-10 pb-8 ${isPassed ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
                    <Award className={`w-20 h-20 mx-auto mb-6 ${isPassed ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
                        {isPassed ? "Tebrikler, Başarıyla Tamamladınız!" : "Maalesef Başarısız Oldunuz."}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg">Sınav sonucunuz sistemlerimize kaydedilmiştir.</p>
                </div>

                <div className="p-10">
                    <div className="flex justify-center items-center space-x-12 mb-10">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Puanınız</p>
                            <p className={`text-5xl font-black ${isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{result.score}</p>
                        </div>
                        <div className="w-px h-16 bg-slate-200 dark:bg-slate-800"></div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Geçme Notu</p>
                            <p className="text-5xl font-black text-slate-800 dark:text-slate-200">{course?.passing_score}</p>
                        </div>
                    </div>
                    <Link to="/app/education" className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition">
                        &larr; Eğitimlerim Sayfasına Dön
                    </Link>
                </div>
            </div>
        );
    }

    // View: Not started yet
    if (!started) {
        return (
            <div className="max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center transition-all">
                <FileText className="w-20 h-20 text-indigo-200 dark:text-indigo-900/40 mx-auto mb-6" />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">{course?.title} - Sınavı</h2>
                <div className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl p-6 mb-8 text-left space-y-4 border border-transparent dark:border-slate-800">
                    <p className="flex justify-between items-center"><strong className="text-slate-800 dark:text-slate-200">Soru Sayısı:</strong> <span>{questions.length}</span></p>
                    <p className="flex justify-between items-center"><strong className="text-slate-800 dark:text-slate-200">Sınav Süresi:</strong> <span>{exam?.time_limit_minutes ? `${exam.time_limit_minutes} Dakika` : 'Süresiz'}</span></p>
                    <p className="flex justify-between items-center"><strong className="text-slate-800 dark:text-slate-200">Geçme Notu:</strong> <span>{course?.passing_score} / 100</span></p>
                    {exam?.time_limit_minutes > 0 && (
                        <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center mt-4 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-100 dark:border-orange-900/20">
                            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Sınava başladıktan sonra süre durdurulamaz. Süre bittiğinde sınav otomatik sonlanır.
                        </p>
                    )}
                </div>

                {exam?.agreement_text && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/20 p-6 rounded-xl text-left mb-8">
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-500 flex items-center mb-3">
                            <AlertCircle className="w-5 h-5 mr-2" /> Taahhütname
                        </h3>
                        <p className="text-slate-700 dark:text-slate-300 italic text-sm mb-4">"{exam.agreement_text}"</p>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-1 w-5 h-5 text-indigo-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Yukarıdaki taahhütnameyi okudum, anladım ve kabul ediyorum.</span>
                        </label>
                    </div>
                )}

                <button
                    onClick={handleStart}
                    disabled={!!exam?.agreement_text && !agreed}
                    className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Sınava Başla
                </button>
            </div>
        );
    }

    // View: Exam in progress
    return (
        <div className="max-w-3xl mx-auto my-6 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-4 z-10 transition-colors">
                <h2 className="font-bold text-slate-800 dark:text-white line-clamp-1 flex-1">{course?.title}</h2>
                {exam?.time_limit_minutes > 0 && (
                    <div className="flex items-center text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg font-bold border border-orange-100 dark:border-orange-900/30 flex-shrink-0 ml-4">
                        <Clock className="w-5 h-5 mr-2" />
                        {Math.floor(timeLeftSeconds / 60)}:{String(timeLeftSeconds % 60).padStart(2, '0')}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {questions.map((q, idx) => (
                    <div key={q.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-lg">
                            <span className="text-indigo-600 dark:text-indigo-400 mr-2">{idx + 1}.</span> {q.question_text}
                        </h3>
                        <div className="space-y-3">
                            {q.exam_answers?.map((ans: any) => (
                                <label
                                    key={ans.id}
                                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition 
                                        ${answers[q.id] === ans.id
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-600 dark:ring-indigo-400'
                                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`
                                    }
                                >
                                    <input
                                        type="radio"
                                        name={`q_${q.id}`}
                                        value={ans.id}
                                        checked={answers[q.id] === ans.id}
                                        onChange={() => handleAnswer(q.id, ans.id)}
                                        className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                    <span className="ml-3 text-slate-700 dark:text-slate-300 font-medium">{ans.answer_text}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end pt-6 pb-12">
                <button
                    onClick={() => handleSubmitExam(false)}
                    disabled={submitting}
                    className="flex items-center px-10 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition disabled:opacity-50 w-full sm:w-auto justify-center"
                >
                    <CheckCircle className="w-6 h-6 mr-3" />
                    {submitting ? "Kaydediliyor..." : "Sınavı Bitir ve Gönder"}
                </button>
            </div>
        </div>
    );
}
