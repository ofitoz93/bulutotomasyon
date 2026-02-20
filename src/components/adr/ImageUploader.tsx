
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

interface ImageUploaderProps {
    onUpload: (url: string, fileName: string) => void;
    onRemove: (url: string) => void;
    currentImages: { url: string; name: string }[];
}

export default function ImageUploader({ onUpload, onRemove, currentImages }: ImageUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${uuidv4()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('adr-uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('adr-uploads')
                .getPublicUrl(filePath);

            onUpload(publicUrl, file.name);
        } catch (error: any) {
            alert('Yükleme hatası: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Fotoğraflar</h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {currentImages.map((img, index) => (
                    <div key={index} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                        <img src={img.url} alt="Uploaded" className="object-cover w-full h-full" />
                        <button
                            onClick={() => onRemove(img.url)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors aspect-square text-gray-500"
                >
                    {uploading ? (
                        <span className="text-xs">Yükleniyor...</span>
                    ) : (
                        <>
                            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <span className="text-xs font-medium">Fotoğraf Ekle</span>
                        </>
                    )}
                </button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment" // Mobile camera trigger
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}
