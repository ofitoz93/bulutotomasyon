export interface ActionSubject {
    id: string;
    company_id: string;
    name: string;
    created_at: string;
}

export interface ActionProject {
    id: string;
    company_id: string;
    name: string;
    created_at: string;
}

export interface ActionContractor {
    id: string;
    company_id: string;
    name: string;
    email: string;
    created_at: string;
}

export interface ActionAssigneeUser {
    action_id: string;
    user_id: string;
    profiles?: {
        first_name: string;
        last_name: string;
        email?: string;
    };
}

export interface ActionAssigneeExternal {
    id: string;
    action_id: string;
    email: string;
}

export interface ActionAssigneeContractor {
    action_id: string;
    contractor_id: string;
    action_contractors?: ActionContractor;
}

export interface ActionCCUser {
    action_id: string;
    user_id: string;
    profiles?: {
        first_name: string;
        last_name: string;
        email?: string;
    };
}

export interface ActionForm {
    id: string;
    company_id: string;
    tracking_number: string;
    subject_id: string;
    project_id: string;
    total_days: number;
    action_description: string;
    nonconformity_description: string;
    status: 'open' | 'closed';
    created_by: string;
    created_at: string;
    closed_at?: string;
    closed_by?: string;

    // Joins
    action_subjects?: ActionSubject;
    action_projects?: ActionProject;
    profiles?: { // created by
        first_name: string;
        last_name: string;
    };
    closer?: { // closed by
        first_name: string;
        last_name: string;
    };
    action_assignee_users?: ActionAssigneeUser[];
    action_assignee_contractors?: ActionAssigneeContractor[];
    action_assignee_external?: ActionAssigneeExternal[];
    action_cc_users?: ActionCCUser[];
}

export interface ActionComment {
    id: string;
    action_id: string;
    user_id: string;
    comment: string;
    created_at: string;
    profiles?: {
        first_name: string;
        last_name: string;
    };
}

export interface ActionFile {
    id: string;
    action_id: string;
    uploaded_by: string;
    file_url: string;
    file_name: string;
    uploaded_at: string;
    profiles?: {
        first_name: string;
        last_name: string;
    };
}
