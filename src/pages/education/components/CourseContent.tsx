import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, GripVertical, FileText, Video } from "lucide-react";

interface CourseMaterial {
    id: string;
    title: string;
    order_num: number;
    content_type: 'pdf' | 'video';
    file_url: string;
    min_duration_minutes: number;
}

export default function CourseContent({ courseId }: { courseId: string }) {
    const [materials, setMaterials] = useState<CourseMaterial[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState<'pdf' | 'video'>('pdf');
    const [newUrl, setNewUrl] = useState("");
    const [newFile, setNewFile] = useState<File | null>(null);
    const [newMinDuration, setNewMinDuration] = useState(0);

    useEffect(() => {
        if (courseId) fetchMaterials();
    }, [courseId]);

    const fetchMaterials = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("course_materials")
                .select("*")
                .eq("course_id", courseId)
                .order("order_num", { ascending: true });

            if (error) throw error;
            setMaterials(data || []);
        } catch (error) {
            console.error("Error fetching materials:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalUrl = newUrl;

        if (!newFile && !newUrl) {
            alert("Lütfen ya bir dosya yükleyin ya da bir bağlantı (URL) girin.");
            return;
        }

        setAdding(true);

        try {
            // Upload file if selected
            if (newFile) {
                const fileExt = newFile.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
                const filePath = `${courseId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('education_materials')
                    .upload(filePath, newFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('education_materials')
                    .getPublicUrl(filePath);

                finalUrl = data.publicUrl;
            }

            const newOrderNum = materials.length > 0 ? Math.max(...materials.map(m => m.order_num)) + 1 : 1;

            const { error } = await supabase
                .from("course_materials")
                .insert([{
                    course_id: courseId,
                    title: newTitle,
                    content_type: newType,
                    file_url: finalUrl,
                    min_duration_minutes: newMinDuration,
                    order_num: newOrderNum
                }]);

            if (error) throw error;

            setNewTitle("");
            setNewUrl("");
            setNewFile(null);
            setNewMinDuration(0);
            fetchMaterials();
        } catch (error) {
            console.error(error);
            alert("İçerik eklenirken hata oluştu.");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu içeriği silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("course_materials").delete().eq("id", id);
            if (error) throw error;
            fetchMaterials();
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="text-gray-500 text-sm">İçerikler yükleniyor...</div>;

    return (
        <div className="space-y-8">
            {/* List of existing */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Mevcut Müfredat</h3>
                {materials.length === 0 ? (
                    <div className="text-sm text-slate-500 p-8 bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-800 text-center">
                        Henüz hiç içerik eklenmemiş. Alttaki formu kullanarak içerik (PDF/Video) ekleyebilirsiniz.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {materials.map((m) => (
                            <div key={m.id} className="flex items-center p-3 bg-slate-900 border border-slate-800 rounded-lg shadow-sm hover:border-slate-700 transition-colors">
                                <GripVertical className="w-5 h-5 text-slate-700 mr-3 cursor-grab" />
                                <div className="h-10 w-10 flex-shrink-0 bg-indigo-500/10 text-indigo-400 rounded flex items-center justify-center mr-4 border border-indigo-500/20">
                                    {m.content_type === 'pdf' ? <FileText className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-slate-100">{m.order_num}. {m.title}</h4>
                                    <div className="text-xs text-slate-500 flex items-center gap-3">
                                        <span className="uppercase font-bold tracking-wider">{m.content_type}</span>
                                        {m.min_duration_minutes > 0 ? (
                                            <span>Minimum Süre: {m.min_duration_minutes} Dk</span>
                                        ) : (
                                            <span>Süre Limiti Yok</span>
                                        )}
                                        <a href={m.file_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">Bağlantıyı Gör</a>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(m.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-md transition ml-4">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New */}
            <form onSubmit={handleAdd} className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 shadow-inner">
                <h3 className="text-sm font-semibold text-white mb-6 pb-2 border-b border-slate-800">Yeni İçerik Ekle</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">İçerik Başlığı</label>
                        <input
                            type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            placeholder="Örn: Bölüm 1 - Risk Değerlendirmesi"
                            className="w-full bg-slate-800 border-slate-700 text-slate-100 px-3 py-2.5 text-sm border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">İçerik Tipi</label>
                        <select
                            value={newType} onChange={e => setNewType(e.target.value as 'pdf' | 'video')}
                            className="w-full bg-slate-800 border-slate-700 text-slate-100 px-3 py-2.5 text-sm border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                            <option value="pdf" className="bg-slate-900">PDF Dosyası (Slayt vb.)</option>
                            <option value="video" className="bg-slate-900">Video (MP4 / YouTube vb.)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Harcanması Gereken Min. Süre (Dakika)</label>
                        <input
                            type="number" min="0" required value={newMinDuration} onChange={e => setNewMinDuration(parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-800 border-slate-700 text-slate-100 px-3 py-2.5 text-sm border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium italic">Katılımcı bu süre dolmadan sıradaki konuya veya sınava geçemez (0 = serbest).</p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Dışsal Link (URL) VEYA Dosya Yükle</label>
                        <div className="flex flex-col gap-3">
                            <input
                                type="url" value={newUrl} onChange={e => { setNewUrl(e.target.value); setNewFile(null); }}
                                placeholder="Dışsal URL (Örn: YouTube veya Drive linki)"
                                className="w-full bg-slate-800 border-slate-700 text-slate-100 px-3 py-2.5 text-sm border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                                disabled={!!newFile}
                            />
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-600 whitespace-nowrap px-2 py-0.5 border border-slate-800 rounded">YA DA</span>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setNewFile(e.target.files[0]);
                                            setNewUrl("");
                                        }
                                    }}
                                    className="text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 transition-colors cursor-pointer"
                                    disabled={!!newUrl}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium italic">Lütfen sadece birini kullanın. Bilgisayardan dosya (PDF, MP4) seçerseniz sistem otomatik yükleyecektir.</p>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={adding}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 shadow flex-shrink-0"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        {adding ? "Ekleniyor..." : "İçeriği Kursa Ekle"}
                    </button>
                </div>
            </form>
        </div>
    );
}
