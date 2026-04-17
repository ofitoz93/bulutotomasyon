import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Clock, PenLine, ShieldCheck, Users, XCircle, Loader2 } from "lucide-react";

interface Participant {
    user_id: string;
    full_name: string;
    is_signed: boolean;
    signed_at: string | null;
}

interface CourseInfo {
    id: string;
    title: string;
    start_date: string;
}

type SignStep = "list" | "tc_verify" | "signature_pad" | "done";

export default function PublicClassSign() {
    const { courseId } = useParams<{ courseId: string }>();

    const [course, setCourse] = useState<CourseInfo | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // İmza akışı
    const [step, setStep] = useState<SignStep>("list");
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [tcNo, setTcNo] = useState("");
    const [tcError, setTcError] = useState("");
    const [tcVerifying, setTcVerifying] = useState(false);

    // İmza pad
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successName, setSuccessName] = useState("");

    useEffect(() => {
        if (courseId) fetchData();
    }, [courseId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Kurs bilgisini çek
            const { data: courseData, error: courseError } = await supabase
                .from("courses")
                .select("id, title, start_date")
                .eq("id", courseId)
                .single();

            if (courseError || !courseData) {
                setError("Eğitim bulunamadı veya link hatalı.");
                return;
            }
            setCourse(courseData);

            // TC'siz katılımcı listesini RPC ile çek
            const { data: participantData, error: pError } = await supabase
                .rpc("get_class_participants_public", { p_course_id: courseId });

            if (pError) {
                console.error("Katılımcı listesi alınamadı:", pError);
                setError("Katılımcı listesi yüklenirken hata oluştu.");
                return;
            }
            setParticipants(participantData || []);
        } catch (err) {
            console.error(err);
            setError("Beklenmeyen bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const openSignFlow = (participant: Participant) => {
        if (participant.is_signed) return;
        setSelectedParticipant(participant);
        setTcNo("");
        setTcError("");
        setStep("tc_verify");
    };

    const handleTcVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tcNo.trim()) {
            setTcError("TC kimlik numaranızı giriniz.");
            return;
        }
        if (tcNo.length < 5) {
            setTcError("Geçersiz TC kimlik numarası. En az 5 haneli olmalıdır.");
            return;
        }
        setTcVerifying(true);
        setTcError("");

        try {
            // SERVER-SIDE TC doğrulama — TC yanlışsa imza aşamasına geçilmez
            const { data, error } = await supabase.rpc("verify_participant_tc", {
                p_course_id: courseId,
                p_user_id: selectedParticipant!.user_id,
                p_tc_no: tcNo,
            });

            if (error) throw error;

            if (!data.success) {
                setTcError(data.error || "TC kimlik numarası doğrulanamadı.");
                return;
            }

            // TC doğrulandı → imza aşamasına geç
            setStep("signature_pad");
            setHasSignature(false);
        } catch (err: any) {
            console.error("TC doğrulama hatası:", err);
            setTcError(err.message || "Sunucu hatası oluştu. Lütfen tekrar deneyin.");
        } finally {
            setTcVerifying(false);
        }
    };

    // Canvas çizim işlemleri
    const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ("touches" in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
        setHasSignature(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const pos = getPos(e);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#1e293b";
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const endDraw = () => setIsDrawing(false);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handleSubmitSignature = async () => {
        if (!hasSignature || !canvasRef.current || !selectedParticipant || !courseId) return;
        const signatureData = canvasRef.current.toDataURL("image/png");
        setSubmitting(true);

        try {
            const { data, error: rpcError } = await supabase.rpc("sign_class_attendance", {
                p_course_id: courseId,
                p_tc_no: tcNo,
                p_signature: signatureData,
            });

            if (rpcError) throw rpcError;

            if (!data.success) {
                setTcError(data.error || "İmzalama başarısız.");
                setStep("tc_verify");
                setSubmitting(false);
                return;
            }

            setSuccessName(data.full_name || selectedParticipant.full_name);
            setStep("done");

            // Listeyi güncelle
            setParticipants(prev =>
                prev.map(p =>
                    p.user_id === selectedParticipant.user_id
                        ? { ...p, is_signed: true, signed_at: new Date().toISOString() }
                        : p
                )
            );
        } catch (err: any) {
            console.error(err);
            setTcError(err.message || "Hata oluştu. TC kimliğini kontrol ediniz.");
            setStep("tc_verify");
        } finally {
            setSubmitting(false);
        }
    };

    const resetFlow = () => {
        setStep("list");
        setSelectedParticipant(null);
        setTcNo("");
        setTcError("");
        setHasSignature(false);
        setSuccessName("");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    <p className="text-slate-400 text-sm">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800 border border-rose-500/30 rounded-2xl p-8 max-w-md text-center">
                    <XCircle className="w-14 h-14 text-rose-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Hata</h2>
                    <p className="text-slate-400">{error}</p>
                </div>
            </div>
        );
    }

    const signedCount = participants.filter(p => p.is_signed).length;
    const totalCount = participants.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-8 px-4">
            <div className="max-w-2xl mx-auto">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl mb-4">
                        <ShieldCheck className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">{course?.title}</h1>
                    <p className="text-slate-400 text-sm">
                        {course?.start_date
                            ? new Date(course.start_date).toLocaleDateString("tr-TR", {
                                day: "numeric", month: "long", year: "numeric",
                                hour: "2-digit", minute: "2-digit"
                            })
                            : ""}
                    </p>

                    {/* İlerleme */}
                    <div className="mt-4 inline-flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-5 py-2.5">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">
                            <span className="font-bold text-indigo-400">{signedCount}</span>
                            <span className="text-slate-500"> / {totalCount}</span>
                            <span className="text-slate-400 ml-1">kişi imzaladı</span>
                        </span>
                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: totalCount > 0 ? `${(signedCount / totalCount) * 100}%` : "0%" }}
                            />
                        </div>
                    </div>
                </div>

                {/* Katılımcı Listesi */}
                {step === "list" && (
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-indigo-400" />
                            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Katılımcı Listesi</h2>
                            <span className="ml-auto text-xs text-slate-500">İmza için isminize tıklayın</span>
                        </div>

                        {participants.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                <p className="text-sm">Bu eğitime henüz katılımcı eklenmemiş.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-700/50">
                                {participants.map((p, idx) => (
                                    <li key={p.user_id}
                                        className={`flex items-center justify-between px-5 py-4 transition-all duration-200 ${p.is_signed
                                            ? "opacity-70"
                                            : "hover:bg-indigo-500/5 cursor-pointer"
                                            }`}
                                        onClick={() => !p.is_signed && openSignFlow(p)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-mono text-slate-600 w-6 text-right">{idx + 1}</span>
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${p.is_signed
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-slate-700 text-slate-300 border border-slate-600"
                                                }`}>
                                                {p.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-200">{p.full_name}</p>
                                                {p.is_signed && p.signed_at && (
                                                    <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(p.signed_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {p.is_signed ? (
                                            <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold">
                                                <CheckCircle className="w-3.5 h-3.5" /> İmzalandı
                                            </div>
                                        ) : (
                                            <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                                                <PenLine className="w-3.5 h-3.5" /> İmzala
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Step: TC Doğrulama */}
                {step === "tc_verify" && selectedParticipant && (
                    <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 max-w-md mx-auto">
                        <button onClick={resetFlow} className="text-slate-500 hover:text-slate-300 text-sm mb-6 flex items-center gap-1 transition-colors">
                            ← Listeye Dön
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck className="w-7 h-7 text-indigo-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white">Kimlik Doğrulama</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                <span className="text-indigo-400 font-semibold">{selectedParticipant.full_name}</span> olarak imzalamak için TC kimlik numaranızı girin.
                            </p>
                        </div>

                        <form onSubmit={handleTcVerify} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    TC Kimlik / Sicil No
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={tcNo}
                                    onChange={e => setTcNo(e.target.value)}
                                    placeholder="TC kimlik numaranız"
                                    className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white rounded-xl px-4 py-3.5 text-lg tracking-widest outline-none transition-all placeholder-slate-600"
                                    autoFocus
                                />
                                {tcError && (
                                    <div className="mt-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
                                        <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-rose-400">{tcError}</p>
                                    </div>
                                )}
                                <p className="text-xs text-slate-600 mt-2">TC kimliğiniz güvenli biçimde doğrulanır. Listede görüntülenmez.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={tcVerifying || !tcNo.trim()}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                            >
                                {tcVerifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Doğrulanıyor...</> : "Doğrula ve İmzala"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Step: İmza Pad */}
                {step === "signature_pad" && selectedParticipant && (
                    <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-6 max-w-lg mx-auto">
                        <button onClick={() => setStep("tc_verify")} className="text-slate-500 hover:text-slate-300 text-sm mb-5 flex items-center gap-1 transition-colors">
                            ← Geri
                        </button>

                        <div className="text-center mb-5">
                            <h2 className="text-lg font-bold text-white">İmzanızı Atın</h2>
                            <p className="text-slate-400 text-sm mt-1">Aşağıdaki alana parmağınızla veya mouse ile imzanızı atın</p>
                        </div>

                        {/* İmza Alanı */}
                        <div className="rounded-xl overflow-hidden border-2 border-dashed border-slate-600 bg-white mb-4 relative select-none">
                            <canvas
                                ref={canvasRef}
                                width={700}
                                height={320}
                                className="w-full touch-none block"
                                style={{ cursor: "crosshair", height: "280px" }}
                                onMouseDown={startDraw}
                                onMouseMove={draw}
                                onMouseUp={endDraw}
                                onMouseLeave={endDraw}
                                onTouchStart={startDraw}
                                onTouchMove={draw}
                                onTouchEnd={endDraw}
                            />
                            {!hasSignature && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
                                    <span className="text-4xl opacity-20">✍️</span>
                                    <p className="text-slate-400 text-sm font-medium">Parmağınızla veya mouse ile imzalayın</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mb-5">
                            <button
                                onClick={clearSignature}
                                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                🗑 Temizle
                            </button>
                            <span className="text-xs text-slate-500">{selectedParticipant.full_name}</span>
                        </div>

                        <button
                            onClick={handleSubmitSignature}
                            disabled={!hasSignature || submitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 text-base"
                        >
                            {submitting ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Kaydediliyor...</>
                            ) : (
                                <><CheckCircle className="w-5 h-5" /> İmzayı Onayla ve Kaydet</>
                            )}
                        </button>
                    </div>
                )}

                {/* Step: Başarı */}
                {step === "done" && (
                    <div className="bg-slate-800/60 backdrop-blur border border-emerald-500/30 rounded-2xl p-10 max-w-md mx-auto text-center">
                        <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">İmza Başarıyla Alındı!</h2>
                        <p className="text-slate-400 mb-2">
                            <span className="text-emerald-400 font-semibold">{successName}</span> adına imzanız kaydedilmiştir.
                        </p>
                        <p className="text-xs text-slate-600 mb-8">
                            {new Date().toLocaleString("tr-TR")}
                        </p>
                        <button
                            onClick={resetFlow}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                        >
                            Katılımcı Listesine Dön
                        </button>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-slate-700 mt-8">
                    TC kimlik numaraları şifrelenmiş olup listede görüntülenmez.
                </p>
            </div>
        </div>
    );
}
