
export type ADRFormType =
    | 'TANK-ALICI'
    | 'AMBALAJ-ALICI'
    | 'YUKLEYEN-GONDEREN'
    | 'PAKETLEYEN-YUKUMLULUK'
    | 'DOLDURAN-YUKUMLULUK';

export type ADRFormStatus = 'pending' | 'approved' | 'rejected';

export interface ADRForm {
    id: string;
    company_id: string;
    user_id: string;
    form_type: ADRFormType;
    status: ADRFormStatus;
    plate_no: string;
    driver_name: string;
    location_lat?: number; // Optional
    location_lng?: number; // Optional
    created_at: string;
    approved_at?: string;
    approved_by?: string;
    notes?: string;

    // Virtual / Joined fields
    profiles?: { first_name: string; last_name: string };
    approver?: { first_name: string; last_name: string };
    form_answers?: FormAnswer[];
    form_media?: FormMedia[];
}

export interface FormAnswer {
    id: string;
    form_id: string;
    question_key: string;
    answer_value: {
        result: string; // "Evet", "Hayır", "Uygun", "Uygun Değil", etc.
        details?: string;
    };
}

export interface FormMedia {
    id: string;
    form_id: string;
    file_url: string;
    file_name: string;
    uploaded_at: string;
}

export interface QuestionDefinition {
    key: string;
    text: string;
    type: 'yes_no' | 'yes_no_partial' | 'suitable_unsuitable' | 'text' | 'checkbox';
    required?: boolean;
}
