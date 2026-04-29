import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2, Link as LinkIcon, Check, X, ShieldAlert, Package, Trash } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export default function TMGDProductList() {
    const profile = useAuthStore(state => state.profile);
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState<1 | 2>(1); // 1: Type Selection, 2: Form
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        product_type: "product", short_name: "", un_nr: "", shipping_name: "", class_nr: "", 
        pg: "", category: "", multiplier: "1", mua_1136: "0", unit: "Litre/Kg", tunnel_code: "", special_provisions: ""
    });

    const [assignmentModal, setAssignmentModal] = useState<{open: boolean, product: any | null}>({open: false, product: null});
    const [productAssignments, setProductAssignments] = useState<string[]>([]);

    useEffect(() => {
        if (profile) {
            fetchClients();
            fetchProducts();
        }
    }, [profile, selectedClientId, selectedType]);

    const fetchClients = async () => {
        const { data } = await supabase.from("tmgd_clients").select("id, title").eq("tenant_id", profile?.tenant_id);
        if (data) setClients(data);
    };

    const fetchProducts = async () => {
        setLoading(true);
        // Fetch all products for the tenant
        let q = supabase.from("tmgd_products").select(`
            *,
            assignments:tmgd_client_products(client_id, tmgd_clients(title))
        `).eq("tenant_id", profile?.tenant_id);
        
        if (selectedType !== "all") {
            q = q.eq("product_type", selectedType);
        }

        const { data } = await q.order("short_name", { ascending: true });
        
        if (data) {
            // If filtering by client, filter locally because we want to see global items that ARE assigned to that client
            let filtered = data;
            if (selectedClientId !== "all") {
                filtered = data.filter(p => p.assignments.some((a: any) => a.client_id === selectedClientId));
            }
            setProducts(filtered);
        }
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
        if (!confirm("Bu ürünü sildiğinizde tüm firma atamaları da silinecektir. Emin misiniz?")) return;
        await supabase.from("tmgd_products").delete().eq("id", id);
        fetchProducts();
    };

    const openAssignment = async (product: any) => {
        setAssignmentModal({ open: true, product });
        const { data } = await supabase.from("tmgd_client_products").select("client_id").eq("product_id", product.id);
        if (data) setProductAssignments(data.map(d => d.client_id));
    };

    const toggleAssignment = async (clientId: string) => {
        if (productAssignments.includes(clientId)) {
            await supabase.from("tmgd_client_products").delete().eq("product_id", assignmentModal.product.id).eq("client_id", clientId);
            setProductAssignments(prev => prev.filter(id => id !== clientId));
        } else {
            await supabase.from("tmgd_client_products").insert([{
                tenant_id: profile?.tenant_id,
                product_id: assignmentModal.product.id,
                client_id: clientId
            }]);
            setProductAssignments(prev => [...prev, clientId]);
        }
        fetchProducts(); // Update the main table list to show new assignment count
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tehlikeli Madde Kara Listesi</h2>
                    <p className="text-sm text-slate-500 mt-1">Sistemdeki tüm tehlikeli maddeleri ve atıkları yönetin.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <select 
                        value={selectedType} 
                        onChange={e => setSelectedType(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm"
                    >
                        <option value="all">Tüm Türler</option>
                        <option value="product">Ürünler</option>
                        <option value="waste">Atıklar</option>
                    </select>

                    <select 
                        value={selectedClientId} 
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm"
                    >
                        <option value="all">Tüm Firmalar</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>

                    <button 
                        onClick={() => { 
                            setEditingId(null); 
                            setModalStep(1);
                            setForm({
                                product_type: "product", short_name: "", un_nr: "", shipping_name: "", class_nr: "", 
                                pg: "", category: "", multiplier: "1", mua_1136: "0", unit: "Litre/Kg", tunnel_code: "", special_provisions: ""
                            });
                            setIsModalOpen(true); 
                        }} 
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Yeni Tanımla
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tür</th>
                                <th className="px-4 py-3 font-medium">Ticari İsim / Kod</th>
                                <th className="px-4 py-3 font-medium">UN No</th>
                                <th className="px-4 py-3 font-medium">Tam Sevkiyat İsmi</th>
                                <th className="px-4 py-3 font-medium">Atandığı Firmalar</th>
                                <th className="px-4 py-3 font-medium text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {products.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Kayıtlı veri bulunamadı.</td></tr>
                            ) : products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td className="px-4 py-3">
                                        {p.product_type === 'waste' ? (
                                            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                                <Trash className="w-3 h-3" /> ATIK
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                                                <Package className="w-3 h-3" /> ÜRÜN
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{p.short_name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{p.un_nr || "-"}</td>
                                    <td className="px-4 py-3 max-w-xs truncate text-xs" title={p.shipping_name}>{p.shipping_name}</td>
                                    <td className="px-4 py-3">
                                        <button 
                                            onClick={() => openAssignment(p)}
                                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                                        >
                                            <LinkIcon className="w-3 h-3" /> {p.assignments?.length || 0} Firma
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => {
                                            setForm(p); setEditingId(p.id); setModalStep(2); setIsModalOpen(true);
                                        }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PRODUCT ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        {modalStep === 1 ? (
                            <div className="p-8">
                                <h3 className="text-2xl font-black text-center mb-8">Tanımlamak İstediğiniz Türü Seçin</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <button 
                                        onClick={() => { setForm({...form, product_type: 'product'}); setModalStep(2); }}
                                        className="flex flex-col items-center justify-center p-8 border-2 border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/30 transition group"
                                    >
                                        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
                                            <Package className="w-10 h-10 text-indigo-600" />
                                        </div>
                                        <span className="text-xl font-bold">Ürün Tanımla</span>
                                        <p className="text-sm text-slate-500 text-center mt-2">Methanol, Etanol vb. ticari ürünler</p>
                                    </button>
                                    <button 
                                        onClick={() => { setForm({...form, product_type: 'waste'}); setModalStep(2); }}
                                        className="flex flex-col items-center justify-center p-8 border-2 border-slate-100 dark:border-slate-800 rounded-2xl hover:border-amber-500 hover:bg-amber-50/30 transition group"
                                    >
                                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
                                            <Trash className="w-10 h-10 text-amber-600" />
                                        </div>
                                        <span className="text-xl font-bold">Atık Tanımla</span>
                                        <p className="text-sm text-slate-500 text-center mt-2">15 02 02, Atık Yağ vb. kodlu atıklar</p>
                                    </button>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-full mt-8 py-3 text-slate-500 font-medium hover:text-slate-900">İptal</button>
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        {form.product_type === 'waste' ? <Trash className="w-5 h-5 text-amber-500" /> : <Package className="w-5 h-5 text-indigo-500" />}
                                        {editingId ? 'Düzenle' : (form.product_type === 'waste' ? 'Yeni Atık Tanımla' : 'Yeni Ürün Tanımla')}
                                    </h3>
                                    <button onClick={() => setModalStep(1)} className="text-xs text-indigo-600 hover:underline">Tür Değiştir</button>
                                </div>
                                
                                <form onSubmit={handleSave} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ticari İsim / Atık Kodu *</label>
                                            <input required value={form.short_name} onChange={e=>setForm({...form, short_name: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={form.product_type === 'waste' ? "Örn: 15 02 02" : "Örn: Methanol"} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UN Numarası</label>
                                            <input value={form.un_nr} onChange={e=>setForm({...form, un_nr: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Örn: UN 1230" />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tam Sevkiyat İsmi (ADR)</label>
                                        <textarea value={form.shipping_name} onChange={e=>setForm({...form, shipping_name: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} placeholder="METHANOL, 3, II, (D/E)"></textarea>
                                    </div>

                                    <div className="grid grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sınıf</label>
                                            <input value={form.class_nr} onChange={e=>setForm({...form, class_nr: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PG</label>
                                            <input value={form.pg} onChange={e=>setForm({...form, pg: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kategori</label>
                                            <input value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tünel</label>
                                            <input value={form.tunnel_code} onChange={e=>setForm({...form, tunnel_code: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="(D/E)"/>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Çarpan *</label>
                                            <input type="number" step="0.01" required value={form.multiplier} onChange={e=>setForm({...form, multiplier: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">1.1.3.6 MUA *</label>
                                            <input type="number" step="0.01" required value={form.mua_1136} onChange={e=>setForm({...form, mua_1136: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Birim</label>
                                            <input value={form.unit} onChange={e=>setForm({...form, unit: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm" placeholder="Kg / L" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Özel Hükümler</label>
                                        <input value={form.special_provisions} onChange={e=>setForm({...form, special_provisions: e.target.value})} className="w-full px-3 py-2 border dark:border-slate-700 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Örn: 274, 335, 375" />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">İptal</button>
                                        <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition">Kaydet</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ASSIGNMENT MODAL */}
            {assignmentModal.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Firma Atamaları</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{assignmentModal.product?.short_name}</p>
                            </div>
                            <button onClick={() => setAssignmentModal({open: false, product: null})} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                            {clients.map(client => {
                                const isAssigned = productAssignments.includes(client.id);
                                return (
                                    <button 
                                        key={client.id}
                                        onClick={() => toggleAssignment(client.id)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isAssigned ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                                    >
                                        <span className={`font-medium ${isAssigned ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{client.title}</span>
                                        {isAssigned ? <Check className="w-5 h-5 text-indigo-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t dark:border-slate-800">
                            <button onClick={() => setAssignmentModal({open: false, product: null})} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold">Tamam</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
