import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface PKDReport {
    id: string;
    title: string;
    version: string;
    status: string;
    facility_name: string;
    process_name: string;
    created_at: string;
}

export default function PKDDashboard() {
    const { profile } = useAuthStore();
    const [reports, setReports] = useState<PKDReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            if (!profile?.tenant_id) return;
            const { data, error } = await supabase
                .from('pkd_reports')
                .select('*')
                .eq('tenant_id', profile.tenant_id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setReports(data);
            }
            setLoading(false);
        };
        fetchReports();
    }, [profile?.tenant_id]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'onay_bekliyor': return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30";
            case 'onaylandı': return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30";
            default: return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border-slate-200 dark:border-slate-500/30";
        }
    };

    const formatStatus = (status: string) => {
        switch (status) {
            case 'onay_bekliyor': return 'Onay Bekliyor';
            case 'onaylandı': return 'Onaylandı';
            default: return 'Taslak';
        }
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Toplam PKD</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{reports.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Güncel Dokümanlar</h2>
                    <Link to="/app/pkd_yonetimi/new" className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium border border-transparent shadow-sm flex items-center gap-2 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Yeni PKD Oluştur
                    </Link>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">Henüz PKD Bulunmuyor</h3>
                            <p className="text-sm text-slate-500">Tesisiniz için risk sınıflandırmasını başlatmak üzere yeni bir PKD oluşturun.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doküman Adı</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tesis / Proses</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarih</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Versiyon</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Durum</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">{report.title}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-slate-600 dark:text-slate-400">{report.facility_name}</div>
                                                <div className="text-xs text-slate-500">{report.process_name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(report.created_at).toLocaleDateString('tr-TR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                {report.version}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(report.status)}`}>
                                                    {formatStatus(report.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
