import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from './components/Layout';
import Home from './pages/Home';
import Projects from './pages/Projects';
import NewProject from './pages/NewProject';
import ProjectDetail from './pages/ProjectDetail';
import Calculator from './pages/Calculator';
import AIAssistant from './pages/AIAssistant';
import NBRLibrary from './pages/NBRLibrary';
import PanelGenerator from './pages/PanelGenerator';
import Budget from './pages/Budget';
import ComponentsLibrary from './pages/ComponentsLibrary';
import Scanner from './pages/Scanner';
import PhaseBalance from './pages/PhaseBalance';
import Diagram from './pages/Diagram';
import CircuitEditor from './pages/CircuitEditor';
import UnifilarDiagram from './pages/UnifilarDiagram';
import MemorialDescritivo from './pages/MemorialDescritivo';
import PlantaIA from './pages/PlantaIA';
import MaterialsList from './pages/MaterialsList';
import SolarProject from './pages/SolarProject';
import SettingsPage from './pages/Settings';
import Subscription from './pages/Subscription';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { BrandingBoot } from './lib/appPreferences';
import { hasFullSystemAccess } from './lib/professionalAccess';

// Error & System Pages
import NotFoundPage from './pages/system/NotFound';
import ForbiddenPage from './pages/system/Forbidden';
import UnauthorizedPage from './pages/system/Unauthorized';
import ServerErrorPage from './pages/system/ServerError';
import ServiceUnavailablePage from './pages/system/ServiceUnavailable';
import MaintenancePage from './pages/system/Maintenance';
import OfflinePage from './pages/system/Offline';
import UnsupportedBrowserPage from './pages/system/UnsupportedBrowser';

// Legal & Compliance Pages
import TermsOfServicePage from './pages/legal/TermsOfService';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicy';
import CookiePolicyPage from './pages/legal/CookiePolicy';
import SecurityPolicyPage from './pages/legal/SecurityPolicy';
import LgpdRightsPage from './pages/legal/LgpdRights';

// Support & Institutional Pages
import HelpCenterPage from './pages/support/HelpCenter';
import ContactPage from './pages/support/Contact';
import SystemStatusPage from './pages/support/SystemStatus';
import ChangelogPage from './pages/support/Changelog';
import AboutPage from './pages/institutional/About';
import ReportProblemPage from './pages/support/ReportProblem';

// Billing & Account Pages
import PaymentSuccessPage from './pages/billing/PaymentSuccess';
import PaymentFailedPage from './pages/billing/PaymentFailed';
import PaymentPendingPage from './pages/billing/PaymentPending';
import CancelSubscriptionPage from './pages/billing/CancelSubscription';
import DeleteAccountPage from './pages/account/DeleteAccount';
import ExportDataPage from './pages/account/ExportData';

