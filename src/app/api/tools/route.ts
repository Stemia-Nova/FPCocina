import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// ============ TIPOS ============

type ToolMode = "menu" | "shopping" | "inspiration";

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

type ShoppingResponse = {
  ingredientes_detectados: string[];
  plato_solicitado: string;
  ingredientes_necesarios: string[];
  tienes: string[];
  te_falta: string[];
  sugerencias_sustitucion: string[];
};

type InspirationResponse = {
  categoria: string;
  propuestas: {
    nombre: string;
    descripcion: string;
    dificultad: "fácil" | "media" | "difícil";
    tiempo_min: number;
  }[];
  consejo_chef: string;
};

type ToolResponse = MenuResponse | ShoppingResponse | InspirationResponse;

// ============ MOCKS ============

const MOCK_MENU: MenuResponse = {
  ingredientes_detectados: [
    "huevos", "leche", "yogur natural", "pimientos",
    "calabacín", "tomates", "queso", "pan", "limón",
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

const MOCK_SHOPPING: ShoppingResponse = {
  ingredientes_detectados: ["huevos", "leche", "tomates", "queso", "pan"],
  plato_solicitado: "Pasta carbonara",
  ingredientes_necesarios: ["pasta", "huevos", "queso parmesano", "panceta", "pimienta negra", "sal"],
  tienes: ["huevos", "queso"],
  te_falta: ["pasta", "panceta", "pimienta negra"],
  sugerencias_sustitucion: [
    "Puedes usar bacon en lugar de panceta",
    "El queso curado puede sustituir al parmesano",
  ],
};

const MOCK_INSPIRATION: InspirationResponse = {
  categoria: "Pescado",
  propuestas: [
    {
      nombre: "Lubina a la sal",
      descripcion: "Pescado entero cocinado en costra de sal, jugoso y aromático",
      dificultad: "media",
      tiempo_min: 45,
    },
    {
      nombre: "Ceviche de corvina",
      descripcion: "Pescado marinado en cítricos con cebolla morada y cilantro",
      dificultad: "fácil",
      tiempo_min: 25,
    },
    {
      nombre: "Bacalao al pil-pil",
      descripcion: "Clásico vasco con emulsión de aceite y ajo",
      dificultad: "difícil",
      tiempo_min: 40,
    },
  ],
  consejo_chef: "Para el pescado, la frescura es clave. Busca ojos brillantes y agallas rojas.",
};

// ============ CONFIG ============

const MODEL = "gpt-4o-mini";
const USE_MOCK = (process.env.USE_MOCK ?? "false").toLowerCase() === "true";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============ PROMPTS ============

const PROMPTS = {
  menu: `
Eres un asistente culinario para estudiantes de FP de Cocina. Analiza la imagen de una nevera y devuelve SOLO un JSON válido con este esquema exacto:
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
`.trim(),

  shopping: (dish: string) => `
Eres un asistente culinario para estudiantes de FP de Cocina. El usuario quiere preparar: "${dish}".
Analiza la imagen de su nevera y devuelve SOLO un JSON válido con este esquema:
{
  "ingredientes_detectados": string[],
  "plato_solicitado": string,
  "ingredientes_necesarios": string[],
  "tienes": string[],
  "te_falta": string[],
  "sugerencias_sustitucion": string[]
}

Reglas:
1) Detecta los ingredientes visibles en la nevera.
2) Lista todos los ingredientes necesarios para el plato.
3) Compara y separa lo que tiene de lo que le falta.
4) Sugiere sustituciones con lo que ya tiene si es posible.
5) Devuelve solo JSON, sin texto adicional ni markdown.
`.trim(),

  inspiration: (category: string) => `
Eres un chef instructor de FP de Cocina. El usuario quiere inspiración para cocinar: "${category}".
Devuelve SOLO un JSON válido con este esquema:
{
  "categoria": string,
  "propuestas": [
    {
      "nombre": string,
      "descripcion": string,
      "dificultad": "fácil" | "media" | "difícil",
      "tiempo_min": number
    }
  ],
  "consejo_chef": string
}

Reglas:
1) Propón exactamente 4 platos variados de esa categoría.
2) Incluye opciones de diferentes dificultades.
3) Las descripciones deben ser atractivas y profesionales.
4) El consejo debe ser útil para un estudiante de cocina.
5) Devuelve solo JSON, sin texto adicional ni markdown.
`.trim(),
};

// ============ UTILIDADES ============

const toStringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;

const extractJson = (text: string): unknown => {
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

const fileToDataUrl = async (file: File): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
};

// ============ NORMALIZADORES ============

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
    menu: { entrante, principal, postre },
    pasos,
    lista_compra: compra,
    alergenos,
    tiempo_estimado_min: Math.max(0, Math.round(tiempo)),
  };
};

