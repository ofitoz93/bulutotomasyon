import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface Profile {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone_number?: string | null
    tc_no?: string | null
    company_employee_no?: string | null
    role: 'system_admin' | 'company_manager' | 'employee' | 'subcontractor_manager'
    tenant_id: string | null
}

interface AuthState {
    session: Session | null
    user: User | null
    profile: Profile | null
    loading: boolean
    setSession: (session: Session | null) => void
    setProfile: (profile: Profile | null) => void
    updateUserProfile: (updates: Partial<Profile>) => void
    signOut: () => Promise<void>
    isCompanyManager: () => boolean
    isSystemAdmin: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    user: null,
    profile: null,
    loading: true,
    setSession: (session) => set({ session, user: session?.user ?? null, loading: false }),
    setProfile: (profile) => set({ profile }),
    updateUserProfile: (updates) => set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null
    })),
    signOut: async () => {
        await supabase.auth.signOut()
        set({ session: null, user: null, profile: null })
    },
    isCompanyManager: () => {
        const profile = get().profile;
        return profile?.role === 'company_manager';
    },
    isSystemAdmin: () => {
        const profile = get().profile;
        return profile?.role === 'system_admin';
    }
}))
