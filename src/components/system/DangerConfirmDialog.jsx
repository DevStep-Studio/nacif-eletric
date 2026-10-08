import { useState } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DangerConfirmDialog({
  open,
  onOpenChange,
  title = "Ação irreversível",
  description = "Tem certeza de que deseja prosseguir? Esta operação não poderá ser desfeita.",
  consequences = [],
  confirmTextRequired = "EXCLUIR",
  confirmButtonLabel = "Confirmar exclusão",
  onConfirm,
}) {
  const [typedConfirm, setTypedConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isConfirmed = typedConfirm.trim().toUpperCase() === confirmTextRequired.trim().toUpperCase();

  const handleConfirm = async () => {
    if (!isConfirmed || loading) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm?.();
      onOpenChange?.(false);
      setTypedConfirm("");
    } catch (err) {
      setError(err?.message || "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen) => {
    if (!isOpen) {
      setTypedConfirm("");
      setError("");
    }
    onOpenChange?.(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border-[#E2E8F0] p-6 shadow-2xl">
        <DialogHeader className="space-y-2.5 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-extrabold text-[#0F172A]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium leading-relaxed text-[#64748B]">
            {description}
          </DialogDescription>
        </DialogHeader>

        {consequences.length > 0 && (
          <div className="my-2 rounded-xl border border-red-100 bg-red-50/50 p-3 text-xs text-red-900 space-y-1.5">
            <p className="font-black text-[11px] uppercase tracking-wider text-red-700">
              Impactos desta ação:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] font-medium text-red-800">
              {consequences.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <Label className="text-xs font-bold text-[#0F172A]">
            Para confirmar, digite <span className="font-mono font-black text-red-600">{confirmTextRequired}</span> abaixo:
          </Label>
          <Input
            type="text"
            value={typedConfirm}
            onChange={(e) => setTypedConfirm(e.target.value)}
            placeholder={confirmTextRequired}
            className="h-10 rounded-xl font-mono text-xs border-[#CBD5E1]"
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-xs font-bold text-red-600">{error}</p>
        )}

        <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="h-10 rounded-xl border-[#E2E8F0] text-xs font-bold"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed || loading}
            className="h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Processando...
              </>
            ) : (
              confirmButtonLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
