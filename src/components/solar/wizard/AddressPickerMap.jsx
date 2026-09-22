import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Layers, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import "leaflet/dist/leaflet.css";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

const STATE_NAME_TO_UF = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

function resolveUf(address = {}) {
  if (address.state_code) return address.state_code.toUpperCase();
  const normalized = String(address.state || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return STATE_NAME_TO_UF[normalized] || "";
}

const customPinIcon = L.divIcon({
  className: "address-picker-pin",
  html: `<div style="width:32px;height:32px;transform:translate(-16px,-30px);filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
    <svg viewBox="0 0 24 24" width="32" height="32" fill="#00d8b8" stroke="#051917" stroke-width="1.2">
      <path d="M12 0c-4.4 0-8 3.6-8 8 0 5.7 8 16 8 16s8-10.3 8-16c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

export default function AddressPickerMap({
  lat = -23.55052,
  lng = -46.633308,
  zoom = 18,
  onPositionChange,
  onAddressSelect,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [mapType, setMapType] = useState("satellite"); // "satellite" | "streets"
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef(null);

  // Inicialização do Mapa Leaflet com suporte a satélite de alta definição
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: zoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Camada de satélite padrão (Google Hybrid / Esri)
      const satLayer = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        { maxZoom: 21, maxNativeZoom: 20 }
      );
      satLayer.addTo(map);
      tileLayerRef.current = satLayer;

      // Marcador arrastável
      const marker = L.marker([lat, lng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        onPositionChange?.({ lat: pos.lat, lng: pos.lng });

        // Geocodificação reversa ao soltar o marcador
        try {
          const revUrl = `${NOMINATIM_REVERSE_URL}?format=json&lat=${pos.lat}&lon=${pos.lng}&addressdetails=1`;
          const res = await fetch(revUrl, { headers: { Accept: "application/json" } });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            onAddressSelect?.({
              lat: pos.lat,
              lng: pos.lng,
              address: [addr.road].filter(Boolean).join(" ") || data.display_name,
              number: addr.house_number || "",
              neighborhood: addr.suburb || addr.neighbourhood || addr.village || "",
              city: addr.city || addr.town || addr.municipality || "",
              state: resolveUf(addr),
              zip_code: addr.postcode || "",
            });
          }
        } catch {
          // Mantém as coordenadas se a busca reversa falhar
        }
      });

      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onPositionChange?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    return () => {
      // Limpeza opcional
    };
  }, []);

  // Atualização de tipo de mapa (Satélite vs Ruas)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const newLayer = mapType === "satellite"
      ? L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", { maxZoom: 21, maxNativeZoom: 20 })
      : L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { maxZoom: 21, maxNativeZoom: 20 });

    newLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [mapType]);

  // Atualização suave de centro e marcador quando as props mudarem
  useEffect(() => {
    if (mapInstanceRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
      const currentCenter = mapInstanceRef.current.getCenter();
      const dist = Math.hypot(currentCenter.lat - lat, currentCenter.lng - lng);
      if (dist > 0.0001) {
        mapInstanceRef.current.flyTo([lat, lng], Math.max(17, mapInstanceRef.current.getZoom()), {
          animate: true,
          duration: 0.8,
        });
      }
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
    }
  }, [lat, lng]);

  const runSearch = useCallback(async (text) => {
    if (!text || text.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const url = `${NOMINATIM_SEARCH_URL}?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(text)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Falha na busca.");
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchError("Não foi possível buscar no momento. Posicione o marcador manualmente.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value) => {
    setQuery(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(value), 500);
  };

  const handleSelectResult = (result) => {
    const nextLat = Number(result.lat);
    const nextLng = Number(result.lon);
    const addr = result.address || {};
    onAddressSelect?.({
      lat: nextLat,
      lng: nextLng,
      address: [addr.road].filter(Boolean).join(" ") || result.display_name,
      number: addr.house_number || "",
      neighborhood: addr.suburb || addr.neighbourhood || addr.village || "",
      city: addr.city || addr.town || addr.municipality || "",
      state: resolveUf(addr),
      zip_code: addr.postcode || "",
    });
    setResults([]);
    setQuery(result.display_name);
  };

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Buscar rua, número, bairro ou ponto de referência..."
          className="h-11 pl-9 pr-10 font-medium"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        )}
        {results.length > 0 && (
          <div className="absolute z-[600] mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow-xl">
            {results.map((result) => (
              <button
                key={`${result.place_id}`}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="flex w-full items-start gap-2.5 border-b border-border/50 px-3.5 py-2.5 text-left text-xs font-semibold last:border-b-0 hover:bg-primary/10 transition"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-foreground leading-snug">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {searchError && <p className="text-xs font-semibold text-amber-700">{searchError}</p>}

      <div className="relative h-[240px] overflow-hidden rounded-2xl border border-border shadow-sm">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Alternador de camadas (Satélite / Ruas) */}
        <div className="absolute right-3 top-3 z-[400] flex items-center gap-1 rounded-xl bg-white/90 p-1 shadow-md backdrop-blur-sm border border-border/60">
          <Button
            type="button"
            size="sm"
            variant={mapType === "satellite" ? "default" : "ghost"}
            onClick={() => setMapType("satellite")}
            className="h-7 px-2.5 text-[11px] font-bold"
          >
            <Layers className="mr-1 h-3.5 w-3.5" /> Satélite HD
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mapType === "streets" ? "default" : "ghost"}
            onClick={() => setMapType("streets")}
            className="h-7 px-2.5 text-[11px] font-bold"
          >
            Ruas
          </Button>
        </div>

        {/* Badge de Coordenadas */}
        <div className="absolute bottom-3 left-3 z-[400] rounded-lg bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          <span className="flex items-center gap-1">
            <Navigation className="h-3 w-3 text-primary" /> {lat.toFixed(6)}, {lng.toFixed(6)}
          </span>
        </div>
      </div>

      <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
        💡 <strong>Dica:</strong> Arraste o marcador ou clique no mapa para posicionar exatamente sobre o telhado da edificação.
      </p>
    </div>
  );
}
