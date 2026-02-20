
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { ADRForm } from "@/types/adr";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Search, FileText, CheckCircle, Clock, XCircle } from "lucide-react";

export default function ADRDashboard() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [forms, setForms] = useState<ADRForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // all, pending, approved
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        fetchForms();
    }, [profile]);

    const fetchForms = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            let query = supabase
                .from("adr_forms")
                .select("*, profiles!adr_forms_user_id_fkey(first_name, last_name)")
                .order("created_at", { ascending: false });

            // RLS handles visibility, but we can filter further if needed
            const { data, error } = await query;
            if (error) {
                setFetchError(error.message);
                throw error;
            }
            setForms(data || []);
        } catch (error: any) {
            console.error("Error fetching forms:", error);
        } finally {
            setLoading(false);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> Onaylandı</span>;
            case 'rejected': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Reddedildi</span>;
            default: return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> Bekliyor</span>;
        }
    };

    const filteredForms = forms.filter(f => {
        if (filter === "all") return true;
        return f.status === filter;
    });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">ADR Form Yönetimi</h1>
                    <p className="text-sm text-gray-500 mt-1">Tehlikeli madde operasyon kayıtları ve onay süreçleri.</p>
                </div>
                <button
                    onClick={() => navigate("/app/adr/new")}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" /> Yeni Kayıt
                </button>
            </div>

            {/* İstatistik / Filtre Kartları (Basit) */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === "all" ? "bg-gray-800 text-white" : "bg-white text-gray-600 border"}`}>
                    Tümü ({forms.length})
                </button>
                <button onClick={() => setFilter("pending")} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === "pending" ? "bg-yellow-500 text-white" : "bg-white text-gray-600 border"}`}>
                    Onay Bekleyen ({forms.filter(f => f.status === 'pending').length})
                </button>
                <button onClick={() => setFilter("approved")} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === "approved" ? "bg-green-600 text-white" : "bg-white text-gray-600 border"}`}>
                    Onaylananlar ({forms.filter(f => f.status === 'approved').length})
                </button>
            </div>

            {/* Liste */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
                ) : filteredForms.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <FileText className="w-12 h-12 text-gray-300 mb-2" />
                        <p>Kayıt bulunamadı.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredForms.map((form) => (
                            <div
                                key={form.id}
                                onClick={() => navigate(`/app/adr/${form.id}`)} // Detay Sayfası
                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors block"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-gray-900">{form.plate_no} <span className="text-gray-400 font-normal">| {form.driver_name}</span></h3>
                                    {statusBadge(form.status)}
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                                    <span>{form.form_type}</span>
                                    <span>{new Date(form.created_at).toLocaleString('tr-TR')}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    Hazırlayan: {form.profiles ? `${form.profiles.first_name || ""} ${form.profiles.last_name || ""}`.trim() : "Bilinmiyor"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* DEBUG PANEL */}
            <div className="bg-orange-50 p-4 rounded border border-orange-200 text-xs font-mono text-orange-800 break-all">
                <p><strong>DEBUG INFO:</strong></p>
                <p>User ID: {profile?.id || "None"}</p>
                <p>Tenant ID: {profile?.tenant_id || "None"}</p>
                <p>Role: {profile?.role || "None"}</p>
                <p>Loading: {loading ? "Yes" : "No"}</p>
                <p>Forms Count: {forms.length}</p>
                <p>Fetch Error: {fetchError || "None"}</p>
                <button onClick={fetchForms} className="mt-2 px-2 py-1 bg-orange-200 rounded">Retry Fetch</button>
            </div>
        </div>
    );
}
