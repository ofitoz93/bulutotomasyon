
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { ADRForm, FormAnswer, FormMedia } from "@/types/adr";
import { useAuthStore } from "@/stores/authStore";
import {
    TANK_ALICI_FORM,
    AMBALAJ_ALICI_FORM,
    YUKLEYEN_GONDEREN_FORM,
    PAKETLEYEN_FORM,
    DOLDURAN_FORM,
    type ADRFormDefinition
} from "@/components/adr/formDefinitions";
import { ArrowLeft, CheckCircle, XCircle, MapPin, Image as ImageIcon } from "lucide-react";

export default function ADRDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [form, setForm] = useState<ADRForm | null>(null);
    const [answers, setAnswers] = useState<FormAnswer[]>([]);
    const [media, setMedia] = useState<FormMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Form tanımlarını bul
    const [formDefs, setFormDefs] = useState<ADRFormDefinition[]>([]);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    useEffect(() => {
        if (form) {
            // Form tipine göre tanımları yükle
            // Basitlik için ana tipleri kontrol ediyoruz.
            // Gerçek senaryoda veritabanında saklanan 'processType' ve 'subType' da kullanılabilir
            // ama burada 'form_type' üzerinden eşleştirme yapacağız.
            let defs: ADRFormDefinition[] = [];

            if (form.form_type === 'TANK-ALICI') defs = [TANK_ALICI_FORM];
            else if (form.form_type === 'AMBALAJ-ALICI') defs = [AMBALAJ_ALICI_FORM];
            else if (form.form_type === 'YUKLEYEN-GONDEREN') {
                // Burada alt tipi veritabanında saklamadığımız için varsayımsal olarak ikisini de
                // veya cevaplardan çıkarım yaparak ekleyebiliriz.
                // Şimdilik sadece ana formu gösterelim, ek formlar cevaplarda varsa onları da dahil edebiliriz.
                defs = [YUKLEYEN_GONDEREN_FORM];

                // Ekstra form kontrolü (basit mantık: cevaplarda 'tehlike_sinifi' varsa PAKETLEYEN, 'dolum_baglanti' varsa DOLDURAN)
                if (answers.some(a => a.question_key === 'tehlike_sinifi')) defs.push(PAKETLEYEN_FORM);
                if (answers.some(a => a.question_key === 'dolum_baglanti')) defs.push(DOLDURAN_FORM);
            }
            setFormDefs(defs);
        }
    }, [form, answers]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Formu çek
            const { data: formData, error: formError } = await supabase
                .from("adr_forms")
                .select("*, profiles!adr_forms_user_id_fkey(first_name, last_name), approver:profiles!adr_forms_approved_by_fkey(first_name, last_name)")
                .eq("id", id)
                .single();
            if (formError) throw formError;
            setForm(formData);

            // Cevapları çek
            const { data: ansData, error: ansError } = await supabase
                .from("form_answers")
                .select("*")
                .eq("form_id", id);
            if (ansError) throw ansError;
            setAnswers(ansData || []);

            // Medyayı çek
            const { data: mediaData, error: mediaError } = await supabase
                .from("form_media")
                .select("*")
                .eq("form_id", id);
            if (mediaError) throw mediaError;
            setMedia(mediaData || []);

        } catch (error) {
            console.error("Error fetching detail:", error);
            alert("Veri yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!window.confirm("Formu onaylamak istediğinize emin misiniz?")) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("adr_forms")
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    approved_by: profile?.id
                })
                .eq("id", id);
            if (error) throw error;
            alert("Form onaylandı.");
            fetchData();
        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!window.confirm("Formu REDDETMEK istediğinize emin misiniz?")) return;
        setActionLoading(true);
        try {
            // Red sebebi için modal açılabilir, şimdilik direkt reddediyoruz
            const { error } = await supabase
                .from("adr_forms")
                .update({ status: 'rejected' })
                .eq("id", id);
            if (error) throw error;
            alert("Form reddedildi.");
            fetchData();
        } catch (error: any) {
            alert("Hata: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const getAnswer = (key: string) => {
        const ans = answers.find(a => a.question_key === key);
        return ans?.answer_value || { result: "-" }; // Default
    };

    // Helper to match colors
    const getResultColor = (result: string) => {
        if (["Evet", "Uygun"].includes(result)) return "text-emerald-400 font-bold";
        if (["Hayır", "Uygun Değil", "Uygunsuz"].includes(result)) return "text-rose-400 font-bold";
        if (["Kısmen"].includes(result)) return "text-amber-400 font-bold";
        return "text-slate-100";
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;
    if (!form) return <div className="p-8 text-center text-slate-500">Form bulunamadı.</div>;

    const isPending = form.status === 'pending';
    const canApprove = (profile?.role === 'company_manager' || profile?.role === 'system_admin');

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-800">
                <button onClick={() => navigate("/app/adr")} className="text-slate-400 hover:text-slate-200 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h1 className="text-xl font-bold text-white">
                            {form.plate_no} - {form.driver_name}
                        </h1>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium w-fit border ${form.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                            form.status === 'rejected' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                                'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                            {form.status === 'approved' ? 'ONAYLANDI' : form.status === 'rejected' ? 'REDDEDİLDİ' : 'ONAY BEKLİYOR'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500">{form.form_type} • {new Date(form.created_at).toLocaleString('tr-TR')} • Hazırlayan: {form.profiles ? `${form.profiles.first_name || ""} ${form.profiles.last_name || ""}`.trim() : "Bilinmiyor"}</p>
                </div>

                {isPending && canApprove && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleReject}
                            disabled={actionLoading}
                            className="text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg border border-transparent hover:border-rose-500/20 transition-colors" title="Reddet">
                            <XCircle className="w-6 h-6" />
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="text-emerald-400 hover:bg-emerald-500/10 p-2 rounded-lg border border-transparent hover:border-emerald-500/20 transition-colors" title="Onayla">
                            <CheckCircle className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </div>

            {/* İçerik */}
            <div className="space-y-6">

                {/* 1. Form Soruları */}
                {formDefs.map((def, i) => (
                    <div key={i} className="bg-slate-900 shadow-xl rounded-lg overflow-hidden border border-slate-800">
                        <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800">
                            <h3 className="text-sm font-bold text-slate-300 uppercase">{def.title}</h3>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {def.sections.map((sec, j) => (
                                <div key={j}>
                                    <div className="px-4 py-2 bg-slate-800/20 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {sec.title}
                                    </div>
                                    <div className="divide-y divide-slate-800/50">
                                        {sec.questions.map((q) => {
                                            const ans = getAnswer(q.key);
                                            return (
                                                <div key={q.key} className="px-4 py-3 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                                                    <span className="text-sm text-slate-300 flex-1 pr-4">{q.text}</span>
                                                    <span className={`text-sm ${getResultColor(ans.result)}`}>
                                                        {ans.result}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* 2. Medya */}
                {media.length > 0 && (
                    <div className="bg-slate-900 shadow-xl rounded-lg p-4 border border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-indigo-400" /> Fotoğraflar
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {media.map((m) => (
                                <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors">
                                    <img src={m.file_url} alt="Proof" className="object-cover w-full h-full" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Konum ve Notlar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Konum */}
                    <div className="bg-slate-900 shadow-xl rounded-lg p-4 border border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-400" /> Konum
                        </h3>
                        {form.location_lat && form.location_lng ? (
                            <div>
                                <div className="text-sm text-slate-400 mb-2">
                                    Enlem: {form.location_lat}, Boylam: {form.location_lng}
                                </div>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${form.location_lat},${form.location_lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 text-sm font-medium underline transition-colors"
                                >
                                    Google Haritalar'da Aç
                                </a>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">Konum bilgisi yok.</p>
                        )}
                    </div>

                    {/* Notlar */}
                    <div className="bg-slate-900 shadow-xl rounded-lg p-4 border border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Notlar</h3>
                        <p className="text-sm text-slate-400 md:whitespace-pre-wrap leading-relaxed">
                            {form.notes || "Not eklenmemiş."}
                        </p>
                    </div>
                </div>

                {/* Onay Bilgisi */}
                {form.status === 'approved' && form.approved_at && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                        <p className="text-emerald-400 font-bold">Bu form onaylanmıştır.</p>
                        <p className="text-emerald-500/80 text-sm mt-1">
                            Onaylayan: {form.approver ? `${form.approver.first_name || ""} ${form.approver.last_name || ""}`.trim() : "Bilinmiyor"} • Tarih: {new Date(form.approved_at).toLocaleString('tr-TR')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
