import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type MenuResponse = {
  ingredientes_detectados: string[];
  menu: {
    entrante: string;
    principal: string;
    postre: string;
  };
  pasos: string[];
  lista_compra: string[];
  alergenos: string[];
  tiempo_estimado_min: number;
};

const MOCK_MENU: MenuResponse = {
  ingredientes_detectados: [
    "huevos",
    "leche",
    "yogur natural",
    "pimientos",
    "calabacín",
    "tomates",
    "queso",
    "pan",
    "limón",
  ],
  menu: {
    entrante: "Tostadas crujientes con tomate y aceite de oliva",
    principal: "Tortilla de verduras con queso fundido",
    postre: "Yogur con ralladura de limón y miel",
  },
  pasos: [
    "Lava y corta los pimientos, el calabacín y el tomate en dados pequeños.",
    "Saltea las verduras con aceite hasta que estén tiernas y añade sal.",
    "Bate los huevos con un chorrito de leche y mezcla con las verduras.",
    "Cuaja la tortilla en una sartén y añade queso al final para que funda.",
    "Tuesta el pan, frota con tomate y añade un hilo de aceite.",
    "Sirve el yogur con miel y ralladura de limón para el postre.",
  ],
  lista_compra: ["aceite de oliva", "miel"],
  alergenos: ["huevo", "lácteos", "gluten"],
  tiempo_estimado_min: 35,
};

const MODEL = "gpt-4o-mini";
const USE_MOCK = (process.env.USE_MOCK ?? "false").toLowerCase() === "true";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const basePrompt = `
Eres un asistente culinario para una demo en directo. Analiza la imagen de una nevera y devuelve SOLO un JSON válido con este esquema exacto:
{
  "ingredientes_detectados": string[],
  "menu": {
    "entrante": string,
    "principal": string,
    "postre": string
  },
  "pasos": string[],
  "lista_compra": string[],
  "alergenos": string[],
  "tiempo_estimado_min": number
}

Reglas:
1) Identifica ingredientes visibles y deduce SOLO si es bastante claro.
2) Propón un menú realista priorizando lo que hay.
3) Si falta algo esencial, añádelo a lista_compra (poca cosa).
4) Pasos sencillos y tiempos aproximados.
5) Incluye alérgenos típicos si aparecen (huevo, lácteos, gluten, frutos secos, pescado/marisco).
6) Devuelve solo JSON, sin texto adicional ni markdown.
`.trim();

const buildPrompt = (forceJsonOnly: boolean) =>
  forceJsonOnly
    ? `${basePrompt}\n\nIMPORTANTE: responde SOLO con JSON válido, sin comillas triples, sin explicaciones.`
    : basePrompt;

const toStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;

const normalizeMenuResponse = (value: unknown): MenuResponse | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;

  const ingredientes = toStringArray(data.ingredientes_detectados);
  const pasos = toStringArray(data.pasos);
  const compra = toStringArray(data.lista_compra);
  const alergenos = toStringArray(data.alergenos);
  const tiempo = Number(data.tiempo_estimado_min);

  const menu = data.menu as Record<string, unknown> | undefined;
  const entrante = menu?.entrante;
  const principal = menu?.principal;
  const postre = menu?.postre;

  if (
    !ingredientes ||
    !pasos ||
    !compra ||
    !alergenos ||
    !Number.isFinite(tiempo) ||
    typeof entrante !== "string" ||
    typeof principal !== "string" ||
    typeof postre !== "string"
  ) {
    return null;
  }

  return {
    ingredientes_detectados: ingredientes,
    menu: {
      entrante,
      principal,
      postre,
    },
    pasos,
    lista_compra: compra,
    alergenos,
    tiempo_estimado_min: Math.max(0, Math.round(tiempo)),
  };
};

const extractJson = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const withoutFence = trimmed
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  const candidate = withoutFence.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

const fileToDataUrl = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
};

const callOpenAI = async (dataUrl: string, forceJsonOnly: boolean) => {
  const response = await openai.responses.create({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: buildPrompt(forceJsonOnly) },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
    temperature: 0.2,
    max_output_tokens: 650,
  });

  return response.output_text ?? "";
};

const jsonResponse = (data: MenuResponse, usedMock: boolean) => {
  const response = NextResponse.json(data);
  response.headers.set("x-used-mock", usedMock ? "true" : "false");
  return response;
};

export async function POST(request: Request) {
  if (USE_MOCK) {
    console.log("[menu] USE_MOCK=true: devolviendo mock.");
    return jsonResponse(MOCK_MENU, true);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[menu] OPENAI_API_KEY no configurada. Usando mock.");
    return jsonResponse(MOCK_MENU, true);
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const entry = formData.get("image");
    file = entry instanceof File ? entry : null;
  } catch (error) {
    console.error("[menu] Error leyendo formData:", error);
  }

  if (!file) {
    return NextResponse.json(
      { error: "Falta la imagen en la solicitud." },
      { status: 400 }
    );
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    console.log("[menu] Enviando imagen al modelo.");

    let outputText = await callOpenAI(dataUrl, false);
    let parsed = normalizeMenuResponse(extractJson(outputText));

    if (!parsed) {
      console.warn("[menu] JSON inválido. Reintentando una vez.");
      outputText = await callOpenAI(dataUrl, true);
      parsed = normalizeMenuResponse(extractJson(outputText));
    }

    if (!parsed) {
      console.error("[menu] No se pudo parsear JSON. Usando mock.");
      return jsonResponse(MOCK_MENU, true);
    }

    return jsonResponse(parsed, false);
  } catch (error) {
    console.error("[menu] Error en OpenAI:", error);
    return jsonResponse(MOCK_MENU, true);
  }
}
