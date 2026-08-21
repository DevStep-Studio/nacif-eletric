import { useState, useRef, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import PageHeader from "@/components/PageHeader";

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`).join("\n");

      const response = await backend.integrations.Core.InvokeLLM({
        prompt: `Você é um engenheiro eletricista especialista em NBR 5410, NBR 14039, NR10 e projetos elétricos residenciais, comerciais e industriais. Responda de forma técnica mas acessível, sempre citando normas quando relevante.

Histórico:
${history}

Pergunta: ${userMsg}`,
      });

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      console.error("Falha ao chamar assistente IA:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: error?.message || "Não foi possível acessar o assistente de IA agora.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full max-w-none flex-col gap-5 pb-6">
      <PageHeader
        icon={Bot}
        title="IA Assistente Elétrica"
        subtitle="Especialista em NBR 5410, dimensionamento e documentação técnica."
      />

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <Zap className="w-12 h-12 mx-auto text-primary/30" />
            <p className="text-muted-foreground">Pergunte sobre normas, dimensionamento, circuitos...</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Qual bitola para chuveiro 5500W?", "Como dimensionar DR?", "Quando usar DPS?"].map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="rounded-[10px] bg-secondary px-3 py-1.5 text-xs transition-colors hover:bg-secondary/80">{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border/50"}`}>
              {m.role === "user" ? (
                <p className="text-sm">{m.content}</p>
              ) : (
                <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{m.content}</ReactMarkdown>
              )}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-card border border-border/50">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-border/50">
        <Input placeholder="Pergunte sobre engenharia elétrica..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} />
        <Button onClick={sendMessage} disabled={!input.trim() || loading} size="icon"><Send className="w-4 h-4" /></Button>
      </div>
      </div>
    </div>
  );
}
