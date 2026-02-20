
import type { QuestionDefinition } from "@/types/adr";

export interface FormSection {
    title: string;
    questions: QuestionDefinition[];
}

export interface ADRFormDefinition {
    type: string;
    title: string;
    sections: FormSection[];
}

// 1. TANK İÇİN ALICI-BOŞALTAN FORMU
export const TANK_ALICI_FORM: ADRFormDefinition = {
    type: 'TANK-ALICI',
    title: 'TANK İÇİN ALICI-BOŞALTAN KONTROL FORMU',
    sections: [
        {
            title: 'TANK/TAŞIMA BİRİMİ BİLGİLERİ',
            questions: [
                { key: 'tank_onay_sertifikasi', text: 'Tank Onay Sertifikası Var mı?', type: 'yes_no', required: true },
                { key: 'arac_uygunluk_belgesi', text: 'Araç Uygunluk Belgesi (2015 Öncesi) Var mı?', type: 'yes_no' },
            ]
        },
        {
            title: 'Araçta Bulunması Gereken Belgeler',
            questions: [
                { key: 'tasima_evraki', text: 'Taşıma Evrakı Var mı?', type: 'yes_no', required: true },
                { key: 'yazili_talimat', text: 'Yazılı Talimat Var mı?', type: 'yes_no', required: true },
                { key: 'src5_sertifikasi', text: 'Şoförün SRC 5 Sertifikası Var mı?', type: 'yes_no', required: true },
            ]
        },
        {
            title: 'Araç Üzerindeki Gerekli Donanımlar',
            questions: [
                { key: 'tank_sizdirmazlik', text: 'Tank Sızdırmazlık Durumu Uygun mu?', type: 'suitable_unsuitable', required: true },
                { key: 'yangin_sondurucu', text: 'Yangın Söndürücü Mevcut mu?', type: 'yes_no', required: true },
                { key: 'turuncu_plaka', text: 'Turuncu Plaka Mevcut mu?', type: 'yes_no', required: true },
                { key: 'tehlike_sinifi_levhalari', text: 'Tehlike Sınıfı Levhaları Mevcut mu?', type: 'yes_no', required: true },
                { key: 'adr_kiti', text: 'ADR Kiti Mevcut mu?', type: 'yes_no', required: true },
            ]
        },
        {
            title: 'Boşaltım Sonrası Kontrol',
            questions: [
                { key: 'bosaltim_temizlik', text: 'Tank dışına bulaşan maddeler temizlendi mi?', type: 'yes_no_partial', required: true },
                { key: 'vana_kapaklar', text: 'Vana ve kapaklar kapatıldı mı?', type: 'yes_no_partial', required: true },
                { key: 'tank_hasar', text: 'Tankta hasar/sızıntı var mı?', type: 'yes_no_partial', required: true },
                { key: 'cevre_kalinti', text: 'Çevrede tehlikeli madde kalıntısı var mı?', type: 'yes_no_partial', required: true },
            ]
        }
    ]
};

// 2. ALICI-BOŞALTAN FORMU (AMBALAJLI)
export const AMBALAJ_ALICI_FORM: ADRFormDefinition = {
    type: 'AMBALAJ-ALICI',
    title: 'ALICI-BOŞALTAN KONTROL FORMU (AMBALAJLI)',
    sections: [
        {
            title: 'Konteyner Kontrolü (Sadece Konteyner ise)',
            questions: [
                { key: 'konteyner_kontrol', text: 'Sızdırmazlık, Hasar, Pas, Sızıntı Uygun mu?', type: 'suitable_unsuitable' },
            ]
        },
        {
            title: 'Tehlikeli Madde Araç ve Ambalaj Kontrolü',
            questions: [
                { key: 'src5_belgesi', text: 'SRC-5 Belgesi Var mı?', type: 'yes_no', required: true },
                { key: 'yazili_talimat', text: 'Yazılı Talimat Var mı?', type: 'yes_no', required: true },
                { key: 'mali_sorumluluk', text: 'Zorunlu Mali Sorumluluk Sigortası Var mı?', type: 'yes_no', required: true },
                { key: 'turuncu_plaka', text: 'Turuncu Plaka Var mı?', type: 'yes_no', required: true },
                { key: 'adr_kiti', text: 'ADR Kiti Var mı?', type: 'yes_no', required: true },
                { key: 'ambalaj_adr_onayi', text: 'Ambalajların ADR onayı ve etiketlenmesi tam mı?', type: 'yes_no', required: true },
            ]
        },
        {
            title: 'Boşaltım Sonrası / Temizlik Kontrolü',
            questions: [
                { key: 'kalinti_temizlik', text: 'Kalıntılar temizlendi mi?', type: 'yes_no_partial', required: true },
                { key: 'dezenfeksiyon', text: 'Dezenfeksiyon uygun mu?', type: 'yes_no_partial', required: true },
            ]
        }
    ]
};

