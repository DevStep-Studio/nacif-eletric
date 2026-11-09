import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { canAccessModule } from "@/lib/subscriptionPlans";

export default function ModuleAccessGate({ children, moduleKey, moduleTitle }) {
  const { user } = useAuth();
  const access = canAccessModule(user, moduleKey);
  if (access.allowed) return <>{children}</>;
  return <section className="mx-auto my-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
    <LockKeyhole className="mx-auto mb-4 h-10 w-10 text-teal-700" />
    <h1 className="text-xl font-bold text-slate-900">{moduleTitle || "Recurso restrito ao plano"}</h1>
    <p className="my-4 text-sm text-slate-600">{access.message}</p>
    <Button asChild><Link to="/subscription">Ver assinatura e planos</Link></Button>
    <p className="mt-4 text-xs text-slate-500">Seus projetos permanecem salvos e disponíveis para consulta na lista de projetos.</p>
  </section>;
}
