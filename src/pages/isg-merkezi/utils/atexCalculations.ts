/**
 * ATEX Zone Hesaplama Algoritmaları (EN IEC 60079-10-1)
 * 
 * Bu modül, sıvı/gaz özellikleri, boşalma kaynağı ve havalandırma koşullarını
 * alarak tehlikeli bölge sınıflandırmasını (Zone 0, 1, 2) ve yaklaşık
 * tehlikeli hacmi (Vz) hesaplar.
 * 
 * NOT: Bu fonksiyonlar standart rehberliğinde basitleştirilmiş tahminlerdir. 
 * Gerçek bir PKD onayında uzman mühendis kontrolü şarttır.
 */

export interface ChemicalData {
    name: string;
    state: 'gaz' | 'sıvı' | 'toz';
    lelVol: number; // Alt Patlama Sınırı (% Hacimce)
    molarMass?: number; // Molar kütle (g/mol)
    vaporPressure?: number; // Buhar basıncı (kPa, çalışma sıcaklığında)
}

export interface ReleaseSourceData {
    grade: 'sürekli' | 'ana' | 'tali'; // Continuous, Primary, Secondary
    wg?: number; // Boşalma hızı (kg/s) - biliniyorsa doğrudan girilir
    poolArea?: number; // Sıvı havuzu alanı (m2) - hesabı etkiler
}

export interface VentilationData {
    degree: 'yüksek' | 'orta' | 'düşük'; // High, Medium, Low
    availability: 'iyi' | 'orta' | 'zayıf'; // Good, Fair, Poor
    velocity: number; // Hava hızı (m/s)
    airChangesPerHour?: number; // C (Saatlik hava değişimi)
    roomVolume?: number; // Oda hacmi (m3)
}

export interface CalculationResult {
    zoneType: '0' | '1' | '2' | 'tehlikesiz';
    vz: number; // Teorik tehlikeli hacim (m3)
    dz: number; // Zon tahmini mesafesi (m)
    notes: string[];
}

/**
 * LEL Hacimsel değerini LEL Kütlesel değerine çevirir (kg/m3)
 * Standart kosullarda: LEL(kg/m3) = (LEL(%) * MolarMass) / (100 * 24.0)
 */
function calculateLelMass(lelVol: number, molarMass: number = 29): number {
    return (lelVol * molarMass) / (100 * 24.0);
}

/**
 * Buharlaşma veya yayılma hızı tahmini (kg/s)
 * Çok basitleştirilmiş bir modeldir.
 */
function estimateReleaseRate(chemical: ChemicalData, source: ReleaseSourceData): number {
    if (source.wg) return source.wg;

    // Basit havuz buharlaşma varsayımı (sıvılar için)
    if (chemical.state === 'sıvı' && source.poolArea && chemical.vaporPressure && chemical.molarMass) {
        // Eşdeğer buharlaşma hızı (Çok kaba ampirik yaklaşım)
        // Wg = A * P * sqrt(M) / (constant)
        return (source.poolArea * chemical.vaporPressure * Math.sqrt(chemical.molarMass)) / 50000;
    }

    // Varsayılan katsayılar (Eğer veri yoksa tehlike derecesine göre atama)
    if (source.grade === 'sürekli') return 0.01;
    if (source.grade === 'ana') return 0.005;
    return 0.001; // Tali
}

/**
 * EN 60079-10-1 Tablo B.1 - Sınıflandırma Matrisi Kuralları
 */
