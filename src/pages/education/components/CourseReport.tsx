import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, CheckCircle2, Clock, AlertCircle, Printer, PenLine } from "lucide-react";

export default function CourseReport({ courseId }: { courseId: string }) {
    const [participants, setParticipants] = useState<any[]>([]);
    const [progress, setProgress] = useState<any[]>([]);
    const [examResults, setExamResults] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [courseTitle, setCourseTitle] = useState<string>("");
    const [examAgreementText, setExamAgreementText] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (courseId) fetchReportData();
    }, [courseId]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // Get participants (imza alanları dahil)
            const { data: pData, error: pError } = await supabase
                .from("course_participants")
                .select("user_id, is_signed, signed_at, signature_data, profiles(first_name, last_name, tc_no)")
                .eq("course_id", courseId);
            if (pError) console.error("participants error:", pError);

            // Get course title
            const { data: cData } = await supabase
                .from("courses")
                .select("title")
                .eq("id", courseId)
                .single();
            if (cData) setCourseTitle(cData.title);

            // Get materials
            const { data: mData, error: mError } = await supabase
                .from("course_materials")
                .select("id, title, min_duration_minutes")
                .eq("course_id", courseId)
                .order("order_num", { ascending: true });
            if (mError) console.error("materials error:", mError);

            // Get progress
            const { data: progData, error: progError } = await supabase
                .from("user_course_progress")
                .select("*")
                .eq("course_id", courseId);
            if (progError) console.error("progress error:", progError);

            // Get exam results (for this course's exam)
            const { data: examData, error: examError } = await supabase
                .from("course_exams")
                .select("id, agreement_text")
                .eq("course_id", courseId)
                .maybeSingle();
            if (examError) console.error("course_exams error:", examError);
            if (examData?.agreement_text) setExamAgreementText(examData.agreement_text);

            const { data: resData, error: resError } = await supabase
                .from("user_exam_results")
                .select("*, profiles(first_name, last_name, tc_no)")
                .eq("exam_id", examData?.id || '00000000-0000-0000-0000-000000000000');
            if (resError) console.error("exam_results error:", resError);

            setParticipants(pData || []);
            setMaterials(mData || []);
            setProgress(progData || []);
            setExamResults(resData || []);
        } catch (error) {
            console.error("Rapor verisi alınamadı:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Rapor verileri yükleniyor...</span>
    </div>;

    const printCertificate = (row: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Lütfen açılır pencerelere (pop-ups) izin verin.");
            return;
        }

        const fullName = row.profile?.first_name ? `${row.profile.first_name} ${row.profile.last_name || ''}`.trim() : 'İsimsiz Katılımcı';
        const dateStr = new Date().toLocaleDateString('tr-TR');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${fullName} - Sınav Sonuç Belgesi</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background-color: #f7f9fc;
                        height: 100vh;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        box-sizing: border-box;
                    }
                    .certificate {
                        background: #ffffff;
                        width: 800px;
                        padding: 40px 60px;
                        border: 15px solid #1e3a8a;
                        outline: 5px solid #3b82f6;
                        outline-offset: -20px;
                        text-align: center;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        position: relative;
                        box-sizing: border-box;
                    }
                    .header {
                        font-size: 28px;
                        color: #1e3a8a;
                        margin-bottom: 5px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        font-weight: bold;
                    }
                    .sub-header {
                        font-size: 16px;
                        color: #64748b;
                        margin-bottom: 30px;
                        letter-spacing: 1px;
                    }
                    .content {
                        font-size: 16px;
                        color: #334155;
                        line-height: 1.6;
                    }
                    .name {
                        font-size: 32px;
                        font-weight: bold;
                        color: #0f172a;
                        margin: 15px 0;
                        text-decoration: underline;
                        text-underline-offset: 8px;
                        text-decoration-color: #3b82f6;
                        text-transform: capitalize;
                    }
                    .course-title {
                        font-size: 20px;
                        font-weight: bold;
                        color: #1e40af;
                        margin: 15px 0 20px 0;
                    }
                    .details-table {
                        width: 100%;
                        margin: 20px auto;
                        border-collapse: collapse;
                    }
                    .details-table th, .details-table td {
                        padding: 8px 12px;
                        border: 1px solid #cbd5e1;
                        font-size: 14px;
                        text-align: center;
                    }
                    .details-table th {
                        background-color: #f1f5f9;
                        color: #475569;
                        width: 50%;
                    }
                    .status-passed { color: #16a34a; font-weight: bold; }
                    .status-failed { color: #dc2626; font-weight: bold; }
                    
                    .agreement-box {
                        text-align: justify;
                        background: #f8fafc;
                        border: 1px dashed #cbd5e1;
                        padding: 15px;
                        font-size: 11px;
                        color: #64748b;
                        margin-bottom: 20px;
                        line-height: 1.4;
                        max-height: 150px;
                        overflow: hidden;
                    }
                    .agreement-title {
                        font-weight: bold;
                        color: #475569;
                        margin-bottom: 5px;
                        font-size: 12px;
                        text-align: left;
                    }
                    
                    .footer {
                        margin-top: 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                    }
                    .signature-box {
                        text-align: center;
                    }
                    .signature-line {
                        width: 200px;
                        border-bottom: 2px solid #334155;
                        margin-bottom: 10px;
                    }
                    .stamp {
                        color: #2563eb;
                        border: 3px solid #2563eb;
                        border-radius: 8px;
                        padding: 8px 15px;
                        font-weight: bold;
                        font-size: 14px;
                        transform: rotate(-5deg);
                        display: inline-block;
                        margin-top: 10px;
                        background: rgba(37, 99, 235, 0.05);
                    }
                    @media print {
                        body { background: white; height: auto; display: block; }
                        .certificate { 
                            box-shadow: none; 
                            width: 100%; 
                            max-width: 100%; 
                            padding: 30px 40px; 
                            margin: 0; 
                            border-width: 10px; 
                            outline-width: 2px; 
                            outline-offset: -12px; 
                            page-break-inside: avoid;
                        }
                        @page { margin: 1cm; size: portrait; }
                    }
                </style>
            </head>
            <body>
                <div class="certificate">
                    <div class="header">Sınav Katılım Belgesi</div>
                    <div class="sub-header">Eğitim Yönetim Sistemi Katılım Kaydı</div>
                    
                    <div class="content">
                        Bu belge,<br>
                        <div class="name">${fullName}</div>
                        adlı katılımcının aşağıda belirtilen eğitim sınavını tamamladığını doğrulamak amacıyla düzenlenmiştir.
                        
                        <div class="course-title">"${courseTitle || 'Eğitim / Sınav'}"</div>
                        
                        <table class="details-table">
                            <tr>
                                <th>Sınav Puanı</th>
                                <td><strong style="font-size: 18px">${row.examScore} / 100</strong></td>
                            </tr>
                            <tr>
                                <th>Sınav Sonucu</th>
                                <td class="${row.examStatus === 'passed' ? 'status-passed' : 'status-failed'}">
                                    ${row.examStatus === 'passed' ? 'BAŞARILI' : 'BAŞARISIZ'}
                                </td>
                            </tr>
                            <tr>
                                <th>TC / Kimlik No</th>
                                <td>${row.profile?.tc_no || 'Belirtilmemiş'}</td>
                            </tr>
                            <tr>
                                <th>Belge Tarihi</th>
                                <td>${dateStr}</td>
                            </tr>
                        </table>
                    </div>
                    
                    ${row.agreed && examAgreementText ? `
                        <div class="agreement-box">
                            <div class="agreement-title">Kabul Edilen Sınav Taahhütnamesi Beyanı:</div>
                            ${examAgreementText.length > 500 ? examAgreementText.substring(0, 500) + '...' : examAgreementText}
                            <br/><br/>
                            <i>* İşbu belge, kişinin yukarıdaki sınav kurallarını ve taahhütnamelerini okuyup kendi isteği ve elektronik onayıyla kabul ettiğini belgeler.</i>
                        </div>
                    ` : ''}
                    
                    <div class="footer">
                        <div class="signature-box">
                            <div class="stamp">E-İmza / Elektronik Olarak Onaylanmıştır</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-line"></div>
                            <div style="font-size: 16px; color: #475569;">Eğitim Yöneticisi</div>
                        </div>
                    </div>
                </div>
                
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Combine Data for Grid View
    const enrolledUsers = participants.map(p => {
        const uId = p.user_id;
        const pR = progress.filter(pr => pr.user_id === uId);
        const eR = examResults.find(er => er.user_id === uId);

        const totalMaterials = materials.length;
        const completedMaterials = pR.filter(pr => pr.is_completed).length;
        const progressPercent = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;
        const totalTimeSpent = pR.reduce((acc, curr) => acc + (curr.time_spent_seconds || 0), 0);

        return {
            id: uId,
            profile: p.profiles,
            isGuest: false,
            progressPercent,
            totalTimeSpent,
            examScore: eR?.score,
            examStatus: eR?.status,
            agreed: eR?.agreed,
            isSigned: p.is_signed || false,
            signedAt: p.signed_at || null,
            signatureData: p.signature_data || null,
        };
    });

    // We also need to list users who took the exam but aren't formally enrolled.
    // This includes external guests AND internal users who accessed the public link.
    const unenrolledResults = examResults.filter(er => !participants.some(p => p.user_id === er.user_id)).map(eR => {
        const isGuest = !eR.user_id;
        const profile = isGuest
            ? { first_name: eR.full_name, last_name: '', tc_no: eR.tc_no, department: 'Misafir / Dış Katılımcı' }
            : eR.profiles || { first_name: 'İsimsiz', last_name: 'Personel', tc_no: '', department: 'Belirtilmemiş' };

        let progressPercent: number | string = '-';
        let totalTimeSpent: number | string = '-';

        if (!isGuest && eR.user_id) {
            const pR = progress.filter(pr => pr.user_id === eR.user_id);
            const totalMaterials = materials.length;
            const completedMaterials = pR.filter(pr => pr.is_completed).length;
            progressPercent = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;
            totalTimeSpent = pR.reduce((acc, curr) => acc + (curr.time_spent_seconds || 0), 0);
        }

        return {
            id: isGuest ? eR.id : eR.user_id,
            profile,
            isGuest,
            progressPercent,
            totalTimeSpent,
            examScore: eR.score,
            examStatus: eR.status,
            agreed: eR.agreed,
            isSigned: false,
            signedAt: null,
            signatureData: null,
        };
    });

    const allData = [...enrolledUsers, ...unenrolledResults];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg flex items-center transition-all hover:border-slate-700">
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center mr-4 shadow-inner">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Katılımcı Sayısı</p>
                        <p className="text-2xl font-black text-white">{allData.length}</p>
                    </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg flex items-center transition-all hover:border-slate-700">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center mr-4 shadow-inner">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Geçenler</p>
                        <p className="text-2xl font-black text-white">{examResults.filter(e => e.status === 'passed').length}</p>
                    </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg flex items-center transition-all hover:border-slate-700">
                    <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-lg flex items-center justify-center mr-4 shadow-inner">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kalanlar</p>
                        <p className="text-2xl font-black text-white">{examResults.filter(e => e.status === 'failed').length}</p>
                    </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg flex items-center transition-all hover:border-slate-700">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center mr-4 shadow-inner">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Katılmayanlar</p>
                        <p className="text-2xl font-black text-white">{participants.length > 0 ? (participants.length - examResults.filter(e => enrolledUsers.some(u => u.id === e.user_id)).length) : 0}</p>
                    </div>
                </div>

                {/* İmzalayanlar özet kartı */}
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg flex items-center transition-all hover:border-slate-700">
                    <div className="w-12 h-12 bg-violet-500/10 text-violet-400 rounded-lg flex items-center justify-center mr-4 shadow-inner">
                        <PenLine className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">İmzalayanlar</p>
                        <p className="text-2xl font-black text-white">{participants.filter((p: any) => p.is_signed).length} / {participants.length}</p>
                    </div>
                </div>
            </div>

            {/* detailed Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                    <h3 className="font-bold text-slate-300 uppercase tracking-widest text-xs">Katılımcı Durum ve Başarı Tablosu</h3>
                    <button onClick={fetchReportData} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Yenile
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kişi / Birim</th>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">İçerik İlerleme</th>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Harcanan Süre</th>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sınav Sorucu</th>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">İmza</th>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Taahhütname</th>
                                <th scope="col" className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {allData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div>
                                                <div className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{row.profile?.first_name} {row.profile?.last_name} {row.isGuest && "(Misafir)"}</div>
                                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{row.profile?.department || 'Bölüm Yok'} | TC: {row.profile?.tc_no}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {typeof row.progressPercent === 'number' ? (
                                                <div className="w-full max-w-[120px]">
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 font-mono">
                                                        <span>{row.progressPercent}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden shadow-inner">
                                                        <div className="bg-indigo-500 h-1.5 rounded-full shadow-lg shadow-indigo-500/50" style={{ width: `${row.progressPercent}%` }}></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-600 font-mono">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
                                        {typeof row.totalTimeSpent === 'number' && row.totalTimeSpent > 0
                                            ? `${Math.floor(row.totalTimeSpent / 60)} dk`
                                            : row.totalTimeSpent === '-' ? '-' : 'Başlamadı'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {row.examScore !== undefined ? (
                                            <span className={`px-3 py-1 inline-flex text-[10px] leading-5 font-bold rounded-full border uppercase tracking-widest shadow-sm ${row.examStatus === 'passed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                {row.examScore} Puan ({row.examStatus === 'passed' ? 'Geçti' : 'Kaldı'})
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 inline-flex text-[10px] leading-5 font-bold rounded-full bg-slate-800 text-slate-500 border border-slate-700 uppercase tracking-widest">
                                                Sınava Girmedi
                                            </span>
                                        )}
                                    </td>

                                    {/* İmza Kolonu */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {row.isSigned ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-emerald-400 flex items-center font-bold text-xs gap-1.5">
                                                    <PenLine className="w-3.5 h-3.5" />
                                                    İmza Atıldı
                                                </span>
                                                {row.signedAt && (
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        {new Date(row.signedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                                {row.signatureData && (
                                                    <img
                                                        src={row.signatureData}
                                                        alt="İmza"
                                                        className="mt-1 h-8 w-auto bg-white rounded border border-slate-700 px-1"
                                                        title="İmzayı görmek için üzerine gelin"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            // İmzalanmadıysa hiçbir şey gösterme
                                            <span className="text-slate-700">—</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {row.agreed === true ? (
                                            <span className="text-emerald-400 flex items-center font-bold text-xs"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Onaylı</span>
                                        ) : row.examScore !== undefined ? (
                                            <span className="text-amber-400 flex items-center font-bold text-xs"><Clock className="w-4 h-4 mr-1.5" /> Bekliyor</span>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {row.examScore !== undefined && (
                                            <button
                                                onClick={() => printCertificate(row)}
                                                className="inline-flex items-center px-3 py-2 bg-indigo-600/10 border border-indigo-500/20 text-[10px] font-bold rounded-lg shadow-sm text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-widest"
                                                title="Sınav Sertifikasını İndir/Yazdır"
                                            >
                                                <Printer className="w-3.5 h-3.5 mr-2" />
                                                Sertifika
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {allData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500 font-medium italic bg-slate-900/50">Henüz katılımcı verisi bulunmuyor.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
