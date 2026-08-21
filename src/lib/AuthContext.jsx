import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '@/api/backendClient';
import { PENDING_REGISTER_PROFESSION_KEY, normalizeProfession } from '@/lib/professionalAccess';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const resolvePendingProfession = async (currentUser) => {
    if (typeof window === "undefined" || !currentUser) return currentUser;

    const pendingProfession = normalizeProfession(window.localStorage.getItem(PENDING_REGISTER_PROFESSION_KEY));
    if (!pendingProfession) return currentUser;

    const currentProfession = normalizeProfession(currentUser.profession || currentUser.profissao);
    if (currentProfession === pendingProfession) {
      window.localStorage.removeItem(PENDING_REGISTER_PROFESSION_KEY);
      return currentUser;
    }

    try {
      const updatedUser = await backend.auth.updateMe({ profession: pendingProfession });
      window.localStorage.removeItem(PENDING_REGISTER_PROFESSION_KEY);
      window.dispatchEvent(new Event("voltai:user-updated"));
      return updatedUser ? { ...currentUser, ...updatedUser, profession: pendingProfession } : { ...currentUser, profession: pendingProfession };
    } catch (error) {
      console.warn("Não foi possível salvar a profissão do usuário:", error);
      return currentUser;
    }
  };

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      setAppPublicSettings({
        id: "volta-ia-backend",
        public_settings: {
          auth_required: true,
        },
      });
      setIsLoadingPublicSettings(false);

      if (backend.auth.getToken?.()) {
        await checkUserAuth();
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Ocorreu um erro inesperado'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await backend.auth.me();
      const resolvedUser = await resolvePendingProfession(currentUser);
      setUser(resolvedUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Autenticação obrigatória'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    backend.auth.logout(shouldRedirect ? "/login" : false);
  };

  const navigateToLogin = () => {
    backend.auth.redirectToLogin("/login");
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
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
