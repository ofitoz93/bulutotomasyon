import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

interface ProfileCompletionProps {
    onComplete: () => void;
}

export default function ProfileCompletion({ onComplete }: ProfileCompletionProps) {
    const { user, profile } = useAuthStore();
    const [firstName, setFirstName] = useState(profile?.first_name || "");
    const [lastName, setLastName] = useState(profile?.last_name || "");
    const [tcNo, setTcNo] = useState(profile?.tc_no || "");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim() || !tcNo.trim()) {
            setError("Lütfen tüm alanları doldurun.");
            return;
        }

        if (tcNo.length !== 11 || !/^\d+$/.test(tcNo)) {
            setError("TC Kimlik Numarası 11 haneli rakamlardan oluşmalıdır.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    tc_no: tcNo
                })
                .eq('id', user?.id);

            if (updateError) {
                console.error("RAW_ERROR:", updateError);
                if (updateError.message.includes('unique constraint')) {
                    throw new Error("Bu TC Kimlik Numarası zaten başka bir hesaba kayıtlı. (HATA: " + updateError.message + ")");
                }
                throw new Error("Hata: " + updateError.message);
            }

            onComplete(); // Başarılı olduğunda ebeveyn componenti tetikle (örneğin Dashboard'a geçiş yap)

            // Zorlayıcı yenileme, AuthStore'un günceli alması için daha sağlıklı
            window.location.reload();

        } catch (err: any) {
            setError(err.message || "Profil güncellenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in relative overflow-hidden">
                {/* Dekoratif Çizgi */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 to-red-700"></div>

                <div className="text-center mb-6 mt-4">
                    <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Profil Bilgileri Eksik</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        Sistemi kullanmaya devam edebilmek için yasal zorunluluklar gereği aşağıdaki bilgileri eksiksiz doldurmanız gerekmektedir.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-start">
                        <svg className="w-5 h-5 mr-2 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Adınız *</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Adınız"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Soyadınız *</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Soyadınız"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik Numaranız *</label>
                        <input
                            type="text"
                            maxLength={11}
                            value={tcNo}
                            onChange={(e) => setTcNo(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            placeholder="11 Haneli TC No"
                            required
                        />
                        <p className="text-xs text-gray-400 mt-1">Sistem modüllerindeki atama ve doğrulama işlemleri için gereklidir.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50"
                    >
                        {loading ? "Kaydediliyor..." : "Bilgileri Kaydet ve Devam Et"}
                    </button>
                </form>
            </div>
        </div>
    );
}
