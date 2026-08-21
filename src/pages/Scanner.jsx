import { useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { ScanLine, Upload, Loader2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "@/components/PageHeader";

export default function Scanner() {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    const { file_url } = await backend.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
  };

  const analyze = async () => {
    if (!imageUrl) return;
    setLoading(true);
    const res = await backend.integrations.Core.InvokeLLM({
      prompt: `Analise esta imagem de um ambiente/instalação elétrica. Identifique todos os equipamentos elétricos visíveis (tomadas, interruptores, luminárias, ar condicionado, chuveiro, motores, quadros elétricos, eletrodomésticos).

Para cada equipamento encontrado, forneça:
- nome do equipamento
- potência estimada em watts
- corrente estimada em amperes (considerando 220V)
- tipo de circuito recomendado (iluminação, TUG, TUE)
- se necessita DR (sim/não)
- se necessita DPS (sim/não)
- bitola de fio recomendada

Base nas normas NBR 5410.`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: "object",
        properties: {
          equipments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                power_w: { type: "number" },
                current_a: { type: "number" },
                circuit_type: { type: "string" },
                needs_dr: { type: "boolean" },
                needs_dps: { type: "boolean" },
                wire_gauge: { type: "string" }
              }
            }
          },
          summary: { type: "string" }
        }
      }
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={ScanLine}
        title="Escanear Ambiente"
        subtitle="IA identifica equipamentos na imagem e gera parâmetros elétricos iniciais."
      />

      <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="p-6 rounded-2xl bg-card border border-border/50 text-center space-y-4">
        {image ? (
          <img src={image} alt="Ambiente" className="rounded-xl max-h-64 mx-auto object-cover" />
        ) : (
          <div className="py-12 border-2 border-dashed border-border rounded-xl">
            <ScanLine className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">Envie uma foto do ambiente</p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild>
            <label className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Enviar Foto<input type="file" accept="image/*" className="hidden" onChange={handleUpload} /></label>
          </Button>
          {imageUrl && (
            <Button onClick={analyze} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando...</> : <><Zap className="w-4 h-4 mr-2" />Analisar com IA</>}
            </Button>
          )}
        </div>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <p className="text-sm text-muted-foreground">{result.summary}</p>
          {result.equipments?.map((eq, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-border/50">
              <h3 className="font-semibold">{eq.name}</h3>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span>{eq.power_w}W</span>
                <span>{eq.current_a}A</span>
                <span>{eq.circuit_type}</span>
                <span>Fio: {eq.wire_gauge}</span>
                {eq.needs_dr && <span className="text-amber-400">DR necessário</span>}
                {eq.needs_dps && <span className="text-primary">DPS necessário</span>}
              </div>
            </div>
          ))}
        </motion.div>
      )}
      </div>
    </div>
  );
}
