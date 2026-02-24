import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const setSession = useAuthStore((state) => state.setSession);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        if (data.session) {
            setSession(data.session);

            // Profili çekelim
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.session.user.id)
                .single();

            if (profile?.role === 'system_admin') {
                navigate("/admin/companies");
            } else {
                navigate("/app");
            }
        }
        setLoading(false);
    };

    return (
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && (
                <div className="p-3 text-sm text-red-600 bg-red-100 rounded-md">
                    {error}
                </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
                <div>
                    <label htmlFor="email-address" className="sr-only">
                        E-posta Adresi
                    </label>
                    <input
                        id="email-address"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                        placeholder="E-posta Adresi"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="password" className="sr-only">
                        Şifre
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                        placeholder="Şifre"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

            <div>
                <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
                </button>
            </div>

            <div className="mt-4 flex flex-col space-y-2 text-center">
                <button
                    type="button"
                    onClick={() => navigate('/auth/quick-permit-approve')}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                    Hızlı İş İzni Onay Merkezi
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/auth/public-work-permit')}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                    Yeni İş İzni Başvurusu
                </button>
            </div>
        </form>
    );
}
