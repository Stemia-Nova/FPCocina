import { NextResponse } from "next/server";
import OpenAI from "openai";
import puppeteer, { Browser, Page } from "puppeteer";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutos máximo

const MODEL = "gpt-4o-mini";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============ TIPOS ============

type AgentAction = {
  action: "click" | "type" | "clear_and_type" | "press_enter" | "wait" | "scroll" | "done" | "error";
  selector?: string;
  text?: string;
  reason: string;
};

type AgentLog = {
  step: number;
  action: string;
  reason: string;
  success: boolean;
};

// ============ UTILIDADES ============

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getPageContext = async (page: Page): Promise<string> => {
  // Obtener información relevante de la página para el LLM
  const pageInfo = await page.evaluate(() => {
    const getElementInfo = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && 
                        rect.top < window.innerHeight && rect.bottom > 0;
      if (!isVisible) return null;
      
      const htmlEl = el as HTMLElement;
      const inputEl = el as HTMLInputElement;
      
      const tag = el.tagName.toLowerCase();
      const text = htmlEl.innerText?.slice(0, 100) || '';
      const placeholder = inputEl.placeholder || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const id = el.id || '';
      const className = el.className?.toString()?.slice(0, 80) || '';
      const type = inputEl.type || '';
      const value = inputEl.value?.slice(0, 50) || '';
      const dataTestId = el.getAttribute('data-testid') || '';
      
      return {
        tag,
        text: text.trim().slice(0, 80),
        placeholder,
        ariaLabel,
        id,
        className,
        type,
        value,
        dataTestId,
        selector: getSelector(el)
      };
    };
    
    const getSelector = (el: Element): string => {
      // Priorizar data-testid
      const testId = el.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;
      
      // Luego id
      if (el.id) return '#' + el.id;
      
      // Luego aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
      
      // Luego clases únicas
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c && !c.includes(':') && c.length < 30);
        if (classes.length > 0) {
          const selector = el.tagName.toLowerCase() + '.' + classes.slice(0, 2).join('.');
          try {
            const matches = document.querySelectorAll(selector);
            if (matches.length === 1) return selector;
          } catch {
            // Ignorar errores de selector
          }
        }
      }
      
      // Fallback: tag + texto parcial
      const htmlEl = el as HTMLElement;
      const text = htmlEl.innerText?.trim().slice(0, 30);
      if (text) {
        return `${el.tagName.toLowerCase()}:has-text("${text}")`;
      }
      
      return el.tagName.toLowerCase();
    };
    
    const elements: ReturnType<typeof getElementInfo>[] = [];
    
    // Botones
    document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
      const info = getElementInfo(el);
      if (info) elements.push({...info, type: 'button'});
    });
    
    // Inputs
    document.querySelectorAll('input[type="text"], input[type="search"], input[type="number"], input[type="tel"], input:not([type]), textarea').forEach(el => {
      const info = getElementInfo(el);
      if (info) elements.push({...info, type: 'input'});
    });
    
    // Links
    document.querySelectorAll('a[href]').forEach(el => {
      const info = getElementInfo(el);
      if (info && info.text && info.text.length < 60) elements.push({...info, type: 'link'});
    });
    
    // Divs clickeables
    document.querySelectorAll('[onclick], [data-testid], [role="listitem"], [role="option"]').forEach(el => {
      const info = getElementInfo(el);
      if (info && info.text) elements.push({...info, type: 'clickable'});
    });
    
    // Contexto de la página
    const context = {
      url: window.location.href,
      title: document.title,
      // Detectar modales o overlays
      hasModal: !!document.querySelector('[role="dialog"], .modal, [class*="modal"], [class*="overlay"]'),
      // Detectar si hay input de código postal visible
      hasPostalCodeInput: !!document.querySelector('input[placeholder*="postal"], input[placeholder*="CP"], input[name*="postal"]'),
      elements: elements.filter(e => e !== null).slice(0, 40)
    };
    
    return JSON.stringify(context, null, 2);
  });

  return pageInfo;
};

