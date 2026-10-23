import { useState } from "react";
import { GraduationCap, UploadCloud, CheckCircle2, AlertCircle, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backend } from "@/api/backendClient";

export default function AcademicVerificationModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}) {
  const [institution, setInstitution] = useState(user?.academic_institution || "");
  const [course, setCourse] = useState(user?.academic_course || "");
  const [documentName, setDocumentName] = useState(user?.academic_document_name || "");
  const [documentData, setDocumentData] = useState(user?.academic_document_url || "");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("O documento não pode exceder 10 MB.");
      return;
    }

    setDocumentName(file.name);
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      setDocumentData(event.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!institution.trim()) {
      setErrorMessage("Por favor, informe a Instituição de Ensino.");
      return;
    }
    if (!course.trim()) {
      setErrorMessage("Por favor, informe seu Curso (ex: Engenharia Elétrica, Eletrotécnica).");
      return;
    }
    if (!documentData) {
      setErrorMessage("Por favor, anexe o comprovante de matrícula (PDF, PNG ou JPG).");
      return;
    }
    if (!termsAccepted) {
      setErrorMessage("Você precisa concordar com os termos de uso exclusivamente acadêmico.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (backend?.subscriptions?.submitAcademicVerification) {
        await backend.subscriptions.submitAcademicVerification({
          institution: institution.trim(),
          course: course.trim(),
          documentName,
          documentUrl: documentData,
        });
      } else {
        await backend.auth.updateMe({
          academic_status: "pending_review",
          academic_institution: institution.trim(),
          academic_course: course.trim(),
          academic_document_name: documentName,
          academic_document_url: documentData,
          academic_submitted_at: new Date().toISOString(),
        });
      }

      setSubmittedSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMessage(err.message || "Erro ao enviar comprovante. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-[16px] border border-[#E4E7EC] bg-white p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
              <GraduationCap className="h-5 w-5 text-[#0f4f49]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold text-[#101828]">
                Comprovação de Vínculo Acadêmico
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-[#667085]">
                Plano Nacif Estudante — R$ 99,99/mês para ensino e pesquisa
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submittedSuccess ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-[#101828]">Comprovante enviado com sucesso!</h3>
            <p className="text-sm font-medium leading-relaxed text-[#667085]">
              Seus documentos foram encaminhados para nossa equipe de análise administrativa.
              Você receberá a confirmação em seu painel assim que a validação for concluída.
            </p>
            <Button
              type="button"
              onClick={onClose}
              className="mt-2 h-10 w-full rounded-[8px] bg-[#00d8b8] font-extrabold text-[#0f172a] hover:bg-[#00bda1]"
            >
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-3 space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#344054]">Instituição de Ensino</Label>
              <Input
                placeholder="Ex: USP, IFSP, Unicamp, PUC, Estácio..."
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="h-10 rounded-[8px] border-[#D0D5DD] text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#344054]">Curso Técnico ou Graduação</Label>
              <Input
                placeholder="Ex: Engenharia Elétrica, Engenharia de Energia, Eletrotécnica..."
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="h-10 rounded-[8px] border-[#D0D5DD] text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#344054]">
                Comprovante de Matrícula (PDF, JPG ou PNG até 10 MB)
              </Label>
              <div className="relative flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 text-center hover:bg-[#F2F4F7]">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileUpload}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                {documentName ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0f4f49]">
                    <FileText className="h-5 w-5 text-[#00d8b8]" />
                    <span className="truncate max-w-[240px]">{documentName}</span>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="h-7 w-7 text-[#98A2B3]" />
                    <p className="mt-1 text-xs font-bold text-[#344054]">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-[11px] text-[#667085]">
                      Declaração de matrícula recente, histórico escolar ou carteirinha estudantil
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="academic-terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#D0D5DD] text-[#00d8b8] focus:ring-[#00d8b8]"
              />
              <label htmlFor="academic-terms" className="text-xs font-medium leading-5 text-[#475467]">
                Declaro que sou estudante ativo e que utilizarei a plataforma exclusivamente para fins acadêmicos e educacionais. Concordo com a identificação de versão acadêmica nos documentos emitidos.
              </label>
            </div>

            <div className="mt-5 flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 flex-1 rounded-[8px] border-[#D0D5DD] font-bold text-[#344054]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 flex-1 rounded-[8px] bg-[#00d8b8] font-extrabold text-[#0f172a] hover:bg-[#00bda1]"
              >
                {isSubmitting ? "Enviando..." : "Enviar Comprovante"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
