import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  AlertOctagon,
  Camera,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  UploadCloud,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { backend } from "@/api/backendClient";
import { collectTechnicalInfo } from "@/lib/technicalInfo";

const AVAILABLE_MODULES = [
  "Dashboard",
  "Projetos",
  "Planta Elétrica",
  "Quadro Elétrico",
  "Projeto Solar",
  "Diagrama Unifilar",
  "Calculadora",
  "Assistente IA",
  "Biblioteca NBR",
  "Orçamento",
  "Outros",
];

const ROUTE_MODULE_MAP = {
  "/": "Dashboard",
  "/projects": "Projetos",
  "/planta-ia": "Planta Elétrica",
  "/panel-generator": "Quadro Elétrico",
  "/solar-project": "Projeto Solar",
  "/unifilar": "Diagrama Unifilar",
  "/diagram": "Diagrama Unifilar",
  "/calculator": "Calculadora",
  "/ai-assistant": "Assistente IA",
  "/nbr-library": "Biblioteca NBR",
  "/budget": "Orçamento",
};

const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function ReportIssueModal({ open, onOpenChange, onIssueCreated, initialModule = null, initialProjectId = null }) {
  const { user } = useAuth();
  const location = useLocation();
  const fileInputRef = useRef(null);

  // Detecção automática do módulo pela rota
  const detectedModule = useMemo(() => {
    if (initialModule && AVAILABLE_MODULES.includes(initialModule)) return initialModule;
    for (const [route, mod] of Object.entries(ROUTE_MODULE_MAP)) {
      if (location.pathname === route || (route !== "/" && location.pathname.startsWith(route))) {
        return mod;
      }
    }
    return "Dashboard";
  }, [location.pathname, initialModule]);

  // Estados do formulário
  const [type, setType] = useState("erro"); // "erro" | "aviso"
  const [title, setTitle] = useState("");
  const [module, setModule] = useState(detectedModule);
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [attachments, setAttachments] = useState([]); // { id, name, size, type, dataUrl }

  // Estados da interface
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdIssue, setCreatedIssue] = useState(null);
  const [capturingScreen, setCapturingScreen] = useState(false);

  // Diagnóstico técnico pré-calculado
  const technicalInfo = useMemo(() => {
    return collectTechnicalInfo({
      module,
      projectId: initialProjectId,
      user,
    });
  }, [module, initialProjectId, user]);

  // Atualiza módulo se mudar de rota enquanto aberto
  useEffect(() => {
    if (open && !title) {
      setModule(detectedModule);
    }
  }, [open, detectedModule, title]);

  // Reset ao fechar ou reabrir
  const handleOpenChange = (isOpen) => {
    if (!isOpen && !submitting) {
      if (createdIssue) {
        // Limpa formulário completo após sucesso
        resetForm();
      }
      onOpenChange(false);
    } else if (isOpen) {
      setErrorMessage("");
      onOpenChange(true);
    }
  };

  const resetForm = () => {
    setType("erro");
    setTitle("");
    setModule(detectedModule);
    setDescription("");
    setStepsToReproduce("");
    setExpectedResult("");
    setActualResult("");
    setAttachments([]);
    setErrorMessage("");
    setCreatedIssue(null);
  };

  // Upload e validação de arquivos
  const handleFileSelect = (e) => {
    setErrorMessage("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setErrorMessage(`Você pode anexar no máximo ${MAX_ATTACHMENTS} imagens por relato.`);
      return;
    }

    files.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrorMessage(`Formato não suportado: ${file.name}. Use apenas PNG, JPG ou WEBP.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`O arquivo ${file.name} excede o limite máximo de 5 MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachments((prev) => {
          if (prev.length >= MAX_ATTACHMENTS) return prev;
          return [
            ...prev,
            {
              id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              size: file.size,
              type: file.type,
              dataUrl: ev.target.result,
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Captura de tela com permissão explícita
  const handleCaptureScreen = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      setErrorMessage(`Limite de ${MAX_ATTACHMENTS} anexos já atingido.`);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage("Seu navegador não oferece suporte à captura direta de tela. Faça o upload manual da imagem.");
      return;
    }

    try {
      setCapturingScreen(true);
      setErrorMessage("");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Encerra stream da captura
      stream.getTracks().forEach((track) => track.stop());

      const dataUrl = canvas.toDataURL("image/webp", 0.85);
      const newAtt = {
        id: `att_screen_${Date.now()}`,
        name: `Captura_Tela_${new Date().toLocaleTimeString("pt-BR").replace(/:/g, "-")}.webp`,
        size: Math.round((dataUrl.length * 3) / 4),
        type: "image/webp",
        dataUrl,
      };

      setAttachments((prev) => [...prev.slice(0, MAX_ATTACHMENTS - 1), newAtt]);
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        console.warn("Erro ao capturar tela:", err);
        setErrorMessage("Não foi possível capturar a tela. Você pode anexar uma imagem salva.");
      }
    } finally {
      setCapturingScreen(false);
    }
  };

  // Envio do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // Validações obrigatórias
    if (!title.trim()) {
      setErrorMessage("Por favor, preencha o título do problema.");
      return;
    }
    if (!module) {
      setErrorMessage("Por favor, selecione onde o problema ocorreu.");
      return;
    }
    if (!description.trim()) {
      setErrorMessage("Por favor, descreva o que aconteceu.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        type,
        title: title.trim(),
        module,
        description: description.trim(),
        steps_to_reproduce: stepsToReproduce.trim(),
        expected_result: expectedResult.trim(),
        actual_result: actualResult.trim(),
        attachments,
        technical_info: technicalInfo,
        project_id: initialProjectId || null,
      };

      const created = await backend.entities.Issue.create(payload);
      setCreatedIssue(created);
      if (onIssueCreated) onIssueCreated(created);
    } catch (err) {
      console.error("Erro ao enviar relato:", err);
      setErrorMessage(
        err.message || "Ocorreu uma falha de conexão ao enviar o relato. Seus dados foram preservados, tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
        {createdIssue ? (
          // Tela de confirmação e sucesso
          <div className="py-8 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8FCF8] text-[#00d8b8] mx-auto shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-[#00d8b8]" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center rounded-lg bg-[#0F172A] px-3 py-1 font-mono text-xs font-black text-[#00d8b8]">
                {createdIssue.protocol}
              </span>
              <h2 className="text-xl font-extrabold text-[#0F172A]">
                Problema enviado com sucesso!
              </h2>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Nossa equipe técnica já recebeu seu chamado e poderá acompanhar a investigação através do protocolo acima.
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left max-w-lg mx-auto space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#64748B]">Módulo:</span>
                <span className="font-bold text-[#0F172A]">{createdIssue.module}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#64748B]">Título:</span>
                <span className="font-bold text-[#0F172A] truncate max-w-[280px]">{createdIssue.title}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#64748B]">Status inicial:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E2E8F0] text-[#0F172A]">
                  Recebido
                </span>
              </div>
            </div>

            <div className="pt-3 flex gap-3 justify-center">
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-6 shadow-sm"
              >
                Concluir e Voltar
              </Button>
            </div>
          </div>
        ) : (
          // Formulário Principal
          <div className="space-y-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#00d8b8]" />
                Reportar Aviso ou Erro
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Encontrou algum problema ou comportamento inesperado? Descreva abaixo para que nossa equipe técnica possa reproduzir e corrigir com rapidez.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-2">
                <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Tipo de Relato */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#0F172A]">
                  Tipo de relato <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType("erro")}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      type === "erro"
                        ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0F172A] ring-1 ring-[#00d8b8]"
                        : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <AlertOctagon className={`h-5 w-5 shrink-0 mt-0.5 ${type === "erro" ? "text-rose-500" : "text-[#94A3B8]"}`} />
                    <div>
                      <p className="text-xs font-extrabold text-[#0F172A]">Erro</p>
                      <p className="text-[11px] text-[#64748B]">Uma funcionalidade quebrou ou apresentou falha.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("aviso")}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      type === "aviso"
                        ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0F172A] ring-1 ring-[#00d8b8]"
                        : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${type === "aviso" ? "text-amber-500" : "text-[#94A3B8]"}`} />
                    <div>
                      <p className="text-xs font-extrabold text-[#0F172A]">Aviso</p>
                      <p className="text-[11px] text-[#64748B]">Comportamento inesperado ou possível problema.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Título & Módulo Afetado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold text-[#0F172A]">
                    Título do problema <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Os cabos ficam desalinhados ao reabrir o quadro elétrico"
                    className="h-10 rounded-xl text-xs font-medium border-[#CBD5E1] focus-visible:ring-[#00d8b8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#0F172A]">
                    Onde aconteceu? <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    value={module}
                    onChange={(e) => setModule(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00d8b8]"
                  >
                    {AVAILABLE_MODULES.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Descrição do Problema */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#0F172A]">
                  Descrição do problema <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o que aconteceu e como o problema afetou a utilização do sistema."
                  className="rounded-xl text-xs font-medium border-[#CBD5E1] focus-visible:ring-[#00d8b8]"
                />
              </div>

              {/* 4. Como reproduzir (Opcional) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-[#0F172A]">
                    Como reproduzir o problema?
                  </Label>
                  <span className="text-[10px] text-[#94A3B8] font-medium">Opcional</span>
                </div>
                <Textarea
                  rows={2}
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  placeholder="Passo 1: Acessei a tela... Passo 2: Cliquei no botão... Passo 3: O erro ocorreu."
                  className="rounded-xl text-xs font-medium border-[#CBD5E1] focus-visible:ring-[#00d8b8]"
                />
              </div>

              {/* 5. Resultado Esperado e Resultado Encontrado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-[#0F172A]">Resultado esperado</Label>
                    <span className="text-[10px] text-[#94A3B8] font-medium">Opcional</span>
                  </div>
                  <Input
                    type="text"
                    value={expectedResult}
                    onChange={(e) => setExpectedResult(e.target.value)}
                    placeholder="O que deveria acontecer..."
                    className="h-9 rounded-xl text-xs font-medium border-[#CBD5E1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-[#0F172A]">Resultado encontrado</Label>
                    <span className="text-[10px] text-[#94A3B8] font-medium">Opcional</span>
                  </div>
                  <Input
                    type="text"
                    value={actualResult}
                    onChange={(e) => setActualResult(e.target.value)}
                    placeholder="O que realmente aconteceu..."
                    className="h-9 rounded-xl text-xs font-medium border-[#CBD5E1]"
                  />
                </div>
              </div>

              {/* 6. Anexos de Imagens */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-[#0F172A]">
                    Anexos (prints ou fotos)
                  </Label>
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    {attachments.length}/{MAX_ATTACHMENTS} (Máx. 5MB cada)
                  </span>
                </div>

                {/* Lista de Pré-visualização de Anexos */}
                {attachments.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="relative group rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1.5 overflow-hidden shadow-sm"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="h-20 w-full object-cover rounded-lg border border-[#E2E8F0]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors"
                          title="Remover anexo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="mt-1 truncate text-[10px] font-bold text-[#0F172A] px-1">
                          {att.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botões de Ação de Anexo */}
                {attachments.length < MAX_ATTACHMENTS && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] gap-2"
                    >
                      <UploadCloud className="h-4 w-4 text-[#00d8b8]" />
                      Selecionar imagens (PNG, JPG, WEBP)
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={capturingScreen}
                      onClick={handleCaptureScreen}
                      className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] gap-2"
                    >
                      {capturingScreen ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#00d8b8]" />
                      ) : (
                        <Camera className="h-4 w-4 text-[#00d8b8]" />
                      )}
                      Capturar tela agora
                    </Button>
                  </div>
                )}
              </div>

              {/* 7. Coleta Transparente de Informações Técnicas */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full flex items-center justify-between text-left font-bold text-[#0F172A] hover:text-[#009b84]"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#00d8b8]" />
                    <span>Diagnóstico técnico automático</span>
                    <span className="text-[10px] font-medium text-[#64748B] bg-white px-2 py-0.5 rounded-full border border-[#E2E8F0]">
                      Privacidade garantida
                    </span>
                  </div>
                  {showTechnicalDetails ? (
                    <ChevronUp className="h-4 w-4 text-[#64748B]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#64748B]" />
                  )}
                </button>

                {showTechnicalDetails && (
                  <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-1.5 font-mono text-[11px] text-[#475467]">
                    <p><strong className="text-[#0F172A]">Navegador:</strong> {technicalInfo.browser}</p>
                    <p><strong className="text-[#0F172A]">Sistema Operacional:</strong> {technicalInfo.os}</p>
                    <p><strong className="text-[#0F172A]">Rota atual:</strong> {technicalInfo.route}</p>
                    <p><strong className="text-[#0F172A]">Resolução:</strong> {technicalInfo.screen_resolution}</p>
                    <p><strong className="text-[#0F172A]">Versão:</strong> {technicalInfo.app_version}</p>
                    <p className="text-[10px] text-[#64748B] italic pt-1">
                      * Nenhuma senha, token, cookie ou dado confidencial é coletado.
                    </p>
                  </div>
                )}
              </div>

              {/* Botão de Envio */}
              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                  className="h-10 rounded-xl text-xs font-bold border-[#CBD5E1]"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-6 shadow-sm gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#0F172A]" />
                      Enviando relato...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-[#0F172A]" />
                      Enviar relato
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
