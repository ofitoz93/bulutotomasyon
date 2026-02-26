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

    if (loading) return <div className="p-12 text-center text-gray-500">Yükleniyor...</div>;

    // View: Already completed or just finished
    if (result) {
        const isPassed = result.status === 'passed';
        return (
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden text-center">
                <div className={`p-8 pb-6 ${isPassed ? 'bg-green-50' : 'bg-red-50'}`}>
                    <Award className={`w-16 h-16 mx-auto mb-4 ${isPassed ? 'text-green-500' : 'text-red-500'}`} />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {isPassed ? "Tebrikler, Başarıyla Tamamladınız!" : "Maalesef Başarısız Oldunuz."}
                    </h2>
                    <p className="text-gray-600">Sınav sonucunuz sistemlerimize kaydedilmiştir.</p>
                </div>

                <div className="p-8">
                    <div className="flex justify-center items-center space-x-8 mb-8">
                        <div>
                            <p className="text-sm text-gray-500 uppercase tracking-wide">Puanınız</p>
                            <p className={`text-3xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>{result.score}</p>
                        </div>
                        <div className="w-px h-12 bg-gray-200"></div>
                        <div>
                            <p className="text-sm text-gray-500 uppercase tracking-wide">Geçme Notu</p>
                            <p className="text-3xl font-bold text-gray-800">{course?.passing_score}</p>
                        </div>
                        <Link to="/app/education" className="text-indigo-600 hover:text-indigo-800 font-medium">
                            &larr; Eğitimlerim Sayfasına Dön
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // View: Not started yet
    if (!started) {
        return (
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <FileText className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{course?.title} - Sınavı</h2>
                <div className="bg-gray-50 text-gray-600 rounded-xl p-6 mb-8 text-left space-y-3">
                    <p><strong>Soru Sayısı:</strong> {questions.length}</p>
                    <p><strong>Sınav Süresi:</strong> {exam?.time_limit_minutes ? `${exam.time_limit_minutes} Dakika` : 'Süresiz'}</p>
                    <p><strong>Geçme Notu:</strong> {course?.passing_score} / 100</p>
                    {exam?.time_limit_minutes > 0 && (
                        <p className="text-sm text-red-600 flex items-center mt-2">
                            <AlertCircle className="w-4 h-4 mr-1" /> Sınava başladıktan sonra süre durdurulamaz. Süre bittiğinde sınav otomatik sonlanır.
                        </p>
                    )}
                </div>

                {exam?.agreement_text && (
                    <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-left mb-8">
                        <h3 className="font-bold text-yellow-800 flex items-center mb-3">
                            <AlertCircle className="w-5 h-5 mr-2" /> Taahhütname
                        </h3>
                        <p className="text-gray-700 italic text-sm mb-4">"{exam.agreement_text}"</p>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-gray-800">Yukarıdaki taahhütnameyi okudum, anladım ve kabul ediyorum.</span>
                        </label>
                    </div>
                )}

                <button
                    onClick={handleStart}
                    disabled={!!exam?.agreement_text && !agreed}
                    className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Sınava Başla
                </button>
            </div>
        );
    }

    // View: Exam in progress
    return (
        <div className="max-w-3xl mx-auto my-6 space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between sticky top-4 z-10">
                <h2 className="font-bold text-gray-800 line-clamp-1 flex-1">{course?.title}</h2>
                {exam?.time_limit_minutes > 0 && (
                    <div className="flex items-center text-orange-600 bg-orange-50 px-4 py-2 rounded-lg font-bold border border-orange-100 flex-shrink-0 ml-4">
                        <Clock className="w-5 h-5 mr-2" />
                        {Math.floor(timeLeftSeconds / 60)}:{String(timeLeftSeconds % 60).padStart(2, '0')}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {questions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-4 text-lg">
                            <span className="text-indigo-600 mr-2">{idx + 1}.</span> {q.question_text}
                        </h3>
                        <div className="space-y-3">
                            {q.exam_answers?.map((ans: any) => (
                                <label
                                    key={ans.id}
                                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition 
                                        ${answers[q.id] === ans.id ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-gray-200 hover:bg-gray-50'}`
                                    }
                                >
                                    <input
                                        type="radio"
                                        name={`q_${q.id}`}
                                        value={ans.id}
                                        checked={answers[q.id] === ans.id}
                                        onChange={() => handleAnswer(q.id, ans.id)}
                                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="ml-3 text-gray-700">{ans.answer_text}</span>
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
                    className="flex items-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {submitting ? "Kaydediliyor..." : "Sınavı Bitir ve Gönder"}
                </button>
            </div>
        </div>
    );
}
