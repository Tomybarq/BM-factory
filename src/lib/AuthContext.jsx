import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSession = async (session) => {
    setIsLoadingPublicSettings(false);
    if (!session) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Fetch user profile from Supabase Database "User" table
      let { data: profile, error } = await supabase
        .from('User')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile && session.user.email) {
        const { data: profileByEmail } = await supabase
          .from('User')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
        profile = profileByEmail;
      }

      if (!profile) {
        // If the user does not exist in the factory users database
        setAuthError({
          type: 'user_not_registered',
          message: 'المستخدم غير مسجل في النظام'
        });
        setUser(null);
        setIsAuthenticated(false);
      } else {
        const mergedUser = {
          ...session.user,
          full_name: session.user.user_metadata?.full_name || profile.full_name || session.user.email,
          role: profile.role || 'viewer',
          ...profile
        };
        setUser(mergedUser);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setAuthError({
        type: 'unknown',
        message: err.message || 'حدث خطأ أثناء جلب بيانات المستخدم'
      });
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkUserAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await handleSession(session);
  };

  const checkAppState = async () => {
    await checkUserAuth();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
