import { readFileSync } from 'node:fs';

function loadJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

export const TARIFFS_2026 = Object.freeze(loadJson('../data/tariffs-piscine-2026.json'));
export const CHEMISTRY_RULES = Object.freeze(loadJson('../data/chemistry-dosage-rules.json'));
export const FILTRATION_SPECS = Object.freeze(loadJson('../data/filtration-specs.json'));
export const HEATPUMP_ZONES = Object.freeze(loadJson('../data/heatpump-climate-zones.json'));

/**
 * Standard round half up matching Python Decimal ROUND_HALF_UP.
 */
export function roundHalfUp(value, decimals = 0) {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.floor(Math.abs(value) * factor + 0.5 + 1e-10)) / factor;
}

/**
 * Tolerant decimal parser accepting French comma (",") and dot ("."), ignoring spaces.
 */
export function parseFrNumber(raw, fallback) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  if (raw === null || raw === undefined || raw === '') return fallback;
  const normalized = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * French number formatting with plain space thousands separator and comma decimal.
 */
export function formatFr(value, decimals = 0) {
  const rounded = roundHalfUp(value, decimals);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const prefix = negative ? '-' : '';
  return decPart !== undefined ? `${prefix}${spacedInt},${decPart}` : `${prefix}${spacedInt}`;
}

export function formatCurrency(value, currency = '€') {
  return `${formatFr(value, 2)} ${currency}`;
}

export function pluralize(count, singular, plural) {
  return count > 1 ? plural : singular;
}

export function getElectricityPreset(key = TARIFFS_2026.electricity.defaultKey) {
  return (
    TARIFFS_2026.electricity.presets.find((preset) => preset.key === key) ??
    TARIFFS_2026.electricity.presets[0]
  );
}

export function getWaterPreset(key = TARIFFS_2026.water.defaultKey) {
  return (
    TARIFFS_2026.water.presets.find((preset) => preset.key === key) ??
    TARIFFS_2026.water.presets[0]
  );
}

// ============================================================
// CORE 1 — VOLUME & EAU
// ============================================================

export function getUrbanismeStatus(surfaceM2) {
  if (surfaceM2 <= TARIFFS_2026.urbanisme.dispenseMaxM2) {
    return {
      level: 'dispense',
      badge: 'Dispense ≤ 10 m²',
      label: 'Dispense de déclaration préalable (hors secteur protégé / PLU spécifique)',
      article: "Code de l'urbanisme art. R*421-2",
    };
  }
  if (surfaceM2 <= TARIFFS_2026.urbanisme.dpMaxM2) {
    return {
      level: 'dp',
      badge: 'DP requise',
      label: 'Déclaration préalable de travaux (DP) requise en mairie (10–100 m²)',
      article: "Code de l'urbanisme art. R*421-9",
    };
  }
  return {
    level: 'permis',
    badge: 'Permis requis',
    label: 'Permis de construire obligatoire en mairie (> 100 m²)',
    article: "Code de l'urbanisme art. R*421-1",
  };
}

