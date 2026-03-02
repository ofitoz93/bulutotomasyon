import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface PendingPermit {
    permit_id: string;
    work_date: string;
    company_name: string;
    department: string;
    estimated_hours: number;
    status: string;
}

export default function QuickPermitApprove() {
    const navigate = useNavigate();

    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1 State
    const [identity, setIdentity] = useState("");
    const [pendingPermits, setPendingPermits] = useState<PendingPermit[]>([]);

    // Step 2 State
    const [selectedPermit, setSelectedPermit] = useState<PendingPermit | null>(null);

    // Step 3 State
    const [confirmIdentity, setConfirmIdentity] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // STEP 1: ARAMA
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);

        try {
            const cleanIdentity = identity.trim();
            if (!cleanIdentity) throw new Error("Lütfen TC Kimlik veya Sicil Numaranızı girin.");

            const { data, error } = await supabase.rpc('get_pending_permits_by_identity', {
                p_identity: cleanIdentity
            });

            if (error) {
                throw new Error(error.message || "İzinler sorgulanırken hata oluştu.");
            }

            if (!data || data.length === 0) {
                throw new Error("Adınıza atanmış, onay bekleyen bir iş izni bulunamadı.");
            }

            setPendingPermits(data);
            setStep(2);

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Bilinmeyen bir hata oluştu.' });
        } finally {
            setLoading(false);
        }
    };

    // STEP 2: SEÇİM
    const handleSelectPermit = (permit: PendingPermit) => {
        setSelectedPermit(permit);
        setStep(3);
        setMessage(null);
    };

    // STEP 3: ONAYLAMA
    const handleApprove = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);

        try {
            const cleanConfirm = confirmIdentity.trim();
            if (!cleanConfirm || !selectedPermit) {
                throw new Error("Lütfen doğrulama için TC/Sicil numaranızı tekrar girin.");
            }

            if (cleanConfirm !== identity.trim()) {
                throw new Error("Girdiğiniz numara ilk adımda arama yaptığınız numara ile eşleşmiyor!");
            }

            const isTc = /^\d{11}$/.test(cleanConfirm);

            const { data, error } = await supabase.rpc('approve_work_permit_coworker', {
                p_permit_id: selectedPermit.permit_id,
                p_sicil_no: !isTc ? cleanConfirm : null,
                p_tc_no: isTc ? cleanConfirm : null
            });

            if (error) {
                throw new Error(error.message || "Onaylama sırasında bir hata oluştu.");
            }

            if (data === true) {
                setMessage({ type: 'success', text: 'İş izni sözleşmesini başarıyla onayladınız. Teşekkür ederiz!' });
                setStep(1); // Reset or we could show a success summary
                setIdentity("");
                setConfirmIdentity("");
                setPendingPermits([]);
            } else {
                throw new Error("İzin onaylanamadı.");
            }

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Bilinmeyen bir hata oluştu.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="sm:mx-auto sm:w-full sm:max-w-xl">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
                    Hızlı İş İzni Onayı
                </h2>

                {/* Stepper UI */}
                <div className="mt-6 flex items-center justify-center space-x-4 text-sm font-medium">
                    <div className={`flex items-center ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${step >= 1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800'}`}>1</span>
                        Arama
                    </div>
                    <div className="w-8 h-px bg-slate-300 dark:bg-slate-700"></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${step >= 2 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800'}`}>2</span>
                        Seçim
                    </div>
                    <div className="w-8 h-px bg-slate-300 dark:bg-slate-700"></div>
                    <div className={`flex items-center ${step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${step >= 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800'}`}>3</span>
                        Taahhüt
                    </div>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
                <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl border border-transparent dark:border-slate-800 sm:rounded-2xl sm:px-10">

                    {message && (
                        <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* ADIM 1: ARAMA EKRANI */}
                    {step === 1 && (
                        <form className="space-y-6" onSubmit={handleSearch}>
                            <p className="text-slate-600 dark:text-slate-400 text-sm text-center mb-4 leading-relaxed">
                                Adınıza atanmış ve onayınızı bekleyen iş izinlerini görmek için lütfen sicil veya TC kimlik numaranızı girin.
                            </p>
                            <div>
                                <label htmlFor="identity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                                    Sicil veya TC Kimlik Numaranız
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="identity"
                                        name="identity"
                                        type="text"
                                        required
                                        value={identity}
                                        onChange={(e) => setIdentity(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm transition-all"
                                        placeholder="Örn: 12345678901"
                                    />
                                </div>
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-950 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Sorgulanıyor...' : 'İzinleri Bul'}
                                </button>
                            </div>
                            <div className="mt-4 text-center">
                                <button type="button" onClick={() => navigate('/login')} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                                    Normal Sisteme Giriş Yap
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ADIM 2: LİSTE VE SEÇİM EKRANI */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Onay Bekleyen İzinleriniz</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Lütfen taahhütnameyi okuyup onaylamak istediğiniz izni seçin:</p>

                            <div className="space-y-3 mt-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {pendingPermits.map(permit => (
                                    <div
                                        key={permit.permit_id}
                                        onClick={() => handleSelectPermit(permit)}
                                        className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg transition-all bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-indigo-700 dark:text-indigo-400 text-lg">
                                                    Form Ref: {permit.permit_id.substring(0, 8)}
                                                </div>
                                                <div className="text-sm text-slate-700 dark:text-slate-300 mt-2 flex items-center">
                                                    <span className="font-bold mr-2 opacity-60">Tarih:</span> {new Date(permit.work_date).toLocaleDateString('tr-TR')}
                                                </div>
                                                <div className="text-sm text-slate-700 dark:text-slate-300 mt-1 flex items-center">
                                                    <span className="font-bold mr-2 opacity-60">Firma/Bölüm:</span> {permit.company_name || "-"} / {permit.department || "-"}
                                                </div>
                                            </div>
                                            <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 text-xs px-2.5 py-1.5 rounded-full font-bold border border-amber-200 dark:border-amber-900/30">
                                                Onay Bekliyor
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="w-full flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
                                >
                                    Geri Dön
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ADIM 3: TAAHHÜTNAME VE BEYAN */}
                    {step === 3 && selectedPermit && (
                        <form className="space-y-6" onSubmit={handleApprove}>
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 mb-6 shadow-inner">
                                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase mb-3 flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Çalışan Taahhütnamesi
                                </h4>
                                <div className="text-xs text-indigo-800 dark:text-indigo-400 space-y-3 h-48 overflow-y-auto bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-indigo-100/50 dark:border-slate-700 leading-relaxed">
                                    <p className="flex items-start"><span className="font-bold mr-2">1.</span> Yapacağım iş ile ilgili tehlikeleri ve alınması gereken önlemleri anladım.</p>
                                    <p className="flex items-start"><span className="font-bold mr-2">2.</span> İşim süresince belirlenen tüm kişisel koruyucu donanımları (KKD) eksiksiz kullanacağımı taahhüt ederim.</p>
                                    <p className="flex items-start"><span className="font-bold mr-2">3.</span> İzinsiz veya yetkisiz müdahalelerde bulunmayacağım.</p>
                                    <p className="flex items-start"><span className="font-bold mr-2">4.</span> İş güvenliği kurallarını ihlal etmem durumunda oluşabilecek tüm sorumlulukların tarafıma ait olduğunu kabul ediyorum.</p>
                                    <p className="flex items-start"><span className="font-bold mr-2">5.</span> Gerekli güvenlik eğitimlerini aldığımı ve çalışma alanının kurallarına harfiyen uyacağımı beyan ederim.</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 font-semibold leading-snug">
                                    Yukarıdaki şartları okudum, anladım ve kabul ediyorum. Güvenlik teyidi için lütfen kimlik numaranızı tekrar giriniz.
                                </p>
                                <div>
                                    <input
                                        type="text"
                                        required
                                        value={confirmIdentity}
                                        onChange={(e) => setConfirmIdentity(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm transition-all"
                                        placeholder="TC/Sicil numaranızı tekrar yazın"
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    disabled={loading}
                                    className="flex-1 justify-center py-3 px-4 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-emerald-600/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-slate-950 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'İşleniyor...' : 'Onaylıyorum'}
                                </button>
                            </div>
                        </form>
                    )}

                </div>
            </div>
        </div>
    );
}
