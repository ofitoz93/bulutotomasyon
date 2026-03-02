import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "react-router-dom";

interface Stats {
    total_accidents: number;
    total_near_misses: number;
    open_audits: number;
    total_risks: number;
    pending_measurements: number;
    lost_workdays: number;
}

export default function ISGDashboard() {
    const { profile } = useAuthStore();
    const [stats, setStats] = useState<Stats>({
        total_accidents: 0, total_near_misses: 0, open_audits: 0,
        total_risks: 0, pending_measurements: 0, lost_workdays: 0,
    });
    const [recentAccidents, setRecentAccidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accRes, auditRes, riskRes, measRes] = await Promise.all([
                supabase.from("ohs_accidents").select("id, type, status, lost_workdays, accident_date, description, severity, tracking_no").eq("company_id", profile!.tenant_id!).order("accident_date", { ascending: false }),
                supabase.from("ohs_audits").select("id, status").eq("company_id", profile!.tenant_id!),
                supabase.from("ohs_risk_assessments").select("id, status").eq("company_id", profile!.tenant_id!),
                supabase.from("ohs_measurements").select("id, next_measurement_date, result").eq("company_id", profile!.tenant_id!),
            ]);

            const accidents = accRes.data || [];
            const audits = auditRes.data || [];
            const risks = riskRes.data || [];
            const measurements = measRes.data || [];

            const today = new Date();
            const pending = measurements.filter(m => m.next_measurement_date && new Date(m.next_measurement_date) <= today);

            setStats({
                total_accidents: accidents.filter(a => a.type === "kaza").length,
                total_near_misses: accidents.filter(a => a.type === "ramak_kala").length,
                open_audits: audits.filter(a => a.status === "acik" || a.status === "takipte").length,
                total_risks: risks.length,
                pending_measurements: pending.length,
                lost_workdays: accidents.reduce((sum: number, a: any) => sum + (a.lost_workdays || 0), 0),
            });
            setRecentAccidents(accidents.slice(0, 5));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const statCards = [
        { label: "İş Kazası", value: stats.total_accidents, color: "from-rose-500 to-rose-600", icon: "⚠️", link: "/app/isg-merkezi/kazalar" },
        { label: "Ramak Kala", value: stats.total_near_misses, color: "from-amber-500 to-orange-500", icon: "⚡", link: "/app/isg-merkezi/kazalar" },
        { label: "Kayıp İş Günü", value: stats.lost_workdays, color: "from-slate-500 to-slate-600", icon: "📅", link: "/app/isg-merkezi/kazalar" },
        { label: "Açık Denetim", value: stats.open_audits, color: "from-blue-500 to-indigo-600", icon: "🔍", link: "/app/isg-merkezi/denetimler" },
        { label: "Risk Raporu", value: stats.total_risks, color: "from-purple-500 to-violet-600", icon: "📊", link: "/app/isg-merkezi/risk" },
        { label: "Geciken Ölçüm", value: stats.pending_measurements, color: "from-emerald-500 to-teal-600", icon: "🔬", link: "/app/isg-merkezi/olcumler" },
    ];

    const SEVERITY_COLORS: Record<string, string> = {
        olumlu: "bg-slate-900 dark:bg-slate-950 text-white border-slate-900 dark:border-slate-800",
        agir: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300",
        orta: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
        hafif: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    };

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Durum Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {statCards.map(card => (
                    <Link to={card.link} key={card.label}
                        className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                        <div className="text-2xl mb-1">{card.icon}</div>
                        <div className={`text-2xl font-bold bg-gradient-to-br ${card.color} bg-clip-text text-transparent`}>
                            {card.value}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-semibold uppercase tracking-tight">{card.label}</div>
                    </Link>
                ))}
            </div>

            {/* Son Olaylar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Son Olaylar</h2>
                    <Link to="/app/isg-merkezi/kazalar" className="text-xs text-rose-500 hover:text-rose-400 font-medium">Tümünü Gör →</Link>
                </div>
                {recentAccidents.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-sm">Kayıtlı olay bulunmuyor.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                {["No", "Tür", "Tarih", "Açıklama", "Ciddiyet", "Durum"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {recentAccidents.map(acc => (
                                <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3 text-xs font-mono text-slate-400 dark:text-slate-500">{acc.tracking_no}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.type === "ramak_kala" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"}`}>
                                            {acc.type === "ramak_kala" ? "Ramak Kala" : "İş Kazası"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{new Date(acc.accident_date).toLocaleDateString("tr-TR")}</td>
                                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 max-w-xs truncate">{acc.description}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${SEVERITY_COLORS[acc.severity] || ""}`}>
                                            {acc.severity}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.status === "kapali" ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : acc.status === "inceleniyor" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"}`}>
                                            {acc.status === "kapali" ? "Kapalı" : acc.status === "inceleniyor" ? "İnceleniyor" : "Açık"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Hızlı Erişim */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Kaza Kaydı Ekle", icon: "➕", color: "border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/5", link: "/app/isg-merkezi/kazalar" },
                    { label: "Denetim Ekle", icon: "📋", color: "border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/5", link: "/app/isg-merkezi/denetimler" },
                    { label: "Risk Raporu Yükle", icon: "📤", color: "border-purple-200 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/5", link: "/app/isg-merkezi/risk" },
                    { label: "Ölçüm Kaydı", icon: "🔬", color: "border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/5", link: "/app/isg-merkezi/olcumler" },
                ].map(item => (
                    <Link key={item.label} to={item.link}
                        className={`bg-white dark:bg-slate-900 border ${item.color} rounded-xl p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                        <div className="text-2xl mb-1">{item.icon}</div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.label}</div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
