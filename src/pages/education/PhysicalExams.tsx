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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Fiziki Sınıf Sınavları</h2>
                    <p className="text-sm text-gray-500 mt-1">Sınıf içi eğitimler için tarih bazlı online testler ve QR kodlar oluşturun.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-1">
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer min-w-[100px]"
                        >
                            <option value="all">Tüm Aylar</option>
                            <option value="0">Ocak</option>
                            <option value="1">Şubat</option>
                            <option value="2">Mart</option>
                            <option value="3">Nisan</option>
                            <option value="4">Mayıs</option>
                            <option value="5">Haziran</option>
                            <option value="6">Temmuz</option>
                            <option value="7">Ağustos</option>
                            <option value="8">Eylül</option>
                            <option value="9">Ekim</option>
                            <option value="10">Kasım</option>
                            <option value="11">Aralık</option>
                        </select>
                        <div className="w-px h-6 bg-gray-300 mx-1 self-center"></div>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer min-w-[80px]"
                        >
                            {[...Array(5)].map((_, i) => (
                                <option key={i} value={(currentYear - 2 + i).toString()}>{currentYear - 2 + i}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex-shrink-0 flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
                    >
                        {showForm ? 'İptal' : <><Plus className="w-5 h-5 mr-1" /> Yeni Sınav</>}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-indigo-200">
                    <h3 className="font-semibold text-lg border-b pb-3 mb-4">Yeni Sınav Oluştur</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Eğitim / Sınav Adı</label>
                                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500" placeholder="Örn: İs İskelesi Güvenliği Eğitimi Sınavı" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                                <input required type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Geçme Notu</label>
                                <input required type="number" min="0" max="100" value={passingScore} onChange={e => setPassingScore(Number(e.target.value))} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Süre (Dakika, 0=Süresiz)</label>
                                <input required type="number" min="0" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500" />
                            </div>

                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Taahhütname Metni (İsteğe Bağlı)</label>
                                <input type="text" value={agreementText} onChange={e => setAgreementText(e.target.value)} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500" placeholder="Sınav öncesi zorunlu kabul metni..." />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={submitting} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                                {submitting ? "Kaydediliyor..." : "Sınavı Oluştur"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-gray-500 p-8 text-center bg-white rounded-lg border border-gray-200">Kayıtlar yükleniyor...</div>
            ) : exams.length === 0 ? (
                <div className="text-gray-500 p-8 text-center bg-white rounded-lg border border-gray-200">Hiç fiziki sınav kaydı bulunmuyor.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {exams.filter(exam => {
                        if (!exam.start_date) return true;
                        const date = new Date(exam.start_date);
                        const matchYear = filterYear === "all" || date.getFullYear().toString() === filterYear;
                        const matchMonth = filterMonth === "all" || date.getMonth().toString() === filterMonth;
                        return matchYear && matchMonth;
                    }).map(exam => {
                        const baseUrl = window.location.origin;
                        const examId = exam.course_exams?.[0]?.id;
                        const publicLink = examId ? `${baseUrl}/public/exam/${examId}` : "";
                        const formattedDate = exam.start_date ? new Date(exam.start_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belirtilmemiş';

                        return (
                            <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 transition overflow-hidden flex flex-col">
                                <div className="p-5 flex-grow">
                                    <h3 className="text-lg font-bold text-gray-800 mb-3 line-clamp-2">{exam.title}</h3>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                            <Calendar className="w-4 h-4 text-indigo-500" /> {formattedDate}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-600 px-1">
                                            <span className="flex items-center"><Award className="w-4 h-4 text-green-500 mr-1" /> {exam.passing_score} Geçme Notu</span>
                                            <span className="flex items-center"><Clock className="w-4 h-4 text-orange-500 mr-1" /> {exam.course_exams?.[0]?.time_limit_minutes || 'Süresiz'} </span>
                                        </div>
                                    </div>

                                    {examId && (
                                        <div className="flex gap-2">
                                            <a href={`/app/education/manage/${exam.id}?tab=exam`} className="flex-1 text-center bg-indigo-50 text-indigo-700 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition">
                                                Soruları Düzenle
                                            </a>
                                            <a href={`/app/education/manage/${exam.id}?tab=report`} className="flex-1 text-center bg-emerald-50 text-emerald-700 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 transition">
                                                Sonuç Raporu
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-50 p-4 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        {examId && (
                                            <>
                                                <button onClick={() => handlePrintQRCode(examId)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded bg-white border border-gray-200 shadow-sm" title="QR Yazdır">
                                                    <QrCode className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDownloadQRCode(examId, exam.title)} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded bg-white border border-gray-200 shadow-sm" title="Büyük QR İndir">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <button onClick={() => handleDelete(exam.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
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
