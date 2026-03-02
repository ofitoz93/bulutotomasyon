import { Link } from "react-router-dom";

export default function CorrectiveActions() {
    return (
        <div className="space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-5">
                <div className="flex items-start gap-4">
                    <div className="text-3xl">🔗</div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">DÖF / Aksiyon Takip Entegrasyonu</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Düzeltici ve Önleyici Faaliyetler (DÖF), İSG kazaları ve denetim bulgularından doğrudan <strong>Aksiyon Takip Sistemi</strong>'ne bağlanır.
                            Aşağıdaki butonu kullanarak yeni bir aksiyon oluşturabilir veya mevcut aksiyonları takip edebilirsiniz.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/app/aksiyon-takip/new"
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all group">
                    <div className="text-3xl mb-3">➕</div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Yeni DÖF / Aksiyon Oluştur</h4>
                    <p className="text-xs text-slate-500 mt-1">Kaza veya denetim bulgusu için düzeltici faaliyet başlatın</p>
                </Link>

                <Link to="/app/aksiyon-takip"
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all group">
                    <div className="text-3xl mb-3">📋</div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Mevcut Aksiyonları Görüntüle</h4>
                    <p className="text-xs text-slate-500 mt-1">Açık ve kapalı tüm DÖF aksiyonlarını takip edin</p>
                </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">DÖF Açma İpuçları</h4>
                <div className="space-y-3">
                    {[
                        { icon: "⚠️", title: "İş Kazası Sonrası", desc: "Kaza kaydını oluşturduktan sonra 'Aksiyon Takip' modülünden düzeltici faaliyet açın ve sorumlu kişiye atayın." },
                        { icon: "🔍", title: "Denetim Bulgusu", desc: "Denetimde tespit edilen uygunsuzluklar için termin tarihi belirleyerek aksiyon oluşturun." },
                        { icon: "📊", title: "Risk Değerlendirme", desc: "Yüksek riskli alanlar için risk azaltma aksiyonları planlamak üzere aksiyon modülünü kullanın." },
                        { icon: "🔬", title: "Uygunsuz Ölçüm", desc: "Sınır değeri aşan ölçüm sonuçları için iyileştirme aksiyonu açın ve sonraki ölçüm tarihini takip edin." },
                    ].map(item => (
                        <div key={item.title} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="text-xl flex-shrink-0">{item.icon}</span>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
