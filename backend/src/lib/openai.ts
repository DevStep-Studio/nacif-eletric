import OpenAI from "openai";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

type InvokePayload = {
  prompt: string;
  file_urls?: string[];
  response_json_schema?: Record<string, unknown>;
};

const normalizeJsonSchema = (value: unknown): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const schema = { ...(value as Record<string, unknown>) };

  if (schema.type === "object") {
    const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? Object.fromEntries(
          Object.entries(schema.properties as Record<string, unknown>).map(([key, childValue]) => [
            key,
            normalizeJsonSchema(childValue),
          ]),
        )
      : undefined;
    const required = properties ? Object.keys(properties) : [];

    return {
      ...schema,
      properties,
      required,
      additionalProperties: false,
    };
  }

  if (schema.type === "array" && schema.items) {
    return {
      ...schema,
      items: normalizeJsonSchema(schema.items),
    };
  }

  if (schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)) {
    return {
      ...schema,
      properties: Object.fromEntries(
        Object.entries(schema.properties as Record<string, unknown>).map(([key, childValue]) => [
          key,
          normalizeJsonSchema(childValue),
        ]),
      ),
    };
  }

  return schema;
};

const buildInput = (payload: InvokePayload) => {
  const parts = [
    {
      type: "input_text",
      text: payload.prompt,
    },
  ] as Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }>;

  for (const url of payload.file_urls ?? []) {
    parts.push({
      type: "input_image",
      image_url: url,
    });
  }

  return [
    {
      role: "user" as const,
      content: parts,
    },
  ] as const;
};

export const invokeAI = async (payload: InvokePayload) => {
  if (!client) {
    throw new AppError("OPENAI_API_KEY não configurada no backend.", 501);
  }

  try {
    const baseRequest = {
      model: env.OPENAI_MODEL,
      input: buildInput(payload),
    };

    if (payload.response_json_schema) {
      const response = await client.responses.create({
        ...baseRequest,
        text: {
          format: {
            type: "json_schema",
            name: "volta_ia_response",
            schema: normalizeJsonSchema(payload.response_json_schema),
          },
        },
      } as any);

      const content = response.output_text?.trim();
      if (!content) {
        throw new AppError("A IA não retornou conteúdo.", 502);
      }

      return JSON.parse(content);
    }

    const response = await client.responses.create(baseRequest as any);
    return response.output_text?.trim() ?? "";
  } catch (error) {
    const apiError = error as { status?: number; message?: string };

    if (apiError?.status === 429) {
      throw new AppError("A cota da OpenAI foi excedida. Verifique faturamento, limites e saldo da chave configurada.", 429);
    }

    if (apiError?.status === 401) {
      throw new AppError("A chave da OpenAI configurada no backend é inválida ou expirou.", 401);
    }

    if (apiError?.status === 403) {
      throw new AppError("A chave da OpenAI não tem permissão para usar este recurso.", 403);
    }

    throw error;
  }
};
