import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateZoneExtents, type ChemicalData, type ReleaseSourceData, type VentilationData } from '../isg-merkezi/utils/atexCalculations';

// Initialize Gemini SDK with the API key provided by user
// Warning: This is exposed frontend-side but user requested it this way for ease in the prompt.
const genAI = new GoogleGenerativeAI("AIzaSyBEIicpFAduFKBx6r1P_1ZPnd-WmgICtNI");

const steps = [
    { id: 1, title: 'Tesis & Proses', description: 'Genel Tanımlamalar' },
    { id: 2, title: 'Kimyasallar', description: 'Yanıcı Madde Seçimi' },
    { id: 3, title: 'Boşalma & Havalandırma', description: 'Kaynak ve Ortam' },
    { id: 4, title: 'Zon Sınıflandırması', description: 'ATEX Haritası' },
    { id: 5, title: 'Yapay Zeka Raporu', description: 'Değerlendirme ve Üretim' }
];

export default function NewPKDForm() {
    const [currentStep, setCurrentStep] = useState(1);

    // States to hold the data across steps
    const [facilityData, setFacilityData] = useState({ name: '', processType: '', description: '' });
    const [chemical, setChemical] = useState<ChemicalData>({ name: 'Hexane', state: 'sıvı', lelVol: 1.2, molarMass: 86.18, vaporPressure: 16.2 }); // Sample default data for illustration
    const [releaseSource, setReleaseSource] = useState<ReleaseSourceData>({ grade: 'ana', poolArea: 2.0 });
    const [ventilation, setVentilation] = useState<VentilationData>({ degree: 'orta', availability: 'iyi', velocity: 0.5, roomVolume: 120 });
    const [zoneResult, setZoneResult] = useState<any>(null);
    const [aiReport, setAiReport] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Form Validation
    const canProceed = () => {
        if (currentStep === 1) return facilityData.name !== '' && facilityData.processType !== '';
        if (currentStep === 2) return chemical.name !== '';
        // step 3 needs calculation triggering
        return true;
    };

    const handleNext = () => {
        if (!canProceed()) return;

        // When moving from Step 3 to 4, calculate Zone
        if (currentStep === 3) {
            const result = calculateZoneExtents(chemical, releaseSource, ventilation);
            setZoneResult(result);
        }

        setCurrentStep(prev => Math.min(prev + 1, steps.length));
    };

    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const generateAIReport = async () => {
        setIsGenerating(true);
        setAiReport("");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `
Sen bir ATEX baş denetçisi ve Endüstriyel Güvenlik Uzmanısın. Aşağıdaki tesis ve proses verilerini EN 60079-10-1 standardına göre analiz ederek resmi bir Patlamadan Korunma Dokümanı (PKD) özet raporu hazırla. 
Raporun formatı genel akademik dil ile, Markdown formatında olmalıdır.

# Tesis Verileri:
- Tesis Adı: ${facilityData.name}
- Proses Türü: ${facilityData.processType}
- Açıklama: ${facilityData.description}

# Kimyasal Tehlike:
- Adı: ${chemical.name} (Faz: ${chemical.state})
- Alt Patlama Sınırı (LEL): %${chemical.lelVol}
- Buhar Basıncı: ${chemical.vaporPressure} kPa
- Molar Kütle: ${chemical.molarMass} g/mol

# Boşalma Kaynağı & Havalandırma:
- Boşalma Derecesi (Grade of Release): ${releaseSource.grade}
- Açık Yüzey / Havuz Alanı: ${releaseSource.poolArea} m2
- Havalandırma Derecesi: ${ventilation.degree}
- Havalandırma Bulunabilirliği: ${ventilation.availability}
- Hız: ${ventilation.velocity} m/s | Oda Hacmi: ${ventilation.roomVolume} m3

# Matematiksel Zon Sınıflandırma Çıktısı (Hesaplama Sonucu):
- Belirlenen Zon: Zone ${zoneResult?.zoneType}
- Teorik Patlayıcı Hacim (Vz): ${zoneResult?.vz} m3
- Tahmini Tehlikeli Mesafe (Dz): ${zoneResult?.dz} m

Lütfen bu verileri kullanarak şu başlıklardan oluşan bir değerlendirme ve sonuç raporu yaz:
1. Yönetici Özeti
2. Metodoloji ve Tehlike Tanımlaması (EN 60079-10-1 atıfları ile)
3. Zon ve Havalandırma Değerlendirmesi
4. Ex-Proof Ekipman Seçimi için Gereksinimler
5. Statik ve Elektriksel Önlemler İçin Öneriler

Açıklayıcı ve mevzuata uygun olmasını sağla. Müşteri logolarının ekleneceğini hesaba katarak en sona 'Onaylayanlar' için imza boşluk alanı gibi bir not ekleyebilirsin.
        `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            setAiReport(response.text());

        } catch (error) {
            console.error("AI Generation Failed:", error);
            setAiReport("Yapay zeka servisi çağrılırken bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-2">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Yeni PKD Oluştur</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Sihirbaz yardımıyla yapay zeka destekli dokümanınızı hazırlayın</p>
                </div>
            </div>

            {/* Stepper Header */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-6 overflow-x-auto">
                <div className="flex items-center min-w-[700px] justify-between">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex-1 text-center relative">
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors z-10 
                  ${currentStep > step.id ? 'bg-green-500 text-white' :
                                        currentStep === step.id ? 'bg-orange-600 text-white ring-4 ring-orange-100 dark:ring-orange-900/50' :
                                            'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}
                                >
                                    {currentStep > step.id ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : step.id}
                                </div>
                                <div className="mt-3">
                                    <div className={`text-sm font-semibold transition-colors
                    ${currentStep === step.id ? 'text-orange-600 dark:text-orange-400' :
                                            currentStep > step.id ? 'text-slate-900 dark:text-white' :
                                                'text-slate-400 dark:text-slate-500'}`}
                                    >
                                        {step.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1 max-w-[120px] mx-auto leading-tight">{step.description}</div>
                                </div>
                            </div>
                            {/* Connector line */}
                            {index < steps.length - 1 && (
                                <div className="absolute top-5 left-[50%] right-[-50%] h-[2px] -z-0">
                                    <div className={`h-full w-full transition-colors
                    ${currentStep > step.id ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-h-[400px]">

                {/* Adım 1 */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">1. Tesis ve Proses Tanımı</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tesis / Bölüm Adı <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={facilityData.name}
                                    onChange={(e) => setFacilityData({ ...facilityData, name: e.target.value })}
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500 p-2.5 border"
                                    placeholder="Örn: Boyahane - Kat 1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proses Türü <span className="text-red-500">*</span></label>
                                <select
                                    value={facilityData.processType}
                                    onChange={(e) => setFacilityData({ ...facilityData, processType: e.target.value })}
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500 p-2.5 border"
                                >
                                    <option value="">Seçiniz...</option>
                                    <option value="Karıştırma / Dozajlama">Karıştırma / Dozajlama</option>
                                    <option value="Boyama / Kaplama">Boyama / Kaplama</option>
                                    <option value="Depolama">Depolama</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proses Açıklaması</label>
                                <textarea
                                    rows={4}
                                    value={facilityData.description}
                                    onChange={(e) => setFacilityData({ ...facilityData, description: e.target.value })}
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500 p-2.5 border"
                                    placeholder="Proseste yapılan işin kısaca tarifi..."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Adım 2 */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">2. Tehlikeli Kimyasallar</h3>
                        </div>
                        {/* Demo Amaçlı Kimyasal Seçme Formu */}
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 rounded-xl mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <div>
                                    <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-400">Kimyasal Veri Tabanı (Demo)</h4>
                                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">Gerçek kullanımda bu adım mevcut stok/MSDS modülüne bağlanacaktır. Şu an demo olarak "Hekzan" (Sıvı) varsayılan kabul edilmektedir.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Madde Adı</label>
                                <input type="text" value={chemical.name} onChange={e => setChemical({ ...chemical, name: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Faz (Gaz/Sıvı/Toz)</label>
                                <select value={chemical.state} onChange={(e: any) => setChemical({ ...chemical, state: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                    <option value="gaz">Gaz</option><option value="sıvı">Sıvı</option><option value="toz">Toz</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Alt Patlama Sınırı (LEL) %</label>
                                <input type="number" step="0.1" value={chemical.lelVol} onChange={e => setChemical({ ...chemical, lelVol: Number(e.target.value) })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Buhar Basıncı (kPa)</label>
                                <input type="number" step="0.1" value={chemical.vaporPressure} onChange={e => setChemical({ ...chemical, vaporPressure: Number(e.target.value) })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Adım 3 */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">3. Boşalma Kaynakları ve Havalandırma</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Boşalma */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Boşalma Karakteristiği</h4>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Boşalma Derecesi</label>
                                    <select value={releaseSource.grade} onChange={(e: any) => setReleaseSource({ ...releaseSource, grade: e.target.value })} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none p-2.5 border">
                                        <option value="sürekli">Sürekli (Continuous)</option>
                                        <option value="ana">Ana (Primary)</option>
                                        <option value="tali">Tali (Secondary)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sıvı Havuzu / Açık Yüzey Alanı (m²)</label>
                                    <input type="number" step="0.5" value={releaseSource.poolArea} onChange={(e) => setReleaseSource({ ...releaseSource, poolArea: Number(e.target.value) })} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none p-2.5 border" />
                                    <p className="text-xs text-slate-500 mt-1">Dökülme veya kapak açılması sonucu oluşabilecek tahmini yüzey alanı.</p>
                                </div>
                            </div>

                            {/* Havalandırma */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Ortam Havalandırması</h4>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Havalandırma Etkinlik Derecesi</label>
                                    <select value={ventilation.degree} onChange={(e: any) => setVentilation({ ...ventilation, degree: e.target.value })} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none p-2.5 border">
                                        <option value="yüksek">Yüksek (High)</option>
                                        <option value="orta">Orta (Medium)</option>
                                        <option value="düşük">Düşük (Low)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bulunabilirlik</label>
                                        <select value={ventilation.availability} onChange={(e: any) => setVentilation({ ...ventilation, availability: e.target.value })} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none p-2.5 border">
                                            <option value="iyi">İyi (Good)</option>
                                            <option value="orta">Orta (Fair)</option>
                                            <option value="zayıf">Zayıf (Poor)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Oda Hacmi (m³)</label>
                                        <input type="number" value={ventilation.roomVolume} onChange={(e) => setVentilation({ ...ventilation, roomVolume: Number(e.target.value) })} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none p-2.5 border" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Adım 4 */}
                {currentStep === 4 && zoneResult && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">4. Zon Sınıflandırması (Hesaplama Sonucu)</h3>
                        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 p-6 rounded-xl text-center">
                            <h4 className="text-orange-800 dark:text-orange-400 font-semibold mb-2">Önerilen Tehlikeli Alan Sınıflandırması</h4>

                            <div className="text-5xl font-extrabold text-orange-600 dark:text-orange-500 my-6 drop-shadow-sm">
                                {zoneResult.zoneType === 'tehlikesiz' ? 'Tehlikesiz' : `Zone ${zoneResult.zoneType}`}
                            </div>

                            <div className="flex justify-center gap-12 text-sm border-t border-orange-200/50 dark:border-orange-900/40 pt-6">
                                <div className="text-center">
                                    <div className="text-slate-500 font-medium pb-1">Tehlikeli Hacim (Vz)</div>
                                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{zoneResult.vz} m³</div>
                                    <div className="text-[10px] text-slate-400">Patlayıcı Atmosfer</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-slate-500 font-medium pb-1">Zon Mesafesi (Dz)</div>
                                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{zoneResult.dz} m</div>
                                    <div className="text-[10px] text-slate-400">Kaynaktan Uzaklık</div>
                                </div>
                            </div>
                        </div>

                        {/* Notlar */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Algoritma Bulguları</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                {zoneResult.notes.map((note: string, i: number) => (
                                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400">{note}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Adım 5 */}
                {currentStep === 5 && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">5. Yapay Zeka ile Doküman Üretimi</h3>
                            {!aiReport && !isGenerating && (
                                <button onClick={generateAIReport} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Gemini AI ile Raporu Oluştur
                                </button>
                            )}
                        </div>

                        {isGenerating && (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-300 mb-1">Yapay Zeka Raporu Hazırlıyor...</h3>
                                <p className="text-sm text-slate-500">Standartlara uygunluk analiz ediliyor, argümanlar sentezleniyor (Yaklaşık 10-20 saniye).</p>
                            </div>
                        )}

                        {aiReport && !isGenerating && (
                            <div className="animate-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 prose prose-slate dark:prose-invert max-w-none">
                                    {/* Render Markdown Simple - In production would use react-markdown */}
                                    <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\ng/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/# (.*?)\n/g, '<h2>$1</h2>\n').replace(/## (.*?)\n/g, '<h3>$1</h3>\n').replace(/\n/g, '<br/>') }} />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button onClick={generateAIReport} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Yeniden Oluştur
                                    </button>
                                    <button className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        PDF Olarak İndir & Kaydet
                                    </button>
                                </div>
                            </div>
                        )}

                        {!aiReport && !isGenerating && (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <p className="text-sm text-slate-500 max-w-sm mx-auto">Yukarıdaki "Gemini AI ile Raporu Oluştur" butonuna basarak, girdiğiniz tesisi ve boşalma verilerini yorumlayan uluslararası standartlara uygun bir resmi rapor metni ürettirebilirsiniz.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stepper Footer / Navigation */}
            <div className="flex justify-between items-center mt-6">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 1 || isGenerating}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Geri
                </button>
                {currentStep < steps.length ? (
                    <button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
                    >
                        İleri
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                ) : (
                    <div />
                )}
            </div>
        </div>
    );
}
