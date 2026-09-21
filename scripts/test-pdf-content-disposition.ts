import assert from "node:assert/strict";
import { buildPdfContentDisposition } from "../lib/pdf/content-disposition";

const romanian = buildPdfContentDisposition(
  "Ofertă comercială-Renovare bucătărie-v2.pdf",
);
assert.ok(romanian.includes('filename="Oferta-comerciala-Renovare-bucatarie-v2.pdf"'));
assert.ok(
  romanian.includes(
    "filename*=UTF-8''Ofert%C4%83%20comercial%C4%83-Renovare%20buc%C4%83t%C4%83rie-v2.pdf",
  ),
);

const russian = buildPdfContentDisposition(
  "Коммерческое предложение-Ремонт-v1.pdf",
);
assert.ok(/^[\x00-\xFF]+$/.test(russian));
assert.ok(russian.includes("filename*=UTF-8''"));

console.log("PDF Content-Disposition Unicode regression passed.");
