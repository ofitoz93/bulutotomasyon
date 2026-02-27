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
                <h1 className="text-2xl font-bold tracking-tight text-white">Ayarlar</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Profil ve hesap bilgilerinizi bu sayfadan güncelleyebilirsiniz.
                </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Kişisel Bilgiler</h2>
                </div>

                <div className="p-6">
                    {message.text && (
                        <div className={`mb-6 p-4 rounded-lg text-sm border ${message.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad</label>
                                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                    placeholder="Adınız" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Soyad</label>
                                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                    placeholder="Soyadınız" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefon Numarası</label>
                            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                placeholder="+90 53X XXX XX XX" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">E-posta Adresi</label>
                            <input type="email" value={profile?.email || ""} disabled
                                className="w-full bg-slate-950 border border-slate-700 text-slate-500 rounded-lg px-3 py-2 cursor-not-allowed text-sm"
                                title="E-posta adresi değiştirilemez" />
                            <p className="mt-1 text-xs text-slate-600">Kayıtlı e-posta adresiniz güvenlik sebebiyle değiştirilemez.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Sicil Numarası</label>
                            <input type="text" value={profile?.company_employee_no || "Atanmadı"} disabled
                                className="w-full bg-slate-950 border border-slate-700 text-slate-500 rounded-lg px-3 py-2 cursor-not-allowed text-sm font-mono"
                                title="Sicil Numarası yalnızca yöneticiniz tarafından veya otomatik atanabilir" />
                            <p className="mt-1 text-xs text-slate-600">Sicil numaranız şirket içi kayıtlarda ve iş izni onaylarında kullanılır.</p>
                        </div>

                        <div className="pt-4 border-t border-slate-800 flex justify-end">
                            <button type="submit" disabled={loading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                                {loading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
