import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export default function SettingsPage() {
    const { profile, user, updateUserProfile } = useAuthStore();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || "");
            setLastName(profile.last_name || "");
            setPhoneNumber(profile.phone_number || "");
        }
    }, [profile]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        setLoading(true);

        try {
            if (!user) throw new Error("Oturum açık değil!");

            const updates = {
                first_name: firstName,
                last_name: lastName,
                phone_number: phoneNumber,
            };

            const { error: profileError } = await supabase
                .from("profiles")
                .update(updates)
                .eq("id", user.id);

            if (profileError) throw profileError;

            // Sadece metadata olarak güncelleyelim. Telefon numarası Auth servisinde SMS kapalıyken 
            // "phone" parametresiyle güncellenemez, bu da tüm isteğin hata vermesine (ve ismin de güncellenmemesine) yol açıyordu.
            // Arka planda veritabanı Trigger'ı ile phone ve isim senkronize edilecek.
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`.trim(),
                    display_name: `${firstName} ${lastName}`.trim(),
                    name: `${firstName} ${lastName}`.trim()
                }
            });

            if (authError) {
                console.error("Auth metadata güncelleme hatası:", authError);
            }

            // Eğer zustand store'unda bu metot varsa state'i de güncelliyoruz
            if (updateUserProfile) {
                updateUserProfile(updates);
            }

            setMessage({ type: "success", text: "Profil bilgileriniz başarıyla güncellendi." });
        } catch (error: any) {
            console.error("Profil güncelleme hatası:", error);
            setMessage({ type: "error", text: error.message || "Bir hata oluştu." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Ayarlar</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Profil ve hesap bilgilerinizi bu sayfadan güncelleyebilirsiniz.
                </p>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase">Kişisel Bilgiler</h2>
                </div>

                <div className="p-6">
                    {message.text && (
                        <div className={`mb-6 p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ad
                                </label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    placeholder="Adınız"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Soyad
                                </label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    placeholder="Soyadınız"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefon Numarası
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="+90 53X XXX XX XX"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                E-posta Adresi
                            </label>
                            <input
                                type="email"
                                value={profile?.email || ""}
                                disabled
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                                title="E-posta adresi değiştirilemez"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                Kayıtlı e-posta adresiniz güvenlik sebebiyle değiştirilemez.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Sicil Numarası
                            </label>
                            <input
                                type="text"
                                value={profile?.company_employee_no || "Atanmadı"}
                                disabled
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed text-sm font-mono"
                                title="Sicil Numarası yalnızca yöneticiniz tarafından veya otomatik atanabilir"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                Sicil numaranız şirket içi kayıtlarda ve iş izni onaylarında kullanılır.
                            </p>
                        </div>

                        <div className="pt-4 border-t flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                            >
                                {loading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
