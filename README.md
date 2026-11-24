# piscine-entretien-calcul-fr

**Moteur de calcul JavaScript (ESM, sans dépendance) et jeux de données ouverts 2026** pour le calcul du volume de piscine, du dosage chlore/pH/sel (efficacité HOCl), du dimensionnement pompe/filtre et de la puissance de pompe à chaleur (thermopompe) en **France, Belgique, Suisse romande et Québec**.

**Exemple chiffré (bassin familial 8 × 4 m à fond composé, soit 45,0 m³ / 45 000 L)** — avec les barèmes 2026 (SISPEA `4,89 €/m³`, EDF Tarif Bleu Base `0,2001 €/kWh`, zone Centre) : remplissage **220,05 €** (déclaration préalable requise pour 32 m²), chlore choc **900 g** (45 pastilles de 20 g), correction pH 7,8 → 7,2 **4,05 kg** de pH- en 3 paliers, sel électrolyseur à 4 g/L **180 kg** (8 sacs de 25 kg), débit minimal **13,5 m³/h** (filtre Ø 600 mm, pompe 1,10 kW, 13 h/j à 26 °C soit **85,84 €/mois**), pompe à chaleur **≥ 7 kW** (6,75 kW théorique, **202,60 €/saison** avec bâche à bulles vs 379,99 € sans bâche).

> **English summary:** Zero-dependency ESM JavaScript engine and 2026 open reference datasets (JSON & CSV) for residential swimming pool volume, water chemistry (HOCl pH efficiency, chlorine, salt), sand/glass filtration sizing, and heat pump sizing across France, Belgium, Switzerland, and Quebec. Built for Node.js 18+ with TypeScript declarations and deterministic `node:test` coverage.

---

## Tableaux de référence rapide (barèmes 2026)

### 1. Formules de volume selon la forme du bassin

| Forme du bassin | Clé `shape` | Formule de surface (`S`) et volume (`V`) | Usage courant |
| :--- | :--- | :--- | :--- |
| Rectangulaire fond plat | `rect_plat` | `V = L × l × h` | Mini-piscine, couloir de nage |
| Rectangulaire pente douce | `rect_pente` | `V = L × l × (hMin + hMax) / 2` | Piscine familiale enterrée |
| Rectangulaire fond composé | `rect_compose` | `V = l × [L1·hMin + L2·(hMin+hMax)/2 + L3·hMax]` | Petit bain + pente + fosse |
| Pointe de diamant | `rect_diamant` | `V = S·hMin + ((hMax − hMin)/6)·(S + Sb + 4·Sm)` | Formule prismatoïdale exacte |
| Ronde | `ronde` | `V = π × (D / 2)² × h` | Hors-sol (tubulaire, bois, acier) |
| Ovale standard / ellipse | `ovale` | Standard : `[(L−l)·l + π·(l/2)²] × hMoy` · Ellipse : `(π·L·l / 4) × hMoy` | Flancs droits + 2 demi-cercles |
| Octogonale bois | `octogonale` | `V = [(L−l)·l + 2·(√2 − 1)·l²] × h` | Piscine bois régulière ou allongée |
| Forme libre | `forme_libre` | `V = L × l × 0,85 × (hMin + hMax) / 2` | Haricot, lagon, coque libre |

*Seuils d'urbanisme en France (Code de l'urbanisme) : `≤ 10 m²` dispense de déclaration préalable hors secteur protégé (`art. R*421-2`), `10–100 m²` déclaration préalable (`art. R*421-9`), `> 100 m²` permis de construire (`art. R*421-1`).*

### 2. Temps de filtration quotidien selon la température de l'eau

| Température de l'eau | Durée recommandée / jour | Mode | Règle appliquée |
| :---: | :---: | :--- | :--- |
| 8 °C | 4,0 h | Hivernage actif | `max(2 h ; T°C ÷ 2)` |
| 10 °C | 5,0 h | Hivernage actif | `max(2 h ; T°C ÷ 2)` |
| 12 °C | 6,0 h | Standard | `T°C ÷ 2` |
| 16 °C | 8,0 h | Standard | `T°C ÷ 2` |
| 20 °C | 10,0 h | Standard | `T°C ÷ 2` |
| 24 °C | 12,0 h | Standard | `T°C ÷ 2` |
| 26 °C | 13,0 h | Standard (plein été) | `T°C ÷ 2` |
| 28 °C | 14,0 h | Standard (forte chaleur) | `T°C ÷ 2` |
| **≥ 30 °C** | **24,0 h** | **Canicule** | **Filtration continue 24 h/24 anti-algues** |

