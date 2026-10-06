import { createHash } from "node:crypto";
import type {
  NormativeSourceMonitor,
  SourceMonitorResult,
} from "@/domain/professional-estimates/normative-source-monitor";

const ALLOWED_HOSTS = new Set([
  "ednc.gov.md",
  "www.ednc.gov.md",
  "particip.gov.md",
  "www.particip.gov.md",
  "legis.md",
  "www.legis.md",
  "tender.gov.md",
  "www.tender.gov.md",
]);

const MAX_RESPONSE_CHARS = 5_000_000;
const MAX_REDIRECTS = 3;

function assertAllowedOfficialUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Normative source monitoring requires HTTPS.");
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(
      `Hostul ${url.hostname} nu este în lista surselor oficiale permise.`,
    );
  }
  return url;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

/**
 * Produces a stable-enough representation of official HTML pages for change
 * detection. Header/navigation/footer/forms and scripts are deliberately
 * excluded because they change independently from the normative record.
 *
 * This is a monitoring signal, not a legal interpretation. A changed
 * fingerprint must always be reviewed by a person before any rule is changed.
 */
export function normalizeOfficialSourceContent(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, " ")
      .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/Număr total de accesări\s*\d+/gi, " ")
      .replace(/Număr de accesări luna curentă\s*\d+/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfficialText(initialUrl: string): Promise<string> {
  let current = assertAllowedOfficialUrl(initialUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        "user-agent":
          "Devizo-Normative-Monitor/1.0 (+official-source-change-detection)",
        accept: "text/html,text/plain;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      if (redirects === MAX_REDIRECTS) {
        throw new Error("Prea multe redirecționări ale sursei oficiale.");
      }
      const next = new URL(response.headers.get("location")!, current);
      current = assertAllowedOfficialUrl(next.toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Sursa oficială a răspuns cu HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(
        `Tip de conținut nesuportat pentru monitorizare: ${contentType || "necunoscut"}.`,
      );
    }

    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARS) {
      throw new Error("Pagina sursei oficiale este prea mare pentru monitorizare.");
    }
    return body;
  }

  throw new Error("Nu s-a putut încărca sursa oficială.");
}

export class HttpNormativeSourceMonitor implements NormativeSourceMonitor {
  async verify(sourceUri: string): Promise<SourceMonitorResult> {
    const html = await fetchOfficialText(sourceUri);
    const normalized = normalizeOfficialSourceContent(html);

    if (normalized.length < 100) {
      throw new Error(
        "Conținutul sursei este prea scurt pentru o verificare sigură.",
      );
    }

    return {
      checkedAt: new Date(),
      fingerprint: createHash("sha256").update(normalized).digest("hex"),
    };
  }
}
