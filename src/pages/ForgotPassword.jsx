import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [recoveryLink, setRecoveryLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setRecoveryLink("");
    setLoading(true);
    try {
      const result = await backend.auth.resetPasswordRequest(email);
      setRecoveryLink(result?.recoveryLink || "");
      setSent(true);
    } catch (err) {
      setError(err.message || "Não foi possível enviar a recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Redefinir senha"
      subtitle="Enviaremos um link para redefinir sua senha"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Voltar para o login
        </Link>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            Se existir uma conta com esse email, você receberá um link de redefinição de senha em instantes.
          </p>
          {recoveryLink && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-left">
              <p className="text-sm font-semibold text-foreground">Ambiente local detectado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Para contas criadas neste navegador, use o link local abaixo.
              </p>
              <a href={recoveryLink} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
                Redefinir senha agora
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar link de recuperação"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
