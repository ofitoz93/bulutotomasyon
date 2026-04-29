import { 
    ALIM_AMBALAJ_QUESTIONS, ALIM_TANKER_QUESTIONS, 
    GONDERIM_VIDANJOR_QUESTIONS, GONDERIM_AMBALAJ_PAKETLEYEN, YUKLEYEN_GONDEREN_QUESTIONS 
} from "./TMGDFormConfigs";

export const getQuestionsForFlow = (flowType: string, formType: string) => {
    let configs: any[] = [];
    if (flowType === "alim") {
        if (formType === "ambalaj" || formType === "konteyner") configs = ALIM_AMBALAJ_QUESTIONS;
        else if (formType === "tanker") configs = ALIM_TANKER_QUESTIONS;
    } else if (flowType === "gonderim") {
        if (formType.includes("vidanjor") || formType.includes("tanker")) {
            configs = [...GONDERIM_VIDANJOR_QUESTIONS, ...YUKLEYEN_GONDEREN_QUESTIONS];
        } else if (formType.includes("ambalaj")) {
            configs = [...GONDERIM_AMBALAJ_PAKETLEYEN, ...YUKLEYEN_GONDEREN_QUESTIONS];
        } else if (formType.includes("dokme")) {
            configs = [...YUKLEYEN_GONDEREN_QUESTIONS];
        }
    }
    return configs;
};
