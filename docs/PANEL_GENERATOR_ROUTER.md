# Arquitetura e Roteamento do Gerador de Quadros (Panel Generator)

Este documento descreve a arquitetura técnica, o sistema de coordenadas, o roteador ortogonal e as práticas de persistência determinística do editor de quadros elétricos do **Nacif Eletric**.

---

## 1. Visão Geral do Sistema

O editor de quadros elétricos (`PanelGenerator`) permite aos projetistas dimensionar, posicionar e conectar componentes elétricos em trilhos DIN e barramentos de acordo com a norma **NBR 5410** e boas práticas de engenharia.

### Principais Módulos:
- **`src/pages/PanelGenerator.jsx`**: Interface visual, renderização SVG interativa, drag-and-drop de componentes, barras de ferramentas flutuantes e estado de edição.
- **`src/lib/orthogonalRouter.js`**: Roteador ortogonal (Manhattan Routing), resolução de pinos de conexão, desvio de obstáculos, cálculo de rotas com curvas em 90° e normalização de persistência.
- **`src/lib/electricalEngine.js`**: Dimensionamento de circuitos, disjuntores, IDRs, DPS, barramentos e fusão de circuitos CA solares fotovoltaicos.

---

## 2. Sistema de Coordenadas (World Coordinates)

Para garantir imunidade absoluta a zoom, pan e redimensionamento da janela:
1. **Espaço do Mundo (0..850 X, 0..N Y):**
   - O SVG possui `viewBox="0 0 850 {panelHeight}"`.
   - Todos os pontos de conexão de pinos, waypoints de cabos e caixas de colisão de obstáculos são calculados exclusivamente no espaço do mundo.
2. **Conversão de Cursor com CTM:**
   ```javascript
   const getSvgCursorPoint = (event) => {
     if (!svgRef.current) return null;
     const svgPoint = svgRef.current.createSVGPoint();
     svgPoint.x = event.clientX;
     svgPoint.y = event.clientY;
     const matrix = svgRef.current.getScreenCTM();
     if (!matrix) return null;
     return svgPoint.matrixTransform(matrix.inverse());
   };
   ```

---

## 3. Resolução de Pinos e Terminais (`resolvePinPosition`)

Todos os terminais possuem identificadores semânticos padronizados:
- `terminal_left_top:{idx}`: Bloco terminal de alimentação trifásica da rede (PE, N, L1, L2, L3).
- `busbar_neutral:{idx}`: Bornes do barramento de neutro superior.
- `busbar_ground:{idx}`: Bornes do barramento de proteção terra inferior.
- `comp:{componentId}:top:{poleIndex}`: Terminal superior (entrada) de disjuntor/DPS/IDR.
- `comp:{componentId}:bottom:{poleIndex}`: Terminal inferior (saída) de disjuntor/DPS/IDR.
- `load_out:{circuitId}:{poleIndex}`: Terminal de saída para circuito terminal.
- `loose:{x}:{y}`: Ponto de ancoragem livre definido pelo usuário.

---

## 4. Roteador Ortogonal e Validação de Trajetos

O roteador ortogonal garante que:
- Todos os segmentos de cabos sejam estritamente horizontais ou verticais ($90^\circ$).
- Nenhuma linha diagonal seja renderizada.
- Faixas paralelas de condutores ($L1, L2, L3, N, PE$) mantenham espaçamento visual uniforme (`WIRE_SPACING = 8px`).
- Obstáculos (disjuntores, barramentos e caixas de passagem) sejam contornados pelas calhas com margem de segurança.
- Rotas migradas ou salvas sejam validadas por `isOrthogonalPath` antes de serem aceitas, recalculando com segurança caso estejam corrompidas.

---

## 5. Persistência Determinística

A regra estrutural do editor é:
$$\text{SALVAR} \longrightarrow \text{FECHAR} \longrightarrow \text{REABRIR} \equiv \text{MESMO QUADRO}$$

- Rotas ortogonais válidas são mantidas com seus waypoints exatos no payload `wire.route.points`.
- Flags como `meta.manualDeviceEdits = true` garantem que reaberturas subsequentes não redefinam ou desloquem componentes configurados pelo usuário.
- Mover um componente recalcula dinamicamente apenas as rotas dos cabos a ele conectados, preservando integralmente o restante do quadro.
