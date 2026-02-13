import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    isAdmin: false,
    isLoading: true,
  });
  const navigate = useNavigate();
  const loadingRef = useRef(true);

  useEffect(() => {
    let isMounted = true;

    const updateState = (newState: AdminAuthState) => {
      if (isMounted) {
        loadingRef.current = newState.isLoading;
        setState(newState);
      }
    };

    const timeout = setTimeout(() => {
      if (isMounted && loadingRef.current) {
        console.warn('Admin auth check timed out after 10s');
        updateState({ user: null, isAdmin: false, isLoading: false });
      }
    }, 10000);

    const checkAdminRole = async (user: User): Promise<boolean> => {
      try {
        const { data, error } = await supabase.rpc('is_admin');
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        return Boolean(data);
      } catch (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
    };

    // Initial auth check
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          updateState({ user: null, isAdmin: false, isLoading: false });
          clearTimeout(timeout);
          return;
        }

        const isAdmin = await checkAdminRole(session.user);
        updateState({ user: session.user, isAdmin, isLoading: false });
        clearTimeout(timeout);
      } catch (error) {
        console.error('Error in initial auth check:', error);
        updateState({ user: null, isAdmin: false, isLoading: false });
        clearTimeout(timeout);
      }
    };

    initializeAuth();

    // Ongoing auth state changes (does NOT control isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT') {
          updateState({ user: null, isAdmin: false, isLoading: false });
        } else if (session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            checkAdminRole(session.user!).then((isAdmin) => {
              if (isMounted) {
                updateState({ user: session.user!, isAdmin, isLoading: false });
              }
            });
          }, 0);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin');

    if (roleError) {
      throw new Error('Failed to verify admin access');
    }

    if (!isAdmin) {
      await supabase.auth.signOut();
      throw new Error('Access denied. Admin privileges required.');
    }

    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return {
    ...state,
    signIn,
    signOut,
  };
}
