import path from "node:path";
import { pathToFileURL } from "node:url";
import type { QuoteVersion } from "@/domain/quotes/quote.repository";

// Loads the prebuilt PDF renderer (see scripts/build-pdf-renderer.mjs) at
// runtime. The webpackIgnore hint keeps Next from bundling/compiling it, so the
// renderer uses the SAME workspace React for both element creation and the
// @react-pdf reconciler — avoiding the React #31 element-symbol mismatch.
type RendererModule = {
  renderQuotePdf: (version: QuoteVersion) => Promise<Buffer>;
};

let modulePromise: Promise<RendererModule> | null = null;

function loadRenderer(): Promise<RendererModule> {
  if (!modulePromise) {
    const file = path.join(
      process.cwd(),
      "lib",
      "pdf",
      "generated",
      "quote-renderer.mjs",
    );
    const url = pathToFileURL(file).href;
    modulePromise = import(/* webpackIgnore: true */ url) as Promise<RendererModule>;
  }
  return modulePromise;
}

export async function renderQuotePdf(version: QuoteVersion): Promise<Buffer> {
  const mod = await loadRenderer();
  return mod.renderQuotePdf(version);
}
