import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

/**
 * Custom hook for managing authentication state
 * Handles user session, authentication checks, and navigation
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const subscription = supabase.auth.onAuthStateChange((_event, authSession) => {
      setSession(authSession);
      setUser(authSession?.user ?? null);
      if (!authSession) {
        navigate('/auth');
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({
      data: {
        session: authSession
      }
    }) => {
      setSession(authSession);
      setUser(authSession?.user ?? null);
      if (!authSession) {
        navigate('/auth');
      }
      setIsLoading(false);
    }).catch(error => {
      logger.error('Error getting session:', error);
      navigate('/auth');
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      logger.error('Error signing out:', error);
    }
  };

  return {
    user,
    session,
    isLoading,
    signOut,
    isAuthenticated: !!session,
  };
}
