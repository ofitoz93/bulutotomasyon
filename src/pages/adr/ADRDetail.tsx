
import { useEffect, useState, useRef } from "react";
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
import { ArrowLeft, CheckCircle, XCircle, MapPin, Image as ImageIcon, FileDown, PenLine, Loader2 } from "lucide-react";

export default function ADRDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [form, setForm] = useState<ADRForm | null>(null);
    const [answers, setAnswers] = useState<FormAnswer[]>([]);
    const [media, setMedia] = useState<FormMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Form tanımlarını bul
    const [formDefs, setFormDefs] = useState<ADRFormDefinition[]>([]);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    useEffect(() => {
        if (form) {
            let defs: ADRFormDefinition[] = [];
            if (form.form_type === 'TANK-ALICI') defs = [TANK_ALICI_FORM];
            else if (form.form_type === 'AMBALAJ-ALICI') defs = [AMBALAJ_ALICI_FORM];
            else if (form.form_type === 'YUKLEYEN-GONDEREN') {
                defs = [YUKLEYEN_GONDEREN_FORM];
                if (answers.some(a => a.question_key === 'tehlike_sinifi')) defs.push(PAKETLEYEN_FORM);
                if (answers.some(a => a.question_key === 'dolum_baglanti')) defs.push(DOLDURAN_FORM);
            }
            setFormDefs(defs);
        }
    }, [form, answers]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: formData, error: formError } = await supabase
                .from("adr_forms")
                .select("*, profiles!adr_forms_user_id_fkey(first_name, last_name), approver:profiles!adr_forms_approved_by_fkey(first_name, last_name)")
                .eq("id", id)
                .single();
            if (formError) throw formError;
            setForm(formData);

            const { data: ansData, error: ansError } = await supabase
                .from("form_answers")
                .select("*")
                .eq("form_id", id);
            if (ansError) throw ansError;
            setAnswers(ansData || []);

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

    // ─── PDF Export ───────────────────────────────────────────────────────────
    const handleExportPDF = async () => {
        if (!form) return;
        setPdfLoading(true);
        try {
            // Dinamik import for jspdf to avoid bundle bloat
            const { default: jsPDF } = await import("jspdf");

            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pageW = 210;
            const margin = 15;
            const contentW = pageW - margin * 2;
            let y = margin;

            const addText = (text: string, x: number, size: number, style: "normal" | "bold" = "normal", color: [number,number,number] = [30,30,40]) => {
                doc.setFontSize(size);
                doc.setFont("helvetica", style);
                doc.setTextColor(...color);
                doc.text(text, x, y);
            };

            const checkNewPage = (neededHeight: number) => {
                if (y + neededHeight > 285) {
                    doc.addPage();
                    y = margin;
                }
            };

            // ── Başlık ──
            doc.setFillColor(67, 56, 202); // indigo-700
            doc.rect(0, 0, pageW, 28, "F");
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("ADR KONTROL FORMU", margin, 12);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Plaka: ${form.plate_no}  •  ${form.form_type}  •  ${new Date(form.created_at).toLocaleString("tr-TR")}`, margin, 20);
            y = 36;

            // ── Durum Bandı ──
            const statusColor: [number,number,number] = form.status === "approved" ? [16,185,129] : form.status === "rejected" ? [239,68,68] : [245,158,11];
            const statusText = form.status === "approved" ? "ONAYLANDI" : form.status === "rejected" ? "REDDEDİLDİ" : "ONAY BEKLİYOR";
            doc.setFillColor(...statusColor);
            doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(statusText, pageW / 2, y + 6.5, { align: "center" });
            y += 16;

            // ── Temel Bilgiler ──
            doc.setFillColor(240, 240, 248);
            doc.roundedRect(margin, y, contentW, 32, 2, 2, "F");
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(80, 80, 120);
            doc.text("TEMEL BİLGİLER", margin + 4, y + 7);

            const info = [
                [`Araç Plakası`, form.plate_no || "-"],
                [`Şoför`, form.driver_name || "-"],
                [`Hazırlayan`, form.profiles ? `${form.profiles.first_name || ""} ${form.profiles.last_name || ""}`.trim() : "Müşteri Portalı"],
            ];
            doc.setFontSize(8.5);
            info.forEach(([label, value], i) => {
                const col = i % 2 === 0 ? margin + 4 : pageW / 2;
                const row = Math.floor(i / 2);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 100, 150);
                doc.text(label + ":", col, y + 16 + row * 9);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(30, 30, 50);
                doc.text(value, col + 28, y + 16 + row * 9);
            });
            y += 38;

            // ── Form Soruları ──
            for (const def of formDefs) {
                checkNewPage(20);
                doc.setFillColor(99, 102, 241);
                doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, "F");
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(255, 255, 255);
                doc.text(def.title.toUpperCase(), margin + 4, y + 6.3);
                y += 13;

                for (const sec of def.sections) {
                    checkNewPage(12);
                    doc.setFillColor(230, 230, 245);
                    doc.rect(margin, y, contentW, 7, "F");
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(80, 80, 120);
                    doc.text(sec.title.toUpperCase(), margin + 3, y + 5);
                    y += 9;

                    for (const q of sec.questions) {
                        checkNewPage(9);
                        const ans = answers.find(a => a.question_key === q.key);
                        const result = ans?.answer_value?.result || "-";

                        // Zebra stripped rows
                        if (sec.questions.indexOf(q) % 2 === 0) {
                            doc.setFillColor(248, 248, 252);
                            doc.rect(margin, y - 1, contentW, 8, "F");
                        }

                        doc.setFontSize(8);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(50, 50, 70);
                        const lines = doc.splitTextToSize(q.text, contentW - 40);
                        doc.text(lines[0], margin + 3, y + 4.5);

                        // Result rengi
                        let resultColor: [number,number,number] = [80, 80, 100];
                        if (["Evet", "Uygun"].includes(result)) resultColor = [16, 185, 129];
                        else if (["Hayır", "Uygun Değil", "Uygunsuz"].includes(result)) resultColor = [239, 68, 68];
                        else if (result === "Kısmen") resultColor = [245, 158, 11];

                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(...resultColor);
                        doc.text(result, pageW - margin - 3, y + 4.5, { align: "right" });
                        y += 8;
                    }
                    y += 3;
                }
                y += 5;
            }

            // ── Konum ──
            if (form.location_lat && form.location_lng) {
                checkNewPage(22);
                doc.setFillColor(240, 240, 248);
                doc.roundedRect(margin, y, contentW, 18, 2, 2, "F");
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(80, 80, 120);
                doc.text("📍 KONUM BİLGİSİ", margin + 4, y + 7);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(50, 50, 70);
                doc.text(`Enlem: ${form.location_lat}   Boylam: ${form.location_lng}`, margin + 4, y + 14);
                y += 24;
            }

            // ── Notlar ──
            if (form.notes) {
                checkNewPage(22);
                doc.setFillColor(252, 252, 240);
                doc.roundedRect(margin, y, contentW, 18, 2, 2, "F");
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 100, 30);
                doc.text("NOTLAR", margin + 4, y + 7);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(60, 60, 30);
                const noteLines = doc.splitTextToSize(form.notes, contentW - 8);
                doc.text(noteLines, margin + 4, y + 14);
                y += 14 + noteLines.length * 5;
            }

            // ── Onay Bilgisi ──
            if (form.status === "approved" && form.approved_at) {
                checkNewPage(18);
                doc.setFillColor(209, 250, 229);
                doc.roundedRect(margin, y, contentW, 16, 2, 2, "F");
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(16, 100, 60);
                doc.text("✓ ONAYLANDI", margin + 4, y + 7);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                const approverName = form.approver ? `${form.approver.first_name || ""} ${form.approver.last_name || ""}`.trim() : "Bilinmiyor";
                doc.text(`Onaylayan: ${approverName}   •   Tarih: ${new Date(form.approved_at).toLocaleString("tr-TR")}`, margin + 4, y + 13);
                y += 22;
            }

            // ── Şoför İmzası ──
            if ((form as any).driver_signature) {
                checkNewPage(70);
                doc.setFillColor(240, 240, 250);
                doc.roundedRect(margin, y, contentW, 65, 2, 2, "F");
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(80, 80, 120);
                doc.text("ŞOFÖR İMZASI", margin + 4, y + 8);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 140);
                doc.text(`Şoför: ${form.driver_name || "-"}`, margin + 4, y + 14);

                try {
                    // signature is base64 png
                    const sigData = (form as any).driver_signature as string;
                    doc.addImage(sigData, "PNG", margin + 4, y + 18, contentW - 8, 40);
                } catch (e) {
                    doc.setTextColor(150, 50, 50);
                    doc.text("İmza görüntülenemedi.", margin + 4, y + 40);
                }

                // underline
                doc.setDrawColor(160, 160, 200);
                doc.setLineWidth(0.3);
                doc.line(margin + 4, y + 60, margin + contentW / 2.5, y + 60);
                doc.setFontSize(7.5);
                doc.setTextColor(130, 130, 160);
                doc.text("İmza", margin + 4, y + 64);
                y += 70;
            }

            // ── Footer ──
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(160, 160, 180);
                doc.text(
                    `ADR Formu • ${form.plate_no} • Sayfa ${i} / ${pageCount} • ${new Date().toLocaleString("tr-TR")}`,
                    pageW / 2, 292, { align: "center" }
                );
            }

            const filename = `ADR_${form.plate_no}_${new Date(form.created_at).toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
        } catch (err: any) {
            alert("PDF oluşturulamadı: " + err.message);
        } finally {
            setPdfLoading(false);
        }
    };

    const getAnswer = (key: string) => {
        const ans = answers.find(a => a.question_key === key);
        return ans?.answer_value || { result: "-" };
    };

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
        <div className="max-w-4xl mx-auto space-y-6 pb-20" ref={printRef}>
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
                    <p className="text-sm text-slate-500">{form.form_type} • {new Date(form.created_at).toLocaleString('tr-TR')} • Hazırlayan: {form.profiles ? `${form.profiles.first_name || ""} ${form.profiles.last_name || ""}`.trim() : "Müşteri Portalı"}</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* PDF Export */}
                    <button
                        onClick={handleExportPDF}
                        disabled={pdfLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        title="PDF İndir"
                    >
                        {pdfLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <FileDown className="w-4 h-4" />
                        }
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    {isPending && canApprove && (
                        <>
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
                        </>
                    )}
                </div>
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

                {/* 4. Şoför İmzası */}
                {(form as any).driver_signature && (
                    <div className="bg-slate-900 shadow-xl rounded-lg p-4 border border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-indigo-400" /> Şoför İmzası
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="flex-1">
                                <p className="text-xs text-slate-500 mb-1">Şoför</p>
                                <p className="text-slate-200 font-semibold">{form.driver_name || "-"}</p>
                            </div>
                            <div className="flex-shrink-0 border border-slate-700 rounded-lg overflow-hidden bg-slate-800/50 p-2">
                                <img
                                    src={(form as any).driver_signature}
                                    alt="Şoför İmzası"
                                    className="max-h-36 max-w-xs object-contain"
                                    style={{ imageRendering: "crisp-edges" }}
                                />
                                <p className="text-center text-xs text-slate-600 mt-1 border-t border-slate-700 pt-1">İmza</p>
                            </div>
                        </div>
                    </div>
                )}

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