export function calculateVolume(input) {
  const waterPreset = input.waterPreset ? getWaterPreset(input.waterPreset) : null;
  const waterPricePerM3 = clamp(input.waterPricePerM3 ?? waterPreset?.price ?? 4.89, 0.1, 30);
  const currency = input.currency ?? waterPreset?.currency ?? '€';
  const L = clamp(input.longueur ?? 8, 1, 50);
  const l = clamp(input.largeur ?? 4, 1, 30);
  const D = clamp(input.diametre ?? 4, 1, 30);
  const hMinRaw = clamp(input.hMin, 0.3, 4.0);
  const hMaxRaw = clamp(input.hMax ?? input.hMin, 0.3, 4.5);
  const hMin = Math.min(hMinRaw, hMaxRaw);
  const hMax = Math.max(hMinRaw, hMaxRaw);

  let surfaceExact = 0;
  let volumeExact = 0;
  let hMoyExact = hMin;

  switch (input.shape) {
    case 'rect_plat': {
      surfaceExact = L * l;
      hMoyExact = hMinRaw;
      volumeExact = surfaceExact * hMinRaw;
      break;
    }
    case 'rect_pente': {
      surfaceExact = L * l;
      hMoyExact = (hMin + hMax) / 2;
      volumeExact = surfaceExact * hMoyExact;
      break;
    }
    case 'rect_compose': {
      surfaceExact = L * l;
      const l1 = clamp(input.l1 ?? L * 0.4, 0, L);
      const l2 = clamp(input.l2 ?? L * 0.3, 0, Math.max(0, L - l1));
      const l3 = Math.max(0, L - l1 - l2);
      volumeExact = l * (l1 * hMin + l2 * ((hMin + hMax) / 2) + l3 * hMax);
      hMoyExact = surfaceExact > 0 ? volumeExact / surfaceExact : hMin;
      break;
    }
    case 'rect_diamant': {
      surfaceExact = L * l;
      const ratio = clamp(input.diamondRatio ?? 0.35, 0.1, 0.8);
      const lb = L * ratio;
      const wb = l * ratio;
      const sb = lb * wb;
      const sm = ((L + lb) / 2) * ((l + wb) / 2);
      volumeExact = surfaceExact * hMin + ((hMax - hMin) / 6) * (surfaceExact + sb + 4 * sm);
      hMoyExact = surfaceExact > 0 ? volumeExact / surfaceExact : hMin;
      break;
    }
    case 'ronde': {
      const r = D / 2;
      surfaceExact = Math.PI * r * r;
      hMoyExact = hMinRaw;
      volumeExact = surfaceExact * hMinRaw;
      break;
    }
    case 'ovale': {
      const major = Math.max(L, l);
      const minor = Math.min(L, l);
      if (input.ovalMode === 'ellipse') {
        surfaceExact = (Math.PI * major * minor) / 4;
      } else {
        surfaceExact = (major - minor) * minor + Math.PI * Math.pow(minor / 2, 2);
      }
      hMoyExact = (hMin + hMax) / 2;
      volumeExact = surfaceExact * hMoyExact;
      break;
    }
    case 'octogonale': {
      const major = Math.max(L, l);
      const minor = Math.min(L, l);
      surfaceExact = (major - minor) * minor + 2 * (Math.SQRT2 - 1) * minor * minor;
      hMoyExact = hMinRaw;
      volumeExact = surfaceExact * hMinRaw;
      break;
    }
    case 'forme_libre': {
      const freeformCoeff = clamp(input.freeformCoeff ?? 0.85, 0.5, 1.0);
      surfaceExact = L * l * freeformCoeff;
      hMoyExact = (hMin + hMax) / 2;
      volumeExact = surfaceExact * hMoyExact;
      break;
    }
    default: {
      throw new Error(`Forme de bassin non reconnue : "${String(input.shape)}"`);
    }
  }

  const surfaceM2 = roundHalfUp(surfaceExact, 2);
  const volumeM3 = roundHalfUp(volumeExact, 1);
  const hMoyM = roundHalfUp(hMoyExact, 2);
  const litres = Math.round(volumeM3 * 1000);
  const fillCostEur = roundHalfUp(volumeM3 * waterPricePerM3, 2);

  return {
    surfaceExact,
    surfaceM2,
    hMoyM,
    volumeExactM3: volumeExact,
    volumeM3,
    litres,
    fillCostEur,
    waterPricePerM3,
    currency,
    urbanisme: getUrbanismeStatus(surfaceM2),
  };
}

// ============================================================
// CORE 2 — DOSAGE EAU : CHLORE · pH · SEL
// ============================================================

