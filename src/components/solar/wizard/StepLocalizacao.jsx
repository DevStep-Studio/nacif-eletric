import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddressPickerMap from "./AddressPickerMap";

const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export default function StepLocalizacao({ state, onChange }) {
  const setField = (field, value) => onChange({ [field]: value });

  const handleAddressSelect = (payload) => {
    onChange({
      address: payload.address || state.address,
      number: payload.number || state.number,
      neighborhood: payload.neighborhood || state.neighborhood,
      city: payload.city || state.city,
      state: (payload.state || state.state || "").toString().slice(0, 2).toUpperCase(),
      zip_code: payload.zip_code || state.zip_code,
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
      <AddressPickerMap
        lat={state.map_center_lat}
        lng={state.map_center_lng}
        onPositionChange={handlePositionChange}
        onAddressSelect={handleAddressSelect}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
        <div className="space-y-1.5">
          <Label>Endereço *</Label>
          <Input value={state.address} onChange={(e) => setField("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Número</Label>
          <Input value={state.number} onChange={(e) => setField("number", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>CEP</Label>
          <Input value={state.zip_code} onChange={(e) => setField("zip_code", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Complemento</Label>
          <Input value={state.complement} onChange={(e) => setField("complement", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Bairro</Label>
          <Input value={state.neighborhood} onChange={(e) => setField("neighborhood", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <div className="space-y-1.5">
          <Label>Cidade *</Label>
          <Input value={state.city} onChange={(e) => setField("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Estado (UF) *</Label>
          <Select value={state.state} onValueChange={(v) => setField("state", v)}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              {BR_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[11px] font-semibold text-muted-foreground">
        Coordenadas atuais: {state.map_center_lat.toFixed(6)}, {state.map_center_lng.toFixed(6)}
        {state.location_confirmed ? " · posição confirmada no mapa" : " · posição padrão, ajuste no mapa"}
      </p>
    </div>
  );
}
