import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function QuickPermitApprove() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [permitId, setPermitId] = useState(searchParams.get("permit_id") || "");
    const [sicilTc, setSicilTc] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);

        try {
            const cleanId = permitId.trim();
            const cleanSicilTc = sicilTc.trim();

            if (!cleanId || !cleanSicilTc) {
                throw new Error("Lütfen tüm alanları doldurun.");
            }

            // Simple check to decide if it's a TC or a Sicil (assume 11 digit is TC)
            const isTc = /^\d{11}$/.test(cleanSicilTc);

            // Using the RPC created in the migration
            const { data, error } = await supabase.rpc('approve_work_permit_coworker', {
                p_permit_id: cleanId,
                p_sicil_no: !isTc ? cleanSicilTc : null,
                p_tc_no: isTc ? cleanSicilTc : null
            });

            if (error) {
                // Return descriptive error from postgres RAISE EXCEPTION
                throw new Error(error.message || "İşlem sırasında bir hata oluştu.");
            }

            if (data === true) {
                setMessage({ type: 'success', text: 'Onay işleminiz başarıyla kaydedildi! Teşekkür ederiz.' });
            } else {
                throw new Error("İzin bulunamadı veya onaylanamadı.");
            }

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Bilinmeyen bir hata oluştu.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                    Hızlı Onay Merkezi
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Size atanan iş izinlerini sisteme giriş yapmadan buradan kolayca onaylayabilirsiniz.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">

                    {message && (
                        <div className={`mb-4 p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {message.text}
                        </div>
                    )}

                    {!message || message.type === 'error' ? (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="permitId" className="block text-sm font-medium text-gray-700">
                                    İş İzni Referans Kodu
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="permitId"
                                        name="permitId"
                                        type="text"
                                        required
                                        value={permitId}
                                        onChange={(e) => setPermitId(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="Formdaki Ref Kodu (örn: xxxx-xxxx-xxxx...)"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="sicilTc" className="block text-sm font-medium text-gray-700">
                                    Sicil veya TC Kimlik Numaranız
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="sicilTc"
                                        name="sicilTc"
                                        type="text"
                                        required
                                        value={sicilTc}
                                        onChange={(e) => setSicilTc(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="Kimlik doğrulaması için gereklidir"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {loading ? 'İşleniyor...' : 'Taahhüdü Kabul Et ve Onayla'}
                                </button>
                            </div>

                            <div className="mt-4 text-center">
                                <button type="button" onClick={() => navigate('/login')} className="text-sm text-indigo-600 hover:text-indigo-500">
                                    Normal Sisteme Giriş Yap
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Ana Ekrana Dön
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