const askLLMForAction = async (
  pageContext: string,
  objetivo: string,
  productosRestantes: string[],
  historial: string[]
): Promise<AgentAction> => {
  const prompt = `
Eres un agente de IA que automatiza compras en la web de Mercadona (tienda.mercadona.es).

OBJETIVO ACTUAL: ${objetivo}

PRODUCTOS QUE FALTAN POR AÑADIR AL CARRITO:
${productosRestantes.length > 0 ? productosRestantes.map((p, i) => `${i + 1}. ${p}`).join("\n") : "Ninguno, todos añadidos"}

HISTORIAL DE ACCIONES (últimas 8):
${historial.slice(-8).join("\n") || "Ninguna acción previa"}

CONTEXTO DE LA PÁGINA ACTUAL:
${pageContext}

Analiza la página y decide la SIGUIENTE acción. Responde SOLO con JSON válido:
{
  "action": "click" | "type" | "clear_and_type" | "press_enter" | "wait" | "scroll" | "done" | "error",
  "selector": "selector CSS del elemento",
  "text": "texto a escribir (solo para type/clear_and_type)",
  "reason": "explicación breve"
}

FLUJO ESPERADO EN MERCADONA:
1. Página inicial: introducir código postal "37001" en el input
2. IMPORTANTE: Después de escribir el código postal, hacer CLICK en el botón verde "Continuar" o similar
3. Si aparece popup preguntando si tienes cuenta, hacer click en "Continuar sin cuenta" o "No" o "Entrar sin registrarse"
4. Usar la barra de búsqueda para buscar productos
5. Para CADA producto nuevo: usar "clear_and_type" para LIMPIAR el buscador antes de escribir
6. En resultados, click en "Añadir" junto al producto correcto
7. Repetir para cada producto

REGLAS IMPORTANTES:
- Si hay modal de cookies, ciérralo (busca "Aceptar" o "Aceptar todas")
- Después de escribir código postal, busca botón "Continuar" y haz CLICK (no solo Enter)
- Si aparece popup de cuenta/registro, busca opción para continuar SIN cuenta ("No tengo cuenta", "Continuar", "Entrar como invitado", etc.)
- Para buscar un NUEVO producto, usa "clear_and_type" que borra el texto anterior antes de escribir
- Para añadir al carrito, busca botones con "Añadir", "+" o iconos de carrito
- Si ves texto como "Añadir" visible, haz click en él
- Usa "wait" si la página está cargando (2-3 segundos)
- Usa "scroll" si no ves el producto en pantalla
- Usa "done" cuando TODOS los productos estén añadidos
- Usa "error" solo si algo falla repetidamente (más de 3 intentos)

Responde SOLO con el JSON, sin explicación adicional.
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content ?? "";
  
  try {
    const cleaned = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    
    const parsed = JSON.parse(cleaned);
    return {
      action: parsed.action || "error",
      selector: parsed.selector,
      text: parsed.text,
      reason: parsed.reason || "Sin razón especificada",
    };
  } catch {
    return {
      action: "error",
      reason: "No se pudo interpretar la respuesta del LLM: " + content.slice(0, 100),
    };
  }
};

const executeAction = async (
  page: Page,
  action: AgentAction
): Promise<boolean> => {
  try {
    switch (action.action) {
      case "click": {
        if (!action.selector) return false;
        
        // Intentar con el selector directo
        try {
          // Si el selector tiene :has-text, usar evaluación especial
          if (action.selector.includes(':has-text(')) {
            const match = action.selector.match(/:has-text\("([^"]+)"\)/);
            if (match) {
              const text = match[1];
              const tag = action.selector.split(':')[0] || '*';
              
              const clicked = await page.evaluate((searchText, tagName) => {
                const elements = document.querySelectorAll(tagName);
                for (const el of elements) {
                  if ((el as HTMLElement).innerText?.includes(searchText)) {
                    (el as HTMLElement).click();
                    return true;
                  }
                }
                return false;
              }, text, tag);
              
              if (clicked) {
                await sleep(1500);
                return true;
              }
            }
          }
          
          await page.waitForSelector(action.selector, { timeout: 5000 });
          await page.click(action.selector);
          await sleep(1500);
          return true;
        } catch {
          // Intentar buscar por texto visible
          const clicked = await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) {
              (el as HTMLElement).click();
              return true;
            }
            return false;
          }, action.selector);
          
          if (clicked) {
            await sleep(1500);
            return true;
          }
          return false;
        }
      }

      case "type": {
        if (!action.selector || !action.text) return false;
        try {
          await page.waitForSelector(action.selector, { timeout: 5000 });
          await page.click(action.selector);
          await page.type(action.selector, action.text, { delay: 50 });
          await sleep(500);
          return true;
        } catch {
          return false;
        }
      }

      case "clear_and_type": {
        if (!action.selector || !action.text) return false;
        try {
          await page.waitForSelector(action.selector, { timeout: 5000 });
          // Triple click para seleccionar todo el texto
          await page.click(action.selector, { clickCount: 3 });
          await sleep(100);
          // Borrar el texto seleccionado
          await page.keyboard.press('Backspace');
          await sleep(100);
          // Escribir el nuevo texto
          await page.type(action.selector, action.text, { delay: 50 });
          await sleep(500);
          return true;
        } catch {
          // Fallback: intentar con Ctrl+A para seleccionar todo
          try {
            await page.click(action.selector);
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.type(action.selector, action.text, { delay: 50 });
            await sleep(500);
            return true;
          } catch {
            return false;
          }
        }
      }

      case "press_enter": {
        await page.keyboard.press('Enter');
        await sleep(2000);
        return true;
      }

      case "wait": {
        await sleep(2500);
        return true;
      }

      case "scroll": {
        await page.evaluate(() => window.scrollBy(0, 400));
        await sleep(1000);
        return true;
      }

      case "done":
      case "error":
        return true;

      default:
        return false;
    }
  } catch (error) {
    console.error(`[agent] Error ejecutando ${action.action}:`, error);
    return false;
  }
};

// ============ AGENTE PRINCIPAL ============

const runMercadonaAgent = async (
  productos: string[],
  onLog: (log: AgentLog) => void
): Promise<{ success: boolean; logs: AgentLog[] }> => {
  const logs: AgentLog[] = [];
  let browser: Browser | null = null;
  let productosRestantes = [...productos];
  const historial: string[] = [];
  
  try {
    console.log("[agent] Iniciando navegador...");
    
    // Iniciar Puppeteer
    browser = await puppeteer.launch({
      headless: false, // Mostrar el navegador para que los estudiantes vean
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    });

    const page = await browser.newPage();
    
    // Configurar para parecer más humano
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log("[agent] Navegando a Mercadona...");
    await page.goto("https://tienda.mercadona.es/", { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await sleep(3000);

    let step = 0;
    const maxSteps = 60;
    let objetivo = "Introducir código postal 37001 y acceder a la tienda";
    let codigoPostalIntroducido = false;
    let productoActualIndex = 0;

    while (step < maxSteps) {
      step++;

      try {
        // Obtener contexto de la página
        const pageContext = await getPageContext(page);

        // Actualizar objetivo según el estado
        if (!codigoPostalIntroducido) {
          objetivo = "Introducir código postal 37001 y confirmar para acceder a la tienda";
        } else if (productosRestantes.length > 0) {
          objetivo = `Buscar y añadir al carrito: "${productosRestantes[0]}"`;
        } else {
          objetivo = "Todos los productos añadidos. Finalizar.";
        }

        console.log(`[agent] Paso ${step}: ${objetivo}`);

        // Preguntar al LLM qué hacer
        const action = await askLLMForAction(
          pageContext,
          objetivo,
          productosRestantes,
          historial
        );

        const log: AgentLog = {
          step,
          action: `${action.action}${action.selector ? ` → ${action.selector.slice(0, 50)}` : ""}${action.text ? ` ("${action.text}")` : ""}`,
          reason: action.reason,
          success: false,
        };

        console.log(`[agent] Acción: ${action.action} - ${action.reason}`);

        // Ejecutar la acción
        const success = await executeAction(page, action);
        log.success = success;

        // Registrar en historial
        historial.push(`Paso ${step}: ${action.action} - ${action.reason} (${success ? "OK" : "FAIL"})`);

        logs.push(log);
        onLog(log);

        // Detectar si se introdujo el código postal
        if (success && action.action === "type" && action.text === "37001") {
          codigoPostalIntroducido = true;
        }

        // Detectar si se añadió un producto (heurística: click exitoso después de buscar)
        if (success && action.action === "click" && 
            (action.reason.toLowerCase().includes("añadir") || 
             action.selector?.toLowerCase().includes("add") ||
             action.selector?.toLowerCase().includes("añadir"))) {
          if (productosRestantes.length > 0) {
            console.log(`[agent] Producto añadido: ${productosRestantes[0]}`);
            productosRestantes.shift();
          }
        }

        // Verificar si terminamos
        if (action.action === "done") {
          console.log("[agent] Agente completado.");
          break;
        }

        if (action.action === "error") {
          console.log("[agent] Agente reportó error.");
          break;
        }

        // Pausa entre acciones
        await sleep(800);
        
      } catch (stepError) {
        console.error(`[agent] Error en paso ${step}:`, stepError);
        logs.push({
          step,
          action: "error interno",
          reason: String(stepError).slice(0, 100),
          success: false,
        });
      }
    }

    // NO cerrar el navegador para que el usuario pueda continuar
    console.log("[agent] Agente finalizado. Navegador abierto para continuar manualmente.");

    return { 
      success: productosRestantes.length === 0, 
      logs 
    };
    
  } catch (error) {
    console.error("[agent] Error general:", error);
    if (browser) {
      // En caso de error grave, cerrar el navegador
      await browser.close();
    }
    return { success: false, logs };
  }
};

// ============ ENDPOINT ============

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const productos: string[] = body.productos || [];

    if (!productos.length) {
      return NextResponse.json(
        { error: "No hay productos para comprar" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "API key de OpenAI no configurada" },
        { status: 500 }
      );
    }

    console.log("[agent] Iniciando agente con productos:", productos);

    const result = await runMercadonaAgent(productos, (log) => {
      console.log(`[agent] Log: Paso ${log.step} - ${log.action}`);
    });

    return NextResponse.json({
      success: result.success,
      logs: result.logs,
      message: result.success
        ? "¡Productos añadidos al carrito! Revisa el navegador."
        : "El agente terminó. Revisa el navegador para completar la compra.",
    });
  } catch (error) {
    console.error("[agent] Error:", error);
    return NextResponse.json(
      { error: "Error ejecutando el agente: " + String(error) },
      { status: 500 }
    );
  }
}
