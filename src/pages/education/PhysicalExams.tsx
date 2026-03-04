import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Trash2, Calendar, Clock, Download, QrCode, Award } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type PhysicalExam = {
    id: string; // Course ID (we use course as a container)
    title: string;
    start_date: string;
    passing_score: number;
    course_exams: {
        id: string;
        time_limit_minutes: number;
        agreement_text: string;
    }[];
}

interface AgreementTemplate {
    id: string;
    title: string;
    agreement_text: string;
};

export default function PhysicalExams() {
    const { profile } = useAuthStore();
    const [exams, setExams] = useState<PhysicalExam[]>([]);
    const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Filters
    const currentYear = new Date().getFullYear();
    const [filterMonth, setFilterMonth] = useState<string>("all");
    const [filterYear, setFilterYear] = useState<string>(currentYear.toString());

    // Form states
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [passingScore, setPassingScore] = useState(70);
    const [timeLimit, setTimeLimit] = useState(0);
    const [agreementText, setAgreementText] = useState("");
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [classes, setClasses] = useState<{ id: string, name: string }[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // QR State
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchExams();
            fetchTemplates();
        }
    }, [profile]);

    const fetchTemplates = async () => {
        try {
            const { data } = await supabase
                .from("exam_agreement_templates")
                .select("*")
                .eq("tenant_id", profile?.tenant_id)
                .order("title");
            if (data) setTemplates(data);

            const { data: clsData } = await supabase
                .from("education_classes")
                .select("id, name")
                .eq("tenant_id", profile?.tenant_id)
                .order("name");
            if (clsData) setClasses(clsData);
        } catch (error) {
            console.error("Error fetching templates or classes:", error);
        }
    };

    const fetchExams = async () => {
        setLoading(true);
        try {
            // Fetch courses that have an exam of type 'physical_only'
            const { data: eData } = await supabase
                .from("course_exams")
                .select("course_id, id, time_limit_minutes, agreement_text")
                .eq("exam_type", "physical_only");

            if (!eData || eData.length === 0) {
                setExams([]);
                return;
            }

            const courseIds = eData.map(e => e.course_id);

            const { data: cData } = await supabase
                .from("courses")
                .select("id, title, start_date, passing_score")
                .in("id", courseIds)
                .order("start_date", { ascending: false });

            if (cData) {
                const combined = cData.map(c => ({
                    ...c,
                    course_exams: eData.filter(e => e.course_id === c.id)
                }));
                setExams(combined);
            }
        } catch (error) {
            console.error("Error fetching physical exams:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const startDate = new Date(`${date}T${time}`);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);

            if (!selectedClassId) {
                alert("Lütfen sınav için bir Eğitim Sınıfı seçin.");
                setSubmitting(false);
                return;
            }

            // 2. Insert Course
            const { data: newCourse, error: courseError } = await supabase
                .from("courses")
                .insert([{
                    tenant_id: profile!.tenant_id,
                    class_id: selectedClassId,
                    title: title,
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString(),
                    passing_score: passingScore,
                    status: 'published', // auto publish
                    creator_id: profile!.id
                }])
                .select()
                .single();

            if (courseError) throw courseError;

            // 3. Insert Exam attached to course
            const { data: newExamData, error: examError } = await supabase
                .from("course_exams")
                .insert([{
                    course_id: newCourse.id,
                    exam_type: 'physical_only',
                    time_limit_minutes: timeLimit,
                    agreement_text: agreementText,
                }])
                .select()
                .single();

            if (examError) throw examError;

            // 4. Fetch the class templates and duplicate to the new exam
            const { data: sourceQs, error: qError } = await supabase
                .from("class_question_templates")
                .select("*")
                .eq("class_id", selectedClassId);

            if (qError) throw qError;

            if (sourceQs && sourceQs.length > 0) {
                for (const q of sourceQs) {
                    // Insert the duplicated question pointing to the NEW exam
                    const { data: newQ, error: newQError } = await supabase
                        .from("exam_questions")
                        .insert([{
                            exam_id: newExamData.id,
                            question_text: q.question_text,
                            image_url: q.image_url,
                            order_num: q.order_num
                        }])
                        .select()
                        .single();

                    if (newQError) throw newQError;

                    // Fetch source answers for this question
                    const { data: sourceAns, error: aError } = await supabase
                        .from("class_answer_templates")
                        .select("*")
                        .eq("question_template_id", q.id);

                    if (aError) throw aError;

                    if (sourceAns && sourceAns.length > 0) {
                        const answersToInsert = sourceAns.map(a => ({
                            question_id: newQ.id,
                            answer_text: a.answer_text,
                            image_url: a.image_url,
                            is_correct: a.is_correct,
                            order_num: a.order_num
                        }));

                        const { error: insertAError } = await supabase
                            .from("exam_answers")
                            .insert(answersToInsert);

                        if (insertAError) throw insertAError;
                    }
                }
            }

            alert("Fiziki sınav başarıyla oluşturuldu!");
            setShowForm(false);
            resetForm();
            fetchExams();

        } catch (error) {
            console.error(error);
            alert("Sınav oluşturulurken bir hata oluştu.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Sınavı silmek istediğinize emin misiniz?")) return;
        try {
            await supabase.from("courses").delete().eq("id", id);
            fetchExams();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setTitle("");
        setDate("");
        setTime("");
        setPassingScore(70);
        setTimeLimit(0);
        setAgreementText("");
        setSelectedClassId("");
    };

    const handlePrintQRCode = (examId: string) => {
        setSelectedExamId(examId);
        setTimeout(() => {
            const container = document.getElementById(`qr-container-${examId}`);
            if (!container) return;

            const printWindow = window.open('', '', 'width=600,height=600');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head><title>QR Yazdır</title></head>
                        <body style="display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                            ${container.innerHTML}
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                    setSelectedExamId(null);
                }, 500);
            } else {
                setSelectedExamId(null);
            }
        }, 100);
    };

    const handleDownloadQRCode = (examId: string, titleStr: string) => {
        setSelectedExamId(examId);
        setTimeout(() => {
            const container = document.getElementById(`qr-container-${examId}`);
            const svgElement = container?.querySelector('svg');
            if (!svgElement) {
                setSelectedExamId(null);
                return;
            }

            const clonedSvg = svgElement.cloneNode(true) as SVGElement;
            clonedSvg.setAttribute('width', '1024');
            clonedSvg.setAttribute('height', '1024');

            const svgData = new XMLSerializer().serializeToString(clonedSvg);
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 1024;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    setSelectedExamId(null);
                    return;
                }

                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const pngUrl = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.href = pngUrl;
                downloadLink.download = `Sınav_${titleStr.substring(0, 15)}_QR.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                setSelectedExamId(null);
            };

            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }, 100);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Fiziki Sınıf Sınavları</h2>
                    <p className="text-sm text-slate-500 mt-1">Sınıf içi eğitimler için tarih bazlı online testler ve QR kodlar oluşturun.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1.5 shadow-inner">
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-transparent text-sm text-slate-200 border-none focus:ring-0 cursor-pointer min-w-[100px] outline-none"
                        >
                            <option value="all" className="bg-slate-900">Tüm Aylar</option>
                            <option value="0" className="bg-slate-900">Ocak</option>
                            <option value="1" className="bg-slate-900">Şubat</option>
                            <option value="2" className="bg-slate-900">Mart</option>
                            <option value="3" className="bg-slate-900">Nisan</option>
                            <option value="4" className="bg-slate-900">Mayıs</option>
                            <option value="5" className="bg-slate-900">Haziran</option>
                            <option value="6" className="bg-slate-900">Temmuz</option>
                            <option value="7" className="bg-slate-900">Ağustos</option>
                            <option value="8" className="bg-slate-900">Eylül</option>
                            <option value="9" className="bg-slate-900">Ekim</option>
                            <option value="10" className="bg-slate-900">Kasım</option>
                            <option value="11" className="bg-slate-900">Aralık</option>
                        </select>
                        <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-transparent text-sm text-slate-200 border-none focus:ring-0 cursor-pointer min-w-[80px] outline-none"
                        >
                            {[...Array(5)].map((_, i) => (
                                <option key={i} value={(currentYear - 2 + i).toString()} className="bg-slate-900">{currentYear - 2 + i}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex-shrink-0 flex items-center px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all"
                    >
                        {showForm ? 'İptal' : <><Plus className="w-4 h-4 mr-2" /> Yeni Sınav</>}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-slate-900 p-8 rounded-xl shadow-2xl border border-indigo-500/30">
                    <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-4 mb-6 uppercase tracking-wider">Yeni Sınav Oluştur</h3>
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Eğitim / Sınav Adı</label>
                                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-600" placeholder="Örn: İs İskelesi Güvenliği Eğitimi Sınavı" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Tarih</label>
                                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Saat</label>
                                <input required type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Geçme Notu</label>
                                <input required type="number" min="0" max="100" value={passingScore} onChange={e => setPassingScore(Number(e.target.value))} className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Süre (Dakika, 0=Süresiz)</label>
                                <input required type="number" min="0" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" />
                            </div>

                            <div className="lg:col-span-2 space-y-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Taahhütname Metni (İsteğe Bağlı)</label>

                                <select
                                    className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                    onChange={(e) => {
                                        const t = templates.find(temp => temp.id === e.target.value);
                                        if (t) setAgreementText(t.agreement_text);
                                        // Option to clear out is left to manual editing by user
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>-- Hazır Şablonlardan Seç --</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>

                                <textarea
                                    value={agreementText}
                                    onChange={e => setAgreementText(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-600 resize-none"
                                    placeholder="Sınav öncesi zorunlu kabul metni veya şablon seçin..."
                                />
                            </div>

                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Hangi Eğitim Sınıfı?</label>
                                <select
                                    required
                                    value={selectedClassId}
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                >
                                    <option value="" disabled>-- Sınıf Seçin --</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                                    Seçtiğiniz sınıf için <strong className="text-emerald-400">Eğitim Ayarları</strong>'nda önceden belirlediğiniz soru havuzu bu yeni sınava otomatik tanımlanır.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={submitting} className="px-10 py-3.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 active:scale-95">
                                {submitting ? "Kaydediliyor..." : "Sınavı Oluştur"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-slate-500 p-12 text-center bg-slate-900 rounded-xl border border-slate-800 shadow-inner italic">Kayıtlar yükleniyor...</div>
            ) : exams.length === 0 ? (
                <div className="text-slate-500 p-12 text-center bg-slate-900 rounded-xl border border-slate-800 shadow-inner italic uppercase tracking-widest text-xs font-bold">Hiç fiziki sınav kaydı bulunmuyor.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {exams.filter(exam => {
                        if (!exam.start_date) return true;
                        const dateNum = new Date(exam.start_date);
                        const matchYear = filterYear === "all" || dateNum.getFullYear().toString() === filterYear;
                        const matchMonth = filterMonth === "all" || dateNum.getMonth().toString() === filterMonth;
                        return matchYear && matchMonth;
                    }).map(exam => {
                        const baseUrl = window.location.origin;
                        const examId = exam.course_exams?.[0]?.id;
                        const publicLink = examId ? `${baseUrl}/public/exam/${examId}` : "";
                        const formattedDate = exam.start_date ? new Date(exam.start_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belirtilmemiş';

                        return (
                            <div key={exam.id} className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 overflow-hidden flex flex-col group">
                                <div className="p-6 flex-grow">
                                    <h3 className="text-lg font-bold text-white mb-4 line-clamp-2 group-hover:text-indigo-400 transition-colors">{exam.title}</h3>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                            <Calendar className="w-4 h-4 text-indigo-400" /> {formattedDate}
                                        </div>
                                        <div className="flex items-center gap-6 text-[11px] text-slate-400 px-1 font-bold uppercase tracking-wider">
                                            <span className="flex items-center"><Award className="w-4 h-4 text-emerald-500 mr-2" /> {exam.passing_score} Geçme</span>
                                            <span className="flex items-center"><Clock className="w-4 h-4 text-amber-500 mr-2" /> {exam.course_exams?.[0]?.time_limit_minutes || 'Süresiz'} </span>
                                        </div>
                                    </div>

                                    {examId && (
                                        <div className="flex gap-2">
                                            <a href={`/app/education/manage/${exam.id}?tab=exam`} className="flex-1 text-center bg-indigo-500/10 text-indigo-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-500/20 border border-indigo-500/20 transition-all">
                                                Düzenle
                                            </a>
                                            <a href={`/app/education/manage/${exam.id}?tab=report`} className="flex-1 text-center bg-emerald-500/10 text-emerald-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 border border-emerald-500/20 transition-all">
                                                Rapor
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-800/50 p-4 border-t border-slate-800/50 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        {examId && (
                                            <>
                                                <button onClick={() => handlePrintQRCode(examId)} className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl bg-slate-800 border border-slate-700 transition-all" title="QR Yazdır">
                                                    <QrCode className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDownloadQRCode(examId, exam.title)} className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl bg-slate-800 border border-slate-700 transition-all" title="QR İndir">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <button onClick={() => handleDelete(exam.id)} className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                {selectedExamId === examId && (
                                    <div id={`qr-container-${examId}`} className="hidden">
                                        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
                                            <h2 style={{ marginBottom: '20px' }}>{exam.title}</h2>
                                            <QRCodeSVG value={publicLink} size={400} />
                                            <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>Sınava katılmak için kameranızı bu koda okutun.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
