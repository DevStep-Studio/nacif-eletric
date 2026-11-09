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
    // Garante que a tabela de tokens de recuperação de senha existe mesmo antes de migrações manuais
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`token\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`expires_at\` DATETIME(3) NOT NULL,
        \`used_at\` DATETIME(3) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`password_reset_tokens_token_key\`(\`token\`),
        INDEX \`password_reset_tokens_user_id_idx\`(\`user_id\`),
        CONSTRAINT \`password_reset_tokens_user_id_fkey\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch((err: unknown) => {
      console.warn("[BOOTSTRAP] Aviso ao verificar/criar tabela password_reset_tokens:", err);
    });

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

