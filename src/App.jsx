import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
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
import React from 'react';

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
      return (
        <div className="min-h-screen bg-background px-6 py-10 text-foreground">
          <div className="mx-auto max-w-xl rounded-[8px] border border-destructive/25 bg-card p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-destructive">Erro ao carregar a tela</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Atualize a página. Se continuar, abra o console do navegador para ver o detalhe técnico.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded-[6px] bg-muted p-3 text-xs text-muted-foreground">
              {this.state.error?.message || "Erro desconhecido"}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-[8px] bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
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
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={fullAccess ? <Home /> : <Navigate to="/planta-ia" replace />} />
          <Route path="/projects" element={requireFullAccess(<Projects />)} />
          <Route path="/projects/new" element={requireFullAccess(<NewProject />)} />
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
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={requireFullAccess(<AdminPanel />)} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <BrandingBoot />
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App
