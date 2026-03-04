import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, CheckCircle2, X } from "lucide-react";

interface Props {
    classId: string;
    className: string;
    onClose: () => void;
}

const DRAFT_KEY = "class_q_modal_draft";

const DEFAULT_ANSWERS = [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false }
];

function loadDraft(classId: string): { qText: string; answers: typeof DEFAULT_ANSWERS } | null {
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Her sınıfa ait ayrı taslak tut
        if (parsed.classId !== classId) return null;
        return { qText: parsed.qText, answers: parsed.answers };
    } catch {
        return null;
    }
}

function saveDraft(classId: string, qText: string, answers: typeof DEFAULT_ANSWERS) {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ classId, qText, answers }));
}

function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
}

export default function ClassQuestionManagerModal({ classId, className, onClose }: Props) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingQ, setAddingQ] = useState(false);

    // Taslağı sessionStorage'dan geri yükle
    const draft = loadDraft(classId);
    const [qText, setQText] = useState(draft?.qText ?? "");
    const [answers, setAnswers] = useState(draft?.answers ?? DEFAULT_ANSWERS);

    // Her değişiklikte taslağı sessionStorage'a kaydet
    useEffect(() => {
        saveDraft(classId, qText, answers);
    }, [qText, answers, classId]);

    useEffect(() => {
        fetchQuestions();
    }, [classId]);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const { data: qData } = await supabase
                .from("class_question_templates")
                .select(`*, class_answer_templates(*)`)
                .eq("class_id", classId)
                .order("order_num", { ascending: true });

            if (qData) {
                qData.forEach(q => {
                    if (q.class_answer_templates) q.class_answer_templates.sort((a: any, b: any) => a.order_num - b.order_num);
                });
                setQuestions(qData);
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qText.trim()) return alert("Soru metni boş olamaz.");

        const hasCorrect = answers.some(a => a.isCorrect && a.text.trim());
        if (!hasCorrect) return alert("En az bir doğru cevap belirlemelisiniz!");

        setAddingQ(true);
        try {
            const newOrder = questions.length + 1;

            const { data: newQ, error: qErr } = await supabase
                .from("class_question_templates")
                .insert([{ class_id: classId, question_text: qText, order_num: newOrder }])
                .select("id")
                .single();

            if (qErr) throw qErr;

            const ansInserts = answers
                .filter(a => a.text.trim())
                .map((a, i) => ({
                    question_template_id: newQ.id,
                    answer_text: a.text,
                    is_correct: a.isCorrect,
                    order_num: i + 1
                }));

            if (ansInserts.length > 0) {
                await supabase.from("class_answer_templates").insert(ansInserts);
            }

            // Başarılı kayıt sonrası taslağı temizle ve formu sıfırla
            clearDraft();
            setQText("");
            setAnswers(DEFAULT_ANSWERS);
            fetchQuestions();
        } catch (error) {
            console.error(error);
            alert("Soru eklenirken hata.");
        } finally {
            setAddingQ(false);
        }
    };

    const handleDeleteQuestion = async (qId: string) => {
        if (!confirm("Bu şablon soruyu silmek istediğinize emin misiniz? (Cevaplar da silinecek)")) return;
        try {
            await supabase.from("class_question_templates").delete().eq("id", qId);
            fetchQuestions();
        } catch (error) {
            console.error(error);
        }
    };

    const updateAnswer = useCallback((index: number, field: string, value: any) => {
        setAnswers(prev => {
            const newArr = prev.map(a => ({ ...a }));
            if (field === 'isCorrect' && value === true) {
                newArr.forEach(a => a.isCorrect = false);
            }
            (newArr[index] as any)[field] = value;
            return newArr;
        });
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">{className}</h2>
                        <p className="text-sm text-slate-400 mt-1">Sınıfa Özel Sınav Soru Havuzu Şablonları</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow flex flex-col lg:flex-row gap-8">

                    {/* Add Form */}
                    <div className="lg:w-1/3">
                        <form onSubmit={handleAddQuestion} className="bg-slate-800/50 p-5 rounded-lg border border-slate-700 sticky top-0">
                            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                                <Plus className="w-4 h-4 text-emerald-400" />
                                Havuza Soru Ekle
                            </h3>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Soru Metni</label>
                                <textarea
                                    required rows={3} value={qText} onChange={e => setQText(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                                    placeholder="Soru metni..."
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Şıklar (Doğru cevabı işaretleyin)</label>
                                {answers.map((ans, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <input
                                            type="radio" name="correct_answer"
                                            checked={ans.isCorrect}
                                            onChange={() => updateAnswer(idx, 'isCorrect', true)}
                                            className="w-4 h-4 text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                                        />
                                        <input
                                            type="text" value={ans.text} onChange={e => updateAnswer(idx, 'text', e.target.value)}
                                            placeholder={`${String.fromCharCode(65 + idx)} Şıkkı`}
                                            className={`flex-1 px-3 py-1.5 text-sm bg-slate-900 border rounded outline-none transition-all ${ans.isCorrect ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5' : 'border-slate-700 text-slate-300 focus:border-emerald-500'}`}
                                            required={idx < 2}
                                        />
                                    </div>
                                ))}
                            </div>

                            <button type="submit" disabled={addingQ} className="w-full mt-6 flex items-center justify-center px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all uppercase tracking-widest disabled:opacity-50">
                                {addingQ ? "Ekleniyor..." : "Şablon Olarak Kaydet"}
                            </button>
                        </form>
                    </div>

                    {/* Question List */}
                    <div className="lg:w-2/3 space-y-4 pl-0 lg:pl-4 border-l-0 lg:border-l border-slate-800">
                        {loading ? (
                            <div className="text-sm text-slate-500 italic p-8 text-center border-2 border-dashed border-slate-800 rounded-xl">Şablonlar yükleniyor...</div>
                        ) : questions.length === 0 ? (
                            <div className="text-sm text-slate-500 italic p-8 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-800/20">Bu sınıfa ait henüz hiç şablon soru eklenmemiş.</div>
                        ) : (
                            questions.map((q, idx) => (
                                <div key={q.id} className="p-5 bg-slate-800/30 border border-slate-700 rounded-xl shadow-md hover:border-slate-600 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-sm font-bold text-white leading-relaxed flex items-start gap-3">
                                            <span className="text-emerald-500 font-mono text-xs mt-0.5">S{idx + 1}</span>
                                            {q.question_text}
                                        </h4>
                                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-slate-500 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-500/10 rounded-lg shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                        {q.class_answer_templates?.map((a: any) => (
                                            <div key={a.id} className={`text-xs p-3 rounded-lg border transition-all ${a.is_correct ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                                                <div className="flex items-center gap-2">
                                                    {a.is_correct && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
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
            </div>
        </div>
    );
}
