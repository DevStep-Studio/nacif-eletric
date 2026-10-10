import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  Box,
  Camera,
  Check,
  Compass,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Rotate3d,
  RotateCw,
  Sun,
  Zap,
} from "lucide-react";
import { calculateAzimuth, getAzimuthWithCardinal } from "@/lib/solarDesignerGeometry";

// Converte graus para radianos
const toRad = (deg) => (deg * Math.PI) / 180;

// Raio da Terra em metros para conversão precisa Lat/Lng -> Metros locais
const EARTH_RADIUS_M = 6378137;

/**
 * Converte Lat/Lng geográfico para coordenadas cartesianas locais (X, Y) em metros
 * relativas a uma âncora central.
 */
function latLngToLocalMeters(lat, lng, centerLat, centerLng) {
  const dLat = toRad(lat - centerLat);
  const dLng = toRad(lng - centerLng);
  const meanLat = toRad((lat + centerLat) / 2);

  const y = dLat * EARTH_RADIUS_M; // Norte positivo (+Y)
  const x = dLng * EARTH_RADIUS_M * Math.cos(meanLat); // Leste positivo (+X)
  return { x, y };
}

/**
 * Cores de materiais de telhado
 */
const ROOF_MATERIAL_COLORS = {
  ceramica: { base: 0xb45309, roughness: 0.85, metalness: 0.05 }, // Telha cerâmica terracota
  metalica: { base: 0x64748b, roughness: 0.35, metalness: 0.65 }, // Telha de aço / sanduíche
  fibrocimento: { base: 0x94a3b8, roughness: 0.9, metalness: 0.02 }, // Fibrocimento cinza claro
  laje: { base: 0x475467, roughness: 0.92, metalness: 0.05 }, // Laje plana impermeabilizada
  shingle: { base: 0x334155, roughness: 0.88, metalness: 0.08 }, // Asfáltico shingle escuro
};

