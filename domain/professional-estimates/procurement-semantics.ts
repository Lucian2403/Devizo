import type { EstimatePerspective, ProfessionalWorkKind } from "./calculation";

export const PROCUREMENT_CATEGORIES = [
  "construction_materials", "metal_structures", "equipment", "other",
] as const;
export type ProcurementCategory = (typeof PROCUREMENT_CATEGORIES)[number];
export const VAT_TREATMENTS = ["exclusive", "inclusive", "unknown"] as const;
export type VatTreatment = (typeof VAT_TREATMENTS)[number];
export const TRANSPORT_TREATMENTS = ["excluded", "included", "unknown"] as const;
export type TransportTreatment = (typeof TRANSPORT_TREATMENTS)[number];

export interface PriceSemantics {
  vatTreatment: VatTreatment;
  transportTreatment: TransportTreatment;
}

export interface NormativeCalculationContext {
  estimatePerspective: EstimatePerspective | null;
  workKind: ProfessionalWorkKind | null;
}

export const procurementCategoryLabels: Record<ProcurementCategory, string> = {
  construction_materials: "Materiale de construcții",
  metal_structures: "Structuri metalice",
  equipment: "Echipamente",
  other: "Altele",
};
export const vatTreatmentLabels: Record<VatTreatment, string> = {
  exclusive: "Fără TVA", inclusive: "Include TVA", unknown: "Necunoscut",
};
export const transportTreatmentLabels: Record<TransportTreatment, string> = {
  excluded: "Fără transport", included: "Include transport", unknown: "Necunoscut",
};
