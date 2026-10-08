import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Calculator,
  Compass,
  CreditCard,
  FileSpreadsheet,
  FileText,
  GitBranch,
  HelpCircle,
  LayoutGrid,
  Mail,
  MessageCircle,
  Search,
  Sun,
  Zap,
} from "lucide-react";

const CATEGORIES = [
  {
    id: "planta",
    title: "Planta Baixa Elétrica",
    icon: Compass,
    description: "Inserção de pontos, traçado ortogonal de eletrodutos, circuitos e cálculo de queda de tensão.",
    articles: [
      {
        id: "planta-1",
        title: "Como inserir tomadas (TUG/TUE) e pontos de iluminação?",
        content: "Para inserir tomadas e pontos de luz, selecione a ferramenta desejada no painel esquerdo da Planta Elétrica e clique no local desejado da planta. Um clique seleciona o ponto para ajuste no painel lateral; um duplo clique abre o modal de configuração de circuito e potência.",
      },
      {
        id: "planta-2",
        title: "Como funciona o roteamento automático de eletrodutos?",
        content: "O motor de roteamento ortogonal conecta automaticamente os pontos de consumo e comando ao quadro elétrico mais próximo ou através de paredes e tetos, calculando o diâmetro do eletroduto com base na taxa de ocupação da NBR 5410 (máximo 40% para 3 ou mais condutores).",
      },
      {
        id: "planta-3",
        title: "Como importar uma planta em PDF, DWG ou imagem?",
        content: "Clique no botão 'Importar Planta' no cabeçalho do editor. Formatos aceitos incluem PNG, JPG, WebP, SVG, PDF e arquivos vetoriais DXF. Em seguida, utilize a ferramenta de escala para calibrar a proporção real em metros.",
      },
    ],
  },
  {
    id: "quadro",
    title: "Quadro de Distribuição (QD)",
    icon: LayoutGrid,
    description: "Balanceamento de fases, disjuntores DIN, DPS, IDR e barramentos.",
    articles: [
      {
        id: "quadro-1",
        title: "Como dimensionar disjuntores e IDR conforme a NBR 5410?",
        content: "O sistema aplica a fórmula Ib ≤ In ≤ Iz, verificando se a corrente de projeto (Ib) é menor ou igual à corrente nominal do disjuntor (In), e se esta não ultrapassa a capacidade de condução de corrente corrigida dos cabos (Iz). O IDR tetrapolar ou bipolar é calculado para sensibilidade de 30mA para proteção contra choque elétrico.",
      },
      {
        id: "quadro-2",
        title: "Como funciona o balanceamento automático de fases (R, S, T)?",
        content: "O algoritmo distribui as cargas monofásicas e bifásicas entre as três fases do sistema trifásico buscando a menor taxa de desbalanceamento percentual, minimizando perdas no condutor neutro e prevenindo sobrecargas.",
      },
    ],
  },
  {
    id: "unifilar",
    title: "Diagrama Unifilar & Pranchas",
    icon: GitBranch,
    description: "Geração de diagramas unifilares, trifilares, pranchas A1/A2/A3 com carimbo profissional.",
    articles: [
      {
        id: "unifilar-1",
        title: "Como gerar e exportar pranchas no padrão ABNT?",
        content: "Na página de Diagrama Unifilar ou Memorial, selecione o tamanho da folha desejada (A0, A1, A2, A3 ou A4). O sistema desenha automaticamente a moldura, margens normatizadas e a legenda (carimbo/selo) com os dados do projeto e do responsável técnico.",
      },
    ],
  },
  {
    id: "solar",
    title: "Energia Solar Fotovoltaica",
    icon: Sun,
    description: "Dimensionamento de módulos fotovoltaicos, inversores, strings e geração de memorial solar.",
    articles: [
      {
        id: "solar-1",
        title: "Como calcular a área de módulos e geração média mensal?",
        content: "O módulo solar cruza os dados de irradiação solar da região (HSP) com a potência dos painéis e o consumo médio em kWh para determinar a quantidade ideal de módulos e o inversor homologado compatível.",
      },
    ],
  },
  {
    id: "faturamento",
    title: "Assinaturas & Faturamento",
    icon: CreditCard,
    description: "Gestão de planos, notas fiscais, formas de pagamento e limites de uso.",
    articles: [
      {
        id: "fat-1",
        title: "Quais formas de pagamento são aceitas?",
        content: "Aceitamos PIX com compensação imediata, Cartões de Crédito (Visa, Mastercard, Elo, Hipercard) e Boleto Bancário.",
      },
      {
        id: "fat-2",
        title: "Como solicitar alteração ou cancelamento do plano?",
        content: "Acesse a página de Assinatura no seu menu de perfil. Você pode fazer upgrade a qualquer momento ou cancelar a renovação sem taxas de rescisão.",
      },
    ],
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("planta");
  const [expandedArticle, setExpandedArticle] = useState(null);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES;
    const q = searchQuery.toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (art) => art.title.toLowerCase().includes(q) || art.content.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.articles.length > 0);
  }, [searchQuery]);

  const activeCategoryData = useMemo(() => {
    return (
      filteredCategories.find((c) => c.id === selectedCategory) ||
      filteredCategories[0] ||
      CATEGORIES[0]
    );
  }, [filteredCategories, selectedCategory]);

  return (
    <SystemPageLayout
      title="Central de Ajuda & Conhecimento"
      subtitle="Tutoriais, guias normativos da NBR 5410 e respostas para as dúvidas mais frequentes."
      maxWidth="max-w-5xl"
    >
      <div className="space-y-8">
        {/* Search Hero */}
        <div className="rounded-2xl border border-[#CDEFE8] bg-white p-6 shadow-sm space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#94A3B8]" />
            <Input
              type="text"
              placeholder="Pesquise por tema: 'cálculo de corrente', 'eletroduto', 'queda de tensão'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-10 rounded-xl text-xs sm:text-sm border-[#CBD5E1]"
            />
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] pb-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategoryData?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setExpandedArticle(null);
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isSelected
                    ? "bg-[#0F172A] text-white shadow-xs"
                    : "bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? "text-[#00d8b8]" : "text-[#94A3B8]"}`} />
                <span>{cat.title}</span>
              </button>
            );
          })}
        </div>

        {/* Articles List */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-[#0F172A]">
              {activeCategoryData?.title}
            </h2>
            <p className="text-xs text-[#64748B]">
              {activeCategoryData?.description}
            </p>
          </div>

          <div className="space-y-3">
            {activeCategoryData?.articles.map((article) => {
              const isOpen = expandedArticle === article.id;
              return (
                <div
                  key={article.id}
                  className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedArticle(isOpen ? null : article.id)}
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-[#F8FAFC]"
                  >
                    <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                      {article.title}
                    </span>
                    <span className={`text-xs font-bold text-[#00d8b8] shrink-0 ml-4`}>
                      {isOpen ? "Fechar" : "Ver resposta"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-0 border-t border-[#F1F5F9] text-xs leading-relaxed text-[#475467] bg-[#F8FBFD]">
                      <p className="pt-3">{article.content}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Need more help banner */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#0F172A]">Não encontrou o que precisava?</h3>
            <p className="text-xs text-[#64748B]">Nossa equipe de suporte técnico e engenharia elétrica está pronta para ajudar.</p>
          </div>
          <Button asChild className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shrink-0">
            <Link to="/contato">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Falar com Suporte Técnico
            </Link>
          </Button>
        </div>
      </div>
    </SystemPageLayout>
  );
}
