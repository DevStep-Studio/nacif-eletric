import { useState } from "react";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import PageHeader from "@/components/PageHeader";

const sections = [
  { id: "1", title: "Circuitos de Iluminação", content: "Potência mínima: 100VA para cômodos até 6m². Acima de 6m², adicionar 60VA a cada 4m² excedentes. Seção mínima: 1,5mm². Disjuntor máximo: 10A." },
  { id: "2", title: "Tomadas de Uso Geral (TUG)", content: "Cozinha, copa, banheiro: mínimo 600VA por tomada. Demais cômodos: mínimo 100VA. Seção mínima: 2,5mm². Disjuntor: 16A ou 20A." },
  { id: "3", title: "Tomadas de Uso Específico (TUE)", content: "Circuito exclusivo para cada equipamento > 1000VA. Chuveiro: circuito dedicado com fio mínimo 4mm² (até 5500W em 220V). Ar condicionado: circuito exclusivo." },
  { id: "4", title: "Dispositivo DR", content: "Obrigatório em: banheiros, cozinhas, lavanderias, áreas externas, garagens. Sensibilidade: 30mA para proteção de pessoas. NBR 5410 seção 5.1.3.2." },
  { id: "5", title: "DPS - Dispositivo de Proteção contra Surtos", content: "Obrigatório em todas as instalações. Classe II na entrada. Classe III em circuitos sensíveis. NBR 5410 seção 5.4.2." },
  { id: "6", title: "Quadro de Distribuição", content: "Reserva mínima de 20% para circuitos futuros. Identificação obrigatória. Barramento de terra e neutro separados em sistema TN-S." },
  { id: "7", title: "Aterramento", content: "Resistência máxima: 10Ω. Tipos: TN-S, TN-C-S, TT, IT. Eletrodo de aterramento: haste cobreada mínimo 2,40m." },
  { id: "8", title: "Queda de Tensão", content: "Limite: 4% entre origem e qualquer ponto de utilização. Sendo: 2% alimentador e 2% circuitos terminais (recomendação). Calcular: ΔV = 2×ρ×L×I / S." },
  { id: "9", title: "Dimensionamento de Condutores", content: "Critérios: capacidade de corrente, queda de tensão, curto-circuito. Temperatura: 70°C PVC, 90°C EPR/XLPE. Método de instalação conforme tabelas 33-39." },
  { id: "10", title: "Seletividade", content: "Coordenação entre dispositivos de proteção. O dispositivo a montante deve atuar apenas quando o de jusante não eliminar a falta. Verificar curvas I×t." },
];

export default function NBRLibrary() {
  const [search, setSearch] = useState("");
  const filtered = sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.content.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={BookOpen}
        title="Biblioteca NBR 5410"
        subtitle="Referência rápida dos critérios mais usados no dimensionamento elétrico."
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar na norma..."
            className="h-12 rounded-[14px] border-[#BCEEE5] bg-white pl-11 text-sm font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-3xl space-y-3">
        {filtered.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-xl bg-card border border-border/50">
            <h3 className="font-semibold text-sm flex items-center gap-2"><ChevronRight className="w-4 h-4 text-primary" />{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.content}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
