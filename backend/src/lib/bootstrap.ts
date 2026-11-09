import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth.js";

export const INITIAL_SUPER_ADMIN_ACCOUNTS = [
  { email: "admin@nacif.com", name: "Administrador Nacif", password: "admin" },
  { email: "grc22.09@hotmail.com", name: "Gabriel Nacif", password: "admin" },
  { email: "ian.mellofla@gmail.com", name: "Ian Mello", password: "admin" },
  { email: "wellingtonalfredo550@gmail.com", name: "Wellington Alfredo", password: "carlos02?" },
  { email: "comercial@nacifsolutions.com.br", name: "Comercial Nacif Solutions", password: "admin" },
  { email: "gabrielderezende13@gmail.com", name: "Gabriel Rezende", password: "admin" },
  { email: "testegabriel@gmail.com", name: "Gabriel Teste", password: "admin" },
];

export async function bootstrapSuperAdmins(prisma: PrismaClient): Promise<void> {
  try {
    for (const adm of INITIAL_SUPER_ADMIN_ACCOUNTS) {
      const normalizedEmail = adm.email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      if (!existing) {
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            fullName: adm.name,
            passwordHash: await hashPassword(adm.password),
            role: "super_admin",
            plan: "completo",
            isSuperAdmin: true,
            status: "active",
            profession: "engenheiro",
            customPermissions: {},
          },
        });
        console.log(`[BOOTSTRAP] Super admin provisionado no banco de dados: ${normalizedEmail}`);
      } else {
        const needsUpdate =
          existing.role !== "super_admin" ||
          !existing.isSuperAdmin ||
          existing.status !== "active" ||
          existing.isDeleted;

        if (needsUpdate) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              role: "super_admin",
              isSuperAdmin: true,
              status: "active",
              isDeleted: false,
              plan: "completo",
            },
          });
        }
      }
    }
  } catch (error) {
    console.warn("[BOOTSTRAP] Aviso ao provisionar super admins iniciais no banco:", error);
  }
}