// 3. YÜKLEYEN-GÖNDEREN FORMU
export const YUKLEYEN_GONDEREN_FORM: ADRFormDefinition = {
    type: 'YUKLEYEN-GONDEREN',
    title: 'YÜKLEYEN-GÖNDEREN KONTROL FORMU',
    sections: [
        {
            title: 'Ambalaj Uygunluğu',
            questions: [
                { key: 'ambalaj_hasar', text: 'Ambalaj dış yüzeyinde hasar var mı?', type: 'yes_no', required: true },
                { key: 'etiketleme_uygunluk', text: 'Etiketlemeler uygun mu?', type: 'suitable_unsuitable', required: true },
            ]
        },
        {
            title: 'Taşıt ve Ambalaj İşaret-Etiket Zorunlulukları',
            questions: [
                { key: 'arac_plaka_levha', text: 'Araç ön/arka turuncu plaka var mı?', type: 'yes_no', required: true },
                { key: 'ambalaj_sizdirmazlik', text: 'Ambalaj sızdırmazlığı uygun mu?', type: 'yes_no', required: true },
                { key: 'palet_konteyner', text: 'Palet/Konteyner uygun mu?', type: 'yes_no' },
                { key: 'yuk_guvenligi', text: 'Yükler güvenli yerleştirildi mi?', type: 'yes_no', required: true },
            ]
        },
        {
            title: 'Karışık Yükleme/Ambalajlama & Belge',
            questions: [
                { key: 'karisik_yukleme', text: 'İzin verilen sınıflar kontrol edildi mi?', type: 'yes_no', required: true },
                { key: 'sizinti_onlem', text: 'Sızıntı riskine karşı önlem alındı mı?', type: 'yes_no', required: true },
                { key: 'tasima_evraki', text: 'Taşıma Evrakı Var mı?', type: 'yes_no', required: true },
                { key: 'src5', text: 'SRC-5 Belgesi Var mı?', type: 'yes_no', required: true },
                { key: 'mali_sorumluluk', text: 'Sigorta Poliçesi Var mı?', type: 'yes_no', required: true },
            ]
        }
    ]
};

// 4. PAKETLEYEN YÜKÜMLÜLÜKLERİ (EK FORM)
export const PAKETLEYEN_FORM: ADRFormDefinition = {
    type: 'PAKETLEYEN-YUKUMLULUK',
    title: 'PAKETLEYEN YÜKÜMLÜLÜKLERİ FORMU',
    sections: [
        {
            title: 'Karışık Paketleme Kuralları',
            questions: [
                { key: 'tehlike_sinifi', text: 'Tehlike sınıfı belirlendi mi?', type: 'checkbox', required: true },
                { key: 'uyumlu_madde', text: 'Uyumlu maddeler karışık ambalajlandı mı?', type: 'checkbox', required: true },
                { key: 'etiket_uyari', text: 'Etiketleme/Uyarılar eklendi mi?', type: 'checkbox', required: true },
                { key: 'ambalaj_dayanim', text: 'Ambalaj dayanıklı mı?', type: 'checkbox', required: true },
            ]
        },
        {
            title: 'İşaret/Etiket Uygunluğu',
            questions: [
                { key: 'ambalaj_saglamlik', text: 'Ambalajlar sağlam mı?', type: 'yes_no', required: true },
                { key: 'un_sinif_dogruluk', text: 'UN numarası ve sınıf bilgileri doğru mu?', type: 'yes_no', required: true },
            ]
        }
    ]
};

// 5. DOLDURAN YÜKÜMLÜLÜKLERİ (EK FORM)
export const DOLDURAN_FORM: ADRFormDefinition = {
    type: 'DOLDURAN-YUKUMLULUK',
    title: 'DOLDURAN YÜKÜMLÜLÜKLERİ FORMU',
    sections: [
        {
            title: 'Muayene ve Tank Dolum Kontrolü',
            questions: [
                { key: 'dolum_baglanti', text: 'Dolum bağlantı noktaları ve valfler çalışır durumda mı?', type: 'yes_no', required: true },
                { key: 'sizdirmazlik_kontrol', text: 'Sızdırmazlık kontrolü yapıldı mı?', type: 'yes_no', required: true },
                { key: 'gbf_inceleme', text: 'GBF (Güvenlik Bilgi Formu) incelendi mi?', type: 'yes_no', required: true },
            ]
        },
        {
            title: 'Bölmeli Tank / Azami Doldurma',
            questions: [
                { key: 'bolme_sizdirmazlik', text: 'Bölmeler arası sızdırmazlık sağlandı mı?', type: 'yes_no', required: true },
                { key: 'tank_kapasite', text: 'Tank kapasitesi/oranı aşıldı mı?', type: 'yes_no', required: true },
            ]
        },
        {
            title: 'Dolum Sonrası',
            questions: [
                { key: 'kapak_valf_sizdirmazlik', text: 'Kapak ve valflerin sızdırmazlığı sağlandı mı?', type: 'yes_no', required: true },
                { key: 'dis_yuzey_bulasma', text: 'Dış yüze bulaşma engellendi mi?', type: 'yes_no', required: true },
            ]
        }
    ]
};
