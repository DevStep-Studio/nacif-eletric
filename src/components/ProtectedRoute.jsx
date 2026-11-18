import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import BrandLoadingScreen from '@/components/system/BrandLoadingScreen';

import { normalizeSubscription } from '@/lib/subscriptionPlans';
import { isAdminUser } from '@/lib/professionalAccess';

const DefaultFallback = () => <BrandLoadingScreen fullScreen />;

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();
  const [expiryTick, tick] = useState(0);
  useEffect(() => {
    const access = normalizeSubscription(user);
    const expiry = Math.max(access.hasActiveTrial ? Date.parse(user.trial_end_date) : 0, access.hasPaidSubscription ? Date.parse(user.subscription_valid_until) : 0);
    if (expiry <= Date.now()) return;
    const timer = setTimeout(() => tick(n => n + 1), Math.min(expiry - Date.now() + 5, 2147483647));
    return () => clearTimeout(timer);
  }, [user, expiryTick]);

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  const accountRoute = /^\/(subscription|settings|billing|configuracoes|account)(?:\/|$)/.test(location.pathname);
  if (!isAdminUser(user) && !normalizeSubscription(user).hasAccess && !accountRoute) {
    return <Navigate to="/subscription" replace />;
  }
  return <Outlet />;
}
