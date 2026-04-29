export const ALIM_AMBALAJ_QUESTIONS = [
  {
    section: "TEHLİKELİ MADDE ARAÇ VE AMBALAJ KONTROL",
    type: "yes_no",
    questions: [
      { id: "src5", text: "Sürücünün SRC-5 belgesi mevcut mu?" },
      { id: "tasima_evraki", text: "Yazılı talimat ve taşıma evrakı var mı?" },
      { id: "sigorta", text: "Zorunlu mali sorumluluk sigorta poliçesi var mı?" },
      { id: "levha", text: "Turuncu plaka ve tehlike ikaz levhaları mevcut mu?" },
      { id: "adr_kiti", text: "Araçta ADR kiti ve kişisel koruyucu ekipmanlar mevcut mu?" },
      { id: "ambalaj_adr", text: "Ambalajlar ADR onaylı mı?" },
      { id: "ambalaj_etiket", text: "Ambalajların işaretlenmesi ve etiketlenmesi tam mı?" },
      { id: "arac_uygunluk", text: "Araç uygunluk belgesi var mı? (Tankerli taşımalarda)" }
    ]
  },
  {
    section: "TEHLİKELİ MADDELERİN BOŞALTIMI SONRASI KONTROL",
    type: "yes_no_na",
    questions: [
      { id: "dis_temizlik", text: "Tank/Taşıt/Konteynerin dışına bulaşan tehlikeli maddeler temizlendi mi?" },
      { id: "vana_kapak", text: "Vana ve kontrol/doldurma kapakları güvenli bir şekilde kapatıldı mı?" },
      { id: "hasar_sizinti", text: "Tank/Taşıt/Konteynerde görünür hasar veya sızıntı var mı?" },
      { id: "cevre_kalinti", text: "Çevrede tehlikeli madde kalıntısı var mı?" }
    ]
  },
  {
    section: "TEHLİKELİ MADDE TAŞIMACILIĞI SONRASI TEMİZLİK VE DEZENFEKSİYON KONTROL",
    type: "yes_no_na",
    questions: [
      { id: "ic_kalinti", text: "Taşıt/Konteyner içindeki ambalaj veya dökme olarak taşınan tehlikeli madde kalıntıları temizlendi mi?" },
      { id: "yuzey_kalinti", text: "Taşıt/Konteyner yüzeylerinde tehlikeli madde kalıntıları temizlendi mi?" },
      { id: "temizlik_ekipman", text: "Kullanılan temizlik/dezenfeksiyon ekipmanları ADR standartlarına uygun mu?" },
      { id: "atik_bertaraf", text: "Temizlik/dezenfeksiyon sonrası atıkların uygun şekilde bertaraf edildiği doğrulandı mı?" }
    ]
  }
];

export const ALIM_TANKER_QUESTIONS = [
  {
    section: "TANK/TAŞIMA BİRİMİ BİLGİLERİ",
    type: "var_yok",
    questions: [
      { id: "tank_onay", text: "TANK ONAY SERTİFİKASI" },
      { id: "arac_uygunluk_pre2015", text: "ARAÇ UYGUNLUK BELGESİ (2015 Öncesi Tanklar için)" }
    ]
  },
  {
    section: "ARAÇTA BULUNMASI GEREKEN BELGELER",
    type: "var_yok",
    questions: [
      { id: "tasima_evraki", text: "TAŞIMA EVRAKI" },
      { id: "yazili_talimat", text: "YAZILI TALİMAT" },
      { id: "src5", text: "ŞOFÖRÜN SRC 5 SERTİFİKASI" }
    ]
  },
  {
    section: "ARAÇ ÜZERİNDEKİ GEREKLİ DONANIMLAR",
    type: "var_yok",
    questions: [
      { id: "tank_sizdirmazlik", text: "TANK SIZDIRMAZLIK DURUMU", typeOverride: "uygun_degil" },
      { id: "yangin_sondurucu", text: "YANGIN SÖNDÜRÜCÜ" },
      { id: "turuncu_plaka", text: "TURUNCU PLAKA" },
      { id: "tehlike_levha", text: "TEHLİKE SINIFI VE UYARI LEVHALARI" },
      { id: "adr_kiti", text: "ADR EKİPMANLARI (ADR KİTİ)" }
    ]
  },
  {
    section: "TEHLİKELİ MADDELERİN BOŞALTIMI SONRASI KONTROL",
    type: "yes_no_na",
    questions: [
      { id: "dis_temizlik", text: "Tank dışına bulaşan tehlikeli maddeler temizlendi mi?" },
      { id: "vana_kapak", text: "Vana ve kontrol/doldurma kapakları güvenli bir şekilde kapatıldı mı?" },
      { id: "hasar_sizinti", text: "Tankta görünür hasar veya sızıntı var mı?" },
      { id: "cevre_kalinti", text: "Çevrede tehlikeli madde kalıntısı var mı?" }
    ]
  }
];

