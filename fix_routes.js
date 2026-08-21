const fs = require('fs');

let content = fs.readFileSync('src/pages/PlantaIA.jsx', 'utf8');

// Fix buildProfessionalRoutesFromBoard
content = content.replace(
  /const boardPoint = plantPoints\.find\(\(point\) => point\.type === "qgbt"\) \|\| plantPoints\.find\(\(point\) => point\.type === "qe"\) \|\| plantPoints\.find\(\(point\) => point\.type === "caixa"\);\n    if \(!boardPoint\) return plantRoutes;\n    const existingPairs = new Set\(plantRoutes\.map\(\(route\) => `\$\{route\.start_id \|\| ""\}->\$\{route\.end_id \|\| ""\}`\)\);\n    const consumedIds = new Set\(\);\n    const nextRoutes = \[\];\n    const targetPoints = plantPoints\.filter\(\(point\) => \(\n      point\.id !== boardPoint\.id &&\n      \(includeInfrastructurePoints \|\| !INFRA_POINT_TYPES\.has\(point\.type\)\)\n    \)\);/,
  `const boardPoints = plantPoints.filter((point) => point.type === "qgbt" || point.type === "qe" || point.type === "caixa");
    if (boardPoints.length === 0) return plantRoutes;
    const getClosestBoard = (targetPoint) => closestPointTo(targetPoint, boardPoints) || boardPoints[0];
    const existingPairs = new Set(plantRoutes.map((route) => \`\${route.start_id || ""}->\${route.end_id || ""}\`));
    const consumedIds = new Set();
    const nextRoutes = [];
    const targetPoints = plantPoints.filter((point) => (
      !boardPoints.some(b => b.id === point.id) &&
      (includeInfrastructurePoints || !INFRA_POINT_TYPES.has(point.type))
    ));`
);

content = content.replace(
  /addAutoRoute\(boardPoint, switchPoint, \{/g,
  `addAutoRoute(getClosestBoard(switchPoint), switchPoint, {`
);

content = content.replace(
  /addAutoRoute\(boardPoint, lightPoint, \{/g,
  `addAutoRoute(getClosestBoard(lightPoint), lightPoint, {`
);

content = content.replace(
  /addAutoRoute\(boardPoint, point, \{/g,
  `addAutoRoute(getClosestBoard(point), point, {`
);

content = content.replace(
  /addAutoRoute\(boardPoint, point\)/g,
  `addAutoRoute(getClosestBoard(point), point)`
);

content = content.replace(
  /let previousPoint = boardPoint;\n      orderPointsByNearest\(boardPoint, outletGroup\)\.forEach/g,
  `const closestBoard = getClosestBoard(outletGroup[0]);\n      let previousPoint = closestBoard;\n      orderPointsByNearest(closestBoard, outletGroup).forEach`
);

// Fix autoConnectFromBoard
content = content.replace(
  /const boardPoint = points\.find\(\(point\) => point\.type === "qgbt"\) \|\| points\.find\(\(point\) => point\.type === "qe"\) \|\| points\.find\(\(point\) => point\.type === "caixa"\);\n    if \(!boardPoint\) return;\n    const baseRoutes = routes\.filter\(\(route\) => !route\.auto_generated && route\.source !== "planta-ia-completa"\);\n    const targetPoints = points\.filter\(\(point\) => \(\n      point\.id !== boardPoint\.id &&\n      \(includeInfrastructurePoints \|\| !INFRA_POINT_TYPES\.has\(point\.type\)\)\n    \)\);/,
  `const boardPoints = points.filter((point) => point.type === "qgbt" || point.type === "qe" || point.type === "caixa");
    if (boardPoints.length === 0) return;
    const getClosestBoard = (targetPoint) => closestPointTo(targetPoint, boardPoints) || boardPoints[0];
    const baseRoutes = routes.filter((route) => !route.auto_generated && route.source !== "planta-ia-completa");
    const targetPoints = points.filter((point) => (
      !boardPoints.some(b => b.id === point.id) &&
      (includeInfrastructurePoints || !INFRA_POINT_TYPES.has(point.type))
    ));`
);

fs.writeFileSync('src/pages/PlantaIA.jsx', content, 'utf8');
console.log("Done");
