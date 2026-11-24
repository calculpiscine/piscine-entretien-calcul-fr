export type BasinShape =
  | 'rect_plat'
  | 'rect_pente'
  | 'rect_compose'
  | 'rect_diamant'
  | 'ronde'
  | 'ovale'
  | 'octogonale'
  | 'forme_libre';

export type OvalMode = 'standard' | 'ellipse';
export type ChlorineMode = 'choc' | 'lent' | 'ajustement';
export type MediaType = 'sable' | 'verre';
export type ClimateZoneKey = 'sud' | 'centre' | 'nord' | 'quebec';
export type CoverMode = 'avec_bache' | 'sans_bache';
export type SeasonKey = 'standard' | 'prolongee';
export type ElectricityPresetKey = 'fr_edf' | 'be_ref' | 'ch_ref' | 'qc_hq';
export type WaterPresetKey = 'fr_sispea_complet' | 'fr_sispea_eau_seule' | 'be_ch_ref';

export interface TariffPreset {
  key: string;
  country: string;
  label: string;
  shortLabel: string;
  price: number;
  currency: string;
  currencyCode: string;
  source: string;
}

export interface FilterTier {
  id: string;
  maxFlowM3h: number;
  diameterMm: number;
  ratedFlowM3h: number;
  sandKg: number;
  sandBags: number;
  glassKg: number;
  glassBags: number;
  pumpKw: number;
  pumpCv: string;
}

export interface VolumeInput {
  shape: BasinShape;
  longueur?: number;
  largeur?: number;
  diametre?: number;
  hMin: number;
  hMax?: number;
  l1?: number;
  l2?: number;
  diamondRatio?: number;
  ovalMode?: OvalMode;
  freeformCoeff?: number;
  waterPreset?: WaterPresetKey;
  waterPricePerM3?: number;
  currency?: string;
}

export interface UrbanismeStatus {
  level: 'dispense' | 'dp' | 'permis';
  badge: string;
  label: string;
  article: string;
}

export interface VolumeResult {
  surfaceExact: number;
  surfaceM2: number;
  hMoyM: number;
  volumeExactM3: number;
  volumeM3: number;
  litres: number;
  fillCostEur: number;
  waterPricePerM3: number;
  currency: string;
  urbanisme: UrbanismeStatus;
}

export interface DosageInput {
  volumeM3: number;
  chlorineMode?: ChlorineMode;
  clActuel?: number;
  clCible?: number;
  phActuel?: number;
  phCible?: number;
  phMinusCoeff?: number;
  phPlusCoeff?: number;
  selActuel?: number;
  selCible?: number;
}

export interface PhEfficiencyStatus {
  percent: number;
  level: 'optimal' | 'warn' | 'alert';
  badge: string;
  message: string;
}

export interface DosageResult {
  volumeM3: number;
  chlorine: {
    chocGrams: number;
    chocPastilles20g: number;
    lentGramsPerWeek: number;
    lentGalets200g: number;
    adjustGrams: number;
    activeGrams: number;
    activeNote: string;
  };
  ph: {
    phActuel: number;
    phCible: number;
    direction: 'minus' | 'plus' | 'ok';
    productLabel: string;
    grams: number;
    kg: number;
    stepsCount: number;
    efficiency: PhEfficiencyStatus;
  };
  sel: {
    selActuel: number;
    selCible: number;
    kg: number;
    bags25kg: number;
  };
}

export interface FiltrationInput {
  volumeM3: number;
  waterTempC?: number;
  media?: MediaType;
  pumpKwOverride?: number | null;
  electricityPreset?: ElectricityPresetKey;
  electricityPrice?: number;
  currency?: string;
}

export interface FiltrationResult {
  volumeM3: number;
  qMinM3h: number;
  filterDiameterMm: number;
  filterRatedFlowM3h: number;
  sandKg: number;
  sandBags25kg: number;
  glassKg: number;
  glassBags25kg: number;
  selectedMedia: MediaType;
  selectedMediaKg: number;
  selectedMediaBags25kg: number;
  gravelBottomKg: number;
  fineTopKg: number;
  recommendedPumpKw: number;
  pumpCv: string;
  activePumpKw: number;
  waterTempC: number;
  hoursPerDay: number;
  tempMode: 'hivernage' | 'standard' | 'canicule';
  tempBadge: string;
  monthlyKwh: number;
  monthlyCost: number;
  electricityPrice: number;
  currency: string;
}

export interface HeatPumpInput {
  volumeM3: number;
  zone?: ClimateZoneKey;
  cover?: CoverMode;
  season?: SeasonKey;
  electricityPreset?: ElectricityPresetKey;
  electricityPrice?: number;
  currency?: string;
}

export interface HeatPumpResult {
  volumeM3: number;
  zoneKey: ClimateZoneKey;
  zoneLabel: string;
  zoneShortLabel: string;
  coverMode: CoverMode;
  seasonKey: SeasonKey;
  seasonDays: number;
  cop: number;
  hoursPerDay: number;
  pTheoreticalKw: number;
  pRecommendedKw: number;
  seasonKwh: number;
  seasonCost: number;
  withCoverPThKw: number;
  withCoverKwh: number;
  withCoverCost: number;
  withoutCoverPThKw: number;
  withoutCoverKwh: number;
  withoutCoverCost: number;
  coverSavingsCost: number;
  coverSavingsKwh: number;
  electricityPrice: number;
  currency: string;
}

export interface MaintenanceSnapshot {
  volumeM3: number;
  litres: number;
  fillCost: number;
  dosage: DosageResult;
  filtration: FiltrationResult;
  pac: HeatPumpResult;
}

export declare const TARIFFS_2026: Readonly<Record<string, unknown>>;
export declare const CHEMISTRY_RULES: Readonly<Record<string, unknown>>;
export declare const FILTRATION_SPECS: Readonly<Record<string, unknown>>;
export declare const HEATPUMP_ZONES: Readonly<Record<string, unknown>>;

export declare function roundHalfUp(value: number, decimals?: number): number;
export declare function parseFrNumber(raw: string | number | null | undefined, fallback: number): number;
export declare function clamp(value: number, min: number, max: number): number;
export declare function formatFr(value: number, decimals?: number): string;
export declare function formatCurrency(value: number, currency?: string): string;
export declare function pluralize(count: number, singular: string, plural: string): string;
export declare function getElectricityPreset(key?: ElectricityPresetKey): TariffPreset;
export declare function getWaterPreset(key?: WaterPresetKey): TariffPreset;

export declare function getUrbanismeStatus(surfaceM2: number): UrbanismeStatus;
export declare function calculateVolume(input: VolumeInput): VolumeResult;
export declare function calculateHoclEfficiency(phActuel: number): PhEfficiencyStatus;
export declare function calculateDosage(input: DosageInput): DosageResult;
export declare function matchFilterTier(qMinM3h: number): FilterTier;
export declare function calculateFiltration(input: FiltrationInput): FiltrationResult;
export declare function calculateHeatPump(input: HeatPumpInput): HeatPumpResult;
export declare function getFullMaintenanceSnapshot(
  volumeM3: number,
  zone?: ClimateZoneKey
): MaintenanceSnapshot;