const normalizeShoppingResponse = (value: unknown): ShoppingResponse | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;

  const ingredientes = toStringArray(data.ingredientes_detectados);
  const necesarios = toStringArray(data.ingredientes_necesarios);
  const tienes = toStringArray(data.tienes);
  const falta = toStringArray(data.te_falta);
  const sustituciones = toStringArray(data.sugerencias_sustitucion);
  const plato = data.plato_solicitado;

  if (
    !ingredientes ||
    !necesarios ||
    !tienes ||
    !falta ||
    !sustituciones ||
    typeof plato !== "string"
  ) {
    return null;
  }

  return {
    ingredientes_detectados: ingredientes,
    plato_solicitado: plato,
    ingredientes_necesarios: necesarios,
    tienes,
    te_falta: falta,
    sugerencias_sustitucion: sustituciones,
  };
};

const normalizeInspirationResponse = (value: unknown): InspirationResponse | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;

  const categoria = data.categoria;
  const consejo = data.consejo_chef;
  const propuestas = data.propuestas;

  if (
    typeof categoria !== "string" ||
    typeof consejo !== "string" ||
    !Array.isArray(propuestas)
  ) {
    return null;
  }

  const normalizedPropuestas = propuestas.map((p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const prop = p as Record<string, unknown>;
    if (
      typeof prop.nombre !== "string" ||
      typeof prop.descripcion !== "string" ||
      !["fácil", "media", "difícil"].includes(prop.dificultad as string) ||
      typeof prop.tiempo_min !== "number"
    ) {
      return null;
    }
    return {
      nombre: prop.nombre,
      descripcion: prop.descripcion,
      dificultad: prop.dificultad as "fácil" | "media" | "difícil",
      tiempo_min: prop.tiempo_min,
    };
  });

  if (normalizedPropuestas.some((p) => p === null)) return null;

  return {
    categoria,
    propuestas: normalizedPropuestas as InspirationResponse["propuestas"],
    consejo_chef: consejo,
  };
};

// ============ LLAMADAS A OPENAI ============

const callOpenAIWithImage = async (
  prompt: string,
  dataUrl: string
): Promise<string> => {
  const response = await openai.responses.create({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl, detail: "auto" },
        ],
      },
    ],
    temperature: 0.2,
    max_output_tokens: 800,
  });

  return response.output_text ?? "";
};

const callOpenAITextOnly = async (prompt: string): Promise<string> => {
  const response = await openai.responses.create({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    temperature: 0.7,
    max_output_tokens: 800,
  });

  return response.output_text ?? "";
};

// ============ HANDLERS ============

const handleMenu = async (file: File): Promise<{ data: MenuResponse; mock: boolean }> => {
  if (USE_MOCK || !process.env.OPENAI_API_KEY) {
    return { data: MOCK_MENU, mock: true };
  }

  const dataUrl = await fileToDataUrl(file);
  console.log("[tools/menu] Enviando imagen al modelo.");

  let outputText = await callOpenAIWithImage(PROMPTS.menu, dataUrl);
  let parsed = normalizeMenuResponse(extractJson(outputText));

  if (!parsed) {
    console.warn("[tools/menu] JSON inválido. Reintentando.");
    const retryPrompt = PROMPTS.menu + "\n\nIMPORTANTE: responde SOLO con JSON válido.";
    outputText = await callOpenAIWithImage(retryPrompt, dataUrl);
    parsed = normalizeMenuResponse(extractJson(outputText));
  }

  if (!parsed) {
    console.error("[tools/menu] No se pudo parsear JSON. Usando mock.");
    return { data: MOCK_MENU, mock: true };
  }

  return { data: parsed, mock: false };
};

