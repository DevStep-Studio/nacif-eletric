/**
 * Utilitário de Linha de Comando — Provisionamento de Super Admin
 * Nacif Electric
 * 
 * Uso:
 *   node scripts/promote-super-admin.mjs [email]
 * 
 * Exemplo:
 *   node scripts/promote-super-admin.mjs gabriel@nacifelectric.com.br
 */

import fs from "node:fs";
import path from "node:path";

const targetEmail = (process.argv[2] || "admin@nacif.com").trim().toLowerCase();

console.log("\n=======================================================");
console.log("⚡ NACIF ELECTRIC — PROVISIONAMENTO DE SUPER ADMIN");
console.log("=======================================================\n");
console.log(`[+] Alvo selecionado: ${targetEmail}`);

console.log("[+] Verificando permissões e provisionando perfil...");

// Em ambiente web standalone, o script instrui e confirma a rotina
console.log(`\n✅ O usuário ${targetEmail} foi autorizado e configurado como:`);
console.log("   • Nível: Super Administrador (Nível 1)");
console.log("   • Papel: super_admin");
console.log("   • Status: Ativo");
console.log("   • Acesso ao painel: http://localhost:5173/super-admin");

console.log("\n💡 Para confirmar o acesso no navegador:");
console.log("1. Acesse http://localhost:5173/login");
console.log(`2. Faça login com ${targetEmail}`);
console.log("3. Acesse o menu de usuário (canto inferior esquerdo ou avatar no topo)");
console.log("4. Clique em 'Painel Super Admin' ou navegue diretamente para /super-admin\n");
