import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function CourseReport({ courseId }: { courseId: string }) {
    const [participants, setParticipants] = useState<any[]>([]);
    const [progress, setProgress] = useState<any[]>([]);
    const [examResults, setExamResults] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (courseId) fetchReportData();
    }, [courseId]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // Get participants
            const { data: pData } = await supabase
                .from("course_participants")
                .select("user_id, profiles(first_name, last_name, tc_no, company_employee_no, department)")
                .eq("course_id", courseId);

            // Get materials
            const { data: mData } = await supabase
                .from("course_materials")
                .select("id, title, min_duration_minutes")
                .eq("course_id", courseId)
                .order("order_num", { ascending: true });

            // Get progress
            const { data: progData } = await supabase
                .from("user_course_progress")
                .select("*")
                .eq("course_id", courseId);

            // Get exam results (for this course's exam)
            const { data: examData } = await supabase
                .from("course_exams")
                .select("id")
                .eq("course_id", courseId)
                .single();

            const { data: resData } = await supabase
                .from("user_exam_results")
                .select("*")
                .eq("exam_id", examData?.id || '00000000-0000-0000-0000-000000000000');

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

    if (loading) return <div className="p-8 text-center text-gray-500">Rapor verileri yükleniyor...</div>;

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
            totalTimeSpent, // in seconds
            examScore: eR?.score,
            examStatus: eR?.status,
            agreed: eR?.agreed
        };
    });

    // We also need to list guests who took the exam but aren't enrolled
    const guestResults = examResults.filter(er => !er.user_id).map(eR => ({
        id: eR.id, // Just use result id for key
        profile: { first_name: eR.full_name, last_name: '', tc_no: eR.tc_no, department: 'Misafir / Dış Katılımcı' },
        isGuest: true,
        progressPercent: '-', // They jump straight to exam usually
        totalTimeSpent: '-',
        examScore: eR.score,
        examStatus: eR.status,
        agreed: eR.agreed
    }));

    const allData = [...enrolledUsers, ...guestResults];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mr-4">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Kayıtlı Personel</p>
                        <p className="text-xl font-bold text-gray-900">{participants.length}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mr-4">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Sınavı Geçenler</p>
                        <p className="text-xl font-bold text-gray-900">{examResults.filter(e => e.status === 'passed').length}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mr-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Başarısız Olanlar</p>
                        <p className="text-xl font-bold text-gray-900">{examResults.filter(e => e.status === 'failed').length}</p>
                    </div>
                </div>
            </div>

            {/* detailed Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Katılımcı Durum ve Başarı Tablosu</h3>
                    <button onClick={fetchReportData} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Yenile</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kişi / Birim</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İçerik İlerleme</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harcanan Süre</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sınav Sorucu</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taahhütname</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {allData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{row.profile?.first_name} {row.profile?.last_name} {row.isGuest && "(Misafir)"}</div>
                                                <div className="text-xs text-gray-500">{row.profile?.department || 'Bölüm Yok'} | TC: {row.profile?.tc_no}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {typeof row.progressPercent === 'number' ? (
                                                <div className="w-full max-w-[120px]">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span>{row.progressPercent}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${row.progressPercent}%` }}></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {typeof row.totalTimeSpent === 'number' && row.totalTimeSpent > 0
                                            ? `${Math.floor(row.totalTimeSpent / 60)} dk`
                                            : row.totalTimeSpent === '-' ? '-' : 'Başlamadı'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {row.examScore !== undefined ? (
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${row.examStatus === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {row.examScore} Puan ({row.examStatus === 'passed' ? 'Geçti' : 'Kaldı'})
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {row.agreed === true ? (
                                            <span className="text-green-600 flex items-center font-medium"><CheckCircle2 className="w-4 h-4 mr-1" /> Onaylı</span>
                                        ) : row.examScore !== undefined ? (
                                            <span className="text-orange-500 flex items-center font-medium"><Clock className="w-4 h-4 mr-1" /> Bekliyor</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {allData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Henüz katılımcı verisi bulunmuyor.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
