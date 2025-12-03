"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Profile {
  id: string
  username: string
  email: string
  fullname?: string
  avatar_url?: string
  auth_user_id: string
}

interface AuthContextType {
  user: any | null
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Create or update profile (non-blocking, fire-and-forget)
  const ensureProfile = async (currentUser: any) => {
    try {
      // First, check if exists (quick select)
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', currentUser.id)
        .single()

      if (existing) {
        setProfile(existing)
        return // Done, update if needed later
      }

      // Create new if not exists
      const profileData = {
        auth_user_id: currentUser.id,
        username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'user',
        email: currentUser.email || '',
        fullname: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
        avatar_url: currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || '',
        updated_at: new Date().toISOString()
      }

      const { data } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      setProfile(data)
    } catch (error) {
      console.error('Profile creation error:', error)
      // Fallback: Set minimal profile from user data (biar bisa main)
      setProfile({
        id: 'fallback-' + currentUser.id,
        username: currentUser.email?.split('@')[0] || 'user',
        email: currentUser.email || '',
        fullname: '',
        avatar_url: '',
        auth_user_id: currentUser.id
      })
    }
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setLoading(false) // Always fast, profile async below

        // Lazy profile ensure after user set
        if (currentUser) {
          ensureProfile(currentUser) // No await, non-blocking
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Session error:', error)
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }
    getUser()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (event === 'SIGNED_IN' && currentUser) {
          // Only ensure profile on sign in (like temanmu)
          ensureProfile(currentUser) // Non-blocking
        } else if (!currentUser) {
          setProfile(null)
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}