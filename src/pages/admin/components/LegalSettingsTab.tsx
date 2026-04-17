import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Camera, Save, Trash2, Globe, Building2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export default function LegalSettingsTab() {
    const { profile } = useAuthStore();
    const [logoUrl, setLogoUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        fetchSettings();
    }, [profile]);

    const fetchSettings = async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("companies")
                .select("legal_logo_url")
                .eq("id", profile.tenant_id)
                .single();

            if (error) throw error;
            if (data) setLogoUrl(data.legal_logo_url || "");
        } catch (err) {
            console.error("Settings fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile?.tenant_id) return;
        setSaving(true);
        setMessage({ type: "", text: "" });

        try {
            const { error } = await supabase
                .from("companies")
                .update({ legal_logo_url: logoUrl })
                .eq("id", profile.tenant_id);

            if (error) throw error;
            setMessage({ type: "success", text: "Ayarlar başarıyla kaydedildi!" });
        } catch (err: any) {
            setMessage({ type: "error", text: "Hata: " + err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.tenant_id) return;

        setUploading(true);
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `legal_${profile.tenant_id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `legal_logos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("adr-uploads")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("adr-uploads")
                .getPublicUrl(filePath);

            setLogoUrl(publicUrl);
        } catch (err: any) {
            alert("Logo yüklenirken hata oluştu: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;

    return (
        <div className="max-w-4xl space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-500" />
                        Modül Ayarları & Logo Yönetimi
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Yasal Şartlar Takip raporlarında ve Excel çıktılarında görünecek şirket logonuzu buradan ayarlayabilirsiniz.
                    </p>
                </div>

                <div className="p-6 space-y-8">
                    {message.text && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 text-sm ${
                            message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                            <AlertCircle className="w-4 h-4" />
                            {message.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Logo Upload Section */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Şirket Logosu
                            </label>
                            
                            <div className="flex flex-col gap-4">
                                <div className="relative group w-48 h-48 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center overflow-hidden">
                                    {logoUrl ? (
                                        <>
                                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => setLogoUrl("")}
                                                    className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors"
                                                    title="Logoyu Kaldır"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4">
                                            <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <span className="text-xs text-slate-400">Henüz logo seçilmedi</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <label className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                        {uploading ? "Yükleniyor..." : "Dosya Seç"}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                                    </label>
                                    {logoUrl && (
                                        <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-medium">
                                            <Globe className="w-3 h-3" />
                                            Logo aktif
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Logo Preview Info */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 space-y-4 border border-slate-100 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Çıktı Önizleme Bilgisi</h4>
                            <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-3">
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    Logo, Excel dosyasının sol üst köşesinde otomatik olarak yerleştirilir.
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    Şeffaf arka planlı (.png) logolar en iyi sonucu verir.
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    Yüklenen logo tüm lokasyon takiplerinde varsayılan olarak kullanılır.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
                    </button>
                </div>
            </div>
        </div>
    );
}