const handleShopping = async (
  file: File,
  dish: string
): Promise<{ data: ShoppingResponse; mock: boolean }> => {
  if (USE_MOCK || !process.env.OPENAI_API_KEY) {
    return { data: { ...MOCK_SHOPPING, plato_solicitado: dish }, mock: true };
  }

  const dataUrl = await fileToDataUrl(file);
  console.log("[tools/shopping] Enviando imagen al modelo.");

  const prompt = PROMPTS.shopping(dish);
  let outputText = await callOpenAIWithImage(prompt, dataUrl);
  let parsed = normalizeShoppingResponse(extractJson(outputText));

  if (!parsed) {
    console.warn("[tools/shopping] JSON inválido. Reintentando.");
    const retryPrompt = prompt + "\n\nIMPORTANTE: responde SOLO con JSON válido.";
    outputText = await callOpenAIWithImage(retryPrompt, dataUrl);
    parsed = normalizeShoppingResponse(extractJson(outputText));
  }

  if (!parsed) {
    console.error("[tools/shopping] No se pudo parsear JSON. Usando mock.");
    return { data: { ...MOCK_SHOPPING, plato_solicitado: dish }, mock: true };
  }

  return { data: parsed, mock: false };
};

const handleInspiration = async (
  category: string
): Promise<{ data: InspirationResponse; mock: boolean }> => {
  if (USE_MOCK || !process.env.OPENAI_API_KEY) {
    return { data: { ...MOCK_INSPIRATION, categoria: category }, mock: true };
  }

  console.log("[tools/inspiration] Generando propuestas.");

  const prompt = PROMPTS.inspiration(category);
  let outputText = await callOpenAITextOnly(prompt);
  let parsed = normalizeInspirationResponse(extractJson(outputText));

  if (!parsed) {
    console.warn("[tools/inspiration] JSON inválido. Reintentando.");
    const retryPrompt = prompt + "\n\nIMPORTANTE: responde SOLO con JSON válido.";
    outputText = await callOpenAITextOnly(retryPrompt);
    parsed = normalizeInspirationResponse(extractJson(outputText));
  }

  if (!parsed) {
    console.error("[tools/inspiration] No se pudo parsear JSON. Usando mock.");
    return { data: { ...MOCK_INSPIRATION, categoria: category }, mock: true };
  }

  return { data: parsed, mock: false };
};

// ============ ENDPOINT ============

const jsonResponse = (data: ToolResponse, mode: ToolMode, usedMock: boolean) => {
  const response = NextResponse.json({ mode, ...data });
  response.headers.set("x-used-mock", usedMock ? "true" : "false");
  return response;
};

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("[tools] Error leyendo formData:", error);
    return NextResponse.json(
      { error: "Error procesando la solicitud." },
      { status: 400 }
    );
  }

  const mode = (formData.get("mode") as ToolMode) ?? "menu";
  const entry = formData.get("image");
  const file = entry instanceof File ? entry : null;

  try {
    switch (mode) {
      case "menu": {
        if (!file) {
          return NextResponse.json(
            { error: "Falta la imagen para generar el menú." },
            { status: 400 }
          );
        }
        const { data, mock } = await handleMenu(file);
        return jsonResponse(data, mode, mock);
      }

      case "shopping": {
        const dish = formData.get("dish") as string;
        if (!file) {
          return NextResponse.json(
            { error: "Falta la imagen para analizar tu nevera." },
            { status: 400 }
          );
        }
        if (!dish?.trim()) {
          return NextResponse.json(
            { error: "Indica qué plato quieres preparar." },
            { status: 400 }
          );
        }
        const { data, mock } = await handleShopping(file, dish.trim());
        return jsonResponse(data, mode, mock);
      }

      case "inspiration": {
        const category = formData.get("category") as string;
        if (!category?.trim()) {
          return NextResponse.json(
            { error: "Indica qué tipo de comida te apetece." },
            { status: 400 }
          );
        }
        const { data, mock } = await handleInspiration(category.trim());
        return jsonResponse(data, mode, mock);
      }

      default:
        return NextResponse.json(
          { error: "Modo no reconocido." },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[tools] Error:", error);
    return NextResponse.json(
      { error: "Error procesando la solicitud." },
      { status: 500 }
    );
  }
}
