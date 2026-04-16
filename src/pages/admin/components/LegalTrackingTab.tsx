import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Calendar } from "lucide-react";
import type { LegalRegulation } from "./LegalListTab";

export default function LegalTrackingTab() {
    const [regulations, setRegulations] = useState<LegalRegulation[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchRequirements();
    }, []);

    const fetchRequirements = async () => {
        setLoading(true);
        const { data: regsData, error: regsError } = await supabase
            .from("legal_regulations")
            .select("*")
            .order("name", { ascending: true });

        if (regsData) setRegulations(regsData as LegalRegulation[]);
        setLoading(false);
    };

    const filtered = regulations.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-4">
            <div className="flex items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Yönetmelik ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Kayıt bulunamadı.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">İlgili Kanun/Yönetmelik Adı</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">Resmi Gazete Tarihi</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">RG Sayısı</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">Yürürlük Tarihi</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">Son Değişiklik</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {filtered.map(reg => (
                                    <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[300px] truncate" title={reg.name}>
                                            {reg.name}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                                            {reg.gazette_date ? (
                                                <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400"/> {reg.gazette_date}</div>
                                            ) : "-"}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{reg.gazette_number || "-"}</td>
                                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                                            {reg.effective_date ? (
                                                <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400"/> {reg.effective_date}</div>
                                            ) : "-"}
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">{reg.last_modification_date || "-"}</td>
                                        <td className="px-5 py-3">
                                            {reg.is_active ? 
                                                <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">Yürürlükte</span>
                                                : <span className="px-2 py-1 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400">Kaldırıldı</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
