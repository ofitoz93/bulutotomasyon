import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export default function TMGDProductList() {
    const profile = useAuthStore(state => state.profile);
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("all");
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        client_id: "", short_name: "", un_nr: "", shipping_name: "", class_nr: "", 
        pg: "", category: "", multiplier: "1", mua_1136: "0", unit: "Litre/Kg", tunnel_code: "", special_provisions: ""
    });

    useEffect(() => {
        if (profile) {
            fetchClients();
            fetchProducts();
        }
    }, [profile, selectedClientId]);

    const fetchClients = async () => {
        const { data } = await supabase.from("tmgd_clients").select("id, title").eq("tenant_id", profile?.tenant_id);
        if (data) setClients(data);
    };

    const fetchProducts = async () => {
        setLoading(true);
        let q = supabase.from("tmgd_products").select("*, tmgd_clients(title)").eq("tenant_id", profile?.tenant_id);
        if (selectedClientId !== "all") {
            q = q.eq("client_id", selectedClientId);
        }
        const { data } = await q.order("short_name", { ascending: true });
        if (data) setProducts(data);
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload = {
            ...form,
            tenant_id: profile?.tenant_id,
            multiplier: parseFloat(form.multiplier),
            mua_1136: parseFloat(form.mua_1136)
        };

        if (editingId) {
            await supabase.from("tmgd_products").update(payload).eq("id", editingId);
        } else {
            await supabase.from("tmgd_products").insert([payload]);
        }

        setIsModalOpen(false);
        fetchProducts();
    };

    const deleteProduct = async (id: string) => {
        if (!confirm("Emin misiniz?")) return;
        await supabase.from("tmgd_products").delete().eq("id", id);
        fetchProducts();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Firma Ürün (MUA) Tanımları</h2>
                
                <div className="flex items-center gap-4">
                    <select 
                        value={selectedClientId} 
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm"
                    >
                        <option value="all">Tüm Firmalar</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>

                    <button onClick={() => { setEditingId(null); setForm({...form, client_id: selectedClientId === "all" ? "" : selectedClientId}); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                        <Plus className="w-4 h-4" /> Yeni Ürün Tanımla
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Hedef Firma</th>
                                <th className="px-4 py-3 font-medium">Ticari İsim</th>
                                <th className="px-4 py-3 font-medium">UN No</th>
                                <th className="px-4 py-3 font-medium">Tam Sevkiyat İsmi</th>
                                <th className="px-4 py-3 font-medium">1.1.3.6 MUA</th>
                                <th className="px-4 py-3 font-medium">Çarpan</th>
                                <th className="px-4 py-3 font-medium text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {products.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Kayıtlı ürün bulunamadı.</td></tr>
                            ) : products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{p.tmgd_clients?.title}</td>
                                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{p.short_name}</td>
                                    <td className="px-4 py-3">{p.un_nr}</td>
                                    <td className="px-4 py-3 max-w-xs truncate" title={p.shipping_name}>{p.shipping_name}</td>
                                    <td className="px-4 py-3 font-mono">{p.mua_1136}</td>
                                    <td className="px-4 py-3 font-mono">{p.multiplier}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => {
                                            setForm(p); setEditingId(p.id); setIsModalOpen(true);
                                        }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">{editingId ? 'Ürünü Düzenle' : 'Yeni Ürün Tanımla'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Hangi Firmada Kullanılacak? *</label>
                                <select required value={form.client_id} onChange={e=>setForm({...form, client_id: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent">
                                    <option value="">Firma Seçiniz</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Kısaltılmış Ticari İsim *</label>
                                    <input required value={form.short_name} onChange={e=>setForm({...form, short_name: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="Örn: 15 02 02" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">UN Numarası</label>
                                    <input value={form.un_nr} onChange={e=>setForm({...form, un_nr: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="Örn: UN 3077" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Tam Sevkiyat İsmi</label>
                                <textarea value={form.shipping_name} onChange={e=>setForm({...form, shipping_name: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" rows={2} placeholder="Örn: ATIK, ÇEVREYE ZARARLI MADDE..."></textarea>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Sınıf</label>
                                    <input value={form.class_nr} onChange={e=>setForm({...form, class_nr: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">PG</label>
                                    <input value={form.pg} onChange={e=>setForm({...form, pg: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Kategori</label>
                                    <input value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tünel B.</label>
                                    <input value={form.tunnel_code} onChange={e=>setForm({...form, tunnel_code: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="(D/E)"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Çarpan *</label>
                                    <input type="number" step="0.01" required value={form.multiplier} onChange={e=>setForm({...form, multiplier: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">1.1.3.6 MUA *</label>
                                    <input type="number" step="0.01" required value={form.mua_1136} onChange={e=>setForm({...form, mua_1136: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Birim</label>
                                    <input value={form.unit} onChange={e=>setForm({...form, unit: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="Litre / Kg" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Özel Hükümler</label>
                                <input value={form.special_provisions} onChange={e=>setForm({...form, special_provisions: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="Örn: 274, 335, 375" />
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
