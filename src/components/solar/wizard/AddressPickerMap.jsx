import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Geocodificação via Nominatim (OpenStreetMap) — serviço público e gratuito, sem
// chave de API, sujeito a limite de uso (~1 req/s) e à política da OSM Foundation.
// Dependência documentada: para volumes maiores/maior precisão, trocar por um
// provedor comercial (Google Places, Mapbox) exige uma chave de API paga.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Nominatim normalmente devolve o nome completo do estado (ex: "São Paulo"),
// não a sigla. Mapeamento usado como fallback quando "state_code" não vem na resposta.
const STATE_NAME_TO_UF = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

function resolveUf(address) {
  if (address.state_code) return address.state_code.toUpperCase();
  const normalized = String(address.state || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return STATE_NAME_TO_UF[normalized] || "";
}

const pinIcon = L.divIcon({
  className: "address-picker-pin",
  html: `<div style="width:26px;height:26px;transform:translate(-13px,-24px);">
    <svg viewBox="0 0 24 24" width="26" height="26" fill="#06296c" stroke="white" stroke-width="1">
      <path d="M12 0c-4.4 0-8 3.6-8 8 0 5.7 8 16 8 16s8-10.3 8-16c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/>
    </svg>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 24],
});

function MapCenterController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true, duration: 0.6 });
  }, [center.lat, center.lng, map, zoom]);
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function ClickToPlace({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export default function AddressPickerMap({ lat, lng, onPositionChange, onAddressSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (text) => {
    if (!text || text.trim().length < 4) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const url = `${NOMINATIM_URL}?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(text)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Falha na busca de endereço.");
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchError("Não foi possível buscar o endereço agora. Tente novamente ou posicione manualmente no mapa.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value) => {
    setQuery(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(value), 600);
  };

  useEffect(() => () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
  }, []);

  const handleSelectResult = (result) => {
    const nextLat = Number(result.lat);
    const nextLng = Number(result.lon);
    const addr = result.address || {};
    onAddressSelect?.({
      lat: nextLat,
      lng: nextLng,
      address: [addr.road, ].filter(Boolean).join(" ") || result.display_name,
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
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Buscar endereço (rua, número, cidade)..."
          className="h-11 pl-9"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {results.length > 0 && (
          <div className="absolute z-[600] mt-1 w-full overflow-hidden rounded-lg border border-border bg-white shadow-lg">
            {results.map((result) => (
              <button
                key={`${result.place_id}`}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="leading-4">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {searchError && <p className="text-xs font-semibold text-amber-700">{searchError}</p>}

      <div className="h-[220px] overflow-hidden rounded-lg border border-border">
        <MapContainer center={[lat, lng]} zoom={16} className="h-full w-full" attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <MapCenterController center={{ lat, lng }} />
          <ClickToPlace onPick={onPositionChange} />
          <Marker
            position={[lat, lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const position = event.target.getLatLng();
                onPositionChange?.({ lat: position.lat, lng: position.lng });
              },
            }}
          />
        </MapContainer>
      </div>
      <p className="text-[11px] font-semibold text-muted-foreground">
        Arraste o marcador ou clique no mapa para corrigir a posição exata do imóvel. Busca via OpenStreetMap (Nominatim).
      </p>
    </div>
  );
}