function determineZone(
    grade: 'sürekli' | 'ana' | 'tali',
    ventDegree: 'yüksek' | 'orta' | 'düşük',
    ventAvailability: 'iyi' | 'orta' | 'zayıf'
): '0' | '1' | '2' | 'tehlikesiz' {

    // İhmal edilebilir hacim (NE) durumu yüksek havalandırmalarda gerçekleşir.
    // Burada standart matrisi if-else bloklarıyla özetlenmiştir:

    if (ventDegree === 'yüksek') {
        if (grade === 'sürekli') return (ventAvailability === 'iyi') ? 'tehlikesiz' /* NE */ : '0';
        if (grade === 'ana') return (ventAvailability === 'iyi') ? 'tehlikesiz' : '1';
        if (grade === 'tali') return (ventAvailability === 'iyi') ? 'tehlikesiz' : '2';
    }

    if (ventDegree === 'orta') {
        if (grade === 'sürekli') return '0';
        if (grade === 'ana') return '1'; // İyi/Orta availability
        if (grade === 'tali') {
            return (ventAvailability === 'zayıf') ? '1' : '2';
        }
    }

    // Düşük havalandırma
    if (grade === 'sürekli') return '0';
    if (grade === 'ana') return '0'; // Düşük havalandırmada Ana kaynak 0'a yükselir
    if (grade === 'tali') return '1'; // Düşük havalandırmada Tali kaynak 1'e yükselir

    return '2'; // Varsayılan fallback
}

/**
 * Ana hesaplama fonksiyonu
 */
export function calculateZoneExtents(
    chemical: ChemicalData,
    source: ReleaseSourceData,
    vent: VentilationData
): CalculationResult {
    const notes: string[] = [];

    // 1. Boşalma hızını (Wg) tahmin et
    const wg = estimateReleaseRate(chemical, source);
    notes.push(`Tahmini boşalma hızı (Wg): ${wg.toFixed(5)} kg/s`);

    // 2. LEL Kütlesel (LEL_m)
    const lelMass = calculateLelMass(chemical.lelVol, chemical.molarMass || 29); // Yoksa hava molar kütlesi varsayılır (kötü senaryo)

    // 3. Q_min (Minimum teorik havalandırma debisi - m3/s)
    // Q_min = (Wg / LEL_m) * (T/293) * k (Sıcaklık katsayısı ve safety faktör ihmal edilmiştir (1 varsayılır))
    const qMin = wg / (lelMass * 0.5); // Safety factor 0.5 (LEL'in yarısı)

    // 4. Vz Hesaplama
    // Vz = (f * Q_min) / C 
    // Burada f=kalite katsayısı (1 ila 5). C = hava değişim sayısı (1/s)
    const f = vent.degree === 'yüksek' ? 1 : vent.degree === 'orta' ? 3 : 5;
    const c = vent.airChangesPerHour ? (vent.airChangesPerHour / 3600) : (vent.velocity * 0.1); // Ampirik C

    let vz = (f * qMin) / (c || 0.05); // c 0 ise default

    // Ortam hacminden büyük olamaz
    if (vent.roomVolume && vz > vent.roomVolume) {
        vz = vent.roomVolume;
        notes.push('Vz ortam hacmini aştığı için ortam hacmiyle sınırlandırıldı.');
    }

    // 5. Zone Belirleme
    let zoneType = determineZone(source.grade, vent.degree, vent.availability);

    // Vz < 0.1 m3 ise "İhmal edilebilir (NE)" sayılır (duruma bağlı olarak tehlikesiz ilan edilebilir)
    if (vz < 0.1 && zoneType !== '0') {
        zoneType = 'tehlikesiz';
        notes.push('Vz < 0.1 m³ olduğundan tehlikeli alan ihmal edilebilir (NE) kabul edilmiştir.');
    }

    // 6. Tahmini Mesafe (Dz) (Küresel yayılım varsayımı: V = (4/3)*pi*r^3 => r = cuberoot(3V/4pi))
    let dz = Math.pow((3 * vz) / (4 * Math.PI), 1 / 3);

    // Güvenlik faktörü (Suni havalandırma zayıfsa yayılım mesafesi artar)
    if (vent.availability === 'zayıf') dz *= 1.5;

    // Dz formatı
    dz = Math.max(0.1, Number(dz.toFixed(2))); // Minimum 10cm gösterim
    vz = Number(vz.toFixed(2));

    return {
        zoneType,
        vz,
        dz,
        notes
    };
}