*Dimensionnement hydraulique : `Qmin = (V ÷ 4) × 1,2` (renouvellement complet en 4 h + 20 % de marge de pertes de charge). Le verre filtrant nécessite `-20 %` de masse par rapport au sable de silice.*

### 3. Tarifs eau & électricité 2026 (FR / BE / CH / CA-QC)

| Zone / Pays | Électricité (2026) | Clé preset | Eau de remplissage (2026) | Source officielle |
| :--- | :---: | :--- | :---: | :--- |
| **France** | `0,2001 €/kWh` | `fr_edf` | `4,89 €/m³` (eau seule : `2,50 €/m³`) | EDF / CRE Tarif Bleu Base TTC 2026 · SISPEA / OFB |
| **Belgique** | `0,3200 €/kWh` | `be_ref` | `5,60 €/m³` (zone dense) | Moyenne tarifaire résidentielle Belgique 2026 |
| **Suisse romande** | `0,2900 CHF/kWh` | `ch_ref` | Tarif communal (personnalisable) | Référence moyenne ElCom Suisse romande 2026 |
| **Québec (CA)** | `0,1030 $ CA/kWh` | `qc_hq` | Tarif municipal (personnalisable) | Hydro-Québec Tarif D 2026 (tranche 2) |

### 4. Dimensionnement pompe à chaleur (PAC / Thermopompe) par zone climatique

Formule : `Pth = V × Cmontee × Kclimat × Kcouverture` (`Cmontee = 0,15` en saison standard 150 j, `0,18` en saison prolongée 210 j ; sans bâche : puissance `× 1,25` et consommation saisonnière `× 1,50`).

| Zone climatique | `Kclimat` | COP saisonnier | Heures / jour | PAC 40 m³ (avec bâche) | PAC 45 m³ (avec bâche) | Budget saison 45 m³ (150 j) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Zone Sud** (PACA, Occitanie, Corse) | `0,85` | `5,0` | `3,5 h` | 5,10 kW (`≥ 6 kW`) | 5,74 kW (`≥ 6 kW`) | `602,7 kWh` · `120,60 €` |
| **Zone Centre / Suisse romande** | `1,00` | `4,5` | `4,5 h` | 6,00 kW (`≥ 6 kW`) | 6,75 kW (`≥ 7 kW`) | `1 012,5 kWh` · `202,60 €` |
| **Zone Nord / Belgique** | `1,15` | `4,0` | `5,5 h` | 6,90 kW (`≥ 7 kW`) | 7,76 kW (`≥ 8 kW`) | `1 600,5 kWh` · `320,26 €` |
| **Québec (CA) & Montagne (> 600 m)** | `1,25` | `3,8` | `6,0 h` | 7,50 kW (`≥ 8 kW`) | 8,44 kW (`≥ 9 kW`) | `1 998,9 kWh` · `205,89 $ CA` |

*Budgets indiqués au Tarif Bleu EDF `0,2001 €/kWh` pour Sud/Centre/Nord et au Tarif D Hydro-Québec `0,103 $ CA/kWh` pour le Québec.*

---

## Installation & utilisation rapide

Prérequis : **Node.js 18+** (aucune dépendance externe).

```js
import {
  calculateVolume,
  calculateDosage,
  calculateFiltration,
  calculateHeatPump,
} from './src/index.js';

// 1. Volume d'une piscine 8 × 4 m à fond composé (45,0 m³)
const vol = calculateVolume({
  shape: 'rect_compose',
  longueur: 8,
  largeur: 4,
  hMin: 1.1,
  hMax: 1.8,
  l1: 3.5,
  l2: 2.0,
});
console.log(vol.volumeM3, vol.fillCostEur, vol.urbanisme.badge);
// -> 45, 220.05, 'DP requise'

// 2. Dosages chlore, pH (efficacité HOCl) et sel
const dosage = calculateDosage({
  volumeM3: vol.volumeM3,
  chlorineMode: 'choc',
  phActuel: 7.8,
  phCible: 7.2,
  selActuel: 0,
  selCible: 4.0,
});
console.log(dosage.chlorine.chocGrams, dosage.ph.efficiency.percent, dosage.sel.bags25kg);
// -> 900, 33.4, 8

// 3. Pompe, filtre à sable/verre et durée de filtration à 26 °C
const filt = calculateFiltration({
  volumeM3: vol.volumeM3,
  waterTempC: 26,
  media: 'sable',
  electricityPreset: 'fr_edf',
});
console.log(filt.qMinM3h, filt.filterDiameterMm, filt.hoursPerDay, filt.monthlyCost);
// -> 13.5, 600, 13, 85.84

// 4. Pompe à chaleur (zone Centre, avec bâche à bulles)
const pac = calculateHeatPump({
  volumeM3: vol.volumeM3,
  zone: 'centre',
  cover: 'avec_bache',
  season: 'standard',
  electricityPreset: 'fr_edf',
});
console.log(pac.pRecommendedKw, pac.seasonCost, pac.coverSavingsCost);
// -> 7, 202.6, 177.39
```

