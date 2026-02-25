import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface EducationType {
    id: string;
    name: string;
}

interface EducationClass {
    id: string;
    type_id: string;
    name: string;
    type?: EducationType;
}

export default function EducationSettings() {
    const { profile } = useAuthStore();

    const [types, setTypes] = useState<EducationType[]>([]);
    const [classes, setClasses] = useState<EducationClass[]>([]);

    // Form States
    const [newTypeName, setNewTypeName] = useState("");
    const [addingType, setAddingType] = useState(false);

    // Class Form States
    const [newClassName, setNewClassName] = useState("");
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [addingClass, setAddingClass] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchSettings();
        }
    }, [profile]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // Fetch Types
            const { data: typesData, error: typesError } = await supabase
                .from("education_types")
                .select("*")
                .eq("tenant_id", profile?.tenant_id)
                .order("name", { ascending: true });

            if (typesError) throw typesError;
            setTypes(typesData || []);

            // Fetch Classes with embedded type
            const { data: classesData, error: classesError } = await supabase
                .from("education_classes")
                .select("*, type:education_types(id, name)")
                .eq("tenant_id", profile?.tenant_id)
                .order("name", { ascending: true });

            if (classesError) throw classesError;
            setClasses(classesData || []);

        } catch (error) {
            console.error("Error fetching education settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTypeName.trim() || !profile?.tenant_id) return;
        setAddingType(true);
        try {
            const { error } = await supabase
                .from("education_types")
                .insert([{ tenant_id: profile.tenant_id, name: newTypeName.trim() }]);

            if (error) throw error;
            setNewTypeName("");
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Kurs tipi eklenirken hata oluştu.");
        } finally {
            setAddingType(false);
        }
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm("Bu kurs tipini (ve ona bağlı eğitim sınıflarını) silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("education_types").delete().eq("id", id);
            if (error) throw error;
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Kurs tipi silinirken hata oluştu.");
        }
    };

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClassName.trim() || !selectedTypeId || !profile?.tenant_id) return;
        setAddingClass(true);
        try {
            const { error } = await supabase
                .from("education_classes")
                .insert([{
                    tenant_id: profile.tenant_id,
                    type_id: selectedTypeId,
                    name: newClassName.trim()
                }]);

            if (error) throw error;
            setNewClassName("");
            setSelectedTypeId("");
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Sınıf eklenirken hata oluştu.");
        } finally {
            setAddingClass(false);
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm("Bu sınıfı (ve bağlı olan taslak kursları) silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from("education_classes").delete().eq("id", id);
            if (error) throw error;
            fetchSettings();
        } catch (error) {
            console.error(error);
            alert("Sınıf silinirken hata oluştu.");
        }
    };

    if (loading) return <div className="text-gray-500">Kayıtlar yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Education Types Panel */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 hover:text-indigo-600 transition">Kurs Tipleri</h2>
                    <p className="text-xs text-gray-500 mb-4">"İSG Eğitimi", "Kalite Eğitimi" gibi ana başlıklar oluşturun.</p>

                    <form onSubmit={handleAddType} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            required
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder="Yeni Tip Adı (Örn: İSG Eğitimi)"
                            className="flex-1 px-3 py-2 border rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={addingType}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {addingType ? "..." : "Ekle"}
                        </button>
                    </form>

                    <div className="mt-4 border rounded-md max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip Adı</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {types.length === 0 ? (
                                    <tr><td colSpan={2} className="px-4 py-3 text-center text-sm text-gray-500">Henüz kurs tipi eklenmedi.</td></tr>
                                ) : (
                                    types.map((type) => (
                                        <tr key={type.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 border-l-4 border-l-indigo-500">{type.name}</td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <button onClick={() => handleDeleteType(type.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md hover:bg-red-100 transition" title="Sil">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Education Classes Panel */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 hover:text-teal-600 transition">Eğitim Sınıfları</h2>
                    <p className="text-xs text-gray-500 mb-4">Bir tipe bağlı olan hedef kitle grupları. Örn: "2026 Yılı Temel İSG Sınıfı"</p>

                    <form onSubmit={handleAddClass} className="flex flex-col gap-2 mb-6">
                        <select
                            required
                            value={selectedTypeId}
                            onChange={(e) => setSelectedTypeId(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-gray-50"
                        >
                            <option value="">-- Bağlı Olacağı Kurs Tipini Seçin --</option>
                            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <div className="flex gap-2 mt-1">
                            <input
                                type="text"
                                required
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="Sınıf Adı (Örn: 2026 Yılı Mavi Yaka İSG)"
                                className="flex-1 px-3 py-2 border rounded-md text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                            />
                            <button
                                type="submit"
                                disabled={addingClass || types.length === 0}
                                className="bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                            >
                                {addingClass ? "..." : "Sınıf Ekle"}
                            </button>
                        </div>
                    </form>

                    <div className="mt-4 border rounded-md max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sınıf Adı</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bağlı Tip</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {classes.length === 0 ? (
                                    <tr><td colSpan={3} className="px-4 py-3 text-center text-sm text-gray-500">Henüz sınıf eklenmedi. Önce Tip oluşturun.</td></tr>
                                ) : (
                                    classes.map((cls) => (
                                        <tr key={cls.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 border-l-4 border-l-teal-500">{cls.name}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                <span className="bg-gray-100 px-2 py-1 rounded-full">{cls.type?.name || 'Bilinmiyor'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <button onClick={() => handleDeleteClass(cls.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md hover:bg-red-100 transition" title="Sil">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
