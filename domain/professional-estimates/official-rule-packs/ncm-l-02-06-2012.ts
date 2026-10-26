/**
 * NCM L.02.06-2012, Anexa A (paginile 5-7): 39 positions, 58 tariff variants.
 * Short labels are navigation aids, not replacements for the official document.
 * No row is a default: a devizier must explicitly choose an applicable rule.
 *
 * Official text: https://ednc.gov.md/wp-content/uploads/2023/06/NCM-L.02.06-2012.pdf
 */
export const NCM_L_02_06_2012_SOURCE_CODE = "NCM L.02.06-2012";
export const NCM_L_02_06_2012_SOURCE_EDITION = "2012";
export const NCM_L_02_06_2012_VALID_FROM = "2013-02-15";
export const NCM_L_02_06_2012_COMPONENT = "winter_conditions" as const;

export type WinterRuleGroup = "industrial" | "energy" | "transport" | "civil" | "other";

export interface NcmL02062012Rule {
  ruleCode: string;
  groupCode: WinterRuleGroup;
  groupLabel: string;
  name: string;
  ratePercent: string;
  sourceReference: string;
  /** Pct. 4.8: these rows only apply when the work is a principal work item. */
  principalWorkOnly: boolean;
}

type RuleTuple = readonly [string, WinterRuleGroup, string, string];

const GROUP_LABELS: Record<WinterRuleGroup, string> = {
  industrial: "Construcții industriale",
  energy: "Construcții energetice",
  transport: "Construcții de transport",
  civil: "Clădiri de locuit și civile",
  other: "Alte tipuri de construcții",
};

/** Tariffs expressed as exact decimal strings, copied from the numeric annex. */
const rows: readonly RuleTuple[] = [
  ["001", "industrial", "Industria metalurgică", "0.7"],
  ["002", "industrial", "Industria petrolului și gazului", "0.8"],
  ["003", "industrial", "Construcții de mașini, electrotehnică și automatizare", "0.7"],
  ["004", "industrial", "Mașini agricole și tractoare", "0.4"],
  ["005", "industrial", "Lucrări miniere fără încălzirea aerului", "0.1"],
  ["006", "industrial", "Industria chimică", "0.6"],
  ["007", "industrial", "Lemn, celuloză, hârtie și poligrafie", "0.6"],
  ["008", "industrial", "Industria materialelor de construcții", "0.7"],
  ["009", "industrial", "Industria ușoară", "0.7"],
  ["010", "industrial", "Industria alimentară", "0.7"],
  ["011", "industrial", "Industria medicamentelor", "0.6"],
  ["012", "industrial", "Industria microbiologică", "0.7"],
  ["013", "energy", "Centrale hidroelectrice", "0.8"],
  ["014", "energy", "Centrale termoelectrice și cazangerii autonome", "0.7"],
  ["015", "energy", "Stații de transformare", "0.6"],
  ["016", "energy", "Linii electrice aeriene", "0.4"],
  ["017", "transport", "Conducte magistrale de gaz și petrol", "0.4"],
  ["018A", "transport", "Clădiri pentru transport feroviar", "1.6"],
  ["018B", "transport", "Clădiri pentru transport auto și baze de reparații", "0.7"],
  ["018C", "transport", "Clădiri pentru transport fluvial", "0.6"],
  ["018D", "transport", "Clădiri pentru transport aerian", "0.4"],
  ["019A", "transport", "Pregătirea traseului de drum", "0.5"],
  ["019B", "transport", "Terasamente din pământ obișnuit", "2.4"],
  ["019C", "transport", "Terasamente din pământ drenat", "0.5"],
  ["019D", "transport", "Consolidarea terasamentelor și construcțiilor de reglare", "0.3"],
  ["019E", "transport", "Poduri mari cu suprastructură din beton armat", "1.5"],
  ["019G", "transport", "Poduri mari cu suprastructură metalică", "0.6"],
  ["019H", "transport", "Alte lucrări de artă la drumuri", "0.9"],
  ["019I", "transport", "Suprastructuri de linii ferate", "0.5"],
  ["019J", "transport", "Electrificarea căilor ferate", "0.8"],
  ["019K", "transport", "Telecomunicații și semnalizare feroviară", "0.7"],
  ["019L", "transport", "Alimentare cu apă și canalizare, fără rețele", "1.3"],
  ["020A", "transport", "Îmbrăcăminte rutieră din plăci prefabricate de beton armat", "0.3"],
  ["020B", "transport", "Îmbrăcăminte rutieră din beton-ciment", "1.2"],
  ["020C", "transport", "Îmbrăcăminte rutieră din beton asfaltic sau piatră spartă", "1.0"],
  ["020D", "transport", "Îmbrăcăminte rutieră din pietriș sau piatră spartă", "0.5"],
  ["021", "transport", "Piste de aterizare", "0.4"],
  ["022", "civil", "Clădiri de locuit cu rețele și amenajări", "0.7"],
  ["023", "civil", "Clădiri de locuit fără rețele și amenajări", "0.4"],
  ["024", "civil", "Clădiri sociale și comunale cu rețele și amenajări", "0.8"],
  ["025", "civil", "Clădiri sociale și comunale fără rețele și amenajări", "0.5"],
  ["026A", "civil", "Conducte exterioare pentru apă și gaz", "0.5"],
  ["026B", "civil", "Conducte exterioare pentru canalizare", "0.7"],
  ["027A", "civil", "Stații de pompare pentru alimentarea cu apă", "1.6"],
  ["027B", "civil", "Stații de pompare pentru canalizare", "1.8"],
  ["028A", "civil", "Stații de epurare pentru alimentarea cu apă", "0.8"],
  ["028B", "civil", "Stații de epurare pentru canalizare", "1.0"],
  ["029", "other", "Construcții agricole", "1.1"],
  ["030", "other", "Magazii și depozite", "0.6"],
  ["031", "other", "Elevatoare din beton armat prefabricat", "0.6"],
  ["032", "other", "Elevatoare din beton armat monolit", "2.5"],
  ["033", "other", "Instalații frigorifice", "0.8"],
  ["034", "other", "Construcții meliorative și gospodărirea apelor", "1.2"],
  ["035", "other", "Rețele și construcții de telecomunicații", "0.6"],
  ["036", "other", "Tuneluri colectoare", "0.8"],
  ["037", "other", "Treceri subterane pentru pietoni", "0.6"],
  ["038", "other", "Consolidări de maluri și construcții de chei", "0.2"],
  ["039", "other", "Plantări și replantări de arbori și arbuști", "0.7"],
];

function isPrincipalWorkOnly(position: number): boolean {
  return (
    (position >= 13 && position <= 21) ||
    (position >= 26 && position <= 28) ||
    (position >= 30 && position <= 33) ||
    (position >= 36 && position <= 39)
  );
}

export const NCM_L_02_06_2012_RULE_PACK: readonly NcmL02062012Rule[] =
  rows.map(([ruleCode, groupCode, name, ratePercent]) => {
    const position = Number(ruleCode.slice(0, 3));
    const subposition = ruleCode.slice(3);
    const reference = subposition
      ? String(position) + "(" + subposition.toLowerCase() + ")"
      : String(position);
    return {
      ruleCode,
      groupCode,
      groupLabel: GROUP_LABELS[groupCode],
      name,
      ratePercent,
      sourceReference: "NCM L.02.06-2012, Anexa A, poz. " + reference,
      principalWorkOnly: isPrincipalWorkOnly(position),
    };
  });