Exécuter la suite de tests unitaires :

```bash
npm test
```

---

## Référence API

| Fonction | Rôle | Entrées principales | Sorties clés |
| :--- | :--- | :--- | :--- |
| `calculateVolume(input)` | Volume, surface, coût de remplissage et urbanisme | `shape`, `longueur`, `largeur`, `diametre`, `hMin`, `hMax`, `waterPreset` | `volumeM3`, `litres`, `surfaceM2`, `fillCostEur`, `urbanisme` |
| `getUrbanismeStatus(surfaceM2)` | Statut administratif France (10 m² / 100 m²) | `surfaceM2` | `level` (`dispense` \| `dp` \| `permis`), `article` |
| `calculateHoclEfficiency(ph)` | Pourcentage de chlore actif HOCl à 25 °C | `phActuel` | `percent`, `level`, `badge`, `message` |
| `calculateDosage(input)` | Chlore choc/lent/ajustement, pH-/pH+ et sel 25 kg | `volumeM3`, `chlorineMode`, `phActuel`, `phCible`, `selActuel`, `selCible` | `chlorine`, `ph` (`grams`, `stepsCount`, `efficiency`), `sel` (`kg`, `bags25kg`) |
| `calculateFiltration(input)` | Débit minimal, diamètre filtre, sable/verre, coût EDF | `volumeM3`, `waterTempC`, `media`, `electricityPreset` | `qMinM3h`, `filterDiameterMm`, `selectedMediaKg`, `hoursPerDay`, `monthlyCost` |
| `matchFilterTier(qMinM3h)` | Sélection du palier de filtre (Ø 400 à Ø 900 mm) | `qMinM3h` | `diameterMm`, `sandKg`, `glassKg`, `pumpKw`, `pumpCv` |
| `calculateHeatPump(input)` | Puissance PAC kW, conso saisonnière et gain bâche | `volumeM3`, `zone`, `cover`, `season`, `electricityPreset` | `pTheoreticalKw`, `pRecommendedKw`, `seasonKwh`, `seasonCost`, `coverSavingsCost` |
| `getFullMaintenanceSnapshot(V, zone)` | Synthèse complète des 4 modules pour un volume donné | `volumeM3`, `zone` | `litres`, `fillCost`, `dosage`, `filtration`, `pac` |

---

## Jeux de données ouverts (`data/`, CC BY 4.0)

| Fichier | Format | Contenu |
| :--- | :---: | :--- |
| `data/tariffs-piscine-2026.json` · `.csv` | JSON + CSV | Tarifs eau et électricité 2026 (FR SISPEA, EDF Tarif Bleu, BE, CH ElCom, Hydro-Québec Tarif D) + seuils d'urbanisme |
| `data/chemistry-dosage-rules.json` · `.csv` | JSON + CSV | Coefficients chlore choc/lent/poudre 56 %, pKa HOCl (7,50), pH-/pH+ et salinité NF EN 16401 |
| `data/filtration-specs.json` | JSON | Paliers filtres Ø 400–900 mm, ratio verre filtrant (-20 %), répartition gravier/fin (30/70 %) et barème températures |
| `data/filtration-temperature-schedule.csv` | CSV | Table directe température de l'eau (8 °C à 30 °C) → durée quotidienne et mode de filtration |
| `data/heatpump-climate-zones.json` · `.csv` | JSON + CSV | Coefficients climatiques `Kclimat`, COP saisonniers, heures/jour et multiplicateurs bâche à bulles (FR/BE/CH/QC) |

---

## Questions fréquentes (FAQ)

### Quelle puissance de pompe à chaleur pour une piscine de 40 m³ ?

Pour une piscine de **40 m³** couverte la nuit (bâche à bulles ou volet) en saison standard (mai à septembre), il faut une pompe à chaleur d'au moins **6 kW en zone Sud ou Centre** (`5,10 kW` théorique en zone Sud, `6,00 kW` en zone Centre soit `900 kWh` / `180,09 €/saison` au tarif EDF 2026), **7 kW en zone Nord / Belgique** (`6,90 kW`) et **8 kW au Québec ou en montagne** (`7,50 kW`). Sans couverture nocturne, majorez la puissance de `+25 %` (≥ 8 kW en zone Centre) et la consommation électrique saisonnière de `+50 %`.

