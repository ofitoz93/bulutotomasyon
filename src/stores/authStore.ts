import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface Profile {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    role: 'system_admin' | 'company_manager' | 'employee'
    tenant_id: string | null
}

interface AuthState {
    session: Session | null
    user: User | null
    profile: Profile | null
    loading: boolean
    setSession: (session: Session | null) => void
    setProfile: (profile: Profile | null) => void
    signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    loading: true,
    setSession: (session) => set({ session, user: session?.user ?? null, loading: false }),
    setProfile: (profile) => set({ profile }),
    signOut: async () => {
        await supabase.auth.signOut()
        set({ session: null, user: null, profile: null })
    },
}))
