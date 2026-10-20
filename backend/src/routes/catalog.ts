import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  estimateCatalogMaterialPrice,
  MEMORIAL_WEG_CATALOG,
  NBR_SECTIONS_CATALOG,
  WEG_COMPONENTS_CATALOG,
} from "../lib/catalogs.js";

export const registerCatalogRoutes = async (app: FastifyInstance) => {
  app.get("/api/catalog/components", async () => ({
    items: WEG_COMPONENTS_CATALOG,
  }));

  app.get("/api/catalog/nbr-sections", async () => ({
    items: NBR_SECTIONS_CATALOG,
  }));

  app.get("/api/catalog/memorial-materials", async () => ({
    items: MEMORIAL_WEG_CATALOG,
  }));

  app.get("/api/catalog/material-price", async (request) => {
    const query = z.object({
      name: z.string().trim().min(1),
    }).parse(request.query);

    return {
      name: query.name,
      unit_price: estimateCatalogMaterialPrice(query.name),
      source: "catalog",
    };
  });
};
