import { z } from "zod";

export const DEFAULT_BRANDING = {
  brandingVersion: "weg-blue-2026-06-01",
  appName: "WEG",
  appSuffix: "",
  primaryColor: "#0064A6",
  primaryForeground: "#ffffff",
  secondaryColor: "#E6F2FA",
  accentColor: "#F4F9FD",
  borderColor: "#B7D7EA",
  logoIconColor: "#0064A6",
  logoBackgroundColor: "#ffffff",
  authLogoIconColor: "#0064A6",
  authLogoBackgroundColor: "#ffffff",
  logoDataUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Weg_logo_blue_vector.svg",
  compactLogoDataUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Weg_logo_blue_vector.svg",
  authLogoDataUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Weg_logo_blue_vector.svg",
};

export const brandingSchema = z.object({
  brandingVersion: z.string().min(1),
  appName: z.string().trim().min(1),
  appSuffix: z.string().trim(),
  primaryColor: z.string().trim().min(1),
  primaryForeground: z.string().trim().min(1),
  secondaryColor: z.string().trim().min(1),
  accentColor: z.string().trim().min(1),
  borderColor: z.string().trim().min(1),
  logoIconColor: z.string().trim().min(1),
  logoBackgroundColor: z.string().trim().min(1),
  authLogoIconColor: z.string().trim().min(1),
  authLogoBackgroundColor: z.string().trim().min(1),
  logoDataUrl: z.string().trim(),
  compactLogoDataUrl: z.string().trim(),
  authLogoDataUrl: z.string().trim(),
}).strict();

export const normalizeBranding = (value: unknown) => {
  const parsed = brandingSchema.safeParse(value);

  if (!parsed.success) {
    return DEFAULT_BRANDING;
  }

  return {
    ...DEFAULT_BRANDING,
    ...parsed.data,
  };
};