export function calculateHoclEfficiency(phActuel) {
  const ph = clamp(phActuel, 5.5, 9.5);
  const raw = 100 / (1 + Math.pow(10, ph - CHEMISTRY_RULES.ph.pKa25C));
  const percent = roundHalfUp(raw, 1);

  if (ph >= CHEMISTRY_RULES.ph.alertHigh) {
    return {
      percent,
      level: 'alert',
      badge: 'Alerte pH',
      message: `À pH ${formatFr(ph, 1)}, seul ${formatFr(percent, 1)} % du chlore reste actif : corrigez impérativement le pH avant de chlorer, sinon deux tiers du produit seront gaspillés.`,
    };
  }
  if (ph > CHEMISTRY_RULES.ph.optimalMax) {
    return {
      percent,
      level: 'warn',
      badge: 'pH élevé',
      message: `À pH ${formatFr(ph, 1)}, l'efficacité du chlore chute à ${formatFr(percent, 1)} %. Ramenez le pH vers 7,2 pour retrouver une désinfection nette.`,
    };
  }
  if (ph < CHEMISTRY_RULES.ph.optimalMin) {
    return {
      percent,
      level: 'warn',
      badge: 'pH bas',
      message: `À pH ${formatFr(ph, 1)}, le chlore est très actif (${formatFr(percent, 1)} %), mais l'eau devient corrosive pour le liner, les joints et les yeux.`,
    };
  }
  return {
    percent,
    level: 'optimal',
    badge: 'pH optimal',
    message: `À pH ${formatFr(ph, 1)}, ${formatFr(percent, 1)} % du chlore est actif (HOCl) : désinfection optimale et confort de baignade préservé.`,
  };
}

export function calculateDosage(input) {
  const V = roundHalfUp(clamp(input.volumeM3, 1, 300), 1);
  const chlorineMode = input.chlorineMode ?? 'choc';
  const clActuel = clamp(input.clActuel ?? 0.2, 0, 10);
  const clCible = clamp(input.clCible ?? 2.0, 0, 10);
  const phActuel = clamp(input.phActuel ?? 7.8, 5.8, 9.0);
  const phCible = clamp(input.phCible ?? 7.2, 6.8, 7.6);
  const phMinusCoeff = clamp(input.phMinusCoeff ?? CHEMISTRY_RULES.ph.phMinusGPerM3Per01, 5, 40);
  const phPlusCoeff = clamp(input.phPlusCoeff ?? CHEMISTRY_RULES.ph.phPlusGPerM3Per01, 5, 40);
  const selActuel = clamp(input.selActuel ?? 0, 0, 10);
  const selCible = clamp(input.selCible ?? CHEMISTRY_RULES.salt.recommendedDefaultGL, 1, 8);

  const chocGrams = roundHalfUp(V * CHEMISTRY_RULES.chlorine.shockGPerM3, 0);
  const chocPastilles20g = Math.ceil(chocGrams / CHEMISTRY_RULES.chlorine.shockTabletG);
  const lentGramsPerWeek = roundHalfUp(V * CHEMISTRY_RULES.chlorine.slowGPerM3PerWeek, 0);
  const lentGalets200g = roundHalfUp(lentGramsPerWeek / CHEMISTRY_RULES.chlorine.slowGaletG, 1);
  const adjustGrams = roundHalfUp(
    V * Math.max(0, clCible - clActuel) * CHEMISTRY_RULES.chlorine.adjustGPerM3PerMgL,
    0
  );

  let activeGrams = chocGrams;
  let activeNote = `${chocPastilles20g} ${pluralize(chocPastilles20g, 'pastille', 'pastilles')} de 20 g`;
  if (chlorineMode === 'lent') {
    activeGrams = lentGramsPerWeek;
    activeNote = `${formatFr(lentGalets200g, 1)} ${lentGalets200g > 1 ? 'galets' : 'galet'} de 200 g / semaine`;
  } else if (chlorineMode === 'ajustement') {
    activeGrams = adjustGrams;
    activeNote = `poudre 56 % chlore actif (+${formatFr(Math.max(0, clCible - clActuel), 1)} mg/L)`;
  }

  const diffPh = roundHalfUp(phActuel - phCible, 2);
  let direction = 'ok';
  let productLabel = 'pH équilibré';
  let phGrams = 0;

  if (diffPh > 0.001) {
    direction = 'minus';
    productLabel = 'pH- (pH moins)';
    phGrams = roundHalfUp(V * (diffPh / 0.1) * phMinusCoeff, 0);
  } else if (diffPh < -0.001) {
    direction = 'plus';
    productLabel = 'pH+ (pH plus)';
    phGrams = roundHalfUp(V * (Math.abs(diffPh) / 0.1) * phPlusCoeff, 0);
  }

  const stepsCount = Math.max(1, Math.ceil(Math.abs(diffPh) / 0.2));
  const efficiency = calculateHoclEfficiency(phActuel);

  const selKg = roundHalfUp(V * Math.max(0, selCible - selActuel), 1);
  const bags25kg = selKg > 0 ? Math.ceil(selKg / CHEMISTRY_RULES.salt.bagWeightKg) : 0;

  return {
    volumeM3: V,
    chlorine: {
      chocGrams,
      chocPastilles20g,
      lentGramsPerWeek,
      lentGalets200g,
      adjustGrams,
      activeGrams,
      activeNote,
    },
    ph: {
      phActuel,
      phCible,
      direction,
      productLabel,
      grams: phGrams,
      kg: roundHalfUp(phGrams / 1000, 2),
      stepsCount,
      efficiency,
    },
    sel: {
      selActuel,
      selCible,
      kg: selKg,
      bags25kg,
    },
  };
}

