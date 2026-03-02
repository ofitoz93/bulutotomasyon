import { useState } from "react";

export default function BulkOperations() {
    const [dragging, setDragging] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            alert("Toplu aktarım özelliği için bir backend API tetiklenmesi gerekiyor. Yakında hazır!");
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    📁
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Excel'den Toplu Personel Aktarımı</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                    Yüzlerce personeli tek tek eklemek yerine, önceden hazırladığımız şablonu kullanarak saniyeler içinde bütün kadroyu sisteme aktarabilirsiniz.
                </p>

                <div
                    className={`mt-8 border-2 border-dashed rounded-2xl p-12 transition-all ${dragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5 scale-[1.02]" : "border-slate-200 dark:border-slate-800"
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); }}
                >
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Dosyayı buraya sürükleyin veya</p>
                        <label className="cursor-pointer inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30">
                            Bilgisayardan Seç
                            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                        </label>
                        <p className="text-xs text-slate-400">Desteklenen formatlar: .xlsx, .csv (Maks. 5MB)</p>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Henüz bir şablonunuz yok mu?</p>
                        <p className="text-xs text-slate-500">Sisteme uyumlu Excel şablonunu indirin.</p>
                    </div>
                    <button className="flex items-center gap-2 text-indigo-600 hover:text-indigo-500 font-bold text-sm bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl transition-all">
                        <span>📥</span> Şablonu İndir (.xlsx)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Toplu KKD Atama</h3>
                    <p className="text-xs text-slate-500 mb-4">Bir departman veya filtre grubuna toplu zimmet oluşturun.</p>
                    <button className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        İşlemi Başlat
                    </button>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">QR Kod Üretici</h3>
                    <p className="text-xs text-slate-500 mb-4">Seçili personel kartları için toplu QR kod çıktısı alın.</p>
                    <button className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        QR Kodları Hazırla
                    </button>
                </div>
            </div>
        </div>
    );
}