export const GONDERIM_VIDANJOR_QUESTIONS = [
  {
    section: "DOLUMU YAPILACAK OLAN YÜK TAŞIMA BİRİMLERİNİN KONTROLÜ",
    type: "yes_no",
    questions: [
      { id: "v1", text: "Muayene belgeleri eksiksiz ve doğru şekilde taşıt üzerinde bulunduruluyor mu?" },
      { id: "v2", text: "Dolum yapılacak tank ADR'nin taşıma sınıfına uygun olarak etiketlenmiş mi?" },
      { id: "v3", text: "Tankın dolum bağlantı noktaları ve valfleri çalışır durumda mı?" },
      { id: "v4", text: "Tankın vana ve kapaklarının sızdırmazlık kontrolü yapılmış mı?" },
      { id: "v5", text: "Dolum yapılacak alanın temizliği ve güvenliği sağlanmış mı?" },
      { id: "v6", text: "Dolum ekipmanlarının ADR standartlarına uygunluğu kontrol edilmiş mi?" },
      { id: "v7", text: "Dolum öncesi, dolum yapılacak maddenin GBF incelenmiş mi?" }
    ]
  },
  {
    section: "TEHLİKE İKAZ ETİKET/LEVHA VE İŞARETLERİ",
    type: "yes_no",
    questions: [
      { id: "v8", text: "Tehlike ikaz etiketleri, taşınacak maddenin ADR sınıfına uygun seçilmiş mi?" },
      { id: "v9", text: "Etiketler, yük taşıma biriminin dört bir tarafında doğru yerleştirilmiş mi?" },
      { id: "v10", text: "Turuncu Plakalar, taşıtın ön ve arka kısmında görünür yerleştirilmiş mi?" },
      { id: "v11", text: "Plakalar üzerinde taşınacak tehlikeli maddeye ilişkin bilgiler doğru mu?" }
    ]
  },
  {
    section: "BÖLMELİ TANKLARIN BİTİŞİK BÖLMELERİ",
    type: "yes_no",
    questions: [
      { id: "v12", text: "Bölmeler arasındaki sızdırmazlık sağlanmış mı?" },
      { id: "v13", text: "Bölmelerin dolum sırasında maksimum kapasiteye göre doldurulmadığı kontrol edildi mi?" },
      { id: "v14", text: "Tankın valfleri ve kapaklarının çalışma durumu kontrol edildi mi?" },
      { id: "v15", text: "Farklı tehlikeli madde sınıflarının bitişik bölmelere doldurulmadığı doğrulandı mı?" },
      { id: "v16", text: "Dolum sırasında kullanılacak ekipmanların ADR standartlarına uygunluğu kontrol edildi mi?" },
      { id: "v17", text: "Dolum yapılacak alanın temiz ve güvenli olduğu doğrulandı mı?" },
      { id: "v18", text: "Dolum işlemi sırasında sızıntı veya taşma olmaması için önlemler alındı mı?" },
      { id: "v19", text: "Dolum tamamlandıktan sonra bölme kapakları ve valflerin sızdırmazlığı kontrol edildi mi?" },
      { id: "v20", text: "Her bölmeye doldurulan maddeye uygun tehlike ikaz etiketleri tank üzerine yerleştirildi mi?" },
      { id: "v21", text: "Bölmeli tankın ön ve arka kısmında turuncu renkli plakalar doğru şekilde takıldı mı?" }
    ]
  },
  {
    section: "AZAMİ DOLDURMA DERECESİ",
    type: "yes_no",
    questions: [
      { id: "v22", text: "Dolum yapılacak tankın veya taşıma biriminin kapasitesi belirlenmiş mi?" },
      { id: "v23", text: "Dolum miktarının, tankın toplam hacminin izin verilen oranını aşmadığı kontrol edildi mi?" },
      { id: "v24", text: "Tankın sıcaklık ve basınç toleransına göre dolum miktarı ayarlanmış mı?" },
      { id: "v25", text: "Taşınacak maddenin yoğunluğu belirlenmiş ve doğrulanmış mı?" },
      { id: "v26", text: "Doldurulan maddeye uygun güvenlik önlemleri alınmış mı?" },
      { id: "v27", text: "Doldurulan madde için ADR'de belirtilen etiketleme kurallarına uyulmuş mu?" },
      { id: "v28", text: "Dolum miktarı, tank kapasitesi ve madde yoğunluğuna ilişkin belgeler doğru hazırlanmış mı?" }
    ]
  },
  {
    section: "DOLUM YAPILDIKTAN SONRA SIZDIRMAZLIK",
    type: "yes_no",
    questions: [
      { id: "v29", text: "Tank kapaklarının sızdırmazlık kontrolü yapıldı mı?" },
      { id: "v30", text: "Doldurulan valflerin sızdırmazlık kontrolü yapıldı mı?" },
      { id: "v31", text: "Tank kapakları ve valfler uygun şekilde kilitlendi mi?" },
      { id: "v32", text: "Tehlikeli madde etiketi ve uyarılar kontrol edildi mi?" },
      { id: "v33", text: "Dolum işlemi sırasında kullanılan ekipman uygun şekilde temizlendi mi?" }
    ]
  },
  {
    section: "ADR/TAŞIT UYGUNLUK BELGESİNE SAHİP OLAN TAŞITLAR",
    type: "yes_no",
    questions: [
      { id: "v34", text: "Taşıt ADR/Taşıt Uygunluk Belgesine sahip mi?" },
      { id: "v35", text: "Taşıtın ADR uygunluk belgesi süresi geçerli mi?" },
      { id: "v36", text: "Taşıtın tank veya konteyner hacmi taşıma gerekliliklerine uygun mu?" },
      { id: "v37", text: "Taşıtın yükleme ekipmanları ADR standartlarına uygun mu?" },
      { id: "v38", text: "Taşıtın dış yüzeyi tehlikeli madde bulaşından arınık durumda mı?" },
      { id: "v39", text: "Taşıyıcı firma ve sürücünün ADR sertifikası bulunuyor mu?" },
      { id: "v40", text: "Taşıtın şoför kabini ve diğer ekipmanları uygun işaretleme etiketlerine sahip mi?" },
      { id: "v41", text: "Yangın söndürme ekipmanları kontrol edildi mi?" },
      { id: "v42", text: "Yük sabitleme donanımları uygun durumda mı?" },
      { id: "v43", text: "ADR kurallarına uygun şekilde yükleme yapıldı mı?" },
      { id: "v44", text: "Taşıtın izleme ve takip sistemleri (varsa) aktif durumda mı?" }
    ]
  },
  {
    section: "DÖKME OLARAK YAPILACAK DOLUM",
    type: "yes_no",
    questions: [
      { id: "v45", text: "Dolum işlemi başlamadan önce taşıt/konteyner ADR uygunluk belgesine sahip mi?" },
      { id: "v46", text: "Taşıt veya konteynerin ADR Bölüm 7.3'e uygun şekilde kontrolü yapıldı mı?" },
      { id: "v47", text: "Dolum yapılacak tehlikeli madde ADR bölüm 7.3'e uygun mu?" },
      { id: "v48", text: "Yükleme sırasında kullanılan ekipmanlar ADR standartlarına uygun mu?" },
      { id: "v49", text: "Dolum alanında gerekli uyarı ve ikaz levhaları mevcut mu?" },
      { id: "v50", text: "Yükleme sırasında statik elektrik riski önlemleri alındı mı?" },
      { id: "v51", text: "Dolum hızı ve miktarı kontrol edildi mi?" },
      { id: "v52", text: "Taşıt veya konteyner valfleri ve kapaklarının sızdırmazlık kontrolü yapıldı mı?" },
      { id: "v53", text: "Dolumdan sonra taşıt veya konteynerin dış yüzeyi tehlikeli madde bulaşından arınık mı?" },
      { id: "v54", text: "Tehlikeli madde etiketleri ve işaretlemeleri ADR kurallarına uygun mu?" },
      { id: "v55", text: "Acil durum ekipmanları (yangın söndürme cihazları, dökülme kitleri vb.) hazır durumda mı?" },
      { id: "v56", text: "Dolum tamamlandıktan sonra taşıt veya konteyner ADR Bölüm 7.3'e uygun şekilde kilitlendi mi?" }
    ]
  },
  {
    section: "TMFB KONTROLÜ",
    type: "yes_no",
    questions: [
      { id: "v57", text: "Taşıt ADR uygunluk belgesine sahip mi?" },
      { id: "v58", text: "Taşıtın TMFB bilgileri eksiksiz ve doğru mu?" },
      { id: "v59", text: "Yükleme sırasında taşıtın yasal gerekliliklere uygun olduğu kontrol edildi mi?" },
      { id: "v60", text: "Taşıt ve sürücünün gerekli belgeleri yanında mı?" },
      { id: "v61", text: "Taşıt yükleme işlemi öncesinde ADR ve TMFB kurallarına uygun mu?" },
      { id: "v62", text: "Tehlikeli madde etiketi ve işaretlemeleri ADR ve TMFB kurallarına uygun mu?" }
    ]
  }
];

