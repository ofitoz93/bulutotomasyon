import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Clock, CheckCircle, AlertCircle, Award, User, ShieldCheck } from "lucide-react";

// Helper function to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

export default function PublicExamPage() {
    const { id } = useParams<{ id: string }>(); // This is courseId or examId? Let's use examId

    const [loading, setLoading] = useState(true);
    const [exam, setExam] = useState<any>(null);
    const [course, setCourse] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);

    // Step Management: 0=TC Check, 1=Info/Start, 2=In-progress, 3=Result
    const [step, setStep] = useState(0);

    // User Data
    const [tcNo, setTcNo] = useState("");
    const [fullName, setFullName] = useState("");
    const [matchedProfile, setMatchedProfile] = useState<any>(null);
    const [tcError, setTcError] = useState("");

    // Exam State
    const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [agreed, setAgreed] = useState(false);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (id) fetchExamData();
    }, [id]);

    useEffect(() => {
        let timer: any;
        if (step === 2 && timeLeftSeconds > 0 && !result) {
            timer = setInterval(() => {
                setTimeLeftSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleSubmitExam(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [step, timeLeftSeconds, result]);

    const fetchExamData = async () => {
        try {
            const { data: eData } = await supabase.from("course_exams").select("*").eq("id", id).single();
            if (!eData) {
                alert("Sınav bulunamadı veya link hatalı.");
                return;
            }
            setExam(eData);

            const { data: cData } = await supabase.from("courses").select("id, title, passing_score, start_date, end_date").eq("id", eData.course_id).single();
            setCourse(cData);

            // Check expiration
            if (cData?.end_date && eData.exam_type === 'physical_only') {
                const expiryDate = new Date(cData.end_date);
                if (new Date() > expiryDate) {
                    setIsExpired(true);
                    setLoading(false);
                    return;
                }
            }

            const { data: qData } = await supabase
                .from("exam_questions")
                .select(`id, question_text, order_num, exam_answers(id, answer_text, order_num)`)
                .eq("exam_id", eData.id)
                .order("order_num", { ascending: true });

            if (qData) {
                // Her sorunun kendi içindeki şıklarını karıştır
                qData.forEach(q => {
                    q.exam_answers = shuffleArray([...(q.exam_answers || [])]);
                });

                // Soruların dizilimini de karıştır
                const shuffledQuestions = shuffleArray(qData);
                setQuestions(shuffledQuestions);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleTcCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setTcError("");
        if (!tcNo || tcNo.length < 5) {
            setTcError("Lütfen geçerli bir TC veya Sicil no giriniz.");
            return;
        }

        try {
            // Check if user already took this exam
            const { data: existingResult } = await supabase
                .from("user_exam_results")
                .select("id")
                .eq("exam_id", exam.id)
                .eq("tc_no", tcNo)
                .limit(1)
                .single();

            if (existingResult) {
                setTcError("Bu sınava daha önce katıldınız. Yeni bir sınava girmek için farklı bir tarihli oturuma kaydolmalısınız.");
                return;
            }

            // Arama yap:
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .or(`tc_no.eq.${tcNo},company_employee_no.eq.${tcNo}`)
                .limit(1)
                .single();

            if (profileData) {
                setMatchedProfile(profileData);
                setFullName(`${profileData.first_name} ${profileData.last_name}`);
                setStep(1);
            } else {
                // Not found, maybe external user
                if (!fullName) {
                    setTcError("Sistemde kaydınız bulunamadı. Lütfen Adınızı ve Soyadınızı girerek Misafir olarak devam edin.");
                    // In UI we will reveal Full Name input
                } else {
                    setStep(1); // Proceed as guest
                }
            }
        } catch (error) {
            console.error(error);
            // Ignore error and act as guest if full name is provided
            if (fullName) setStep(1);
            else setTcError("Kayıt bulunamadı. Şirket dışı iseniz Ad Soyad giriniz.");
        }
    };

    const handleStart = () => {
        setStep(2);
        setTimeLeftSeconds((exam?.time_limit_minutes || 0) * 60);
    };

    const handleAnswer = (qId: string, aId: string) => {
        setAnswers(prev => ({ ...prev, [qId]: aId }));
    };

    const handleSubmitExam = async (autoSubmit = false) => {
        if (!autoSubmit && !confirm("Sınavı bitirmek istediğinize emin misiniz?")) return;

        setSubmitting(true);
        try {
            const { data: correctAnswers } = await supabase
                .from("exam_answers")
                .select("id, question_id")
                .eq("is_correct", true)
                .in("question_id", questions.map(q => q.id));

            let correctCount = 0;
            if (correctAnswers) {
                for (const q of questions) {
                    const userAns = answers[q.id];
                    if (correctAnswers.some(ca => ca.question_id === q.id && ca.id === userAns)) {
                        correctCount++;
                    }
                }
            }

            const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
            const status = score >= course.passing_score ? 'passed' : 'failed';

            const newResult = {
                exam_id: exam.id,
                user_id: matchedProfile ? matchedProfile.id : null,
                tc_no: tcNo,
                full_name: fullName,
                score: score,
                status: status,
                agreed: true // We enforce agreement before starting now
            };

            const { data, error } = await supabase.from("user_exam_results").insert([newResult]).select("*").single();

            if (error) throw error;
            setResult(data);
            setStep(3);

        } catch (error) {
            console.error(error);
            alert("Sınav sonucu kaydedilirken hata oluştu.");
        } finally {
            setSubmitting(false);
        }
    };

    // Deprecated: Agreement is now handled before start
    const handleAgree = async () => { };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><p className="text-slate-500 dark:text-slate-400 animate-pulse">Yükleniyor...</p></div>;
    if (isExpired) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-rose-100 dark:border-slate-800 max-w-md text-center">
                <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Süresi Dolmuş Sınav</h2>
                <p className="text-slate-500 dark:text-slate-400 text-lg">Bu sınavın veya eğitimin tarihi geçmiştir. Katılıma kapatılmıştır.</p>
            </div>
        </div>
    );
    if (!exam || !course) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><p className="text-slate-500 dark:text-slate-400">Sınav bulunamadı.</p></div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-3xl mx-auto">
                {/* Header (Always Visible except result) */}
                {step < 3 && (
                    <div className="text-center mb-10">
                        <ShieldCheck className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{course.title}</h1>
                        <p className="mt-2 text-slate-600 dark:text-slate-400 font-medium">Online Değerlendirme Sınavı</p>
                    </div>
                )}

                {/* Step 0: TC Control */}
                {step === 0 && (
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md mx-auto">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-center gap-2">
                            <User className="w-6 h-6 text-indigo-500 dark:text-indigo-400" /> Sınava Giriş Yapın
                        </h2>
                        <form onSubmit={handleTcCheck} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">TC Kimlik veya Sicil No *</label>
                                <input
                                    type="text" required value={tcNo} onChange={e => setTcNo(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg text-slate-900 dark:text-white"
                                    placeholder="Kimlik numaranız"
                                />
                            </div>

                            {tcError && (
                                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-lg">
                                    <p className="text-sm text-orange-800 dark:text-orange-400 mb-3">{tcError}</p>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-900 dark:text-orange-300 mb-1">Adınız ve Soyadınız (Misafir Girişi)</label>
                                        <input
                                            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                            className="w-full px-4 py-2 border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500"
                                            placeholder="Ad Soyad"
                                        />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg shadow-indigo-600/20 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-950 transition">
                                Doğrula ve Devam Et
                            </button>
                        </form>
                    </div>
                )}

                {/* Step 1: Info */}
                {step === 1 && (
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Hoş Geldiniz, {fullName}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">{matchedProfile ? "(Şirket Personeli)" : "(Misafir / Dış Katılımcı)"}</p>

                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 text-left space-y-4 mb-8">
                            <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Sınav Kuralları</h3>
                            <ul className="space-y-2 text-slate-600 dark:text-slate-400 text-sm list-disc pl-5">
                                <li>Toplam <strong>{questions.length}</strong> soru sorulacaktır.</li>
                                <li>Sınav süresi <strong>{exam.time_limit_minutes > 0 ? `${exam.time_limit_minutes} dakika` : 'süresiz'}</strong> olarak belirlenmiştir.</li>
                                <li>Başarılı olmak için geçme notu: <strong>{course.passing_score}</strong>.</li>
                                <li>Sınava başladıktan sonra sayfayı yenilemeyin veya kapatmayın.</li>
                            </ul>
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
                            className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sınavı Şimdi Başlat
                        </button>
                    </div>
                )}

                {/* Step 2: In Progress */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-4 z-10 transition-colors">
                            <div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Sınavda:</span>
                                <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{fullName}</h3>
                            </div>
                            {exam.time_limit_minutes > 0 && (
                                <div className="flex items-center text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg font-bold border border-orange-100 dark:border-orange-900/30 flex-shrink-0">
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
                                                <span className="ml-3 text-slate-800 dark:text-slate-200 font-medium">{ans.answer_text}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center pt-8 pb-16">
                            <button
                                onClick={() => handleSubmitExam(false)}
                                disabled={submitting}
                                className="flex items-center px-10 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition disabled:opacity-50 w-full sm:w-auto justify-center"
                            >
                                <CheckCircle className="w-6 h-6 mr-3" />
                                {submitting ? "Gönderiliyor..." : "Sınavı Bitir ve Gönder"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result & Agreement */}
                {step === 3 && result && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-center transition-all">
                        <div className={`p-10 pb-8 ${result.status === 'passed' ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
                            <Award className={`w-20 h-20 mx-auto mb-6 ${result.status === 'passed' ? 'text-emerald-500' : 'text-rose-500'}`} />
                            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
                                {result.status === 'passed' ? "Tebrikler, Başarıyla Tamamladınız!" : "Maalesef Başarısız Oldunuz."}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">Sayın {result.full_name}, sınav sonucunuz kaydedilmiştir.</p>
                        </div>

                        <div className="p-10 max-w-lg mx-auto">
                            <div className="flex justify-center items-center space-x-12 mb-10">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Aldığınız Puan</p>
                                    <p className={`text-6xl font-black ${result.status === 'passed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{result.score}</p>
                                </div>
                                <div className="w-px h-16 bg-slate-200 dark:bg-slate-800"></div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Geçme Notu</p>
                                    <p className="text-6xl font-black text-slate-800 dark:text-slate-200">{course?.passing_score}</p>
                                </div>
                            </div>

                            <div className="text-emerald-600 dark:text-emerald-400 font-bold flex justify-center items-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                <CheckCircle className="w-5 h-5 mr-3" /> İşlem tamamlanmıştır, sayfayı kapatabilirsiniz.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
