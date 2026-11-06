import { AppError } from "./errors.js";

type AccountState = {
  status?: string | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
};

export function normalizeAccountStatus(status?: string | null): string {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["", "active", "ativo", "ativa"].includes(normalized)) return "active";
  if (
    [
      "suspended",
      "suspenso",
      "suspensa",
      "blocked",
      "bloqueado",
      "bloqueada",
    ].includes(normalized)
  )
    return "suspended";
  if (["inactive", "inativo", "inativa"].includes(normalized))
    return "inactive";
  if (
    ["deleted", "excluido", "excluida", "deletado", "deletada"].includes(
      normalized,
    )
  )
    return "deleted";
  return normalized;
}

export function assertAccountAvailable<T extends AccountState>(
  user: T | null | undefined,
): asserts user is T {
  if (!user) throw new AppError("Sessão inválida. Faça login novamente.", 401);
  const status = normalizeAccountStatus(user.status);
  if (user.isDeleted || user.deletedAt || status === "deleted")
    throw new AppError(
      "Esta conta foi excluída. Entre em contato com o suporte.",
      403,
    );
  if (status === "suspended")
    throw new AppError(
      "Sua conta está suspensa. Entre em contato com o administrador.",
      403,
    );
  if (status === "inactive")
    throw new AppError(
      "Sua conta está inativa. Entre em contato com o administrador.",
      403,
    );
  if (status !== "active")
    throw new AppError(
      "O status da sua conta precisa ser revisado pelo administrador.",
      403,
    );
}
