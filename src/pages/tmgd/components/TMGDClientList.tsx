import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2, Link as LinkIcon, ExternalLink, Copy, Upload } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export default function TMGDClientList() {
    const profile = useAuthStore(state => state.profile);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        title: "", address: "", tel: "", fax: "", url_slug: "", access_password: "", logo_url: ""
    });

    useEffect(() => {
        if (profile) fetchClients();
    }, [profile]);

    const fetchClients = async () => {
        setLoading(true);
        const { data } = await supabase.from("tmgd_clients").select("*").eq("tenant_id", profile?.tenant_id).order("created_at", { ascending: false });
        if (data) setClients(data);
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let errorMsg = null;
        if (editingId) {
            const { error } = await supabase.from("tmgd_clients").update(form).eq("id", editingId);
            errorMsg = error?.message;
        } else {
            const { error } = await supabase.from("tmgd_clients").insert([{ ...form, tenant_id: profile?.tenant_id }]);
            errorMsg = error?.message;
        }

        if (errorMsg) {
            alert("Hata oluştu: " + errorMsg);
        } else {
            setIsModalOpen(false);
            fetchClients();
        }
    };

    const openEdit = (client: any) => {
        setForm({
            title: client.title, address: client.address || "", tel: client.tel || "", 
            fax: client.fax || "", url_slug: client.url_slug, access_password: client.access_password, 
            logo_url: client.logo_url || ""
        });
        setEditingId(client.id);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setForm({ title: "", address: "", tel: "", fax: "", url_slug: "", access_password: "", logo_url: "" });
        setEditingId(null);
        setIsModalOpen(true);
    };

    const deleteClient = async (id: string) => {
        if (!confirm("Emin misiniz? Müşteri silinirse o müşteriye ait tüm Evraklar ve Ürünler silinebilir!")) return;
        await supabase.from("tmgd_clients").delete().eq("id", id);
        fetchClients();
    };

    const copyUrl = (slug: string) => {
        const url = `${window.location.origin}/tmgd/${slug}`;
        navigator.clipboard.writeText(url);
        alert("Bağlantı Kopyalandı!");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingLogo(true);
        try {
            const ext = file.name.split('.').pop();
            const filePath = `tmgd_client_logos/client_${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('adr-uploads').upload(filePath, file);
            if (error) throw error;
            const { data } = supabase.storage.from('adr-uploads').getPublicUrl(filePath);
            setForm({...form, logo_url: data.publicUrl});
        } catch (err: any) {
            alert("Logo yüklenirken hata oluştu: " + err.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">TMGD Müşterileri (Firmalar)</h2>
                <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> Yeni Müşteri Kartı
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="text-slate-500">Yükleniyor...</div> : clients.map(client => (
                    <div key={client.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                        <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(client)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 rounded"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => deleteClient(client.id)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 rounded"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 overflow-hidden">
                                {client.logo_url ? <img src={client.logo_url} alt="" className="w-full h-full object-contain p-1" /> : <span className="font-bold text-indigo-500 text-lg">{client.title.charAt(0)}</span>}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{client.title}</h3>
                                <div className="text-xs text-slate-500 mt-1 lines-clamp-2" title={client.address}>{client.address}</div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2 mb-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Giriş Şifresi:</span>
                                <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold">{client.access_password}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => copyUrl(client.url_slug)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                                <Copy className="w-4 h-4" /> Linki Kopyala
                            </button>
                            <a href={`/tmgd/${client.url_slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
                                <ExternalLink className="w-4 h-4" /> Git
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">{editingId ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Müşteri/Firma Ünvanı *</label>
                                <input required value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL / Link Takma Adı *</label>
                                    <div className="flex items-center border dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                                        <span className="px-2 text-xs text-slate-500">/tmgd/</span>
                                        <input required value={form.url_slug} onChange={e=>setForm({...form, url_slug: e.target.value.replace(/[^a-zA-Z0-9-]/g, '')})} className="w-full py-2 bg-transparent outline-none text-sm" placeholder="firma-adi" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Erişim Şifresi *</label>
                                    <input required value={form.access_password} onChange={e=>setForm({...form, access_password: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm font-mono" placeholder="Örn: 123456" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-2">Firma Logosu (Çıktılarda Görünür)</label>
                                
                                {form.logo_url && (
                                    <div className="mb-3 p-2 border border-slate-200 dark:border-slate-700 rounded-lg inline-block bg-slate-50 dark:bg-slate-800">
                                        <img src={form.logo_url} alt="Logo Prev" className="h-16 object-contain" />
                                    </div>
                                )}
                                
                                <div className="flex gap-3">
                                    <label className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition bg-white dark:bg-slate-900 flex-1 whitespace-nowrap">
                                        {uploadingLogo ? (
                                            <span className="text-sm font-medium text-slate-500">Yükleniyor...</span>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm font-medium">Bilgisayardan Seç</span>
                                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                            </>
                                        )}
                                    </label>
                                    <input type="url" value={form.logo_url} onChange={e=>setForm({...form, logo_url: e.target.value})} className="flex-1 px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="veya Manuel URL" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Adres</label>
                                <textarea value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" rows={2}></textarea>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Telefon</label>
                                    <input value={form.tel} onChange={e=>setForm({...form, tel: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Faks</label>
                                    <input value={form.fax} onChange={e=>setForm({...form, fax: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">İptal</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
