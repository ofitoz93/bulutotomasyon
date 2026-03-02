import { useState, useEffect, useRef } from "react";
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
};

export default function PhysicalExams() {
    const { profile } = useAuthStore();
    const [exams, setExams] = useState<PhysicalExam[]>([]);
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
    const [submitting, setSubmitting] = useState(false);

    // QR Print Ref
    const printRef = useRef<HTMLDivElement>(null);
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.tenant_id) fetchExams();
    }, [profile]);

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

            // 1. Create a dummy class/type if we don't have one specifically for physical exams, 
            // or just pick the first available one to satisfy FK constraints.
            // Ideally we should create a default "Fiziki Sınıf Eğitimleri" type/class.
            const { data: types } = await supabase.from("education_types").select("id").eq("tenant_id", profile!.tenant_id).limit(1);
            let classId = null;
            if (types && types.length > 0) {
                const { data: classes } = await supabase.from("education_classes").select("id").eq("type_id", types[0].id).limit(1);
                if (classes && classes.length > 0) {
                    classId = classes[0].id;
                }
            }

            if (!classId) {
                alert("Önce Eğitim Ayarları sayfasından en az bir Eğitim Türü ve Sınıfı oluşturmalısınız.");
                setSubmitting(false);
                return;
            }

            // 2. Insert Course
            const { data: newCourse, error: courseError } = await supabase
                .from("courses")
                .insert([{
                    tenant_id: profile!.tenant_id,
                    class_id: classId,
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
            const { error: examError } = await supabase
                .from("course_exams")
                .insert([{
                    course_id: newCourse.id,
                    exam_type: 'physical_only',
                    time_limit_minutes: timeLimit,
                    agreement_text: agreementText,
                }]);

            if (examError) throw examError;

            alert("Fiziki sınav başarıyla oluşturuldu! Şimdi soruları ekleyebilirsiniz.");
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
    };

    const handlePrintQRCode = (examId: string) => {
        setSelectedExamId(examId);
        setTimeout(() => {
            const printWindow = window.open('', '', 'width=600,height=600');
            if (printWindow && printRef.current) {
                printWindow.document.write(`
                    <html>
                        <head><title>QR Yazdır</title></head>
                        <body style="display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                            ${printRef.current.innerHTML}
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
            }
        }, 100);
    };

    const handleDownloadQRCode = (examId: string, titleStr: string) => {
        setSelectedExamId(examId);
        setTimeout(() => {
            const svgElement = printRef.current?.querySelector('svg');
            if (!svgElement) return;

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
                if (!ctx) return;

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

                            <div className="lg:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Taahhütname Metni (İsteğe Bağlı)</label>
                                <input type="text" value={agreementText} onChange={e => setAgreementText(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-600" placeholder="Sınav öncesi zorunlu kabul metni..." />
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
                                    <div className="hidden">
                                        <div ref={printRef}>
                                            <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
                                                <h2 style={{ marginBottom: '20px' }}>{exam.title}</h2>
                                                <QRCodeSVG value={publicLink} size={400} />
                                                <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>Sınava katılmak için kameranızı bu koda okutun.</p>
                                            </div>
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
