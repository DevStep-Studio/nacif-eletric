const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const BRASIL_API_CEP_URL = "https://brasilapi.com.br/api/cep/v2";

const toFiniteCoords = (lat, lng) => {
  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) return null;
  if (latNumber === 0 && lngNumber === 0) return null;
  return { lat: latNumber, lng: lngNumber };
};

async function queryNominatim(params) {
  const search = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "br",
    ...params,
  });

  const response = await fetch(`${NOMINATIM_URL}?${search.toString()}`);
  if (!response.ok) return null;

  const results = await response.json();
  const [first] = Array.isArray(results) ? results : [];
  if (!first) return null;

  return toFiniteCoords(first.lat, first.lon);
}

async function geocodeByCepCentroid(zipCode) {
  const digits = String(zipCode || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const response = await fetch(`${BRASIL_API_CEP_URL}/${digits}`);
    if (!response.ok) return null;
    const data = await response.json();
    return toFiniteCoords(data?.location?.coordinates?.latitude, data?.location?.coordinates?.longitude);
  } catch {
    return null;
  }
}

/**
 * Resolves a Brazilian street address to lat/lng, from most to least precise:
 * exact street+number -> street only -> CEP centroid. Uses only free,
 * keyless services (Nominatim/OpenStreetMap and BrasilAPI) so it works
 * without any Google Maps billing account configured.
 */
export async function geocodeBrazilianAddress({ street, number, city, state, zipCode } = {}) {
  const cleanStreet = String(street || "").trim();
  const cleanNumber = String(number || "").trim();
  const cleanCity = String(city || "").trim();
  const cleanState = String(state || "").trim();
  const cleanZip = String(zipCode || "").replace(/\D/g, "");

  try {
    if (cleanStreet && cleanNumber && cleanCity) {
      const precise = await queryNominatim({
        street: `${cleanStreet} ${cleanNumber}`,
        city: cleanCity,
        state: cleanState,
        postalcode: cleanZip,
      });
      if (precise) return precise;
    }

    if (cleanStreet && cleanCity) {
      const streetLevel = await queryNominatim({
        street: cleanStreet,
        city: cleanCity,
        state: cleanState,
        postalcode: cleanZip,
      });
      if (streetLevel) return streetLevel;
    }
  } catch {
    // Falls through to the CEP centroid below.
  }

  return geocodeByCepCentroid(cleanZip);
}