// System Components
import CookieConsentBanner from './components/system/CookieConsentBanner';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro fatal na interface:", error, info);
  }

  render() {
    if (this.state.error) {
      try {
        return <ServerErrorPage error={this.state.error} />;
      } catch (boundaryErr) {
        console.error("Erro secundário na tela de erro:", boundaryErr);
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-6 font-sans">
            <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Algo não saiu como esperado</h2>
              <p className="text-xs text-slate-600">Ocorreu um erro inesperado ao processar a interface.</p>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#00d8b8] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#00bda1]"
                >
                  Recarregar página
                </button>
                <a
                  href="/projects"
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
                >
                  Ir para Projetos
                </a>
              </div>
            </div>
          </div>
        );
      }
    }

    return this.props.children;
  }
}

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const fullAccess = hasFullSystemAccess(user);
  const requireFullAccess = (element) => fullAccess ? element : <Navigate to="/planta-ia" replace />;

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/25 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Auth Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Institutional & Support Public Routes */}
      <Route path="/termos" element={<TermsOfServicePage />} />
      <Route path="/privacidade" element={<PrivacyPolicyPage />} />
      <Route path="/cookies" element={<CookiePolicyPage />} />
      <Route path="/seguranca" element={<SecurityPolicyPage />} />
      <Route path="/privacidade/direitos" element={<LgpdRightsPage />} />
      <Route path="/ajuda" element={<HelpCenterPage />} />
      <Route path="/suporte" element={<HelpCenterPage />} />
      <Route path="/contato" element={<ContactPage />} />
      <Route path="/status" element={<SystemStatusPage />} />
      <Route path="/novidades" element={<ChangelogPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/sobre" element={<AboutPage />} />
      <Route path="/reportar-problema" element={<ReportProblemPage />} />

      {/* System Error & Status Routes */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/401" element={<UnauthorizedPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="/503" element={<ServiceUnavailablePage />} />
      <Route path="/manutencao" element={<MaintenancePage />} />
      <Route path="/offline" element={<OfflinePage />} />
      <Route path="/navegador-nao-suportado" element={<UnsupportedBrowserPage />} />

      {/* Billing Public Feedback Routes */}
      <Route path="/billing/sucesso" element={<PaymentSuccessPage />} />
      <Route path="/billing/erro" element={<PaymentFailedPage />} />
      <Route path="/billing/pendente" element={<PaymentPendingPage />} />
      <Route path="/pagamento/aprovado" element={<PaymentSuccessPage />} />
      <Route path="/pagamento/falha" element={<PaymentFailedPage />} />
      <Route path="/pagamento/pendente" element={<PaymentPendingPage />} />

      {/* Protected App Routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={fullAccess ? <Home /> : <Navigate to="/planta-ia" replace />} />
          <Route path="/projects" element={requireFullAccess(<Projects />)} />
          <Route path="/projects/new" element={requireFullAccess(<NewProject />)} />
          <Route path="/solar-project-wizard" element={requireFullAccess(<NewProject />)} />
          <Route path="/projects/:projectId" element={requireFullAccess(<ProjectDetail />)} />
          <Route path="/calculator" element={requireFullAccess(<Calculator />)} />
          <Route path="/ai-assistant" element={requireFullAccess(<AIAssistant />)} />
          <Route path="/nbr-library" element={requireFullAccess(<NBRLibrary />)} />
          <Route path="/panel-generator" element={requireFullAccess(<PanelGenerator />)} />
          <Route path="/budget" element={requireFullAccess(<Budget />)} />
          <Route path="/components-library" element={requireFullAccess(<ComponentsLibrary />)} />
          <Route path="/scanner" element={requireFullAccess(<Scanner />)} />
          <Route path="/phase-balance" element={requireFullAccess(<PhaseBalance />)} />
          <Route path="/diagram" element={requireFullAccess(<Diagram />)} />
          <Route path="/circuit-editor" element={requireFullAccess(<CircuitEditor />)} />
          <Route path="/unifilar" element={requireFullAccess(<UnifilarDiagram />)} />
          <Route path="/memorial" element={requireFullAccess(<MemorialDescritivo />)} />
          <Route path="/planta-ia" element={<PlantaIA />} />
          <Route path="/materials" element={requireFullAccess(<MaterialsList />)} />
          <Route path="/solar-project" element={requireFullAccess(<SolarProject />)} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/billing" element={<Subscription />} />
          <Route path="/billing/plans" element={<Subscription />} />
          <Route path="/billing/cancelar" element={<CancelSubscriptionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/configuracoes/excluir-conta" element={<DeleteAccountPage />} />
          <Route path="/configuracoes/exportar-dados" element={<ExportDataPage />} />
          <Route path="/admin" element={requireFullAccess(<AdminPanel />)} />
        </Route>
      </Route>

      {/* Wildcard Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <BrandingBoot />
        <Router>
          <AppErrorBoundary>
            <AuthenticatedApp />
            <CookieConsentBanner />
          </AppErrorBoundary>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
