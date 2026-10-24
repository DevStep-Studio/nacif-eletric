import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from './components/Layout';
// Páginas principais e editores técnicos com Code Splitting (React.lazy)
const Home = React.lazy(() => import('./pages/Home'));
const Projects = React.lazy(() => import('./pages/Projects'));
const NewProject = React.lazy(() => import('./pages/NewProject'));
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'));
const Calculator = React.lazy(() => import('./pages/Calculator'));
const AIAssistant = React.lazy(() => import('./pages/AIAssistant'));
const NBRLibrary = React.lazy(() => import('./pages/NBRLibrary'));
const PanelGenerator = React.lazy(() => import('./pages/PanelGenerator'));
const Budget = React.lazy(() => import('./pages/Budget'));
const ComponentsLibrary = React.lazy(() => import('./pages/ComponentsLibrary'));
const Scanner = React.lazy(() => import('./pages/Scanner'));
const PhaseBalance = React.lazy(() => import('./pages/PhaseBalance'));
const Diagram = React.lazy(() => import('./pages/Diagram'));
const CircuitEditor = React.lazy(() => import('./pages/CircuitEditor'));
const UnifilarDiagram = React.lazy(() => import('./pages/UnifilarDiagram'));
const MemorialDescritivo = React.lazy(() => import('./pages/MemorialDescritivo'));
const PlantaIA = React.lazy(() => import('./pages/PlantaIA'));
const MaterialsList = React.lazy(() => import('./pages/MaterialsList'));
const SolarProject = React.lazy(() => import('./pages/SolarProject'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const Subscription = React.lazy(() => import('./pages/Subscription'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const AvisosErros = React.lazy(() => import('./pages/AvisosErros'));
const SuperAdminPage = React.lazy(() => import('./pages/SuperAdmin'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));

import { BrandingBoot } from './lib/appPreferences';
import { hasFullSystemAccess, isSuperAdmin } from './lib/professionalAccess';
import ModuleAccessGate from './components/subscription/ModuleAccessGate';

// Error & System Pages
import ServerErrorPage from './pages/system/ServerError';
const NotFoundPage = React.lazy(() => import('./pages/system/NotFound'));
const ForbiddenPage = React.lazy(() => import('./pages/system/Forbidden'));
const UnauthorizedPage = React.lazy(() => import('./pages/system/Unauthorized'));
const ServiceUnavailablePage = React.lazy(() => import('./pages/system/ServiceUnavailable'));
const MaintenancePage = React.lazy(() => import('./pages/system/Maintenance'));
const OfflinePage = React.lazy(() => import('./pages/system/Offline'));
const UnsupportedBrowserPage = React.lazy(() => import('./pages/system/UnsupportedBrowser'));

// Legal & Compliance Pages
const TermsOfServicePage = React.lazy(() => import('./pages/legal/TermsOfService'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/legal/PrivacyPolicy'));
const CookiePolicyPage = React.lazy(() => import('./pages/legal/CookiePolicy'));
const SecurityPolicyPage = React.lazy(() => import('./pages/legal/SecurityPolicy'));
const LgpdRightsPage = React.lazy(() => import('./pages/legal/LgpdRights'));

// Support & Institutional Pages
const HelpCenterPage = React.lazy(() => import('./pages/support/HelpCenter'));
const ContactPage = React.lazy(() => import('./pages/support/Contact'));
const SystemStatusPage = React.lazy(() => import('./pages/support/SystemStatus'));
const ChangelogPage = React.lazy(() => import('./pages/support/Changelog'));
const AboutPage = React.lazy(() => import('./pages/institutional/About'));
const ReportProblemPage = React.lazy(() => import('./pages/support/ReportProblem'));

// Billing & Account Pages
const PaymentSuccessPage = React.lazy(() => import('./pages/billing/PaymentSuccess'));
const PaymentFailedPage = React.lazy(() => import('./pages/billing/PaymentFailed'));
const PaymentPendingPage = React.lazy(() => import('./pages/billing/PaymentPending'));
const CancelSubscriptionPage = React.lazy(() => import('./pages/billing/CancelSubscription'));
const DeleteAccountPage = React.lazy(() => import('./pages/account/DeleteAccount'));
const ExportDataPage = React.lazy(() => import('./pages/account/ExportData'));

// System Components
import CookieConsentBanner from './components/system/CookieConsentBanner';
import DeviceGate from './components/system/DeviceGate';

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
  const superAdminAccess = isSuperAdmin(user);
  const requireSuperAdmin = (element) => superAdminAccess ? element : <Navigate to="/403" replace />;

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

const PageLoadingFallback = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
    <div className="w-10 h-10 border-4 border-[#005B94]/20 border-t-[#005B94] rounded-full animate-spin"></div>
    <span className="text-xs font-medium text-slate-500 animate-pulse">Carregando módulo Nacif...</span>
  </div>
);

  // Render the main app
  return (
    <React.Suspense fallback={<PageLoadingFallback />}>
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
          <Route path="/panel-generator" element={requireFullAccess(<ModuleAccessGate moduleKey="panel" moduleTitle="Quadro Elétrico"><PanelGenerator /></ModuleAccessGate>)} />
          <Route path="/panel" element={requireFullAccess(<ModuleAccessGate moduleKey="panel" moduleTitle="Quadro Elétrico"><PanelGenerator /></ModuleAccessGate>)} />
          <Route path="/budget" element={requireFullAccess(<Budget />)} />
          <Route path="/components-library" element={requireFullAccess(<ComponentsLibrary />)} />
          <Route path="/scanner" element={requireFullAccess(<Scanner />)} />
          <Route path="/phase-balance" element={requireFullAccess(<PhaseBalance />)} />
          <Route path="/diagram" element={requireFullAccess(<Diagram />)} />
          <Route path="/circuit-editor" element={requireFullAccess(<CircuitEditor />)} />
          <Route path="/unifilar" element={requireFullAccess(<ModuleAccessGate moduleKey="unifilar" moduleTitle="Diagrama Unifilar"><UnifilarDiagram /></ModuleAccessGate>)} />
          <Route path="/memorial" element={requireFullAccess(<MemorialDescritivo />)} />
          <Route path="/planta-ia" element={<ModuleAccessGate moduleKey="plant" moduleTitle="Planta Elétrica"><PlantaIA /></ModuleAccessGate>} />
          <Route path="/materials" element={requireFullAccess(<MaterialsList />)} />
          <Route path="/solar-project" element={requireFullAccess(<ModuleAccessGate moduleKey="solar" moduleTitle="Projeto Solar"><SolarProject /></ModuleAccessGate>)} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/billing" element={<Subscription />} />
          <Route path="/billing/plans" element={<Subscription />} />
          <Route path="/billing/cancelar" element={<CancelSubscriptionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/configuracoes/excluir-conta" element={<DeleteAccountPage />} />
          <Route path="/configuracoes/exportar-dados" element={<ExportDataPage />} />
          <Route path="/avisos-erros" element={<AvisosErros />} />
          <Route path="/avisos-erros/:issueId" element={<AvisosErros />} />
          <Route path="/admin" element={requireFullAccess(<AdminPanel />)} />
          <Route path="/super-admin" element={requireSuperAdmin(<SuperAdminPage />)} />
          <Route path="/super-admin/*" element={requireSuperAdmin(<SuperAdminPage />)} />
        </Route>
      </Route>

      {/* Wildcard Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </React.Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <BrandingBoot />
        <Router>
          <AppErrorBoundary>
            <DeviceGate>
              <AuthenticatedApp />
              <CookieConsentBanner />
            </DeviceGate>
          </AppErrorBoundary>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
