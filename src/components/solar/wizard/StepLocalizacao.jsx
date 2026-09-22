import { useEffect, useRef, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Search, Zap, CheckCircle2, Info } from "lucide-react";
import { cleanDigits, maskCep } from "@/lib/brFormatters";
import { fetchAddressByCep } from "@/lib/cepService";
import { identifyDistributorByLocation } from "@/lib/solarDistributorRates";
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

  // Identificação automática da distribuidora e tarifa pela localização atual
  const locationConcessionInfo = useMemo(() => {
    return identifyDistributorByLocation({
      state: state.state,
      city: state.city,
      zip_code: state.zip_code,
      address: state.address,
    });
  }, [state.state, state.city, state.zip_code, state.address]);

  // Aplica automaticamente a distribuidora e tarifa sugerida se ainda não preenchidas
  useEffect(() => {
    if (locationConcessionInfo?.distributor) {
      const updates = {};
      if (!state.distributor || state.distributor.trim() === "") {
        updates.distributor = locationConcessionInfo.distributor;
      }
      if ((!state.tariff_brl_kwh || state.tariff_brl_kwh === "") && locationConcessionInfo.referenceTariffBrlKwh) {
        updates.tariff_brl_kwh = locationConcessionInfo.referenceTariffBrlKwh;
      }
      if (Object.keys(updates).length > 0) {
        onChange(updates);
      }
    }
  }, [locationConcessionInfo, state.distributor, state.tariff_brl_kwh]);

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

        // Auto identifica concessionária
        const concession = identifyDistributorByLocation({
          state: updatedState,
          city: updatedCity,
          zip_code: d.zip_code,
          address: updatedAddress,
        });

        const patch = {
          zip_code: d.zip_code,
          address: updatedAddress,
          neighborhood: updatedNeighborhood,
          city: updatedCity,
          state: updatedState,
          complement: d.complement || state.complement,
        };

        if (concession?.distributor && (!state.distributor || state.distributor.trim() === "")) {
          patch.distributor = concession.distributor;
        }
        if (concession?.referenceTariffBrlKwh && (!state.tariff_brl_kwh || state.tariff_brl_kwh === "")) {
          patch.tariff_brl_kwh = concession.referenceTariffBrlKwh;
        }

        onChange(patch);

        // Dispara geocodificação para atualizar mapa
        const searchStr = [updatedAddress, updatedNeighborhood, updatedCity, updatedState, "Brasil"].filter(Boolean).join(", ");
        geocodeAddress(searchStr);
      } else if (!result.aborted) {
        setCepMessage(result.error || "CEP não encontrado. Preencha o endereço manualmente.");
      }
    }
  };

  const handleAddressSelect = (payload) => {
    const nextState = (payload.state || state.state || "").toString().slice(0, 2).toUpperCase();
    const nextCity = payload.city || state.city;
    const nextZip = maskCep(payload.zip_code || state.zip_code);
    const nextAddress = payload.address || state.address;

    const concession = identifyDistributorByLocation({
      state: nextState,
      city: nextCity,
      zip_code: nextZip,
      address: nextAddress,
    });

    const patch = {
      address: nextAddress,
      number: payload.number || state.number,
      neighborhood: payload.neighborhood || state.neighborhood,
      city: nextCity,
      state: nextState,
      zip_code: nextZip,
      map_center_lat: payload.lat,
      map_center_lng: payload.lng,
      location_confirmed: true,
    };

    if (concession?.distributor && (!state.distributor || state.distributor.trim() === "")) {
      patch.distributor = concession.distributor;
    }
    if (concession?.referenceTariffBrlKwh && (!state.tariff_brl_kwh || state.tariff_brl_kwh === "")) {
      patch.tariff_brl_kwh = concession.referenceTariffBrlKwh;
    }

    onChange(patch);
  };

  const handlePositionChange = ({ lat, lng }) => {
    onChange({ map_center_lat: lat, map_center_lng: lng, location_confirmed: true });
  };

  return (
    <div className="space-y-5">
      {/* 1. Mapa Interativo com Satélite */}
      <div className="space-y-1.5">
        <Label className="text-xs font-black text-slate-800">Localização do imóvel no mapa</Label>
        <AddressPickerMap
          lat={state.map_center_lat}
          lng={state.map_center_lng}
          onPositionChange={handlePositionChange}
          onAddressSelect={handleAddressSelect}
        />
      </div>

      {/* 2. Formulário Estruturado de Endereço com CEP Automático */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#00d8b8]" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Endereço da Instalação
            </span>
          </div>
          {loadingCep && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00d8b8]" />
              Consultando CEP...
            </span>
          )}
        </div>

        {/* Linha 1: CEP (3 col), Logradouro (6 col), Número (3 col) */}
        <div className="grid gap-3.5 sm:grid-cols-12">
          {/* CEP com máscara e auto-busca */}
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs font-bold text-slate-700">
              CEP
            </Label>
            <div className="relative">
              <Input
                placeholder="00000-000"
                maxLength={9}
                value={state.zip_code}
                onChange={(e) => handleCepChange(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white pr-9 text-sm font-semibold tracking-wide text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Endereço / Logradouro */}
          <div className="space-y-1.5 sm:col-span-6">
            <Label className="text-xs font-bold text-slate-700">
              Endereço / Logradouro <span className="text-[#00d8b8] font-bold">*</span>
            </Label>
            <Input
              placeholder="Ex: Rua Hernani, Av. Paulista"
              value={state.address}
              onChange={(e) => setField("address", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>

          {/* Número */}
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs font-bold text-slate-700">Número</Label>
            <Input
              placeholder="Ex: 1046"
              value={state.number}
              onChange={(e) => setField("number", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>
        </div>

        {cepMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            {cepMessage}
          </div>
        )}

        {/* Linha 2: Complemento (3 col), Bairro (3 col), Cidade (4 col), UF (2 col) */}
        <div className="grid gap-3.5 sm:grid-cols-12">
          {/* Complemento */}
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs font-bold text-slate-700">Complemento</Label>
            <Input
              placeholder="Ex: Condomínio, Apto 42"
              value={state.complement}
              onChange={(e) => setField("complement", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>

          {/* Bairro */}
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs font-bold text-slate-700">Bairro</Label>
            <Input
              placeholder="Ex: Centro, Jardins"
              value={state.neighborhood}
              onChange={(e) => setField("neighborhood", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>

          {/* Cidade */}
          <div className="space-y-1.5 sm:col-span-4">
            <Label className="text-xs font-bold text-slate-700">
              Cidade <span className="text-[#00d8b8] font-bold">*</span>
            </Label>
            <Input
              placeholder="Ex: São Paulo, Campinas"
              value={state.city}
              onChange={(e) => setField("city", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>

          {/* Estado (UF) */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-bold text-slate-700">
              Estado (UF) <span className="text-[#00d8b8] font-bold">*</span>
            </Label>
            <Select value={state.state} onValueChange={(v) => setField("state", v)}>
              <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {BR_STATES.map((uf) => (
                  <SelectItem key={uf} value={uf} className="font-semibold">
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 3. Card Inteligente de Concessionária e Tarifa Identificadas */}
        {locationConcessionInfo && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#00d8b8]/30 bg-[#00d8b8]/[0.04] p-3.5 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00d8b8]/15 text-[#00d8b8]">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="font-black text-slate-900">
                  Distribuidora Identificada: <span className="text-[#00d8b8]">{locationConcessionInfo.distributor}</span>
                </p>
                <p className="text-[11px] font-medium text-slate-600">
                  {locationConcessionInfo.notes}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Auto-preenchimento ativo na etapa de Consumo
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
