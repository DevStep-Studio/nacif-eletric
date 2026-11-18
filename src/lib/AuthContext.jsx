import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { applyRemotePlanCatalog } from '@/lib/subscriptionPlans';
import { backend, SESSION_EXPIRED_EVENT } from '@/api/backendClient';
import { PENDING_REGISTER_PROFESSION_KEY, normalizeProfession } from '@/lib/professionalAccess';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const authCheckId = useRef(0);
  const currentUserId = useRef(null);

  const clearAuthState = useCallback(() => {
    authCheckId.current += 1;
    currentUserId.current = null;
    queryClientInstance.clear();
    setUser(null);
    setIsAuthenticated(false);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    setAuthError(null);
  }, []);

  const resolvePendingProfession = useCallback(async (currentUser) => {
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
      return updatedUser ? { ...currentUser, ...updatedUser, profession: pendingProfession } : { ...currentUser, profession: pendingProfession };
    } catch (error) {
      if (error.status === 401 || error.status === 403) throw error;
      console.warn("Não foi possível salvar a profissão do usuário:", error);
      return currentUser;
    }
  }, []);

  const checkUserAuth = useCallback(async ({ silent = false } = {}) => {
    if (!backend.auth.getToken?.()) {
      clearAuthState();
      return;
    }
    const checkId = ++authCheckId.current;
    const checkedToken = backend.auth.getToken();
    const isCurrentCheck = () => checkId === authCheckId.current && checkedToken === backend.auth.getToken();
    if (!silent) setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await backend.auth.me();
      if (!isCurrentCheck()) return;
      const resolvedUser = await resolvePendingProfession(currentUser);
      if (!isCurrentCheck()) return;
      if (currentUserId.current !== resolvedUser?.id) queryClientInstance.clear();
      currentUserId.current = resolvedUser?.id;
      setUser(resolvedUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      // A 401 event or another login may already have replaced this session.
      if (checkId !== authCheckId.current) return;
      if (checkedToken !== backend.auth.getToken() && backend.auth.getToken()) return;
      if (error.status === 401 || error.status === 403) {
        backend.auth.logout(false);
        clearAuthState();
        return;
      }
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [clearAuthState, resolvePendingProfession]);

  const checkAppState = useCallback(async () => {
    setAppPublicSettings({ id: "volta-ia-backend", public_settings: { auth_required: true } });
    setIsLoadingPublicSettings(false);
    // A slow public catalog must not prevent the login form from rendering.
    void backend.subscriptions.getPlans().then(catalog => {
      if (catalog?.plans) applyRemotePlanCatalog(catalog.plans);
    }).catch(planErr => console.warn("Catálogo remoto indisponível, utilizando catálogo local:", planErr));
    await checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === null || event.key === "voltai_access_token" || event.key === "voltai_token") {
        if (!backend.auth.getToken?.()) clearAuthState();
        else void checkUserAuth();
      }
    };
    const handleUserUpdated = () => { void checkUserAuth({ silent: true }); };
    window.addEventListener(SESSION_EXPIRED_EVENT, clearAuthState);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("voltai:user-updated", handleUserUpdated);
    void checkAppState();
    return () => {
      authCheckId.current += 1;
      window.removeEventListener(SESSION_EXPIRED_EVENT, clearAuthState);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("voltai:user-updated", handleUserUpdated);
    };
  }, [checkAppState, checkUserAuth, clearAuthState]);

  const logout = (shouldRedirect = true) => {
    clearAuthState();
    backend.auth.logout(shouldRedirect ? "/login" : false);
  };

  const navigateToLogin = () => {
    backend.auth.redirectToLogin("/login");
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError,
      appPublicSettings, authChecked, logout, navigateToLogin, checkUserAuth, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
