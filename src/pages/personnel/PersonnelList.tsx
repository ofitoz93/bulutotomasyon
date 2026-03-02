import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Link, useNavigate } from "react-router-dom";

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    tc_no: string | null;
    company_employee_no: string | null;
    position: string | null;
    is_active: boolean;
    tenant_id: string;
    subcontractor_id: string | null;
    subcontractors?: { name: string } | null;
    profile_image_url: string | null;
}

export default function PersonnelList() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [personnel, setPersonnel] = useState<Profile[]>([]);
    const [subcontractors, setSubcontractors] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterSub, setFilterSub] = useState<string>("all");

    useEffect(() => {
        if (profile?.tenant_id) fetchData();
    }, [profile?.tenant_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [profilesRes, subRes] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("*, subcontractors(name)")
                    .eq("tenant_id", profile!.tenant_id)
                    .order("first_name", { ascending: true }),
                supabase
                    .from("subcontractors")
                    .select("id, name")
                    .eq("parent_company_id", profile!.tenant_id)
            ]);

            setPersonnel(profilesRes.data || []);
            setSubcontractors(subRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = personnel.filter(p => {
        const matchesSearch =
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.tc_no || "").includes(searchTerm) ||
            (p.email || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesSub = filterSub === "all" ? true :
            filterSub === "main" ? !p.subcontractor_id :
                p.subcontractor_id === filterSub;

        return matchesSearch && matchesSub;
    });

    const getInitial = (p: Profile) => {
        return `${(p.first_name || "?")[0]}${(p.last_name || "?")[0]}`.toUpperCase();
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                    <div className="relative flex-1 max-w-sm">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="İsim, TC No, E-posta ile ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm dark:text-slate-200"
                        />
                    </div>

                    <select
                        value={filterSub}
                        onChange={(e) => setFilterSub(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-slate-200"
                    >
                        <option value="all">Tüm Firmalar</option>
                        <option value="main">Ana Firma</option>
                        {subcontractors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2">
                    <Link
                        to="/app/personel-takip/toplu-islem"
                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-800"
                    >
                        Excel Aktar
                    </Link>
                    <button
                        onClick={() => navigate("/app/manager/team")} // Mevcut davet sayfasına yönlendir
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20"
                    >
                        + Yeni Personel
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-24">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-4">👥</div>
                    <p className="text-slate-500 dark:text-slate-400">Aranan kriterlere uygun personel bulunamadı.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(p => (
                        <Link
                            key={p.id}
                            to={`/app/personel-takip/${p.id}`}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-inner overflow-hidden">
                                    {p.profile_image_url ? (
                                        <img src={p.profile_image_url} alt="" className="w-full h-full object-cover" />
                                    ) : getInitial(p)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {p.first_name} {p.last_name}
                                    </h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{p.position || "Pozisyon Belirtilmemiş"}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {!p.is_active && (
                                        <span className="text-[10px] bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-bold">PASİF</span>
                                    )}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.subcontractor_id ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" : "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"}`}>
                                        {p.subcontractors?.name || "Ana Firma"}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">TC No</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold text-right">Sicil No</div>
                                <div className="text-xs text-slate-700 dark:text-slate-300 font-mono">{p.tc_no || "—"}</div>
                                <div className="text-xs text-slate-700 dark:text-slate-300 font-mono text-right">{p.company_employee_no || "—"}</div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Sağlık: Uygun
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                    Eğitim: %100
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
