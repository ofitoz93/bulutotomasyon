import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Save, Upload, Printer, Mail } from "lucide-react";

export default function TMGDSettings() {
    const profile = useAuthStore(state => state.profile);
    const [logoUrl, setLogoUrl] = useState("");
    const [alertEmail, setAlertEmail] = useState("");
    const [quotaThreshold, setQuotaThreshold] = useState<number>(20);
    const [undownloadedLimit, setUndownloadedLimit] = useState<number>(10);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) fetchCompany();
    }, [profile]);

    const fetchCompany = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("companies")
            .select("tmgd_logo_url, tmgd_alert_email, tmgd_quota_threshold, tmgd_undownloaded_limit")
            .eq("id", profile?.tenant_id)
            .single();
        if (data) {
            setLogoUrl(data.tmgd_logo_url || "");
            setAlertEmail(data.tmgd_alert_email || "");
            setQuotaThreshold(data.tmgd_quota_threshold || 20);
            setUndownloadedLimit(data.tmgd_undownloaded_limit || 10);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!profile?.tenant_id) return;
        setSaving(true);
        await supabase
            .from("companies")
            .update({ 
                tmgd_logo_url: logoUrl,
                tmgd_alert_email: alertEmail,
                tmgd_quota_threshold: quotaThreshold,
                tmgd_undownloaded_limit: undownloadedLimit
            })
            .eq("id", profile.tenant_id);
        setSaving(false);
        alert("Ayarlar başarıyla kaydedildi!");
    };

    const handleTestEmail = async () => {
        if (!alertEmail) return alert("Önce bir e-posta adresi giriniz.");
        setTestingEmail(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-tmgd-notifications', {
                body: { 
                    type: 'test', 
                    email: alertEmail,
                    company_name: profile?.company_name
                }
            });
            if (error) {
                // Edge function hata döndürdüğünde body'yi okumaya çalış
                let msg = error.message;
                try {
                    const errData = await error.context.json();
                    if (errData.error) msg = errData.error;
                } catch (e) {}
                throw new Error(msg);
            }
            alert("Deneme maili başarıyla gönderildi! Lütfen gelen kutunuzu (ve gereksiz klasörünü) kontrol edin.");
        } catch (err: any) {
            alert("Mail Hatası: " + err.message);
        } finally {
            setTestingEmail(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setLoading(true);
        try {
            const ext = file.name.split('.').pop();
            const filePath = `tmgd_logos/tmgd_${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('adr-uploads').upload(filePath, file);
            if (error) throw error;
            const { data } = supabase.storage.from('adr-uploads').getPublicUrl(filePath);
            setLogoUrl(data.publicUrl);
        } catch (err: any) {
            alert("Logo yüklenirken hata oluştu: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Sistem Ayarları (TMGD Logonuz)</h2>
            
            {loading ? (
                <div className="text-slate-500">Yükleniyor...</div>
            ) : (
                <div className="max-w-xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Danışman (Sizin) Firmanızın Logosu (URL)
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Bu logo, hizmet verdiğiniz tüm firmaların Taşıma Evrağı çıktılarında <b>Sol Üst</b> köşede görünecektir.</p>
                        
                        <div className="flex flex-col gap-4 mb-4">
                            <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition bg-white dark:bg-slate-900 group">
                                <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Bilgisayardan Logo Seç (.png, .jpg)</span>
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-medium">Veya manuel URL girin:</span>
                                <input
                                    type="url"
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="Örn: https://example.com/logo.png"
                                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        
                        {logoUrl && (
                            <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 inline-block">
                                <span className="block text-xs font-semibold text-slate-500 mb-2">Önizleme:</span>
                                <img src={logoUrl} alt="Logo Preview" className="h-20 object-contain" />
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-semibold text-slate-800 dark:text-slate-100 mb-4">Otomatik Uyarı & E-Posta Ayarları</h3>
                        <p className="text-xs text-slate-500 mb-4">Firmalara tanımladığınız evrak oluşturma kotaları (limitler) dolmaya yaklaştığında, sistemin otomatik olarak göndereceği uyarı maillerini buradan yönetebilirsiniz.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Kota Uyarı E-Posta Adresi
                                </label>
                                <input
                                    type="email"
                                    value={alertEmail}
                                    onChange={(e) => setAlertEmail(e.target.value)}
                                    placeholder="Örn: admin@tmgdfirmasi.com"
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Uyarı mailleri bu adrese gönderilecektir.</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    İndirilmeyen Evrak Uyarı Limiti
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={undownloadedLimit}
                                        onChange={(e) => setUndownloadedLimit(Number(e.target.value))}
                                        className="w-24 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="text-sm font-medium text-slate-600">Evrak İndirilmezse Uyar</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Son yüklenen evraklardan bu kadarı indirilmediğinde mail alırsınız.</p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                                    Mail sistemini test etmek için:
                                </div>
                                <button
                                    onClick={handleTestEmail}
                                    disabled={testingEmail}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {testingEmail ? (
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Printer className="w-3 h-3" />
                                    )}
                                    Deneme Maili Gönder
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
