import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

export default function SettingsPage() {
    const { profile, user, updateUserProfile } = useAuthStore();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // Parola değiştirme state'leri
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

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

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage({ type: "", text: "" });

        if (newPassword.length < 6) {
            setPasswordMessage({ type: "error", text: "Parola en az 6 karakter olmalıdır." });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: "error", text: "Parolalar eşleşmiyor." });
            return;
        }

        setPasswordLoading(true);
        try {
            if (!user?.email) throw new Error("Kullanıcı bilgisi bulunamadı.");

            // 1. Mevcut parolayı doğrula (bu aynı zamanda oturumu tazeler)
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (signInError) {
                throw new Error("Mevcut parolanız hatalı. Lütfen kontrol edip tekrar deneyin.");
            }

            // 2. Yeni parolayı güncelle
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setPasswordMessage({ type: "success", text: "Parolanız başarıyla güncellendi." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            console.error("Parola güncelleme hatası:", error);
            setPasswordMessage({ type: "error", text: error.message || "Bir hata oluştu." });
        } finally {
            setPasswordLoading(false);
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

            {/* Parola Değiştirme Bölümü */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Parola Değiştir</h2>
                </div>

                <div className="p-6">
                    {passwordMessage.text && (
                        <div className={`mb-6 p-4 rounded-lg text-sm border flex items-start gap-3 ${passwordMessage.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                            {passwordMessage.type === 'success' ? <ShieldCheck className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                            {passwordMessage.text}
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Mevcut Parola</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                    placeholder="••••••••"
                                    required
                                />
                                <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Yeni Parola</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                                </div>
                                <p className="mt-1.5 text-xs text-slate-500">En az 6 karakterden oluşmalıdır.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Parola Onayı</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <ShieldCheck className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {passwordLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Güncelleniyor...
                                    </>
                                ) : "Parolayı Güncelle"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