export default function Solar3DView({
  config = {},
  areas = [],
  sizing = {},
  panelPolygons = [],
  onAreaSelect,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sunLightRef = useRef(null);
  const animFrameRef = useRef(null);

  // Estados de controle da cena 3D
  const [sunTime, setSunTime] = useState(12); // 6h a 18h
  const [castShadows, setCastShadows] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState(areas[0]?.id || null);
  const [cameraPreset, setCameraPreset] = useState("iso"); // "iso" | "top" | "front"
  const [pitchOverride, setPitchOverride] = useState(config.roof_pitch_deg || 15);

  const activeAreas = areas.length > 0 ? areas : config.areas?.length > 0 ? config.areas : [];
  const currentArea = activeAreas.find((a) => a.id === selectedAreaId) || activeAreas[0] || {};
  const currentPolygon = currentArea?.polygon || config.roof_polygon || [];

  const azimuth = useMemo(() => calculateAzimuth(currentPolygon), [currentPolygon]);

  // Âncora central da cena em Lat/Lng
  const centerCoord = useMemo(() => {
    if (currentPolygon.length > 0) {
      const lats = currentPolygon.map((p) => p.lat);
      const lngs = currentPolygon.map((p) => p.lng);
      return {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      };
    }
    return {
      lat: config.map_center_lat || -23.55052,
      lng: config.map_center_lng || -46.633308,
    };
  }, [currentPolygon, config]);

  // Controles de mouse / toque para rotação orbital
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 26 });

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngleRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.cos(phi);

    cameraRef.current.position.set(x, y, Math.max(1, z));
    cameraRef.current.lookAt(0, 0, 3);
  };

  // Inicialização do Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Slate-100 clean backdrop
    sceneRef.current = scene;

    // 2. Câmera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
    camera.up.set(0, 0, 1); // Z para cima (padrão de engenharia civil/topografia)
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Luzes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x94a3b8, 0.35);
    hemiLight.position.set(0, 0, 50);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    const d = 20;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 5. Terreno / Plano Base
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // Grade métrica sutil
    const grid = new THREE.GridHelper(60, 60, 0x94a3b8, 0xcbd5e1);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.01;
    scene.add(grid);

    // 6. Loop de Renderização
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // 7. Redimensionamento
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Atualização da Posição do Sol baseada no Horário
  useEffect(() => {
    if (!sunLightRef.current) return;
    const sunLight = sunLightRef.current;
    sunLight.castShadow = castShadows;

    // Cálculo solar simplificado para latitude brasileira (-23.5°):
    // 6h: Leste (baixo), 12h: Norte (alto/zênite), 18h: Oeste (baixo)
    const normalizedHour = (sunTime - 6) / 12; // 0 a 1
    const solarElevationRad = Math.sin(normalizedHour * Math.PI) * (Math.PI / 2.3);
    const solarAzimuthRad = normalizedHour * Math.PI - Math.PI / 2; // -PI/2 (Leste) -> 0 (Norte) -> +PI/2 (Oeste)

    const sunDistance = 35;
    const sunX = Math.sin(solarAzimuthRad) * Math.cos(solarElevationRad) * sunDistance;
    const sunY = Math.cos(solarAzimuthRad) * Math.cos(solarElevationRad) * sunDistance;
    const sunZ = Math.max(1, Math.sin(solarElevationRad) * sunDistance);

    sunLight.position.set(sunX, sunY, sunZ);
  }, [sunTime, castShadows]);

  // Reconstrução Geométrica 3D do Telhado, Módulos e Obstáculos
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove objetos de projeto anteriores (mantém terreno, luzes e grade)
    const toRemove = [];
    scene.traverse((child) => {
      if (child.userData?.isProjectObject) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
      scene.remove(obj);
    });

    const projectGroup = new THREE.Group();
    projectGroup.userData.isProjectObject = true;

    const baseBuildingHeight = 4.5; // Altura padrão do pé-direito/beiral da edificação em metros

    // Renderiza cada água de telhado (área)
    const areasToRender = activeAreas.length > 0 ? activeAreas : [
      {
        id: "default_area",
        polygon: currentPolygon,
        roof_area_m2: config.roof_area_m2 || 60,
        roof_pitch_deg: pitchOverride,
        roof_rotation_deg: config.roof_rotation_deg || 329,
        roof_covering: "ceramica",
      },
    ];

    areasToRender.forEach((area, areaIdx) => {
      const poly = area.polygon && area.polygon.length >= 3 ? area.polygon : currentPolygon;
      if (poly.length < 3) return;

      const localPoints = poly.map((pt) =>
        latLngToLocalMeters(pt.lat, pt.lng, centerCoord.lat, centerCoord.lng)
      );

      // Centroide da área para cálculo da inclinação
      const avgX = localPoints.reduce((acc, p) => acc + p.x, 0) / localPoints.length;
      const avgY = localPoints.reduce((acc, p) => acc + p.y, 0) / localPoints.length;

      // Cria Shape 2D para o telhado
      const shape = new THREE.Shape();
      localPoints.forEach((p, idx) => {
        if (idx === 0) shape.moveTo(p.x, p.y);
        else shape.lineTo(p.x, p.y);
      });
      shape.closePath();

      // Geometria do telhado
      const roofGeo = new THREE.ShapeGeometry(shape);
      const matConfig = ROOF_MATERIAL_COLORS[area.roof_covering] || ROOF_MATERIAL_COLORS.ceramica;
      const roofMat = new THREE.MeshStandardMaterial({
        color: matConfig.base,
        roughness: matConfig.roughness,
        metalness: matConfig.metalness,
        side: THREE.DoubleSide,
      });

      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.set(0, 0, baseBuildingHeight);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;

      // Inclinação do telhado
      const pitchRad = toRad(area.roof_pitch_deg || pitchOverride || 15);
      const azimuthRad = toRad(area.roof_rotation_deg || config.roof_rotation_deg || 0);

      // Aplica inclinação respeitando azimute do telhado
      roofMesh.rotation.z = -azimuthRad;
      roofMesh.rotation.x = pitchRad;

      projectGroup.add(roofMesh);

      // Paredes estruturais da edificação (extrusão para baixo até o chão)
      const extrudeSettings = {
        depth: baseBuildingHeight,
        bevelEnabled: false,
      };
      const wallGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.9,
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(0, 0, 0);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      projectGroup.add(wallMesh);
    });

    // 7. Renderização 3D dos Módulos Fotovoltaicos
    const panelsToRender = panelPolygons.length > 0
      ? panelPolygons
      : activeAreas.flatMap((a) => a.panelPolygons || []);

    const moduleWidthM = config.module_width_m || 1.134;
    const moduleHeightM = config.module_height_m || 2.278;
    const moduleThicknessM = 0.035; // 35mm moldura de alumínio

    // Materiais dos módulos fotovoltaicos
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Alumínio anodizado fosco
      metalness: 0.8,
      roughness: 0.25,
    });
    const cellMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Silício monocristalino escuro
      metalness: 0.4,
      roughness: 0.15,
      emissive: 0x001524,
      emissiveIntensity: 0.2,
    });

    panelsToRender.forEach((panel) => {
      if (!Array.isArray(panel) || panel.length < 4) return;

      const pLocal = panel.map((pt) =>
        latLngToLocalMeters(pt.lat, pt.lng, centerCoord.lat, centerCoord.lng)
      );

      const pCenterX = pLocal.reduce((acc, p) => acc + p.x, 0) / 4;
      const pCenterY = pLocal.reduce((acc, p) => acc + p.y, 0) / 4;

      // Geometria da placa 3D com moldura
      const panelGroup = new THREE.Group();

      // Moldura de alumínio externa
      const frameGeo = new THREE.BoxGeometry(moduleWidthM, moduleHeightM, moduleThicknessM);
      const frameMesh = new THREE.Mesh(frameGeo, frameMaterial);
      frameMesh.castShadow = true;
      frameMesh.receiveShadow = true;
      panelGroup.add(frameMesh);

      // Células fotovoltaicas de silício na face superior
      const cellGeo = new THREE.BoxGeometry(
        moduleWidthM - 0.03,
        moduleHeightM - 0.03,
        moduleThicknessM * 0.2
      );
      const cellMesh = new THREE.Mesh(cellGeo, cellMaterial);
      cellMesh.position.z = moduleThicknessM * 0.45;
      cellMesh.castShadow = true;
      cellMesh.receiveShadow = true;
      panelGroup.add(cellMesh);

      // Posiciona módulo sobre o telhado com pequeno offset de elevação dos trilhos (6cm)
      const pitchRad = toRad(currentArea?.roof_pitch_deg || pitchOverride || 15);
      const azimuthRad = toRad(currentArea?.roof_rotation_deg || config.roof_rotation_deg || 0);

      panelGroup.position.set(pCenterX, pCenterY, baseBuildingHeight + 0.08);
      panelGroup.rotation.z = -azimuthRad;
      panelGroup.rotation.x = pitchRad;

      projectGroup.add(panelGroup);
    });

    // 8. Renderização 3D dos Obstáculos
    const obstaclesToRender = config.obstacles || currentArea?.obstacles || [];
    obstaclesToRender.forEach((obs) => {
      const obsPos = latLngToLocalMeters(
        obs.lat || centerCoord.lat,
        obs.lng || centerCoord.lng,
        centerCoord.lat,
        centerCoord.lng
      );
      const obsHeight = obs.heightAboveRoofM || 1.8;
      const obsRadius = obs.radiusM || 1.0;

      let obsMesh = null;
      if (obs.type === "caixa_dagua") {
        const cylGeo = new THREE.CylinderGeometry(obsRadius, obsRadius, obsHeight, 24);
        cylGeo.rotateX(Math.PI / 2);
        const cylMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.7,
        });
        obsMesh = new THREE.Mesh(cylGeo, cylMat);
      } else if (obs.type === "chamine") {
        const boxGeo = new THREE.BoxGeometry(0.8, 0.8, obsHeight);
        const boxMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12, // Tijolo terracota escuro
          roughness: 0.9,
        });
        obsMesh = new THREE.Mesh(boxGeo, boxMat);
      } else {
        const defaultGeo = new THREE.BoxGeometry(1.2, 1.2, obsHeight);
        const defaultMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.8,
        });
        obsMesh = new THREE.Mesh(defaultGeo, defaultMat);
      }

      if (obsMesh) {
        obsMesh.position.set(obsPos.x, obsPos.y, baseBuildingHeight + obsHeight / 2);
        obsMesh.castShadow = true;
        obsMesh.receiveShadow = true;
        projectGroup.add(obsMesh);
      }
    });

    scene.add(projectGroup);
  }, [activeAreas, currentPolygon, panelPolygons, config, pitchOverride, centerCoord]);

  // Manipuladores de Eventos de Mouse e Rotação Orbital da Câmera
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    cameraAngleRef.current.theta -= deltaX * 0.008;
    cameraAngleRef.current.phi = Math.max(
      0.1,
      Math.min(Math.PI / 2.05, cameraAngleRef.current.phi - deltaY * 0.008)
    );

    updateCameraPosition();
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    cameraAngleRef.current.radius = Math.max(
      8,
      Math.min(60, cameraAngleRef.current.radius + e.deltaY * 0.03)
    );
    updateCameraPosition();
  };

  // Predefinições de Câmera (Superior / Isométrica / Frontal)
  const setPresetView = (preset) => {
    setCameraPreset(preset);
    if (preset === "top") {
      cameraAngleRef.current = { theta: 0, phi: 0.01, radius: 28 };
    } else if (preset === "front") {
      cameraAngleRef.current = { theta: 0, phi: Math.PI / 2.1, radius: 26 };
    } else {
      cameraAngleRef.current = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 26 };
    }
    updateCameraPosition();
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className="relative h-full w-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-slate-100"
    >
      {/* ── 1. Barra de Controles 3D Superior ── */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 p-2 rounded-2xl text-xs shadow-xl text-slate-800 pointer-events-auto">
        {/* Seletor de Áreas se houver mais de uma */}
        {activeAreas.length > 1 && (
          <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
            <Layers className="h-3.5 w-3.5 text-[#00d8b8]" />
            {activeAreas.map((area, idx) => (
              <button
                key={area.id}
                type="button"
                onClick={() => {
                  setSelectedAreaId(area.id);
                  onAreaSelect?.(area.id);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  currentArea.id === area.id
                    ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {area.name || `Área ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Câmeras Pré-definidas */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setPresetView("iso")}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
              cameraPreset === "iso" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Isométrica
          </button>
          <button
            type="button"
            onClick={() => setPresetView("top")}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
              cameraPreset === "top" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Vista Superior
          </button>
          <button
            type="button"
            onClick={() => setPresetView("front")}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
              cameraPreset === "front" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Frontal
          </button>
        </div>

        <span className="h-4 w-px bg-slate-200" />

        {/* Inclinação do Telhado */}
        <div className="flex items-center gap-2 px-1">
          <Rotate3d className="h-4 w-4 text-[#00d8b8]" />
          <span className="font-bold">Inclinação: {pitchOverride}°</span>
          <input
            type="range"
            min="5"
            max="45"
            value={pitchOverride}
            onChange={(e) => setPitchOverride(Number(e.target.value))}
            className="w-16 accent-[#00d8b8] cursor-pointer"
          />
        </div>

        <span className="h-4 w-px bg-slate-200" />

        {/* Simulação Solar com Horário */}
        <div className="flex items-center gap-2 px-1">
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="font-bold">Sol: {String(sunTime).padStart(2, "0")}:00</span>
          <input
            type="range"
            min="6"
            max="18"
            step="1"
            value={sunTime}
            onChange={(e) => setSunTime(Number(e.target.value))}
            className="w-16 accent-amber-500 cursor-pointer"
          />
        </div>

        <span className="h-4 w-px bg-slate-200" />

        {/* Toggle de Sombreamento Dinâmico */}
        <button
          type="button"
          onClick={() => setCastShadows(!castShadows)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition text-xs ${
            castShadows ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
          }`}
          title="Ativar/desativar sombras dinâmicas de engenharia"
        >
          <span>Sombras</span>
          {castShadows && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── 2. Azimute e Rosa dos Ventos Flutuante ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 px-3 py-1.5 rounded-2xl text-xs shadow-xl pointer-events-auto">
        <Compass className="h-4 w-4 text-[#00d8b8]" />
        <span className="font-black text-slate-800">
          Azimute: {azimuth.formatted} ({getAzimuthWithCardinal(currentArea?.roof_rotation_deg || config.roof_rotation_deg || 0).cardinal})
        </span>
      </div>

      {/* ── 3. Rodapé Técnico Informativo ── */}
      <div className="absolute bottom-4 inset-x-6 z-20 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-md border border-slate-200/90 px-5 py-3 rounded-2xl text-xs shadow-xl text-slate-800 pointer-events-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-black text-slate-900">
            <Zap className="h-4 w-4 text-[#00d8b8]" />
            <span>
              {sizing?.panelCount || panelPolygons.length || 0} Módulos Posicionados
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-slate-600">
            Potência: <strong className="text-slate-900 font-bold">{sizing?.dcPowerKw || 0} kWp</strong>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-slate-600">
            Área Utilizada: <strong className="text-slate-900 font-bold">{Math.round(sizing?.roofArea || 0)} m²</strong>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <span>Arraste com o mouse para orbitar</span>
          <span>·</span>
          <span>Scroll para zoom</span>
        </div>
      </div>
    </div>
  );
}
