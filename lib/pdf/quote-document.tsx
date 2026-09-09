import path from "node:path";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SupportedLanguage } from "@/domain/shared/types";
import type { QuoteVersion } from "@/domain/quotes/quote.repository";
import {
  PDF_STRINGS,
  PDF_LOCALES,
  UNIT_SYMBOLS,
  type QuotePdfStrings,
} from "./quote-strings";
import { buildQuoteDocumentNumber } from "../quotes/document-number";

// Register a Unicode-capable font (DejaVu Sans) once per process. It covers
// Latin-extended (Romanian ă â î ș ț) and Cyrillic (Russian А Б В Г Д).
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "DejaVuSans",
    fonts: [
      { src: path.join(dir, "DejaVuSans.ttf"), fontWeight: "normal" },
      { src: path.join(dir, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // Avoid hyphenation splitting words in unexpected languages.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

function resolveLanguage(code: string | null): SupportedLanguage {
  const supported: SupportedLanguage[] = [
    "ro",
    "ru",
    "en",
    "it",
    "fr",
    "de",
    "es",
  ];
  return supported.includes(code as SupportedLanguage)
    ? (code as SupportedLanguage)
    : "ro";
}

// Decimal-safe money formatting. Stored values are fixed-2 NUMERIC strings
// bounded well within IEEE-754 exact-integer range, so parsing for grouping is
// deterministic. We never recompute — we only format the stored value.
function formatMoney(value: string, currency: string, locale: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatQuantity(value: string, locale: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

function formatDate(value: Date | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "DejaVuSans",
    fontSize: 9,
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 32,
    color: "#1a1a1a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  companyName: { fontSize: 14, fontWeight: "bold" },
  muted: { color: "#555" },
  docTitle: { fontSize: 18, fontWeight: "bold", textAlign: "right" },
  metaLine: { textAlign: "right", color: "#555" },
  section: { marginBottom: 12 },
  introCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  introText: { color: "#374151", lineHeight: 1.5 },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#777",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  twoCol: { flexDirection: "row", justifyContent: "space-between", gap: 24 },
  col: { flexGrow: 1, flexBasis: 0 },
  table: { marginTop: 8, borderTopWidth: 1, borderColor: "#ddd" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 4,
  },
  cell: { paddingHorizontal: 4 },
  withDescNr: { width: "5%" },
  withDescWork: { width: "24%" },
  withDescDesc: { width: "20%" },
  withDescQty: { width: "10%", textAlign: "right" },
  withDescUnit: { width: "8%" },
  withDescPrice: { width: "13%", textAlign: "right" },
  withDescDiscount: { width: "8%", textAlign: "right" },
  withDescTotal: { width: "12%", textAlign: "right" },
  noDescNr: { width: "6%" },
  noDescWork: { width: "35%" },
  noDescQty: { width: "11%", textAlign: "right" },
  noDescUnit: { width: "9%" },
  noDescPrice: { width: "15%", textAlign: "right" },
  noDescDiscount: { width: "9%", textAlign: "right" },
  noDescTotal: { width: "15%", textAlign: "right" },
  headerCell: { fontWeight: "bold", fontSize: 8 },
  totals: {
    marginTop: 12,
    marginLeft: "auto",
    width: "45%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#ccc",
    paddingTop: 4,
    marginTop: 4,
    fontSize: 11,
    fontWeight: "bold",
  },
  valueNoWrap: { fontWeight: "bold" },
  terms: { marginTop: 14, borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 8 },
  termsRow: { marginBottom: 6 },
  termsValue: { color: "#374151", lineHeight: 1.45 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    textAlign: "center",
    fontSize: 7,
    color: "#999",
  },
});

function QuoteDocument({
  version,
  t,
  locale,
}: {
  version: QuoteVersion;
  t: QuotePdfStrings;
  locale: string;
}) {
  const currency = version.currency;
  const money = (v: string) => formatMoney(v, currency, locale);
  const showDescription = version.items.some(
    (item) => (item.description ?? "").trim().length > 0,
  );
  const docNumber = buildQuoteDocumentNumber(version);
  const issueDateText = formatDate(version.sentAt, locale);
  const validUntilText = formatDate(version.validUntil, locale);
  const introLine = `${t.documentTitle} ${docNumber}. ${t.project}: ${version.projectName ?? "—"}. ${t.customer}: ${version.customerName ?? "—"}.`;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header: company (left) + document identity (right) */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{version.companyName ?? "—"}</Text>
            {version.companyLegalName ? (
              <Text style={styles.muted}>{version.companyLegalName}</Text>
            ) : null}
            {version.companyTaxVatId ? (
              <Text style={styles.muted}>{version.companyTaxVatId}</Text>
            ) : null}
            {version.companyEmail ? (
              <Text style={styles.muted}>{version.companyEmail}</Text>
            ) : null}
            {version.companyPhone ? (
              <Text style={styles.muted}>{version.companyPhone}</Text>
            ) : null}
            {version.companyAddress ? (
              <Text style={styles.muted}>{version.companyAddress}</Text>
            ) : null}
            {version.companyCountry ? (
              <Text style={styles.muted}>{version.companyCountry}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.docTitle}>{t.documentTitle}</Text>
            <Text style={styles.metaLine}>
              {t.documentNumber}: {docNumber}
            </Text>
            <Text style={styles.metaLine}>
              {t.versionLabel} {version.versionNumber}
            </Text>
            <Text style={styles.metaLine}>
              {t.issueDate}: {issueDateText}
            </Text>
            <Text style={styles.metaLine}>
              {t.validUntil}: {validUntilText}
            </Text>
            <Text style={styles.metaLine}>
              {t.status}: {t.statusLabels[version.status]}
            </Text>
          </View>
        </View>

        {/* Customer + project */}
        <View style={[styles.section, styles.twoCol]}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>{t.customer}</Text>
            {version.customerName ? <Text>{version.customerName}</Text> : null}
            {version.customerEmail ? (
              <Text style={styles.muted}>{version.customerEmail}</Text>
            ) : null}
            {version.customerPhone ? (
              <Text style={styles.muted}>{version.customerPhone}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>{t.project}</Text>
            {version.projectName ? <Text>{version.projectName}</Text> : null}
            {version.projectAddress ? (
              <Text style={styles.muted}>{version.projectAddress}</Text>
            ) : null}
          </View>
        </View>

        {/* Compact introductory section before line items. */}
        <View style={styles.introCard}>
          <Text style={styles.sectionLabel}>{t.introTitle}</Text>
          <Text style={styles.introText}>{introLine}</Text>
        </View>

        {/* Line items table. The header repeats on every page (fixed). Rows do
            not break across pages (wrap=false). */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescNr : styles.noDescNr,
                styles.headerCell,
              ]}
            >
              {t.colNr}
            </Text>
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescWork : styles.noDescWork,
                styles.headerCell,
              ]}
            >
              {t.colWork}
            </Text>
            {showDescription ? (
              <Text style={[styles.cell, styles.withDescDesc, styles.headerCell]}>
                {t.colDescription}
              </Text>
            ) : null}
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescQty : styles.noDescQty,
                styles.headerCell,
              ]}
            >
              {t.colQuantity}
            </Text>
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescUnit : styles.noDescUnit,
                styles.headerCell,
              ]}
            >
              {t.colUnit}
            </Text>
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescPrice : styles.noDescPrice,
                styles.headerCell,
              ]}
            >
              {t.colUnitPrice}
            </Text>
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescDiscount : styles.noDescDiscount,
                styles.headerCell,
              ]}
            >
              {t.colDiscount}
            </Text>
            <Text
              style={[
                styles.cell,
                showDescription ? styles.withDescTotal : styles.noDescTotal,
                styles.headerCell,
              ]}
            >
              {t.colTotal}
            </Text>
          </View>

          {version.items.map((item, index) => (
            <View style={styles.tableRow} key={item.id} wrap={false}>
              <Text style={[styles.cell, showDescription ? styles.withDescNr : styles.noDescNr]}>
                {index + 1}
              </Text>
              <Text style={[styles.cell, showDescription ? styles.withDescWork : styles.noDescWork]}>
                {item.name}
              </Text>
              {showDescription ? (
                <Text style={[styles.cell, styles.withDescDesc]}>
                  {item.description ?? ""}
                </Text>
              ) : null}
              <Text
                style={[styles.cell, showDescription ? styles.withDescQty : styles.noDescQty]}
                wrap={false}
              >
                {formatQuantity(item.quantity, locale)}
              </Text>
              <Text style={[styles.cell, showDescription ? styles.withDescUnit : styles.noDescUnit]}>
                {UNIT_SYMBOLS[item.unit] ?? item.unit}
              </Text>
              <Text
                style={[styles.cell, showDescription ? styles.withDescPrice : styles.noDescPrice]}
                wrap={false}
              >
                {money(item.unitPrice)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  showDescription ? styles.withDescDiscount : styles.noDescDiscount,
                ]}
                wrap={false}
              >
                {item.discountPct}%
              </Text>
              <Text
                style={[styles.cell, showDescription ? styles.withDescTotal : styles.noDescTotal]}
                wrap={false}
              >
                {money(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* Financial summary — all values come from the stored snapshot. */}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>{t.subtotal}</Text>
            <Text style={styles.valueNoWrap} wrap={false}>
              {money(version.subtotal)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>
              {t.discount} ({version.discountPct}%)
            </Text>
            <Text style={styles.valueNoWrap} wrap={false}>
              − {money(version.discountAmount)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>{t.taxBase}</Text>
            <Text style={styles.valueNoWrap} wrap={false}>
              {money(version.taxableAmount)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>
              {t.vat} ({version.vatRate}%)
            </Text>
            <Text style={styles.valueNoWrap} wrap={false}>
              {money(version.vatAmount)}
            </Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text>{t.total}</Text>
            <Text wrap={false}>{money(version.total)}</Text>
          </View>
        </View>

        <View style={styles.terms}>
          <Text style={styles.sectionLabel}>{t.commercialTerms}</Text>
          <View style={styles.termsRow}>
            <Text style={styles.muted}>{t.validity}</Text>
            <Text style={styles.termsValue}>{validUntilText}</Text>
          </View>
          {version.paymentTerms ? (
            <View style={styles.termsRow}>
              <Text style={styles.muted}>{t.paymentTerms}</Text>
              <Text style={styles.termsValue}>{version.paymentTerms}</Text>
            </View>
          ) : null}
          {version.executionDuration ? (
            <View style={styles.termsRow}>
              <Text style={styles.muted}>{t.executionDuration}</Text>
              <Text style={styles.termsValue}>{version.executionDuration}</Text>
            </View>
          ) : null}
          {version.inclusions ? (
            <View style={styles.termsRow}>
              <Text style={styles.muted}>{t.inclusions}</Text>
              <Text style={styles.termsValue}>{version.inclusions}</Text>
            </View>
          ) : null}
          {version.exclusions ? (
            <View style={styles.termsRow}>
              <Text style={styles.muted}>{t.exclusions}</Text>
              <Text style={styles.termsValue}>{version.exclusions}</Text>
            </View>
          ) : null}
          {version.notes ? (
            <View style={styles.termsRow}>
              <Text style={styles.muted}>{t.notes}</Text>
              <Text style={styles.termsValue}>{version.notes}</Text>
            </View>
          ) : null}
          {version.companyTerms ? (
            <View style={styles.termsRow}>
              <Text style={styles.muted}>{t.companyTerms}</Text>
              <Text style={styles.termsValue}>{version.companyTerms}</Text>
            </View>
          ) : null}
        </View>

        {/* Page numbers on every page */}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            t.page
              .replace("{n}", String(pageNumber))
              .replace("{total}", String(totalPages))
          }
        />
      </Page>
    </Document>
  );
}

/**
 * Renders a customer-facing PDF from ONE immutable QuoteVersion snapshot.
 * The renderer only formats stored snapshot data: it never recomputes totals,
 * reads catalog prices, or touches live Organization/Customer/Project data.
 */
export async function renderQuotePdf(version: QuoteVersion): Promise<Buffer> {
  ensureFonts();
  const language = resolveLanguage(version.documentLanguage);
  const t = PDF_STRINGS[language];
  const locale = PDF_LOCALES[language];
  return renderToBuffer(
    <QuoteDocument version={version} t={t} locale={locale} />,
  );
}
