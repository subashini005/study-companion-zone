import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo mode for development when Supabase is not available
const DEMO_MODE = true; // Set to true to enable demo mode
const demoUsers: Record<string, string> = {
  'demo@example.com': 'password123',
  'test@example.com': 'test123'
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (DEMO_MODE) {
      // In demo mode, check localStorage for demo user
      const demoUserEmail = localStorage.getItem('demo_user');
      if (demoUserEmail) {
        setUser({
          id: 'demo-' + demoUserEmail,
          email: demoUserEmail,
          user_metadata: {},
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User);
      }
      setIsLoading(false);
      return;
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state changed:', event, newSession?.user?.email);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setIsLoading(false);
      } else {
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setIsLoading(false);
      }
    }).catch(err => {
      console.error('Failed to get session:', err);
      setIsLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    if (DEMO_MODE) {
      // Demo mode: just store the user
      localStorage.setItem('demo_user', email);
      demoUsers[email] = password;
      setUser({
        id: 'demo-' + email,
        email: email,
        user_metadata: {},
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User);
      return {};
    }

    try {
      console.log('Signing up with email:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}`,
        }
      });
      
      if (error) {
        console.error('Sign up error:', error);
        return { error: error.message };
      }
      
      console.log('Sign up successful:', data);
      return { data };
    } catch (err) {
      console.error('Sign up exception:', err);
      return { error: err instanceof Error ? err.message : 'An unexpected error occurred during sign up' };
    }
  };



  const signIn = async (email: string, password: string) => {
    if (DEMO_MODE) {
      // Demo mode: validate against stored credentials
      if (demoUsers[email] === password) {
        localStorage.setItem('demo_user', email);
        setUser({
          id: 'demo-' + email,
          email: email,
          user_metadata: {},
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User);
        return {};
      } else {
        return { error: 'Invalid email or password' };
      }
    }

    try {
      console.log('Signing in with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Sign in error:', error);
        // Check if it's a network error
        if (error.message.includes('fetch')) {
          return { error: 'Network error: Unable to reach authentication server. Please check your internet connection and Supabase configuration.' };
        }
        return { error: error.message };
      }
      
      console.log('Sign in successful:', data);
      return { data };
    } catch (err) {
      console.error('Sign in exception:', err);
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      if (errorMsg.includes('fetch')) {
        return { error: 'Network error: Unable to reach authentication server. Please check your internet connection.' };
      }
      return { error: errorMsg };
    }
  };

  const logout = async () => {
    if (DEMO_MODE) {
      localStorage.removeItem('demo_user');
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    logout,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};