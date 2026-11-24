import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TARIFFS_2026,
  CHEMISTRY_RULES,
  FILTRATION_SPECS,
  HEATPUMP_ZONES,
  roundHalfUp,
  parseFrNumber,
  clamp,
  formatFr,
  formatCurrency,
  pluralize,
  getElectricityPreset,
  getWaterPreset,
  getUrbanismeStatus,
  calculateVolume,
  calculateHoclEfficiency,
  calculateDosage,
  matchFilterTier,
  calculateFiltration,
  calculateHeatPump,
  getFullMaintenanceSnapshot,
} from '../src/index.js';

test('Utilitaires numériques et formatage français', () => {
  assert.equal(roundHalfUp(2.25, 1), 2.3);
  assert.equal(roundHalfUp(8.4375, 2), 8.44);
  assert.equal(roundHalfUp(-1.25, 1), -1.3);
  assert.equal(roundHalfUp(Number.NaN, 2), 0);

  assert.equal(parseFrNumber('4 850,5', 0), 4850.5);
  assert.equal(parseFrNumber('12.75', 0), 12.75);
  assert.equal(parseFrNumber('', 42), 42);
  assert.equal(parseFrNumber(null, 15), 15);

  assert.equal(clamp(500, 1, 300), 300);
  assert.equal(clamp(-5, 1, 300), 1);
  assert.equal(clamp(Number.NaN, 1, 300), 1);

  assert.equal(formatFr(12345.67, 2), '12 345,67');
  assert.equal(formatFr(-980, 0), '-980');
  assert.equal(formatCurrency(220.05, '€'), '220,05 €');
  assert.equal(pluralize(1, 'pastille', 'pastilles'), 'pastille');
  assert.equal(pluralize(2, 'pastille', 'pastilles'), 'pastilles');
});

test('CORE 1 — Volume piscine (toutes formes, coût SISPEA 2026 et urbanisme)', () => {
  // Cas de référence 8 × 4 m fond composé = 45,0 m³ exact
  const compose = calculateVolume({
    shape: 'rect_compose',
    longueur: 8,
    largeur: 4,
    hMin: 1.1,
    hMax: 1.8,
    l1: 3.5,
    l2: 2.0,
  });
  assert.equal(compose.surfaceM2, 32);
  assert.equal(compose.volumeM3, 45);
  assert.equal(compose.litres, 45000);
  assert.equal(compose.hMoyM, 1.41);
  assert.equal(compose.fillCostEur, 220.05);
  assert.equal(compose.urbanisme.level, 'dp');

  // Familiale 8 × 4 m pente douce 1,2–1,8 m = 48,0 m³
  const pente = calculateVolume({
    shape: 'rect_pente',
    longueur: 8,
    largeur: 4,
    hMin: 1.2,
    hMax: 1.8,
  });
  assert.equal(pente.volumeM3, 48);
  assert.equal(pente.hMoyM, 1.5);
  assert.equal(pente.fillCostEur, 234.72);

  // Mini-piscine 4 × 2,5 m = 10 m² (dispense DP)
  const mini = calculateVolume({
    shape: 'rect_plat',
    longueur: 4,
    largeur: 2.5,
    hMin: 1.4,
    waterPreset: 'fr_sispea_eau_seule',
  });
  assert.equal(mini.surfaceM2, 10);
  assert.equal(mini.volumeM3, 14);
  assert.equal(mini.fillCostEur, 35);
  assert.equal(mini.urbanisme.level, 'dispense');

  // Pointe de diamant (formule prismatoïdale exacte)
  const diamant = calculateVolume({
    shape: 'rect_diamant',
    longueur: 8,
    largeur: 4,
    hMin: 1.2,
    hMax: 2.0,
    diamondRatio: 0.35,
  });
  assert.equal(diamant.surfaceM2, 32);
  assert.ok(diamant.volumeM3 > 45 && diamant.volumeM3 < 55);

  // Ronde Ø 5,5 m × 1,32 m
  const ronde = calculateVolume({
    shape: 'ronde',
    diametre: 5.5,
    hMin: 1.32,
  });
  assert.equal(ronde.surfaceM2, 23.76);
  assert.equal(ronde.volumeM3, 31.4);

  // Ovale standard vs ellipse
  const ovalStd = calculateVolume({
    shape: 'ovale',
    longueur: 8,
    largeur: 4,
    hMin: 1.4,
    hMax: 1.4,
    ovalMode: 'standard',
  });
  const ovalEll = calculateVolume({
    shape: 'ovale',
    longueur: 8,
    largeur: 4,
    hMin: 1.4,
    hMax: 1.4,
    ovalMode: 'ellipse',
  });
  assert.ok(ovalStd.surfaceM2 > ovalEll.surfaceM2);
  assert.equal(ovalStd.surfaceM2, 28.57);
  assert.equal(ovalEll.surfaceM2, 25.13);

  // Octogonale bois allongée
  const octo = calculateVolume({
    shape: 'octogonale',
    longueur: 6,
    largeur: 4,
    hMin: 1.3,
  });
  assert.equal(octo.surfaceM2, 21.25);
  assert.equal(octo.volumeM3, 27.6);

  // Forme libre (coefficient 0,85)
  const libre = calculateVolume({
    shape: 'forme_libre',
    longueur: 8,
    largeur: 4,
    hMin: 1.2,
    hMax: 1.8,
  });
  assert.equal(libre.surfaceM2, 27.2);
  assert.equal(libre.volumeM3, 40.8);

  // Seuil permis > 100 m²
  assert.equal(getUrbanismeStatus(101).level, 'permis');

  // Forme invalide
  assert.throws(() => calculateVolume({ shape: 'inconnue', hMin: 1.4 }), /Forme de bassin non reconnue/);
});

