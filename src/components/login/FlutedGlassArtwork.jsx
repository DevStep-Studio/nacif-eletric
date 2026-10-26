import React, { useMemo } from "react";

/**
 * FlutedGlassArtwork
 * 
 * Recria fielmente a arte abstrata de lâminas verticais com iluminação
 * e profundidade de vidro canelado da referência, adaptada para o tema claro
 * com acentos na cor primária da Nacif Energy (#00d8b8).
 */
export default function FlutedGlassArtwork() {
  // Gera determinísticamente 38 lâminas verticais com perfil de onda orgânica e iluminação
  const blades = useMemo(() => {
    const totalBlades = 38;
    const bladeWidth = 8.5;
    const gap = 3.2;
    const items = [];

    // Curva base ondulada semelhante à imagem de referência
    for (let i = 0; i < totalBlades; i++) {
      const normalized = i / (totalBlades - 1); // 0 a 1
      
      // Forma de onda: mais curta na esquerda (~210px), desce no centro-esquerdo (~390px),
      // ondula no meio (~360px-410px) e sobe gradualmente na direita (~280px)
      const wave = Math.sin(normalized * Math.PI * 1.1) * 160;
      const subWave = Math.sin(normalized * Math.PI * 3.4) * 28;
      
      // Variação micro-escalonada para simular lâminas individuais de vidro canelado
      const microJitter = ((i * 17) % 19) - 9;
      
      const height = Math.min(430, Math.max(180, 195 + wave + subWave + microJitter));
      const x = i * (bladeWidth + gap) + 4;
      
      // Intensidade de luz e reflexo da lâmina
      const lightIntensity = 0.55 + ((i % 5) * 0.09);
      const isHeroBlade = i % 4 === 0;

      items.push({
        id: i,
        x,
        y: 0,
        width: bladeWidth,
        height,
        lightIntensity,
        isHeroBlade,
      });
    }

    return items;
  }, []);

  return (
    <div className="relative w-full h-[380px] sm:h-[420px] overflow-hidden select-none pointer-events-none">
      {/* Luz ambiente difusa central (Backlight esmeralda/teal luminoso) */}
      <div 
        className="absolute inset-x-0 top-16 h-72 opacity-65 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, rgba(0, 216, 184, 0.45) 0%, rgba(0, 169, 142, 0.22) 42%, rgba(255, 255, 255, 0) 75%)",
        }}
      />

      {/* Luz superior branca pura difusa */}
      <div 
        className="absolute inset-x-0 top-0 h-40 opacity-90 blur-2xl"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.95) 0%, rgba(240, 253, 250, 0.6) 50%, transparent 85%)",
        }}
      />

      {/* Renderização SVG de ultra alta precisão das lâminas de vidro canelado */}
      <svg
        viewBox="0 0 450 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover object-top"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          {/* Gradiente vertical padrão de corpo da lâmina (translúcido -> teal brilhante -> difuso) */}
          <linearGradient id="bladeBodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="22%" stopColor="#F0FDFA" stopOpacity="0.85" />
            <stop offset="48%" stopColor="#00D8B8" stopOpacity="0.75" />
            <stop offset="72%" stopColor="#00A98E" stopOpacity="0.82" />
            <stop offset="90%" stopColor="#0E4A43" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0E4A43" stopOpacity="0.0" />
          </linearGradient>

          {/* Gradiente de lâminas com reflexo mais claro / realçado */}
          <linearGradient id="bladeHeroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="25%" stopColor="#CCFBF1" stopOpacity="0.9" />
            <stop offset="52%" stopColor="#00D8B8" stopOpacity="0.95" />
            <stop offset="76%" stopColor="#00B89C" stopOpacity="0.7" />
            <stop offset="94%" stopColor="#146057" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#146057" stopOpacity="0.0" />
          </linearGradient>

          {/* Gradiente horizontal de curvatura cilíndrica de cada lâmina */}
          <linearGradient id="cylinderReflection" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="28%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#00A98E" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#004D40" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Lâminas de vidro canelado */}
        {blades.map((b) => (
          <g key={b.id} opacity={b.lightIntensity}>
            {/* Sombra de oclusão sutil entre lâminas */}
            <rect
              x={b.x + b.width - 1.2}
              y={0}
              width={1.6}
              height={b.height}
              fill="#062E29"
              opacity="0.16"
              rx={0.8}
            />

            {/* Corpo principal da lâmina */}
            <rect
              x={b.x}
              y={0}
              width={b.width}
              height={b.height}
              fill={b.isHeroBlade ? "url(#bladeHeroGrad)" : "url(#bladeBodyGrad)"}
              rx={4}
            />

            {/* Curvatura cilíndrica reflexiva */}
            <rect
              x={b.x}
              y={0}
              width={b.width}
              height={b.height}
              fill="url(#cylinderReflection)"
              opacity="0.4"
              rx={4}
            />

            {/* Fio de luz especular brilhante na crista da lâmina */}
            <line
              x1={b.x + 2}
              y1={2}
              x2={b.x + 2}
              y2={b.height - 12}
              stroke="#FFFFFF"
              strokeWidth={b.isHeroBlade ? 1.4 : 0.9}
              strokeOpacity={b.isHeroBlade ? 0.95 : 0.75}
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>

      {/* Degradê inferior de transição suave para reservar área tranquila aos textos */}
      <div 
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background: "linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(248, 251, 251, 0.75) 45%, #F8FBFB 100%)",
        }}
      />
    </div>
  );
}