// ============================================================
// CORE 3 — POMPE & FILTRATION
// ============================================================

export function matchFilterTier(qMinM3h) {
  for (const tier of FILTRATION_SPECS.tiers) {
    if (qMinM3h <= tier.maxFlowM3h) return tier;
  }
  return FILTRATION_SPECS.tiers[FILTRATION_SPECS.tiers.length - 1];
}

export function calculateFiltration(input) {
  const V = roundHalfUp(clamp(input.volumeM3, 1, 300), 1);
  const waterTempC = clamp(input.waterTempC ?? 26, 2, 34);
  const media = input.media ?? 'sable';
  const preset = input.electricityPreset ? getElectricityPreset(input.electricityPreset) : null;
  const electricityPrice = clamp(input.electricityPrice ?? preset?.price ?? 0.2001, 0.05, 1.5);
  const currency = input.currency ?? preset?.currency ?? '€';

  const qMinM3h = roundHalfUp(
    (V / FILTRATION_SPECS.turnoverHours) * FILTRATION_SPECS.hydraulicMargin,
    2
  );
  const tier = matchFilterTier(qMinM3h);

  const activePumpKw =
    input.pumpKwOverride && input.pumpKwOverride > 0
      ? clamp(input.pumpKwOverride, 0.15, 5.0)
      : tier.pumpKw;

  let hoursPerDay;
  let tempMode = 'standard';
  let tempBadge = 'T°C ÷ 2';

  if (waterTempC >= 30) {
    hoursPerDay = 24.0;
    tempMode = 'canicule';
    tempBadge = 'Canicule 24 h';
  } else if (waterTempC < 12) {
    hoursPerDay = Math.max(2.0, roundHalfUp(waterTempC / 2, 1));
    tempMode = 'hivernage';
    tempBadge = 'Hivernage';
  } else {
    hoursPerDay = roundHalfUp(waterTempC / 2, 1);
  }

  const monthlyKwh = roundHalfUp(activePumpKw * hoursPerDay * 30, 1);
  const monthlyCost = roundHalfUp(monthlyKwh * electricityPrice, 2);

  const selectedMediaKg = media === 'verre' ? tier.glassKg : tier.sandKg;
  const selectedMediaBags25kg = media === 'verre' ? tier.glassBags : tier.sandBags;
  const gravelBottomKg = roundHalfUp(selectedMediaKg * FILTRATION_SPECS.gravelLayerRatio, 0);
  const fineTopKg = Math.max(0, selectedMediaKg - gravelBottomKg);

  return {
    volumeM3: V,
    qMinM3h,
    filterDiameterMm: tier.diameterMm,
    filterRatedFlowM3h: tier.ratedFlowM3h,
    sandKg: tier.sandKg,
    sandBags25kg: tier.sandBags,
    glassKg: tier.glassKg,
    glassBags25kg: tier.glassBags,
    selectedMedia: media,
    selectedMediaKg,
    selectedMediaBags25kg,
    gravelBottomKg,
    fineTopKg,
    recommendedPumpKw: tier.pumpKw,
    pumpCv: tier.pumpCv,
    activePumpKw,
    waterTempC,
    hoursPerDay,
    tempMode,
    tempBadge,
    monthlyKwh,
    monthlyCost,
    electricityPrice,
    currency,
  };
}

