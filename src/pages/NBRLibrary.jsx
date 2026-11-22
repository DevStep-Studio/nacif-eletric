import { useMemo, useState } from "react";
import { BookOpen, Search, Star, Info, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import FilterBar from "@/components/nacif/FilterBar";
import EmptyState from "@/components/nacif/EmptyState";

const FAVORITES_KEY = "nacif:nbr-favorites";

const NBR_ENTRIES = [
  {
    id: "nbr5410-illum",
    norm: "NBR 5410",
    clause: "Seção 4.2.1.2 / 6.2.6",
    title: "Circuitos de Iluminação",
    content: "Potência mínima: 100 VA para cômodos até 6 m². Acima de 6 m², adicionar 60 VA a cada 4 m² inteiros excedentes. Seção mínima: 1,5 mm² em cobre. Disjuntor típico: 10 A.",
  },
  {
    id: "nbr5410-tug",
    norm: "NBR 5410",
    clause: "Seção 9.5.2.2",
    title: "Tomadas de Uso Geral (TUG)",
    content: "Cozinha, copa, lavanderia e banheiros: mínimo 600 VA por ponto (até 3 primeiros pontos). Demais cômodos: mínimo 100 VA por ponto. Condutor mínimo: 2,5 mm². Disjuntor típico: 16 A ou 20 A.",
  },
  {
    id: "nbr5410-tue",
    norm: "NBR 5410",
    clause: "Seção 9.5.3",
    title: "Tomadas de Uso Específico (TUE)",
    content: "Circuito exclusivo recomendado para cada equipamento com corrente nominal superior a 10 A ou potência elevada (chuveiro, forno, ar-condicionado, bomba).",
  },
  {
    id: "nbr5410-dr",
    norm: "NBR 5410",
    clause: "Seção 5.1.3.2.2",
    title: "Proteção Adicional por DR (30 mA)",
    content: "Obrigatório em circuitos que atendem pontos em locais contendo banheira ou chuveiro, cozinhas, áreas de serviço, tomadas externas e ambientes úmidos. Sensibilidade máxima de 30 mA.",
  },
  {
    id: "nbr5410-dps",
    norm: "NBR 5410",
    clause: "Seção 5.4.2.1",
    title: "DPS — Dispositivo de Proteção contra Surtos",
    content: "Coordenação de surtos transitórios na origem da instalação (Classe I ou Classe II conforme exposição SPDA/rede aérea) e proteção complementar quando aplicável.",
  },
  {
    id: "nbr5410-vd",
    norm: "NBR 5410",
    clause: "Seção 6.2.7",
    title: "Limites de Queda de Tensão",
    content: "Em instalações alimentadas por ramal de baixa tensão, queda máxima de 4% nos circuitos de iluminação e demais usos a partir do ponto de entrega, respeitando o dimensionamento por capacidade de corrente.",
  },
  {
    id: "nbr5410-cables",
    norm: "NBR 5410",
    clause: "Tabelas 33 a 47",
    title: "Dimensionamento de Condutores",
    content: "Critérios simultâneos: seção mínima normativa, capacidade de condução de corrente (com fatores de temperatura e agrupamento), queda de tensão, sobrecarga e curto-circuito.",
  },
  {
    id: "nbr16690-pv",
    norm: "NBR 16690",
    clause: "Arranjos Fotovoltaicos",
    title: "Instalações Elétricas de Arranjos Fotovoltaicos",
    content: "Requisitos para projeto de geração distribuída: seccionamento CC e CA acessíveis, proteção contra sobrecorrente/surtos CC (DPS fotovoltaico), identificação de segurança e coordenação inversor-rede.",
  },
  {
    id: "nbr5419-spda",
    norm: "NBR 5419",
    clause: "Partes 1 a 4",
    title: "SPDA e Medidas de Proteção contra Raios",
    content: "Gerenciamento de risco atmosférico, subsistemas de captação, descidas, aterramento equipotencializado e coordenação com DPS na entrada de energia e linhas de sinal.",
  },
  {
    id: "nbr14039-mt",
    norm: "NBR 14039",
    clause: "Média Tensão",
    title: "Instalações Elétricas de Média Tensão (1,0 a 36,2 kV)",
    content: "Diretrizes para subestações consumidoras, coordenação e seletividade de proteção primária, seccionamento, intertravamento e segurança de operação.",
  },
];

const CATEGORIES = ["Todas", "Favoritas", "NBR 5410", "NBR 16690", "NBR 5419", "NBR 14039"];

export default function NBRLibrary() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return NBR_ENTRIES.filter((entry) => {
      if (category === "Favoritas" && !favorites.includes(entry.id)) return false;
      if (category !== "Todas" && category !== "Favoritas" && entry.norm !== category) return false;
      if (q) {
        const hay = `${entry.norm} ${entry.clause} ${entry.title} ${entry.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, category, favorites]);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 pb-16">
      <PageHeader
        icon={BookOpen}
        badge="CONSULTA NORMATIVA"
        title="Biblioteca NBR"
        subtitle="Resumo técnico estruturado dos principais critérios da NBR 5410, NBR 16690, NBR 5419 e NBR 14039."
      >
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            placeholder="Buscar critério, seção ou norma..."
            className="h-10 rounded-xl border-[#E5EBF1] bg-white pl-10 text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </PageHeader>

      <div className="flex items-start gap-2.5 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3 text-xs text-[#64748B]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#006F51]" />
        <p className="leading-relaxed">
          <strong className="text-[#101828]">Nota técnica:</strong> Esta biblioteca apresenta resumos de consulta rápida usados nos módulos da plataforma e não substitui a consulta integral às normas oficiais publicadas pela ABNT.
        </p>
      </div>

      <FilterBar
        activeTab={category}
        onTabChange={setCategory}
        tabs={CATEGORIES.map((c) => ({
          id: c,
          label: c,
          count: c === "Favoritas" ? favorites.length : c === "Todas" ? NBR_ENTRIES.length : undefined,
        }))}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum critério encontrado"
          description="Ajuste a busca ou altere a categoria selecionada."
          actionLabel="Mostrar todas as normas"
          onAction={() => {
            setCategory("Todas");
            setSearch("");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {filtered.map((item) => {
            const isFav = favorites.includes(item.id);
            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#00D98A]/60"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#DDFCF0] px-2.5 py-0.5 text-[11px] font-bold text-[#006F51]">
                        {item.norm}
                      </span>
                      <span className="rounded-md bg-[#F6F9FC] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                        {item.clause}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.id)}
                      aria-label={isFav ? "Remover dos favoritos" : "Favoritar norma"}
                      className={`rounded-lg p-1.5 transition ${
                        isFav ? "bg-amber-50 text-amber-500" : "text-[#94A3B8] hover:bg-[#F6F9FC] hover:text-[#101828]"
                      }`}
                    >
                      <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  <h3 className="mt-2.5 flex items-center gap-1.5 text-sm font-extrabold text-[#101828]">
                    <ChevronRight className="h-4 w-4 text-[#00D98A]" />
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{item.content}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
