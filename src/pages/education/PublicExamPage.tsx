import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Clock, CheckCircle, AlertCircle, Award, User, ShieldCheck } from "lucide-react";

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

            const { data: cData } = await supabase.from("courses").select("id, title, passing_score, start_date").eq("id", eData.course_id).single();
            setCourse(cData);

            // Check expiration
            if (cData?.start_date && eData.exam_type === 'physical_only') {
                const examDate = new Date(cData.start_date);
                // We add 24 hours to the start_date to allow users to take it until end of day/next day.
                const expiryDate = new Date(examDate.getTime() + 24 * 60 * 60 * 1000);
                if (new Date() > expiryDate) {
                    setTcError("Bu sınavın tarihi geçmiştir. Sınava katılım süresi dolmuştur.");
                    // Keep loading false but we can render an error screen instead of login.
                    // For now, setting tcError will show it on the login screen.
                    // To completely block, maybe set step to a new error step, but setting tcError and clearing questions is enough.
                    setQuestions([]);
                    return;
                }
            }

            const { data: qData } = await supabase
                .from("exam_questions")
                .select(`id, question_text, order_num, exam_answers(id, answer_text, order_num)`)
                .eq("exam_id", eData.id)
                .order("order_num", { ascending: true });

            if (qData) {
                qData.forEach(q => q.exam_answers.sort((a: any, b: any) => a.order_num - b.order_num));
                setQuestions(qData);
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

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500">Yükleniyor...</p></div>;
    if (!exam || !course) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500">Sınav bulunamadı.</p></div>;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header (Always Visible except result) */}
                {step < 3 && (
                    <div className="text-center mb-10">
                        <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                        <h1 className="text-3xl font-extrabold text-gray-900">{course.title}</h1>
                        <p className="mt-2 text-gray-600 font-medium">Online Değerlendirme Sınavı</p>
                    </div>
                )}

                {/* Step 0: TC Control */}
                {step === 0 && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md mx-auto">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center gap-2">
                            <User className="w-6 h-6 text-indigo-500" /> Sınava Giriş Yapın
                        </h2>
                        <form onSubmit={handleTcCheck} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik veya Sicil No *</label>
                                <input
                                    type="text" required value={tcNo} onChange={e => setTcNo(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                    placeholder="Kimlik numaranız"
                                />
                            </div>

                            {tcError && (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-sm text-orange-800 mb-3">{tcError}</p>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-900 mb-1">Adınız ve Soyadınız (Misafir Girişi)</label>
                                        <input
                                            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                            className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                            placeholder="Ad Soyad"
                                        />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">
                                Doğrula ve Devam Et
                            </button>
                        </form>
                    </div>
                )}

                {/* Step 1: Info */}
                {step === 1 && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Hoş Geldiniz, {fullName}</h2>
                        <p className="text-gray-500 mb-8">{matchedProfile ? "(Şirket Personeli)" : "(Misafir / Dış Katılımcı)"}</p>

                        <div className="bg-gray-50 rounded-xl p-6 text-left space-y-4 mb-8">
                            <h3 className="font-semibold text-gray-900 border-b pb-2">Sınav Kuralları</h3>
                            <ul className="space-y-2 text-gray-600 text-sm list-disc pl-5">
                                <li>Toplam <strong>{questions.length}</strong> soru sorulacaktır.</li>
                                <li>Sınav süresi <strong>{exam.time_limit_minutes > 0 ? `${exam.time_limit_minutes} dakika` : 'süresiz'}</strong> olarak belirlenmiştir.</li>
                                <li>Başarılı olmak için geçme notu: <strong>{course.passing_score}</strong>.</li>
                                <li>Sınava başladıktan sonra sayfayı yenilemeyin veya kapatmayın.</li>
                            </ul>
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
                            className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sınavı Şimdi Başlat
                        </button>
                    </div>
                )}

                {/* Step 2: In Progress */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between sticky top-4 z-10">
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-semibold">Sınavda:</span>
                                <h3 className="font-bold text-gray-900 leading-tight">{fullName}</h3>
                            </div>
                            {exam.time_limit_minutes > 0 && (
                                <div className="flex items-center text-orange-600 bg-orange-50 px-4 py-2 rounded-lg font-bold border border-orange-100 flex-shrink-0">
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
                                                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                                />
                                                <span className="ml-3 text-gray-800 font-medium">{ans.answer_text}</span>
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
                                className="flex items-center px-10 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-xl hover:bg-indigo-700 transition disabled:opacity-50 w-full sm:w-auto justify-center"
                            >
                                <CheckCircle className="w-6 h-6 mr-3" />
                                {submitting ? "Gönderiliyor..." : "Sınavı Bitir ve Gönder"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result & Agreement */}
                {step === 3 && result && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-center">
                        <div className={`p-10 pb-8 ${result.status === 'passed' ? 'bg-green-50' : 'bg-red-50'}`}>
                            <Award className={`w-20 h-20 mx-auto mb-6 ${result.status === 'passed' ? 'text-green-500' : 'text-red-500'}`} />
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                                {result.status === 'passed' ? "Tebrikler, Başarıyla Tamamladınız!" : "Maalesef Başarısız Oldunuz."}
                            </h2>
                            <p className="text-gray-600 text-lg">Sayın {result.full_name}, sınav sonucunuz kaydedilmiştir.</p>
                        </div>

                        <div className="p-10 max-w-lg mx-auto">
                            <div className="flex justify-center items-center space-x-12 mb-10">
                                <div>
                                    <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Aldığınız Puan</p>
                                    <p className={`text-5xl font-black ${result.status === 'passed' ? 'text-green-600' : 'text-red-600'}`}>{result.score}</p>
                                </div>
                                <div className="w-px h-16 bg-gray-200"></div>
                                <div>
                                    <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Geçme Notu</p>
                                    <p className="text-5xl font-black text-gray-800">{course?.passing_score}</p>
                                </div>
                            </div>

                            <div className="text-green-600 font-medium flex justify-center items-center p-4 bg-green-50 rounded-lg">
                                <CheckCircle className="w-5 h-5 mr-2" /> İşlem tamamlanmıştır, sayfayı kapatabilirsiniz.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
