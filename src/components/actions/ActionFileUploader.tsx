import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { FileUp, X, File, FileText, Image as ImageIcon, Archive } from "lucide-react";

interface ActionFileUploaderProps {
    onUpload: (url: string, fileName: string) => void;
    onRemove: (url: string) => void;
    currentFiles: { url: string; name: string }[];
}

export default function ActionFileUploader({ onUpload, onRemove, currentFiles }: ActionFileUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];

        // 10 MB limit check
        if (file.size > 10 * 1024 * 1024) {
            alert("Dosya boyutu 10 MB'ı geçemez.");
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${uuidv4()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('action-files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('action-files')
                .getPublicUrl(filePath);

            onUpload(publicUrl, file.name);
        } catch (error: any) {
            alert('Yükleme hatası: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon className="w-8 h-8 text-blue-500" />;
        if (['pdf'].includes(ext)) return <FileText className="w-8 h-8 text-red-500" />;
        if (['zip', 'rar', '7z'].includes(ext)) return <Archive className="w-8 h-8 text-yellow-500" />;
        return <File className="w-8 h-8 text-gray-500" />;
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Dosya / Medya Yükle (Maks. 10MB)</h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {currentFiles.map((f, index) => {
                    const isImage = f.url.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i);
                    return (
                        <div key={index} className="relative group aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col items-center justify-center p-2">
                            {isImage ? (
                                <img src={f.url} alt={f.name} className="object-cover w-full h-full rounded" />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center space-y-2">
                                    {getFileIcon(f.name)}
                                    <span className="text-xs text-gray-600 truncate w-full px-1" title={f.name}>{f.name}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => onRemove(f.url)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100 shadow-sm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )
                })}

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 bg-indigo-50 rounded-lg p-4 hover:bg-indigo-100 transition-colors aspect-square text-indigo-500"
                >
                    {uploading ? (
                        <span className="text-xs font-medium">Yükleniyor...</span>
                    ) : (
                        <>
                            <FileUp className="w-8 h-8 mb-2" />
                            <span className="text-xs font-medium text-center">Dosya Seç<br />(Resim, PDF, Rar)</span>
                        </>
                    )}
                </button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                // PDF, Resim, Zip, Rar izinleri
                accept="image/*,.pdf,.zip,.rar,.7z,application/pdf,application/zip,application/x-rar-compressed,application/x-7z-compressed"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}
