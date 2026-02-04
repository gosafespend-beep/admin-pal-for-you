import { useEffect, useState } from "react";
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

  useEffect(() => {
    let isMounted = true;

    async function checkAdminStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (isMounted) {
            setState({ user: null, isAdmin: false, isLoading: false });
          }
          return;
        }

        // Check if user has admin role using the is_admin() function
        const { data: isAdmin, error } = await supabase.rpc('is_admin');
        
        if (error) {
          console.error('Error checking admin status:', error);
          if (isMounted) {
            setState({ user: session.user, isAdmin: false, isLoading: false });
          }
          return;
        }

        if (isMounted) {
          setState({ 
            user: session.user, 
            isAdmin: Boolean(isAdmin), 
            isLoading: false 
          });
        }
      } catch (error) {
        console.error('Error in admin auth check:', error);
        if (isMounted) {
          setState({ user: null, isAdmin: false, isLoading: false });
        }
      }
    }

    checkAdminStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setState({ user: null, isAdmin: false, isLoading: false });
          }
        } else if (session?.user) {
          // Re-check admin status on auth state change
          const { data: isAdmin } = await supabase.rpc('is_admin');
          if (isMounted) {
            setState({ 
              user: session.user, 
              isAdmin: Boolean(isAdmin), 
              isLoading: false 
            });
          }
        }
      }
    );

    return () => {
      isMounted = false;
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

    // Check admin status after sign in
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
    navigate('/admin/login');
  };

  return {
    ...state,
    signIn,
    signOut,
  };
}
