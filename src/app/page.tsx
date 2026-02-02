"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// ============ TIPOS ============

type ToolMode = "menu" | "shopping" | "inspiration";

type MenuResponse = {
  mode: "menu";
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
  mode: "shopping";
  ingredientes_detectados: string[];
  plato_solicitado: string;
  ingredientes_necesarios: string[];
  tienes: string[];
  te_falta: string[];
  sugerencias_sustitucion: string[];
};

type InspirationResponse = {
  mode: "inspiration";
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

type StatusMessage = {
  tone: "error" | "info" | "success";
  message: string;
};

// ============ CONFIGURACIÓN DE HERRAMIENTAS ============

const TOOLS = [
  {
    id: "menu" as const,
    icon: "🍳",
    name: "Generar Menú",
    description: "Sube foto de tu nevera y te propongo un menú completo",
    needsImage: true,
    needsInput: false,
  },
  {
    id: "shopping" as const,
    icon: "🛒",
    name: "Lista de Compra",
    description: "Dime qué quieres cocinar y te digo qué te falta",
    needsImage: true,
    needsInput: true,
    inputPlaceholder: "¿Qué quieres preparar? Ej: Paella, Carbonara...",
    inputLabel: "Plato que quieres cocinar",
  },
  {
    id: "inspiration" as const,
    icon: "💡",
    name: "Inspiración",
    description: "Elige un tipo de comida y te propongo platos",
    needsImage: false,
    needsInput: true,
    inputPlaceholder: "¿Qué te apetece? Ej: Pescado, Carne, Vegetariano...",
    inputLabel: "Tipo de comida",
  },
];

const INSPIRATION_CATEGORIES = [
  { label: "🥩 Carne", value: "Carne" },
  { label: "🐟 Pescado", value: "Pescado" },
  { label: "🥗 Vegetariano", value: "Vegetariano" },
  { label: "🍝 Pasta", value: "Pasta" },
  { label: "🍚 Arroz", value: "Arroz" },
  { label: "🥘 Guisos", value: "Guisos y estofados" },
  { label: "🥧 Postres", value: "Postres" },
  { label: "🌮 Internacional", value: "Cocina internacional" },
];

// ============ COMPONENTES ============

function ToolSelector({
  selected,
  onSelect,
}: {
  selected: ToolMode;
  onSelect: (mode: ToolMode) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onSelect(tool.id)}
          className={`group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all ${
            selected === tool.id
              ? "border-[#1f1c17] bg-[#1f1c17] text-white shadow-lg"
              : "border-[#e7d8c2] bg-white hover:border-[#c4b08d] hover:shadow-md"
          }`}
        >
          <span className="text-2xl">{tool.icon}</span>
          <div>
            <p className={`font-semibold ${selected === tool.id ? "text-white" : "text-[#2d251d]"}`}>
              {tool.name}
            </p>
            <p className={`text-xs ${selected === tool.id ? "text-white/70" : "text-[#6b5b45]"}`}>
              {tool.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ImageUploader({
  previewUrl,
  onFileChange,
}: {
  previewUrl: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-[#dbcbb3] bg-white/60 px-6 py-8 text-center transition hover:border-[#c4b08d] hover:bg-white">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e7d8c2] bg-white text-xl">
          📷
        </span>
        <span className="text-sm font-medium text-[#3f3428]">
          Arrastra tu imagen aquí o haz clic para subirla
        </span>
        <span className="text-xs text-[#7a6a54]">
          La IA detectará los ingredientes de tu nevera.
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="sr-only"
        />
      </label>

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-[#efe3d1] bg-[#fbf7f1]">
          <Image
            src={previewUrl}
            alt="Vista previa"
            width={960}
            height={540}
            unoptimized
            className="h-48 w-full object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuResult({ data }: { data: MenuResponse }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
          Ingredientes detectados
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.ingredientes_detectados.map((ing) => (
            <span
              key={ing}
              className="rounded-full border border-[#e7d8c2] bg-white px-3 py-1 text-xs text-[#5c4f3f]"
            >
              {ing}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Entrante", value: data.menu.entrante },
          { label: "Principal", value: data.menu.principal },
          { label: "Postre", value: data.menu.postre },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-[#2d251d]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Pasos</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-[#4b3f31]">
          {data.pasos.map((paso, i) => (
            <li key={i}>{paso}</li>
          ))}
        </ol>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Lista de compra</p>
          {data.lista_compra.length ? (
            <ul className="mt-2 space-y-1 text-sm text-[#4b3f31]">
              {data.lista_compra.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#6b5b45]">¡Tienes todo lo necesario!</p>
          )}
        </div>
        <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Alérgenos</p>
          {data.alergenos.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.alergenos.map((al) => (
                <span
                  key={al}
                  className="rounded-full border border-[#f1dfc2] bg-[#fff7e6] px-3 py-1 text-xs text-[#8a5b1a]"
                >
                  {al}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#6b5b45]">Sin alérgenos destacados.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-[#d4e8d4] bg-[#f0f9f0] px-4 py-3 text-sm text-[#2d5a2d]">
        <span>⏱</span>
        <span>Tiempo estimado: <strong>{data.tiempo_estimado_min} minutos</strong></span>
      </div>
    </div>
  );
}

function ShoppingResult({ data }: { data: ShoppingResponse }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#d4e8f0] bg-[#f0f8ff] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#5a7a8a]">Plato solicitado</p>
        <p className="mt-1 text-lg font-semibold text-[#2d4a5a]">{data.plato_solicitado}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[#d4e8d4] bg-[#f0f9f0] px-4 py-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#5a8a5a]">
            <span>✓</span> Tienes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.tienes.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#c4e0c4] bg-white px-3 py-1 text-xs text-[#2d5a2d]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#f0d4d4] bg-[#fff5f5] px-4 py-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8a5a5a]">
            <span>✗</span> Te falta
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.te_falta.length ? (
              data.te_falta.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#e0c4c4] bg-white px-3 py-1 text-xs text-[#8a2d2d]"
                >
                  {item}
                </span>
              ))
            ) : (
              <span className="text-sm text-[#5a8a5a]">¡Tienes todo!</span>
            )}
          </div>
        </div>
      </div>

      {data.sugerencias_sustitucion.length > 0 && (
        <div className="rounded-2xl border border-[#f1dfc2] bg-[#fff9ee] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">💡 Sugerencias</p>
          <ul className="mt-2 space-y-1 text-sm text-[#5c4f3f]">
            {data.sugerencias_sustitucion.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Ingredientes necesarios</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.ingredientes_necesarios.map((ing) => (
            <span
              key={ing}
              className={`rounded-full border px-3 py-1 text-xs ${
                data.tienes.includes(ing)
                  ? "border-[#c4e0c4] bg-[#f0f9f0] text-[#2d5a2d]"
                  : "border-[#e0c4c4] bg-[#fff5f5] text-[#8a2d2d]"
              }`}
            >
              {ing}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspirationResult({ data }: { data: InspirationResponse }) {
  const difficultyColors = {
    fácil: "border-[#c4e0c4] bg-[#f0f9f0] text-[#2d5a2d]",
    media: "border-[#f1dfc2] bg-[#fff9ee] text-[#8a5b1a]",
    difícil: "border-[#e0c4c4] bg-[#fff5f5] text-[#8a2d2d]",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#d4e8f0] bg-[#f0f8ff] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#5a7a8a]">Inspiración para</p>
        <p className="mt-1 text-lg font-semibold text-[#2d4a5a]">{data.categoria}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.propuestas.map((prop, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-[#efe3d1] bg-white px-4 py-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[#2d251d]">{prop.nombre}</p>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${difficultyColors[prop.dificultad]}`}
              >
                {prop.dificultad}
              </span>
            </div>
            <p className="text-sm text-[#5c4f3f]">{prop.descripcion}</p>
            <p className="mt-auto text-xs text-[#8a7a64]">⏱ {prop.tiempo_min} min</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#f1dfc2] bg-[#fff9ee] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">👨‍🍳 Consejo del Chef</p>
        <p className="mt-2 text-sm italic text-[#5c4f3f]">&ldquo;{data.consejo_chef}&rdquo;</p>
      </div>
    </div>
  );
}

// ============ PÁGINA PRINCIPAL ============

export default function Home() {
  const [selectedTool, setSelectedTool] = useState<ToolMode>("menu");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<ToolResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const currentTool = TOOLS.find((t) => t.id === selectedTool)!;

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleToolChange = (mode: ToolMode) => {
    setSelectedTool(mode);
    setResult(null);
    setStatus(null);
    setUserInput("");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setResult(null);
    setStatus(null);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (currentTool.needsImage && !imageFile) return;
    if (currentTool.needsInput && !userInput.trim()) return;

    setLoading(true);
    setStatus(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("mode", selectedTool);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      if (selectedTool === "shopping") {
        formData.append("dish", userInput);
      } else if (selectedTool === "inspiration") {
        formData.append("category", userInput);
      }

      const response = await fetch("/api/tools", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error procesando la solicitud.");
      }

      const usedMock = response.headers.get("x-used-mock") === "true";
      const data = (await response.json()) as ToolResponse;
      setResult(data);

      if (usedMock) {
        setStatus({
          tone: "info",
          message: "Mostrando datos de demostración.",
        });
      }
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Error procesando la solicitud.",
      });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    if (loading) return false;
    if (currentTool.needsImage && !imageFile) return false;
    if (currentTool.needsInput && !userInput.trim()) return false;
    return true;
  };

  const getButtonText = () => {
    if (loading) return "Procesando...";
    switch (selectedTool) {
      case "menu":
        return "Generar menú";
      case "shopping":
        return "Ver lista de compra";
      case "inspiration":
        return "Dame ideas";
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f4ee] text-[#1f1c17]">
      {/* Fondos decorativos */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_10%_-10%,#fff6e9,transparent_60%),radial-gradient(700px_circle_at_90%_0%,#e7f6ff,transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#f9d7a8] opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute right-[-120px] top-10 h-72 w-72 rounded-full bg-[#c7efff] opacity-40 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:py-14">
        {/* Header */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#e4d5bf] bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#6b5b45]">
              FP Cocina · IA
            </span>
            <span className="rounded-full border border-[#d4e8d4] bg-[#f0f9f0] px-3 py-1 text-xs font-medium text-[#2d5a2d]">
              v2.0
            </span>
          </div>
          <h1 className="font-display text-3xl leading-tight text-[#1f1c17] md:text-4xl">
            Chef Tools
          </h1>
          <p className="max-w-2xl text-base text-[#5c4f3f]">
            Multiherramienta con IA para estudiantes de cocina. Genera menús, listas de compra
            y encuentra inspiración para tus platos.
          </p>
        </header>

        {/* Selector de herramientas */}
        <section>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
            Elige una herramienta
          </p>
          <ToolSelector selected={selectedTool} onSelect={handleToolChange} />
        </section>

        {/* Área de trabajo */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Panel de entrada */}
          <div className="flex flex-col gap-5 rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentTool.icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-[#2d251d]">{currentTool.name}</h2>
                <p className="text-sm text-[#6b5b45]">{currentTool.description}</p>
              </div>
            </div>

            {/* Imagen (si es necesaria) */}
            {currentTool.needsImage && (
              <ImageUploader previewUrl={previewUrl} onFileChange={handleFileChange} />
            )}

            {/* Input de texto (si es necesario) */}
            {currentTool.needsInput && (
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                  {currentTool.inputLabel}
                </label>
                {selectedTool === "inspiration" ? (
                  <div className="flex flex-wrap gap-2">
                    {INSPIRATION_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setUserInput(cat.value)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          userInput === cat.value
                            ? "border-[#1f1c17] bg-[#1f1c17] text-white"
                            : "border-[#e7d8c2] bg-white text-[#5c4f3f] hover:border-[#c4b08d]"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={currentTool.inputPlaceholder}
                    className="rounded-xl border border-[#e7d8c2] bg-white px-4 py-3 text-sm text-[#2d251d] placeholder:text-[#a99d8a] focus:border-[#c4b08d] focus:outline-none focus:ring-2 focus:ring-[#f5b041]/20"
                  />
                )}
              </div>
            )}

            {/* Botón de acción */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit()}
                className="inline-flex items-center justify-center rounded-full bg-[#1f1c17] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#3b3227] disabled:cursor-not-allowed disabled:bg-[#bdb2a1]"
              >
                {getButtonText()}
              </button>
              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#6b5b45]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d9cbb5] border-t-transparent" />
                  Procesando con IA, esto puede tardar unos segundos...
                </div>
              )}
              {status && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    status.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : status.tone === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {status.message}
                </div>
              )}
            </div>
          </div>

          {/* Panel de resultados */}
          <div className="flex flex-col gap-5 rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#2d251d]">Resultado</h2>
              {result && (
                <span className="rounded-full border border-[#d4e8d4] bg-[#f0f9f0] px-3 py-1 text-xs font-medium text-[#2d5a2d]">
                  ✓ Generado
                </span>
              )}
            </div>

            {!result ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#e7d8c2] bg-[#fbf7f1] px-6 py-12 text-center text-sm text-[#7a6a54]">
                <span className="text-3xl">🍽️</span>
                <p>Los resultados aparecerán aquí cuando uses una herramienta.</p>
                <p className="text-xs">
                  Consejo: una foto clara y bien iluminada mejora los resultados.
                </p>
              </div>
            ) : result.mode === "menu" ? (
              <MenuResult data={result} />
            ) : result.mode === "shopping" ? (
              <ShoppingResult data={result} />
            ) : (
              <InspirationResult data={result} />
            )}

            {result && (
              <div className="rounded-2xl border border-[#f3e7d6] bg-[#fff9ee] px-4 py-3 text-xs text-[#7a5a2c]">
                ⚠️ Revisa y valida: la IA puede equivocarse. Usa tu criterio profesional.
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-4 text-center text-xs text-[#8a7a64]">
          Hecho con ❤️ para estudiantes de FP de Cocina · Powered by Stemia
        </footer>
      </main>
    </div>
  );
}