// ============================================================
// CORE 4 — POMPE À CHALEUR / THERMOPOMPE
// ============================================================

export function calculateHeatPump(input) {
  const V = roundHalfUp(clamp(input.volumeM3, 1, 300), 1);
  const zoneKey = input.zone ?? 'centre';
  const coverMode = input.cover ?? 'avec_bache';
  const seasonKey = input.season ?? 'standard';
  const preset = input.electricityPreset ? getElectricityPreset(input.electricityPreset) : null;
  const electricityPrice = clamp(input.electricityPrice ?? preset?.price ?? 0.2001, 0.05, 1.5);
  const currency = input.currency ?? preset?.currency ?? '€';

  const zone = HEATPUMP_ZONES.zones.find((z) => z.key === zoneKey) ?? HEATPUMP_ZONES.zones[1];
  const season = HEATPUMP_ZONES.seasons.find((s) => s.key === seasonKey) ?? HEATPUMP_ZONES.seasons[0];

  const computeForCover = (mode) => {
    const cov = HEATPUMP_ZONES.covers[mode];
    const pTh = roundHalfUp(V * season.cMontee * zone.kClimat * cov.kCouverture, 2);
    const pRec = Math.ceil(pTh);
    const kwh = roundHalfUp(
      (pTh * zone.hoursPerDay * season.days * cov.mCouverture) / zone.cop,
      1
    );
    const cost = roundHalfUp(kwh * electricityPrice, 2);
    return { pTh, pRec, kwh, cost };
  };

  const withCov = computeForCover('avec_bache');
  const withoutCov = computeForCover('sans_bache');
  const active = coverMode === 'avec_bache' ? withCov : withoutCov;

  return {
    volumeM3: V,
    zoneKey: zone.key,
    zoneLabel: zone.label,
    zoneShortLabel: zone.shortLabel,
    coverMode,
    seasonKey: season.key,
    seasonDays: season.days,
    cop: zone.cop,
    hoursPerDay: zone.hoursPerDay,
    pTheoreticalKw: active.pTh,
    pRecommendedKw: active.pRec,
    seasonKwh: active.kwh,
    seasonCost: active.cost,
    withCoverPThKw: withCov.pTh,
    withCoverKwh: withCov.kwh,
    withCoverCost: withCov.cost,
    withoutCoverPThKw: withoutCov.pTh,
    withoutCoverKwh: withoutCov.kwh,
    withoutCoverCost: withoutCov.cost,
    coverSavingsCost: roundHalfUp(withoutCov.cost - withCov.cost, 2),
    coverSavingsKwh: roundHalfUp(withoutCov.kwh - withCov.kwh, 1),
    electricityPrice,
    currency,
  };
}

export function getFullMaintenanceSnapshot(volumeM3, zone = 'centre') {
  const V = roundHalfUp(clamp(volumeM3, 1, 300), 1);
  const fillCost = roundHalfUp(V * 4.89, 2);
  const dosage = calculateDosage({
    volumeM3: V,
    phActuel: 7.8,
    phCible: 7.2,
    selActuel: 0,
    selCible: 4.0,
  });
  const filtration = calculateFiltration({
    volumeM3: V,
    waterTempC: 26,
    media: 'sable',
    electricityPrice: 0.2001,
  });
  const pac = calculateHeatPump({
    volumeM3: V,
    zone,
    cover: 'avec_bache',
    season: 'standard',
    electricityPrice: 0.2001,
  });

  return {
    volumeM3: V,
    litres: Math.round(V * 1000),
    fillCost,
    dosage,
    filtration,
    pac,
  };
}
