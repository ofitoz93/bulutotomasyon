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
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-xl">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                    Hızlı İş İzni Onayı
                </h2>

                {/* Stepper UI */}
                <div className="mt-4 flex items-center justify-center space-x-4 text-sm font-medium">
                    <div className={`flex items-center ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>1</span>
                        Arama
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>2</span>
                        Seçim
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center ${step >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>3</span>
                        Taahhüt
                    </div>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">

                    {message && (
                        <div className={`mb-6 p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* ADIM 1: ARAMA EKRANI */}
                    {step === 1 && (
                        <form className="space-y-6" onSubmit={handleSearch}>
                            <p className="text-gray-600 text-sm text-center mb-4">
                                Adınıza atanmış ve onayınızı bekleyen iş izinlerini görmek için lütfen sicil veya TC kimlik numaranızı girin.
                            </p>
                            <div>
                                <label htmlFor="identity" className="block text-sm font-medium text-gray-700">
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
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="Örn: 12345678901"
                                    />
                                </div>
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {loading ? 'Sorgulanıyor...' : 'İzinleri Bul'}
                                </button>
                            </div>
                            <div className="mt-4 text-center">
                                <button type="button" onClick={() => navigate('/login')} className="text-sm text-indigo-600 hover:text-indigo-500">
                                    Normal Sisteme Giriş Yap
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ADIM 2: LİSTE VE SEÇİM EKRANI */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Onay Bekleyen İzinleriniz</h3>
                            <p className="text-sm text-gray-500">Lütfen taahhütnameyi okuyup onaylamak istediğiniz izni seçin:</p>

                            <div className="space-y-3 mt-4 max-h-96 overflow-y-auto pr-2">
                                {pendingPermits.map(permit => (
                                    <div
                                        key={permit.permit_id}
                                        onClick={() => handleSelectPermit(permit)}
                                        className="border rounded-lg p-4 cursor-pointer hover:border-indigo-500 hover:shadow-md transition bg-gray-50 hover:bg-white"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-semibold text-indigo-700">
                                                    Form Ref: {permit.permit_id.substring(0, 8)}
                                                </div>
                                                <div className="text-sm text-gray-700 mt-1">
                                                    <span className="font-medium">Tarih:</span> {new Date(permit.work_date).toLocaleDateString('tr-TR')}
                                                </div>
                                                <div className="text-sm text-gray-700">
                                                    <span className="font-medium">Firma/Bölüm:</span> {permit.company_name || "-"} / {permit.department || "-"}
                                                </div>
                                            </div>
                                            <div className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-medium">
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
                                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    Geri Dön
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ADIM 3: TAAHHÜTNAME VE BEYAN */}
                    {step === 3 && selectedPermit && (
                        <form className="space-y-6" onSubmit={handleApprove}>
                            <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-6">
                                <h4 className="text-sm font-bold text-blue-900 uppercase mb-2">Çalışan Taahhütnamesi</h4>
                                <div className="text-xs text-blue-800 space-y-2 h-40 overflow-y-auto bg-white p-3 rounded border">
                                    <p>1. Yapacağım iş ile ilgili tehlikeleri ve alınması gereken önlemleri anladım.</p>
                                    <p>2. İşim süresince belirlenen tüm kişisel koruyucu donanımları (KKD) eksiksiz kullanacağımı taahhüt ederim.</p>
                                    <p>3. İzinsiz veya yetkisiz müdahalelerde bulunmayacağım.</p>
                                    <p>4. İş güvenliği kurallarını ihlal etmem durumunda oluşabilecek tüm sorumlulukların tarafıma ait olduğunu kabul ediyorum.</p>
                                    <p>5. Gerekli güvenlik eğitimlerini aldığımı ve çalışma alanının kurallarına harfiyen uyacağımı beyan ederim.</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <p className="text-sm text-gray-700 mb-3 font-medium">
                                    Yukarıdaki şartları okudum, anladım ve kabul ediyorum. Güvenlik teyidi için lütfen kimlik numaranızı tekrar giriniz.
                                </p>
                                <div>
                                    <input
                                        type="text"
                                        required
                                        value={confirmIdentity}
                                        onChange={(e) => setConfirmIdentity(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="TC/Sicil numaranızı tekrar yazın"
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    disabled={loading}
                                    className="flex-1 justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
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
