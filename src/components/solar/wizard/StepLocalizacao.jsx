import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Search } from "lucide-react";
import { cleanDigits, maskCep } from "@/lib/brFormatters";
import { fetchAddressByCep } from "@/lib/cepService";
import AddressPickerMap from "./AddressPickerMap";

const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

export default function StepLocalizacao({ state, onChange }) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const setField = (field, value) => onChange({ [field]: value });
  const lastQueriedCepRef = useRef("");

  // Geocodificação de endereço para centralizar mapa
  const geocodeAddress = async (fullAddress) => {
    if (!fullAddress || fullAddress.trim().length < 5) return;
    try {
      const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(fullAddress)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = Number(data[0].lat);
          const lng = Number(data[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            onChange({ map_center_lat: lat, map_center_lng: lng, location_confirmed: true });
          }
        }
      }
    } catch {
      // Geocodificação opcional
    }
  };

  const handleCepChange = async (rawValue) => {
    const masked = maskCep(rawValue);
    setField("zip_code", masked);
    setCepMessage("");

    const digits = cleanDigits(masked);
    if (digits.length === 8 && digits !== lastQueriedCepRef.current) {
      lastQueriedCepRef.current = digits;
      setLoadingCep(true);
      const result = await fetchAddressByCep(digits);
      setLoadingCep(false);

      if (result.success && result.data) {
        const d = result.data;
        const updatedAddress = d.address || state.address;
        const updatedCity = d.city || state.city;
        const updatedState = d.state || state.state;
        const updatedNeighborhood = d.neighborhood || state.neighborhood;

        onChange({
          zip_code: d.zip_code,
          address: updatedAddress,
          neighborhood: updatedNeighborhood,
          city: updatedCity,
          state: updatedState,
          complement: d.complement || state.complement,
        });

        // Dispara geocodificação para atualizar mapa
        const searchStr = [updatedAddress, updatedNeighborhood, updatedCity, updatedState, "Brasil"].filter(Boolean).join(", ");
        geocodeAddress(searchStr);
      } else if (!result.aborted) {
        setCepMessage(result.error || "CEP não encontrado. Preencha o endereço manualmente.");
      }
    }
  };

  const handleAddressSelect = (payload) => {
    onChange({
      address: payload.address || state.address,
      number: payload.number || state.number,
      neighborhood: payload.neighborhood || state.neighborhood,
      city: payload.city || state.city,
      state: (payload.state || state.state || "").toString().slice(0, 2).toUpperCase(),
      zip_code: maskCep(payload.zip_code || state.zip_code),
      map_center_lat: payload.lat,
      map_center_lng: payload.lng,
      location_confirmed: true,
    });
  };

  const handlePositionChange = ({ lat, lng }) => {
    onChange({ map_center_lat: lat, map_center_lng: lng, location_confirmed: true });
  };

  return (
    <div className="space-y-5">
      {/* 1. Mapa Interativo com Satélite */}
      <div className="space-y-1.5">
        <Label className="text-xs font-black text-foreground">Localização do imóvel no mapa</Label>
        <AddressPickerMap
          lat={state.map_center_lat}
          lng={state.map_center_lng}
          onPositionChange={handlePositionChange}
          onAddressSelect={handleAddressSelect}
        />
      </div>

      {/* 2. Formulário Estruturado de Endereço com CEP Automático */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr_100px]">
          {/* CEP com máscara e auto-busca */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground flex items-center justify-between">
              CEP {loadingCep && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            <div className="relative">
              <Input
                placeholder="00000-000"
                maxLength={9}
                value={state.zip_code}
                onChange={(e) => handleCepChange(e.target.value)}
                className="h-11 font-medium tracking-wide pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">
              Endereço / Logradouro <span className="text-primary">*</span>
            </Label>
            <Input
              placeholder="Ex: Av. Paulista, Rua das Flores"
              value={state.address}
              onChange={(e) => setField("address", e.target.value)}
              className="h-11 font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Número</Label>
            <Input
              placeholder="123"
              value={state.number}
              onChange={(e) => setField("number", e.target.value)}
              className="h-11 font-medium"
            />
          </div>
        </div>

        {cepMessage && (
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
            {cepMessage}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Complemento</Label>
            <Input
              placeholder="Ex: Bloco B, Apto 42, Galpão 3"
              value={state.complement}
              onChange={(e) => setField("complement", e.target.value)}
              className="h-11 font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Bairro</Label>
            <Input
              placeholder="Ex: Centro, Pinheiros"
              value={state.neighborhood}
              onChange={(e) => setField("neighborhood", e.target.value)}
              className="h-11 font-medium"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">
              Cidade <span className="text-primary">*</span>
            </Label>
            <Input
              placeholder="Ex: São Paulo, Campinas"
              value={state.city}
              onChange={(e) => setField("city", e.target.value)}
              className="h-11 font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">
              Estado (UF) <span className="text-primary">*</span>
            </Label>
            <Select value={state.state} onValueChange={(v) => setField("state", v)}>
              <SelectTrigger className="h-11 font-medium"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {BR_STATES.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