test('CORE 2 — Dosage Chlore, pH (efficacité HOCl) et Sel électrolyseur', () => {
  // Vérification courbe Henderson-Hasselbalch (pKa = 7,50 à 25 °C)
  assert.equal(calculateHoclEfficiency(7.0).percent, 76.0);
  assert.equal(calculateHoclEfficiency(7.2).percent, 66.6);
  assert.equal(calculateHoclEfficiency(7.4).percent, 55.7);
  assert.equal(calculateHoclEfficiency(7.8).percent, 33.4);
  assert.equal(calculateHoclEfficiency(7.8).level, 'alert');
  assert.equal(calculateHoclEfficiency(8.0).percent, 24.0);
  assert.equal(calculateHoclEfficiency(6.8).level, 'warn');

  // Piscine 45 m³ : pH 7,8 -> 7,2, sel 0 -> 4 g/L
  const d45 = calculateDosage({
    volumeM3: 45,
    chlorineMode: 'choc',
    phActuel: 7.8,
    phCible: 7.2,
    selActuel: 0,
    selCible: 4.0,
  });
  assert.equal(d45.chlorine.chocGrams, 900);
  assert.equal(d45.chlorine.chocPastilles20g, 45);
  assert.equal(d45.chlorine.lentGramsPerWeek, 450);
  assert.equal(d45.chlorine.lentGalets200g, 2.3);
  assert.equal(d45.ph.direction, 'minus');
  assert.equal(d45.ph.grams, 4050);
  assert.equal(d45.ph.kg, 4.05);
  assert.equal(d45.ph.stepsCount, 3);
  assert.equal(d45.sel.kg, 180);
  assert.equal(d45.sel.bags25kg, 8);

  // Piscine 50 m³ sel 4 g/L = 200 kg = 8 sacs de 25 kg
  const d50 = calculateDosage({
    volumeM3: 50,
    chlorineMode: 'ajustement',
    clActuel: 0.5,
    clCible: 2.0,
    phActuel: 6.9,
    phCible: 7.2,
    selActuel: 0,
    selCible: 4.0,
  });
  assert.equal(d50.chlorine.adjustGrams, 135);
  assert.equal(d50.ph.direction, 'plus');
  assert.equal(d50.ph.grams, 1500);
  assert.equal(d50.sel.kg, 200);
  assert.equal(d50.sel.bags25kg, 8);

  // pH déjà équilibré & sel déjà suffisant
  const ok = calculateDosage({
    volumeM3: 30,
    chlorineMode: 'lent',
    phActuel: 7.2,
    phCible: 7.2,
    selActuel: 4.5,
    selCible: 4.0,
  });
  assert.equal(ok.ph.direction, 'ok');
  assert.equal(ok.ph.grams, 0);
  assert.equal(ok.sel.kg, 0);
  assert.equal(ok.sel.bags25kg, 0);
  assert.equal(ok.chlorine.activeGrams, 300);
});

test('CORE 3 — Pompe, filtre sable/verre (-20 %) et durée de filtration', () => {
  // 45 m³ à 26 °C (EDF 2026)
  const f45 = calculateFiltration({
    volumeM3: 45,
    waterTempC: 26,
    media: 'sable',
    electricityPreset: 'fr_edf',
  });
  assert.equal(f45.qMinM3h, 13.5);
  assert.equal(f45.filterDiameterMm, 600);
  assert.equal(f45.sandKg, 150);
  assert.equal(f45.glassKg, 120);
  assert.equal(f45.gravelBottomKg, 45);
  assert.equal(f45.fineTopKg, 105);
  assert.equal(f45.recommendedPumpKw, 1.1);
  assert.equal(f45.hoursPerDay, 13);
  assert.equal(f45.tempMode, 'standard');
  assert.equal(f45.monthlyKwh, 429);
  assert.equal(f45.monthlyCost, 85.84);

  // Mode verre filtrant & canicule 30 °C
  const canicule = calculateFiltration({
    volumeM3: 30,
    waterTempC: 30,
    media: 'verre',
    electricityPreset: 'ch_ref',
  });
  assert.equal(canicule.filterDiameterMm, 500);
  assert.equal(canicule.selectedMediaKg, 80);
  assert.equal(canicule.selectedMediaBags25kg, 4);
  assert.equal(canicule.hoursPerDay, 24);
  assert.equal(canicule.tempMode, 'canicule');
  assert.equal(canicule.currency, 'CHF');

  // Hivernage actif sous 12 °C (plancher 2 h/j)
  const hiver = calculateFiltration({
    volumeM3: 20,
    waterTempC: 3,
  });
  assert.equal(hiver.hoursPerDay, 2);
  assert.equal(hiver.tempMode, 'hivernage');

  // Très grand bassin (> 22 m³/h -> Ø 900 mm)
  assert.equal(matchFilterTier(28).diameterMm, 900);
});

