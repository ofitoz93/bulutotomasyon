import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function UpdatePassword() {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Oturum kontrolü
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                // Şifre sıfırlama linkine tıklandığında URL'de access_token olur ve Supabase bunu otomatik yakalar.
                // Eğer burada session yoksa, link geçersizdir veya kullanıcı linke henüz tıklamamıştır.
                // Ancak auth state change listener (App.tsx) bunu yakalayacaktır.
            }
        });
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
                data: { force_password_change: false }
            });

            if (error) throw error;

            setMessage("Şifreniz başarıyla güncellendi! Panele yönlendiriliyorsunuz...");

            // Profil güncellemesi gerekebilir (opsiyonel)

            setTimeout(() => {
                navigate("/app");
            }, 2000);

        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="mt-8 space-y-6" onSubmit={handleUpdatePassword}>
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold">Yeni Şifre Belirle</h2>
                <p className="text-sm text-gray-500">Lütfen güvenli bir şifre seçin.</p>
            </div>

            {error && (
                <div className="p-3 text-sm text-red-600 bg-red-100 rounded-md">
                    {error}
                </div>
            )}

            {message && (
                <div className="p-3 text-sm text-green-600 bg-green-100 rounded-md">
                    {message}
                </div>
            )}

            <div className="rounded-md shadow-sm -space-y-px">
                <div>
                    <label htmlFor="password" className="sr-only">
                        Yeni Şifre
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Yeni Şifre"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={6}
                    />
                </div>
            </div>

            <div>
                <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                </button>
            </div>
        </form>
    );
}
