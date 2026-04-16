import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Copy, MapPin, Search } from "lucide-react";

export default function TMGDDocumentList() {
    const profile = useAuthStore(state => state.profile);
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) fetchDocs();
    }, [profile]);

    const fetchDocs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("tmgd_transport_docs")
            .select("*, tmgd_clients(title), tmgd_transport_items(*)")
            .eq("tenant_id", profile?.tenant_id)
            .order("created_at", { ascending: false });
        if (data) setDocs(data);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Oluşturulan Taşıma Evrakları</h2>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tarih</th>
                                <th className="px-4 py-3 font-medium">Müşteri Firma</th>
                                <th className="px-4 py-3 font-medium">İrsaliye No</th>
                                <th className="px-4 py-3 font-medium">Alıcı</th>
                                <th className="px-4 py-3 font-medium">Araç / Sürücü</th>
                                <th className="px-4 py-3 font-medium">Toplam Puan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {loading ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Yükleniyor...</td></tr>
                            ) : docs.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Henüz evrak oluşturulmamış.</td></tr>
                            ) : docs.map(doc => (
                                <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{new Date(doc.created_at).toLocaleDateString('tr-TR')}</td>
                                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{doc.tmgd_clients?.title}</td>
                                    <td className="px-4 py-3">{doc.waybill_no || '-'}</td>
                                    <td className="px-4 py-3 max-w-[200px] truncate" title={doc.receiver_title}>{doc.receiver_title}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900 dark:text-white">{doc.driver_plate}</div>
                                        <div className="text-xs text-slate-500">{doc.driver_name}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono">{doc.total_1136_points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