### Combien de sel pour une piscine de 50 m³ ?

Pour démarrer une piscine de **50 m³** au sel à la concentration recommandée de **4 g/L** (eau douce à 0 g/L au départ), il faut exactement **200 kg de sel piscine**, soit **8 sacs de 25 kg** conformes à la norme **NF EN 16401**. Si votre électrolyseur préconise `3 g/L`, prévoyez `150 kg` (6 sacs) ; à `5 g/L`, comptez `250 kg` (10 sacs). En cours de saison, mesurez toujours la salinité actuelle avant de compléter (`V × (Cible − Actuel)`).

### Pourquoi le chlore ne fonctionne-t-il pas quand le pH est à 7,8 ?

À **pH 7,8**, seul **33,4 %** du chlore libre reste sous sa forme active désinfectante (acide hypochloreux, **HOCl**) selon l'équilibre de Henderson-Hasselbalch (`pKa = 7,50` à 25 °C), contre **66,6 % à pH 7,2** et **76,0 % à pH 7,0**. Deux tiers du produit sont donc inefficaces tant que le pH n'est pas corrigé. Il faut d'abord abaisser le pH vers `7,2` par paliers de `0,2` unité maximum avant tout traitement choc.

### Combien d'heures filtrer sa piscine selon la température de l'eau ?

En saison de baignade (`12 °C` à `29 °C`), appliquez la règle **`T°C ÷ 2`** : par exemple `10 h/jour` à `20 °C`, `12 h/jour` à `24 °C`, `13 h/jour` à `26 °C` et `14 h/jour` à `28 °C`. Dès que l'eau atteint ou dépasse **`30 °C` (canicule)**, basculez en filtration continue **24 h/24** pour prévenir le développement rapide des algues. En hivernage actif sous `12 °C`, maintenez `T°C ÷ 2` avec un plancher minimal de **2 h/jour**.

### Faut-il une déclaration préalable en mairie pour une piscine de 10 m² ?

En France métropolitaine, un bassin dont la surface du plan d'eau est **inférieure ou égale à 10 m²** (par exemple une mini-piscine `4 × 2,5 m`) est **dispensé de déclaration préalable** en application de l'article `R*421-2` du Code de l'urbanisme, sauf secteur protégé, site classé ou règle locale spécifique du PLU. Entre **10 m² et 100 m²**, une déclaration préalable de travaux (DP, `art. R*421-9`) est obligatoire ; au-delà de **100 m²**, un permis de construire (`art. R*421-1`) s'impose.

---

## Calculateur interactif & références

- **Calculateur volume piscine & coût de remplissage :** https://calculpiscine.com/
- **Calculateur dosage chlore, pH (jauge HOCl) et sel :** https://calculpiscine.com/dosage-eau/
- **Calculateur pompe, filtre sable/verre et durée de filtration :** https://calculpiscine.com/pompe-filtration/
- **Calculateur pompe à chaleur (PAC / thermopompe) par zone climatique :** https://calculpiscine.com/pompe-a-chaleur/

*Transparence : le calculateur en ligne gratuit sans inscription est maintenu par le même auteur.*  
*Transparency: the free, no-signup online calculator is maintained by the same author.*

### Sources & normes de référence
- **Observatoire national SISPEA / OFB** — Prix moyen de l'eau potable et de l'assainissement en France (`4,89 €/m³`, eau seule `2,50 €/m³`).
- **EDF / CRE** — Tarif Bleu Option Base TTC 2026 (`0,2001 €/kWh`) ; **ElCom** Suisse romande (`0,29 CHF/kWh`) ; **Hydro-Québec** Tarif D 2026 (`0,103 $ CA/kWh`).
- **Code de l'urbanisme** — Articles `R*421-2`, `R*421-9` et `R*421-1`.
- **FPP (Fédération des Professionnels de la Piscine) & normes AFNOR / européennes** — Hydraulique résidentielle (`NF P90`), sel électrolyseur (`NF EN 16401`) et performance énergétique des piscines (`NF EN 17645`).

---

## Licences

- **Code source (`src/`, `test/`)** : licence [MIT](./LICENSE).
- **Jeux de données (`data/`)** : licence [CC BY 4.0](./data/LICENSE-DATA.md).