export const GONDERIM_AMBALAJ_PAKETLEYEN = [
  {
    section: "KARIŞIK PAKETLEME İŞLEMİ SIRASINDA UYULMASI GEREKEN KURALLAR",
    type: "uygun_degil",
    questions: [
      { id: "p1", text: "Tehlikeli Maddelerin Sınıflandırılması (Karışık paketleme işlemi öncesinde, maddelerin tehlike sınıfı belirlenmelidir)" },
      { id: "p2", text: "Uyumlu Maddelerin Karışık Ambalajlanması (Sadece uyumlu tehlikeli maddeler karışık ambalajlanmalıdır)" },
      { id: "p3", text: "Etiketleme ve Uyarılar (Her bir paket içeriğine uygun olarak etiketlenmeli)" },
      { id: "p4", text: "Paketleme Malzemelerinin Uygunluğu (Malzemeler özelliklere göre seçilmeli)" },
      { id: "p5", text: "Ambalajın Dayanıklılığı (Sızmayı engelleyecek şekilde dayanıklı olmalı)" },
      { id: "p6", text: "Ayrı Depolama Alanları (Depolama sırasında birbirlerinden uzak tutulmalı)" }
    ]
  },
  {
    section: "İŞARETLEME VE ETİKETLEME KURALLARINA UYGUNLUK",
    type: "yes_no",
    questions: [
      { id: "p7", text: "Ambalajın ADR'ye uygun işaretlemesi var mı?" },
      { id: "p8", text: "Ambalajlar sağlam mı? (Sızıntı var mı? Ambalaj deforme olmuş mu?)" },
      { id: "p9", text: "Ambalaj üzerinde belirtilen UN numarası ve sınıf bilgileri doğru mu?" }
    ]
  }
];

