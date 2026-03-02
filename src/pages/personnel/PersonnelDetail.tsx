import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    tc_no: string | null;
    company_employee_no: string | null;
    position: string | null;
    subcontractor_id: string | null;
    blood_group: string | null;
    gender: string | null;
    birth_date: string | null;
    hiring_date: string | null;
    leaving_date: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    profile_image_url: string | null;
    tenant_id: string;
}

export default function PersonnelDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [person, setPerson] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"ozluk" | "saglik" | "egitim" | "kkd">("ozluk");

    // Data states for tabs
    const [healthRecords, setHealthRecords] = useState<any[]>([]);
    const [ppeAssignments, setPPEAssignments] = useState<any[]>([]);

    useEffect(() => {
        if (id) {
            fetchPerson();
            fetchDataForTabs();
        }
    }, [id]);

    const fetchPerson = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            setPerson(data);
        } catch (e) {
            console.error(e);
            navigate("/app/personel-takip");
        } finally {
            setLoading(false);
        }
    };

    const fetchDataForTabs = async () => {
        if (!id) return;
        const [healthRes, ppeRes] = await Promise.all([
            supabase.from("personnel_health_records").select("*").eq("user_id", id).order("exam_date", { ascending: false }),
            supabase.from("ppe_assignments").select("*, ppe_types(name, category)").eq("user_id", id).order("assignment_date", { ascending: false })
        ]);
        setHealthRecords(healthRes.data || []);
        setPPEAssignments(ppeRes.data || []);
    };

    if (loading) return (
        <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!person) return null;

    const LabelValue = ({ label, value }: { label: string; value: string | null }) => (
        <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{value || "—"}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Personel Ana Kart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-600"></div>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-24 h-24 rounded-2xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-3xl font-bold text-indigo-300 shadow-inner overflow-hidden border border-indigo-100 dark:border-slate-700">
                        {person.profile_image_url ? (
                            <img src={person.profile_image_url} alt="" className="w-full h-full object-cover" />
                        ) : `${(person.first_name || "?")[0]}${(person.last_name || "?")[0]}`}
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {person.first_name} {person.last_name}
                                </h1>
                                <p className="text-indigo-600 dark:text-indigo-400 font-medium">{person.position || "Pozisyon Belirtilmemiş"}</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 text-sm font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded-xl transition-all">
                                    Profili Düzenle
                                </button>
                                <button className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <LabelValue label="TC Kimlik No" value={person.tc_no} />
                            <LabelValue label="Sicil No" value={person.company_employee_no} />
                            <LabelValue label="Kan Grubu" value={person.blood_group} />
                            <LabelValue label="E-Posta" value={person.email} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Detay Sekmeleri */}
            <div className="flex gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
                {[
                    { id: "ozluk", label: "Özlük Bilgileri" },
                    { id: "saglik", label: "Sağlık & Muayene" },
                    { id: "egitim", label: "Eğitim & Sertifika" },
                    { id: "kkd", label: "KKD Zimmetleri" }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === tab.id
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* İçerik */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[300px]">
                {activeTab === "ozluk" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-50 dark:border-slate-800 pb-2">Kişisel Bilgiler</h3>
                            <LabelValue label="Cinsiyet" value={person.gender} />
                            <LabelValue label="Doğum Tarihi" value={person.birth_date ? new Date(person.birth_date).toLocaleDateString("tr-TR") : null} />
                        </section>
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-50 dark:border-slate-800 pb-2">İş Bilgileri</h3>
                            <LabelValue label="İşe Giriş Tarihi" value={person.hiring_date ? new Date(person.hiring_date).toLocaleDateString("tr-TR") : null} />
                            <LabelValue label="İşten Ayrılış" value={person.leaving_date ? new Date(person.leaving_date).toLocaleDateString("tr-TR") : null} />
                        </section>
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-50 dark:border-slate-800 pb-2">Acil Durum</h3>
                            <LabelValue label="Acil Durum İrtibat" value={person.emergency_contact_name} />
                            <LabelValue label="İrtibat Telefonu" value={person.emergency_contact_phone} />
                        </section>
                    </div>
                )}

                {activeTab === "saglik" && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Muayene Geçmişi</h3>
                            <button
                                onClick={() => navigate("/app/personel-takip/saglik")}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-500 underline"
                            >
                                + Yeni Kayıt Ekle
                            </button>
                        </div>
                        {healthRecords.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">Kayıt bulunamadı.</p>
                        ) : (
                            <div className="space-y-3">
                                {healthRecords.map(r => (
                                    <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{r.record_type.replace(/_/g, " ").toUpperCase()}</p>
                                            <p className="text-[10px] text-slate-600 dark:text-slate-400">{new Date(r.exam_date).toLocaleDateString("tr-TR")}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.result === 'uygun' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {r.result.toUpperCase()}
                                            </span>
                                            {r.next_exam_date && (
                                                <p className="text-[9px] text-slate-400 mt-1">Sıradaki: {new Date(r.next_exam_date).toLocaleDateString("tr-TR")}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "egitim" && (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-4">🎓</div>
                        <p className="text-slate-500">Eğitim modülü verileri senkronize ediliyor...</p>
                        <button className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-500 underline">Eğitim Ataması Yap</button>
                    </div>
                )}

                {activeTab === "kkd" && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Zimmetli Donanımlar</h3>
                            <button
                                onClick={() => navigate("/app/personel-takip/kkd")}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-500 underline"
                            >
                                + Yeni Zimmet Ataması
                            </button>
                        </div>
                        {ppeAssignments.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">Zimmetli donanım bulunamadı.</p>
                        ) : (
                            <div className="space-y-3">
                                {ppeAssignments.map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{a.ppe_types?.name}</p>
                                            <p className="text-[10px] text-slate-600 dark:text-slate-400">{new Date(a.assignment_date).toLocaleDateString("tr-TR")} tarihinde verildi</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700`}>
                                                {a.status.toUpperCase()}
                                            </span>
                                            {a.expected_renewal_date && (
                                                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1">Yenileme: {new Date(a.expected_renewal_date).toLocaleDateString("tr-TR")}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
