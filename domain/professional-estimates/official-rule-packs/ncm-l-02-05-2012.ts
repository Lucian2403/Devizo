export const NCM_L_02_05_2012_SOURCE_CODE = "NCM L.02.05-2012";
export const NCM_L_02_05_2012_SOURCE_EDITION = "2012";
export const NCM_L_02_05_2012_VALID_FROM = "2013-02-15";
export const NCM_L_02_05_2012_COMPONENT = "temporary_works" as const;

export interface NcmL02052012Rule {
  ruleCode: string;
  groupCode: string;
  groupLabel: string;
  name: string;
  ratePercent: string;
  sourceReference: string;
}

function row(
  ruleCode: string,
  groupCode: string,
  groupLabel: string,
  name: string,
  ratePercent: string,
): NcmL02052012Rule {
  return {
    ruleCode,
    groupCode,
    groupLabel,
    name,
    ratePercent,
    sourceReference: `NCM L.02.05-2012, pct. 4.6, poziția ${ruleCode.replace(/^0+/, "")}`,
  };
}

/**
 * Curated table from NCM L.02.05-2012, pct. 4.6.
 *
 * Rates are normative data, not engine defaults. The exact persisted rule is
 * explicitly selected by the user and keeps its source/applicability provenance.
 */
export const NCM_L_02_05_2012_RULE_PACK: readonly NcmL02052012Rule[] = [
  row("001", "industrial", "Construcții industriale", "Întreprinderi din industria metalurgică", "1.7"),
  row("002", "industrial", "Construcții industriale", "Obiecte de amenajare a zăcămintelor de țiței și de gaze", "0.8"),
  row("003", "industrial", "Construcții industriale", "Întreprinderi din industria constructoare de mașini și din industria electrotehnică", "1.2"),
  row("004", "industrial", "Construcții industriale", "Întreprinderi din industria extractivă minieră", "1.7"),
  row("005", "industrial", "Construcții industriale", "Întreprinderi din industria chimică", "1.6"),
  row("006", "industrial", "Construcții industriale", "Întreprinderi din industria de exploatare forestieră și de prelucrare a lemnului", "1.6"),
  row("007", "industrial", "Construcții industriale", "Întreprinderi din industria construcțiilor și materialelor de construcții", "0.8"),
  row("008", "industrial", "Construcții industriale", "Întreprinderi din industria celulozei și hârtiei", "1.8"),
  row("009", "industrial", "Construcții industriale", "Întreprinderi din industria ușoară", "1.0"),
  row("010", "industrial", "Construcții industriale", "Întreprinderi din industria alimentară", "1.1"),
  row("011", "industrial", "Construcții industriale", "Întreprinderi din industria medicamentelor, aparatelor și instrumentelor medicale", "1.1"),
  row("012", "industrial", "Construcții industriale", "Întreprinderi din industria microbiologică", "1.6"),

  row("013", "energy", "Construcții energetice", "Centrale termoelectrice", "3.2"),
  row("014", "energy", "Construcții energetice", "Centrale electrice cu termoficare și centrale termice autonome", "2.4"),
  row("015", "energy", "Construcții energetice", "Linii electrice aeriene, stații electrice de transformare, alte obiecte energetice", "1.2"),

  row("016", "transport", "Construcții de transport", "Linii ferate noi exclusiv tuneluri și poduri (viaducte) cu lungimea peste 50 m", "2.1"),
  row("017", "transport", "Construcții de transport", "Linii directe secundare, electrificarea sectoarelor de cale ferată, dezvoltarea nodurilor, stațiilor, reconstrucția căilor ferate (consolidarea sectoarelor și traseelor feroviare) și alte grupe de construcții din rețeaua existentă", "0.8"),
  row("018", "transport", "Construcții de transport", "Drumuri auto", "1.9"),
  row("019", "transport", "Construcții de transport", "Poduri de cale ferată și de autostradă cu lungimea peste 50 m, viaducte", "3.6"),
  row("020A", "transport", "Construcții de transport", "Poduri și viaducte urbane în localități cu dislocație permanentă a organizațiilor de construcții poduri", "1.8"),
  row("020B", "transport", "Construcții de transport", "Poduri și viaducte urbane în alte puncte", "3.0"),
  row("021A", "transport", "Construcții de transport", "Aerodromuri — terenuri aerodromuri", "2.4"),
  row("021B", "transport", "Construcții de transport", "Aerodromuri — clădiri și construcții din zona de deservire tehnică", "0.9"),
  row("022", "transport", "Construcții de transport", "Obiecte de transport fluvial", "2.4"),
  row("023", "transport", "Construcții de transport", "Tuneluri de colector", "2.8"),

  row("024", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Clădiri de locuit, inclusiv cu încăperi incorporate (magazine, spălătorii etc.), microraioane, cartiere, complexe de clădiri publice și de locuit (inclusiv rețele exterioare și amenajări), amenajări orașe (inclusiv lucrările de amenajare a străzilor, drumurilor de acces, trotuarelor, zonelor verzi)", "0.5"),
  row("025", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Școli, grădinițe de copii, magazine, clădiri administrative, cinematografe, teatre, galerii de artă și alte clădiri cu destinație civilă", "0.8"),
  row("026", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Clădiri și construcții de învățământ și medicale, institute de cercetări științifice și de proiectări", "0.8"),
  row("027", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Obiecte comunale (băi, spălătorii, crematorii etc.)", "0.7"),
  row("028", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Rețele exterioare apă, canalizări, termice, gaze în limitele localităților", "0.6"),
  row("029", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Alimentare cu apă și canalizare (complex de construcții inginerești în componența conductelor, stații de pompare, instalații de epurare etc.)", "1.0"),
  row("030", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Transportul urban electric (troleibuze, substații de tracțiune, stații terminus, ateliere, servicii de întreținere a căii și instalații energetice)", "1.4"),
  row("031", "civil", "Construcții civile și de locuințe în localități de tip oraș", "Sanatorii, case de odihnă, baze de turism, pensioane, profilatorii, tabere de odihnă pentru copii", "0.9"),

  row("032", "other", "Alte tipuri de construcții", "Clădiri și construcții de recepționare, depozitare și prelucrare a cerealelor și fabrici de pâine", "1.5"),
  row("033A", "other", "Alte tipuri de construcții", "Obiecte pentru ministerul apărării — militare și speciale", "1.5"),
  row("033B", "other", "Alte tipuri de construcții", "Obiecte pentru ministerul apărării — locuințe, cazărmi, comunale și social-culturale", "1.1"),
  row("034A", "other", "Alte tipuri de construcții", "Telecomunicații — linii de radiorelee", "3.0"),
  row("034B", "other", "Alte tipuri de construcții", "Telecomunicații — construcții de centrale, linii de telecomunicații aeriene și de cabluri, oficii poștale, centre de telecomunicații județene etc.", "2.0"),
  row("034C", "other", "Alte tipuri de construcții", "Telecomunicații — rețele urbane, linii și centre intercentrale, obiecte TV și radiodifuziune", "1.4"),
  row("035", "other", "Alte tipuri de construcții", "Construcții agricole, inclusiv de locuințe și civile în localități rurale (exclusiv drumuri auto și obiecte de electrificare)", "1.4"),
  row("036", "other", "Alte tipuri de construcții", "Construcții pentru gospodărirea apei, hidrotehnice, construcții pentru piscicultură", "1.5"),
  row("037A", "other", "Alte tipuri de construcții", "Conducte magistrale extraurbane — apă și canalizare", "1.3"),
  row("037B", "other", "Alte tipuri de construcții", "Conducte magistrale extraurbane — gaze și petrol", "1.1"),
  row("037C", "other", "Alte tipuri de construcții", "Conducte magistrale extraurbane — rețele termice", "1.1"),
  row("038", "other", "Alte tipuri de construcții", "Instalații de epurare, stații de alimentare cu apă și canalizare construite conform unui proiect independent", "1.7"),
  row("039", "other", "Alte tipuri de construcții", "Întreprinderi de aprovizionare", "1.3"),
  row("040", "other", "Alte tipuri de construcții", "Întreprinderi din alte ramuri de producție", "1.3"),
];
