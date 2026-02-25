import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, CheckCircle2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function CourseExam({ courseId }: { courseId: string }) {
    const [exam, setExam] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Exam Config
    const [timeLimit, setTimeLimit] = useState(30);
    const [examType, setExamType] = useState('final_test');
    const [agreementText, setAgreementText] = useState("Okudum, anladım ve kabul ediyorum.");

    // New Question Form
    const [addingQ, setAddingQ] = useState(false);
    const [qText, setQText] = useState("");
    const [answers, setAnswers] = useState([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false }
    ]);

    // Print Ref
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (courseId) fetchExamData();
    }, [courseId]);

    const examLink = exam?.id ? `${window.location.origin}/public/exam/${exam.id}` : "";

    const handlePrintQRCode = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Sınav QR Kodu</title>
                    <style>
                        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .container { text-align: center; border: 2px solid #000; padding: 40px; border-radius: 20px; }
                        h1 { margin-bottom: 20px; font-size: 24px; }
                        .url { margin-top: 20px; font-size: 14px; color: #555; word-break: break-all; max-width: 300px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Sınav Giriş QR Kodu</h1>
                        ${content.innerHTML}
                        <div class="url">${examLink}</div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const fetchExamData = async () => {
        setLoading(true);
        try {
            // Get exam config
            const { data: examData } = await supabase
                .from("course_exams")
                .select("*")
                .eq("course_id", courseId)
                .single();

            if (examData) {
                setExam(examData);
                setTimeLimit(examData.time_limit_minutes || 0);
                setExamType(examData.exam_type);
                setAgreementText(examData.agreement_text || "");

                // Get questions with answers
                const { data: qData } = await supabase
                    .from("exam_questions")
                    .select(`*, exam_answers(*)`)
                    .eq("exam_id", examData.id)
                    .order("order_num", { ascending: true });

                // Sort answers inside questions (optional, but good for UX)
                if (qData) {
                    qData.forEach(q => {
                        if (q.exam_answers) q.exam_answers.sort((a: any, b: any) => a.order_num - b.order_num);
                    });
                    setQuestions(qData);
                }
            } else {
                setExam(null);
                setQuestions([]);
            }
        } catch (error) {
            console.error("Error fetching exam:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (exam) {
                // Update
                await supabase.from("course_exams").update({
                    time_limit_minutes: timeLimit,
                    exam_type: examType,
                    agreement_text: agreementText
                }).eq("id", exam.id);
            } else {
                // Insert
                await supabase.from("course_exams").insert([{
                    course_id: courseId,
                    time_limit_minutes: timeLimit,
                    exam_type: examType,
                    agreement_text: agreementText
                }]);
            }
            alert("Sınav ayarları kaydedildi.");
            fetchExamData();
        } catch (error) {
            console.error(error);
            alert("Hata oluştu.");
        }
    };

    const handleAddQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!exam) return alert("Önce sınav ayarlarını kaydetmelisiniz!");
        if (!qText.trim()) return alert("Soru metni boş olamaz.");

        const hasCorrect = answers.some(a => a.isCorrect && a.text.trim());
        if (!hasCorrect) return alert("En az bir doğru cevap belirlemelisiniz!");

        setAddingQ(true);
        try {
            const newOrder = questions.length + 1;

            // Insert Question
            const { data: newQ, error: qErr } = await supabase
                .from("exam_questions")
                .insert([{ exam_id: exam.id, question_text: qText, order_num: newOrder }])
                .select("id")
                .single();

            if (qErr) throw qErr;

            // Insert Answers
            const ansInserts = answers
                .filter(a => a.text.trim()) // only non-empty
                .map((a, i) => ({
                    question_id: newQ.id,
                    answer_text: a.text,
                    is_correct: a.isCorrect,
                    order_num: i + 1
                }));

            if (ansInserts.length > 0) {
                await supabase.from("exam_answers").insert(ansInserts);
            }

            // reset form
            setQText("");
            setAnswers([
                { text: "", isCorrect: true },
                { text: "", isCorrect: false },
                { text: "", isCorrect: false },
                { text: "", isCorrect: false }
            ]);

            fetchExamData();
        } catch (error) {
            console.error(error);
            alert("Soru eklenirken hata.");
        } finally {
            setAddingQ(false);
        }
    };

    const handleDeleteQuestion = async (qId: string) => {
        if (!confirm("Sorguyu silmek istediğinize emin misiniz? (Cevaplar da silinecek)")) return;
        try {
            await supabase.from("exam_questions").delete().eq("id", qId);
            fetchExamData();
        } catch (error) {
            console.error(error);
        }
    };

    const updateAnswer = (index: number, field: string, value: any) => {
        const newArr = [...answers];
        if (field === 'isCorrect' && value === true) {
            // Make others false (Single choice mode)
            newArr.forEach(a => a.isCorrect = false);
        }
        (newArr[index] as any)[field] = value;
        setAnswers(newArr);
    };

    if (loading) return <div className="text-gray-500 text-sm">Sınav bilgileri yükleniyor...</div>;

    return (
        <div className="space-y-8">

            {/* Exam Config */}
            <form onSubmit={handleSaveConfig} className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b">Sınav Ayarları</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sınav Tipi</label>
                        <select
                            value={examType} onChange={e => setExamType(e.target.value)}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="final_test">Kurs Sonu Sınavı (Final Test)</option>
                            <option value="pre_test">Ön Değerlendirme (Pre Test)</option>
                            <option value="physical_only">Sadece Sınav (Online Kurssuz)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sınav Süresi (Dakika)</label>
                        <input
                            type="number" min="0" required value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Süre bitiğinde sınav otomatik sonlanır. 0 = Süresiz</p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sınav Sonu Taahhütname (Kullanıcı onaylayacak)</label>
                        <textarea
                            rows={3} required value={agreementText} onChange={e => setAgreementText(e.target.value)}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Eğitimi aldığımı, anladığımı ve uygulayacağımı taahhüt ederim."
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    {exam && examLink && (
                        <div className="flex items-center gap-4 bg-white p-3 rounded border border-gray-200 shadow-sm">
                            <div ref={printRef} className="bg-white p-1 rounded">
                                <QRCodeSVG value={examLink} size={64} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-800 mb-1">Dış Sınav Linki (QR)</p>
                                <button type="button" onClick={handlePrintQRCode} className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center bg-indigo-50 px-2 py-1 rounded">
                                    <QrCode className="w-3 h-3 mr-1" /> QR Yazdır
                                </button>
                            </div>
                        </div>
                    )}
                    <button type="submit" className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900 shadow transition ml-auto flex-shrink-0">
                        Ayarları Kaydet
                    </button>
                </div>
            </form>

            <hr className="border-gray-200" />

            {/* Questions List & Add */}
            {exam ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Add Question Form */}
                    <div className="lg:col-span-1">
                        <form onSubmit={handleAddQuestion} className="bg-white p-5 rounded-lg border border-indigo-100 shadow-sm sticky top-6">
                            <h3 className="text-sm font-semibold text-indigo-900 mb-4">Yeni Soru Ekle</h3>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Soru Metni</label>
                                <textarea
                                    required rows={3} value={qText} onChange={e => setQText(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Soru metni..."
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Şıklar (Doğru cevabı işaretleyin)</label>
                                {answers.map((ans, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="radio" name="correct_answer"
                                            checked={ans.isCorrect}
                                            onChange={() => updateAnswer(idx, 'isCorrect', true)}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <input
                                            type="text" value={ans.text} onChange={e => updateAnswer(idx, 'text', e.target.value)}
                                            placeholder={`${String.fromCharCode(65 + idx)} Şıkkı`}
                                            className={`flex-1 px-3 py-1.5 text-sm border rounded ${ans.isCorrect ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                            required={idx < 2} // İlk iki şık zorunlu olsun
                                        />
                                    </div>
                                ))}
                            </div>

                            <button type="submit" disabled={addingQ} className="w-full mt-6 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 transition">
                                <Plus className="w-4 h-4 mr-1" /> {addingQ ? "Ekleniyor..." : "Soruyu Kaydet"}
                            </button>
                        </form>
                    </div>

                    {/* Questions List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2">Eklenen Sorular ({questions.length})</h3>

                        {questions.length === 0 ? (
                            <div className="text-sm text-gray-500 italic p-4 text-center border border-dashed rounded bg-gray-50">Henüz soru eklenmedi.</div>
                        ) : (
                            questions.map((q, idx) => (
                                <div key={q.id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="text-sm font-medium text-gray-900"><span className="text-indigo-600 mr-1">{idx + 1}.</span> {q.question_text}</h4>
                                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-400 hover:text-red-600 ml-2">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                        {q.exam_answers?.map((a: any) => (
                                            <div key={a.id} className={`text-xs p-2 rounded border ${a.is_correct ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                                                <div className="flex items-start">
                                                    {a.is_correct && <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-600 flex-shrink-0" />}
                                                    <span>{a.answer_text}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500 text-sm">
                    Soru eklemek için önce lütfen üstteki sınav ayarlarını kaydedin.
                </div>
            )}

        </div>
    );
}
