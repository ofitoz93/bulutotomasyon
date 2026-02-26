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
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Mevcut Müfredat</h3>
                {materials.length === 0 ? (
                    <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                        Henüz hiç içerik eklenmemiş. Alttaki formu kullanarak içerik (PDF/Video) ekleyebilirsiniz.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {materials.map((m) => (
                            <div key={m.id} className="flex items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                <GripVertical className="w-5 h-5 text-gray-300 mr-3 cursor-grab" />
                                <div className="h-10 w-10 flex-shrink-0 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center mr-4">
                                    {m.content_type === 'pdf' ? <FileText className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-gray-900">{m.order_num}. {m.title}</h4>
                                    <div className="text-xs text-gray-500 flex items-center gap-3">
                                        <span className="uppercase">{m.content_type}</span>
                                        {m.min_duration_minutes > 0 ? (
                                            <span>Minimum Süre: {m.min_duration_minutes} Dk</span>
                                        ) : (
                                            <span>Süre Limiti Yok</span>
                                        )}
                                        <a href={m.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Bağlantıyı Gör</a>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(m.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition ml-4">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New */}
            <form onSubmit={handleAdd} className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b">Yeni İçerik Ekle</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">İçerik Başlığı</label>
                        <input
                            type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            placeholder="Örn: Bölüm 1 - Risk Değerlendirmesi"
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">İçerik Tipi</label>
                        <select
                            value={newType} onChange={e => setNewType(e.target.value as 'pdf' | 'video')}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="pdf">PDF Dosyası (Slayt vb.)</option>
                            <option value="video">Video (MP4 / YouTube vb.)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Harcanması Gereken Min. Süre (Dakika)</label>
                        <input
                            type="number" min="0" required value={newMinDuration} onChange={e => setNewMinDuration(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">Katılımcı bu süre dolmadan sıradaki konuya veya sınava geçemez (0 = serbest).</p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Dışsal Link (URL) VEYA Dosya Yükle</label>
                        <div className="flex flex-col gap-2">
                            <input
                                type="url" value={newUrl} onChange={e => { setNewUrl(e.target.value); setNewFile(null); }}
                                placeholder="Dışsal URL (Örn: YouTube veya Drive linki)"
                                className="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={!!newFile}
                            />
                            <div className="flex items-center">
                                <span className="text-xs text-gray-500 mr-2">YA DA</span>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setNewFile(e.target.files[0]);
                                            setNewUrl("");
                                        }
                                    }}
                                    className="text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    disabled={!!newUrl}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Lütfen sadece birini kullanın. Bilgisayardan dosya (PDF, MP4) seçerseniz sistem otomatik yükleyecektir.</p>
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
