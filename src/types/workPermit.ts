export interface WorkPermitCoworker {
    id: string;
    permit_id: string;
    full_name: string;
    location: string | null;
    sicil_no: string | null;
    tc_no: string | null;
    is_approved: boolean;
    approved_at: string | null;
}

export interface WorkPermit {
    id: string;
    tenant_id: string;
    created_by: string;
    department: string | null;
    company_name: string | null;
    work_date: string;
    estimated_hours: number | null;
    project_id: string | null;

    // Arrays for checklists stored as JSONB
    job_types: string[];
    job_type_other: string | null;
    hazards: string[];
    hazard_other: string | null;
    ppe_requirements: string[];
    ppe_other: string | null;
    precautions: string[];
    precaution_other: string | null;

    status: 'pending' | 'approved' | 'rejected';
    creator_tc_no: string | null;
    is_creator_approved: boolean;

    engineer_approved_by: string | null;
    engineer_approved_at: string | null;
    isg_approved_by: string | null;
    isg_approved_at: string | null;

    created_at: string;

    // Relational joins
    profiles?: {
        first_name: string | null;
        last_name: string | null;
    };
    action_projects?: {
        name: string;
    };
    coworkers?: WorkPermitCoworker[];
    engineer_profile?: {
        first_name: string | null;
        last_name: string | null;
        tc_no: string | null;
    };
    isg_profile?: {
        first_name: string | null;
        last_name: string | null;
        tc_no: string | null;
    };
}
