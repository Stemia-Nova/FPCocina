"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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

type StatusMessage = {
  tone: "error" | "info";
  message: string;
};

export default function Home() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setResult(null);
    setStatus(null);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }
    setPreviewUrl(null);
  };

  const handleSubmit = async () => {
    if (!imageFile || loading) return;
    setLoading(true);
    setStatus(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await fetch("/api/menu", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("No se pudo analizar la imagen.");
      }

      const usedMock = response.headers.get("x-used-mock") === "true";
      const data = (await response.json()) as MenuResponse;
      setResult(data);

      if (usedMock) {
        setStatus({
          tone: "info",
          message: "No se pudo analizar la imagen, mostrando demo.",
        });
      }
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        message: "No se pudo analizar la imagen. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f4ee] text-[#1f1c17]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_10%_-10%,#fff6e9,transparent_60%),radial-gradient(700px_circle_at_90%_0%,#e7f6ff,transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#f9d7a8] opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute right-[-120px] top-10 h-72 w-72 rounded-full bg-[#c7efff] opacity-40 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:py-16">
        <header className="flex flex-col gap-3">
          <span className="w-fit rounded-full border border-[#e4d5bf] bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#6b5b45]">
            Demo IA · Cocina FP
          </span>
          <h1 className="font-display text-4xl leading-tight text-[#1f1c17] md:text-5xl">
            Menú desde tu nevera
          </h1>
          <p className="max-w-2xl text-base text-[#5c4f3f] md:text-lg">
            Sube una foto y genera un menú con IA. Te proponemos entrante,
            principal y postre con pasos claros y lista de compra.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col gap-6 rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#2d251d]">
                  Foto de la nevera
                </h2>
                <p className="text-sm text-[#6b5b45]">
                  Formatos JPG/PNG. Procesamos en memoria.
                </p>
              </div>
              <span className="rounded-full bg-[#f5b041]/20 px-3 py-1 text-xs font-semibold text-[#9a5a06]">
                Sin guardado
              </span>
            </div>

            <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-[#dbcbb3] bg-white/60 px-6 py-10 text-center transition hover:border-[#c4b08d] hover:bg-white">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e7d8c2] bg-white text-xl">
                📷
              </span>
              <span className="text-sm font-medium text-[#3f3428]">
                Arrastra tu imagen aquí o haz clic para subirla
              </span>
              <span className="text-xs text-[#7a6a54]">
                La IA detectará ingredientes y sugerirá un menú completo.
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
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
                  className="h-56 w-full object-cover md:h-64"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#e7d8c2] bg-[#fbf7f1] px-6 py-10 text-center text-sm text-[#7a6a54]">
                La vista previa aparecerá aquí.
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                disabled={!imageFile || loading}
                className="inline-flex items-center justify-center rounded-full bg-[#1f1c17] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#3b3227] disabled:cursor-not-allowed disabled:bg-[#bdb2a1]"
              >
                {loading ? "Analizando..." : "Generar menú"}
              </button>
              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#6b5b45]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d9cbb5] border-t-transparent" />
                  Esto suele tardar menos de 20 segundos.
                </div>
              )}
              {status && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    status.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {status.message}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#2d251d]">
                  Resultado del menú
                </h2>
                <p className="text-sm text-[#6b5b45]">
                  Entrante · Principal · Postre
                </p>
              </div>
              <div className="rounded-full border border-[#f1dfc2] bg-[#fff7e6] px-3 py-1 text-xs font-semibold text-[#a06008]">
                {result
                  ? `⏱ ${result.tiempo_estimado_min} min`
                  : "Tiempo estimado"}
              </div>
            </div>

            {!result ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#e7d8c2] bg-[#fbf7f1] px-6 py-12 text-center text-sm text-[#7a6a54]">
                <p>
                  Cuando subas una foto, verás aquí los ingredientes detectados
                  y el menú sugerido.
                </p>
                <p className="text-xs">
                  Consejo: una foto clara y bien iluminada mejora el resultado.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                    Ingredientes detectados
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.ingredientes_detectados.map((ingrediente) => (
                      <span
                        key={ingrediente}
                        className="rounded-full border border-[#e7d8c2] bg-white px-3 py-1 text-xs text-[#5c4f3f]"
                      >
                        {ingrediente}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                      Entrante
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#2d251d]">
                      {result.menu.entrante}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                      Principal
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#2d251d]">
                      {result.menu.principal}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                      Postre
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#2d251d]">
                      {result.menu.postre}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                    Pasos
                  </p>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-[#4b3f31]">
                    {result.pasos.map((paso) => (
                      <li key={paso}>{paso}</li>
                    ))}
                  </ol>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                      Lista de compra
                    </p>
                    {result.lista_compra.length ? (
                      <ul className="mt-3 space-y-2 text-sm text-[#4b3f31]">
                        {result.lista_compra.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-[#6b5b45]">
                        No necesitas comprar nada extra.
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-[#efe3d1] bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
                      Alérgenos
                    </p>
                    {result.alergenos.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.alergenos.map((alergeno) => (
                          <span
                            key={alergeno}
                            className="rounded-full border border-[#f1dfc2] bg-[#fff7e6] px-3 py-1 text-xs text-[#8a5b1a]"
                          >
                            {alergeno}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#6b5b45]">
                        Sin alérgenos destacados.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#f3e7d6] bg-[#fff9ee] px-4 py-3 text-xs text-[#7a5a2c]">
                  Revisa y valida: la IA puede equivocarse.
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
