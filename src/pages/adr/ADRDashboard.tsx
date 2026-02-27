
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { ADRForm } from "@/types/adr";
import { useAuthStore } from "@/stores/authStore";
import { Plus, FileText, CheckCircle, Clock, XCircle } from "lucide-react";

export default function ADRDashboard() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [forms, setForms] = useState<ADRForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetchForms();
    }, [profile]);

    const fetchForms = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("adr_forms")
                .select("*, profiles!adr_forms_user_id_fkey(first_name, last_name)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setForms(data || []);
        } catch (error: any) {
            console.error("Error fetching forms:", error);
        } finally {
            setLoading(false);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle className="w-3 h-3" /> Onaylandı</span>;
            case 'rejected':
                return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30"><XCircle className="w-3 h-3" /> Reddedildi</span>;
            default:
                return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30"><Clock className="w-3 h-3" /> Bekliyor</span>;
        }
    };

    const filteredForms = forms.filter(f => {
        if (filter === "all") return true;
        return f.status === filter;
    });

    const filterBtn = (value: string, label: string, activeColor: string) => (
        <button
            onClick={() => setFilter(value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === value
                    ? `${activeColor} text-white shadow-md`
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">ADR Form Yönetimi</h1>
                    <p className="text-sm text-slate-400 mt-1">Tehlikeli madde operasyon kayıtları ve onay süreçleri.</p>
                </div>
                <button
                    onClick={() => navigate("/app/adr/new")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 w-full sm:w-auto justify-center transition-colors"
                >
                    <Plus className="w-4 h-4" /> Yeni Kayıt
                </button>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {filterBtn("all", `Tümü (${forms.length})`, "bg-slate-600")}
                {filterBtn("pending", `Bekleyen (${forms.filter(f => f.status === 'pending').length})`, "bg-amber-600")}
                {filterBtn("approved", `Onaylanan (${forms.filter(f => f.status === 'approved').length})`, "bg-emerald-600")}
                {filterBtn("rejected", `Reddedilen (${forms.filter(f => f.status === 'rejected').length})`, "bg-rose-600")}
            </div>

            {/* List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 p-12">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-slate-500 text-sm">Yükleniyor...</span>
                    </div>
                ) : filteredForms.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mb-4">
                            <FileText className="w-7 h-7 text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-sm">Kayıt bulunamadı.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {filteredForms.map((form) => (
                            <div
                                key={form.id}
                                onClick={() => navigate(`/app/adr/${form.id}`)}
                                className="px-5 py-4 hover:bg-slate-800/60 cursor-pointer transition-colors group"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                                        {form.plate_no}
                                        <span className="text-slate-500 font-normal ml-2">| {form.driver_name}</span>
                                    </h3>
                                    {statusBadge(form.status)}
                                </div>
                                <div className="flex justify-between items-center text-sm text-slate-500 mt-2">
                                    <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">{form.form_type}</span>
                                    <span className="text-xs">{new Date(form.created_at).toLocaleString('tr-TR')}</span>
                                </div>
                                <div className="text-xs text-slate-600 mt-1.5">
                                    Hazırlayan: {form.profiles ? `${form.profiles.first_name || ""} ${form.profiles.last_name || ""}`.trim() : "Bilinmiyor"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