export const YUKLEYEN_GONDEREN_QUESTIONS = [
  {
    section: "AMBALAJLARIN UYGUNLUĞUNUN KONTROLÜ",
    type: "uygun_degil",
    questions: [
      { id: "y1", text: "Ambalajın Dış Yüzeyinde Hasar Var mı?" },
      { id: "y2", text: "Ambalajın etiket ve işaretlemeleri uygun mu?" },
      { id: "y3", text: "Ambalaj taşıma ve depolama koşullarına uygun mu?" }
    ]
  },
  {
    section: "İŞARET-ETİKET-LEVHA ZORUNLULUKLARI",
    type: "yes_no",
    questions: [
      { id: "y4", text: "TAŞITLAR: Aracın ön ve arkasında turuncu plaka var mı?" },
      { id: "y5", text: "TAŞITLAR: Tehlikeli madde etiketleri ve işaretleri uygun mu?" },
      { id: "y6", text: "AMBALAJLAR: Ambalajların üzerinde gerekli işaret ve etiketlerin var mı?" },
      { id: "y7", text: "AMBALAJLAR: Ambalajların sızdırmazlık ve güvenlik önlemlerine uygun mu?" },
      { id: "y8", text: "AMBALAJLAR: Ambalajlar ADR onaylı mı?" },
      { id: "y9", text: "YÜK TAŞIMA BİRİMLERİ: Yük taşıma birimleri (paletler, konteynerler) uygun mu?" },
      { id: "y10", text: "YÜK TAŞIMA BİRİMLERİ: Yük taşıma birimlerinde bulunan işaretler doğru ve okunabilir mi?" },
      { id: "y11", text: "YÜK TAŞIMA BİRİMLERİ: Yükler güvenli bir şekilde yerleştirildi mi?" }
    ]
  },
  {
    section: "KARIŞIK AMBALAJLAMA VE KARIŞIK YÜKLEME",
    type: "yes_no",
    questions: [
      { id: "y12", text: "Etiketler ve işaretlemeler eksiksiz mi?" },
      { id: "y13", text: "Ambalajlar hasarsız ve sağlam mı?" },
      { id: "y14", text: "Aynı taşıma biriminde yüklenmesine izin verilen tehlikeli madde sınıfları kontrol edildi mi?" },
      { id: "y15", text: "Taşıma birimi içinde sızıntı riskine karşı gerekli önlemler alındı mı?" },
      { id: "y16", text: "Tehlikeli maddelerin çevresel risklere uygun koruma malzemeleriyle yüklendiği kontrol edildi mi?" }
    ]
  },
  {
    section: "YÜKLEME VE TAŞIMA BELGELERİNİN KONTROLÜ",
    type: "yes_no",
    questions: [
      { id: "y17", text: "SRC-5 belgeli Şoför" },
      { id: "y18", text: "Taşıma Evrakı" },
      { id: "y19", text: "Yazılı Talimat" },
      { id: "y20", text: "Tehlikeli Maddeler ve Tehlikeli Atık Zorunlu Mali Sorumluluk Poliçesi" },
      { id: "y21", text: "ADR Araç Uygunluk Belgesi / T9 Belgesi (Tankerli Taşımalarda)" }
    ]
  }
];