test('CORE 4 — Pompe à chaleur / Thermopompe (FR, BE, CH, Québec) & bâche à bulles', () => {
  // 40 m³ Zone Centre avec bâche (référence 6,00 kW / 900 kWh / 180,09 €)
  const pac40 = calculateHeatPump({
    volumeM3: 40,
    zone: 'centre',
    cover: 'avec_bache',
    season: 'standard',
    electricityPrice: 0.2001,
  });
  assert.equal(pac40.pTheoreticalKw, 6.0);
  assert.equal(pac40.pRecommendedKw, 6);
  assert.equal(pac40.seasonKwh, 900);
  assert.equal(pac40.seasonCost, 180.09);

  // 45 m³ Zone Centre : comparaison avec vs sans bâche
  const pac45 = calculateHeatPump({
    volumeM3: 45,
    zone: 'centre',
    cover: 'avec_bache',
    season: 'standard',
  });
  assert.equal(pac45.pTheoreticalKw, 6.75);
  assert.equal(pac45.pRecommendedKw, 7);
  assert.equal(pac45.seasonKwh, 1012.5);
  assert.equal(pac45.seasonCost, 202.6);
  assert.equal(pac45.withoutCoverPThKw, 8.44);
  assert.equal(pac45.coverSavingsKwh, 886.5);
  assert.equal(pac45.coverSavingsCost, 177.39);

  // Québec avec tarif Hydro-Québec Tarif D (0,103 $ CA/kWh)
  const qc = calculateHeatPump({
    volumeM3: 35,
    zone: 'quebec',
    cover: 'avec_bache',
    season: 'standard',
    electricityPreset: 'qc_hq',
  });
  assert.equal(qc.pTheoreticalKw, 6.56);
  assert.equal(qc.pRecommendedKw, 7);
  assert.equal(qc.currency, '$ CA');
  assert.equal(qc.seasonKwh, 1553.7);
  assert.equal(qc.seasonCost, 160.03);
});

test('Snapshot complet et cohérence des jeux de données JSON & CSV', () => {
  const snap = getFullMaintenanceSnapshot(48, 'centre');
  assert.equal(snap.volumeM3, 48);
  assert.equal(snap.litres, 48000);
  assert.equal(snap.dosage.chlorine.chocGrams, 960);
  assert.equal(snap.dosage.sel.bags25kg, 8);
  assert.equal(snap.filtration.filterDiameterMm, 600);
  assert.equal(snap.pac.pRecommendedKw, 8);

  // Presets FR/BE/CH/CA présents
  assert.equal(getElectricityPreset('fr_edf').price, 0.2001);
  assert.equal(getElectricityPreset('be_ref').price, 0.32);
  assert.equal(getElectricityPreset('ch_ref').price, 0.29);
  assert.equal(getElectricityPreset('qc_hq').price, 0.103);
  assert.equal(getWaterPreset('fr_sispea_complet').price, 4.89);

  // Métadonnées ouvertes requises sur chaque JSON
  for (const dataset of [TARIFFS_2026, CHEMISTRY_RULES, FILTRATION_SPECS, HEATPUMP_ZONES]) {
    assert.ok(typeof dataset.updated_at === 'string' && dataset.updated_at.length === 10);
    assert.ok(Array.isArray(dataset.sources) && dataset.sources.length >= 2);
    assert.ok(String(dataset.reference_calculator).startsWith('https://calculpiscine.com'));
  }

  // Intégrité des fichiers CSV (en-têtes + lignes non vides)
  const csvChecks = [
    { path: '../data/tariffs-piscine-2026.csv', minRows: 7 },
    { path: '../data/chemistry-dosage-rules.csv', minRows: 11 },
    { path: '../data/heatpump-climate-zones.csv', minRows: 4 },
    { path: '../data/filtration-temperature-schedule.csv', minRows: 9 },
  ];

  for (const check of csvChecks) {
    const raw = readFileSync(new URL(check.path, import.meta.url), 'utf8').trim();
    const lines = raw.split('\n');
    const expectedCols = lines[0].split(',').length;
    assert.ok(lines.length - 1 >= check.minRows, `${check.path} doit contenir >= ${check.minRows} lignes`);
    for (let i = 1; i < lines.length; i += 1) {
      assert.equal(
        lines[i].split(',').length,
        expectedCols,
        `Nombre de colonnes incohérent dans ${check.path} ligne ${i + 1}`
      );
    }
  }
});
