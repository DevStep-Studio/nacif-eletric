import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/auth.js";
import { INITIAL_SUPER_ADMIN_ACCOUNTS } from "../src/lib/bootstrap.js";

async function main() {
  console.log("==================================================");
  console.log("⚡ NACIF ENERGY — PROVISIONAMENTO DE SUPER ADMINS");
  console.log("==================================================");

  for (const adm of INITIAL_SUPER_ADMIN_ACCOUNTS) {
    const normalizedEmail = adm.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const passwordHash = await hashPassword(adm.password);

    if (!existing) {
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: adm.name,
          passwordHash,
          role: "super_admin",
          plan: "completo",
          isSuperAdmin: true,
          status: "active",
          profession: "engenheiro",
          customPermissions: {},
        },
      });
      console.log(`✔ [CRIADO] ${normalizedEmail} | Senha padrão inicial configurada`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: existing.fullName || adm.name,
          passwordHash,
          role: "super_admin",
          plan: "completo",
          isSuperAdmin: true,
          status: "active",
          isDeleted: false,
        },
      });
      console.log(`✔ [SINCRONIZADO] ${normalizedEmail} | Papel Super Admin e senha atualizados`);
    }
  }

  console.log("==================================================");
  console.log("🎉 TODOS OS SUPER ADMINS FORAM PROVISIONADOS COM SUCESSO!");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao provisionar super admins:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

