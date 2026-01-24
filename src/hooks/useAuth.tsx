import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  dealership_id: string | null;
}

interface UserRole {
  role: 'admin' | 'rep';
  dealership_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userRole: UserRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; user: User | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  createDealership: (name: string) => Promise<{ error: Error | null; dealership: any }>;
  joinDealership: (inviteCode: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);

      if (profileData.dealership_id) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role, dealership_id')
          .eq('user_id', userId)
          .eq('dealership_id', profileData.dealership_id)
          .maybeSingle();

        if (roleData) {
          setUserRole(roleData as UserRole);
        }
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return { error, user: null };
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
        });

      if (profileError) {
        return { error: profileError as unknown as Error, user: null };
      }
    }

    return { error: null, user: data.user };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserRole(null);
  };

  const createDealership = async (name: string) => {
    if (!user) {
      return { error: new Error('Not authenticated'), dealership: null };
    }

    // Call the secure backend function that handles everything in one transaction
    const { data: dealership, error } = await supabase
      .rpc('create_dealership_for_current_user', { _name: name })
      .single();

    if (error) {
      console.error('Failed to create dealership:', error);
      return { error: error as unknown as Error, dealership: null };
    }

    await fetchProfile(user.id);
    return { error: null, dealership };
  };

  const joinDealership = async (inviteCode: string) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    // Find dealership by invite code - we need to use a function since we can't see dealerships we're not part of
    const { data: dealerships, error: searchError } = await supabase
      .rpc('find_dealership_by_invite_code', { code: inviteCode });

    if (searchError || !dealerships || dealerships.length === 0) {
      return { error: new Error('Invalid invite code') };
    }

    const dealership = dealerships[0];

    // Update profile with dealership
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ dealership_id: dealership.id })
      .eq('user_id', user.id);

    if (profileError) {
      return { error: profileError as unknown as Error };
    }

    // Create rep role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        dealership_id: dealership.id,
        role: 'rep',
      });

    if (roleError) {
      return { error: roleError as unknown as Error };
    }

    await fetchProfile(user.id);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        loading,
        signUp,
        signIn,
        signOut,
        createDealership,
        joinDealership,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
