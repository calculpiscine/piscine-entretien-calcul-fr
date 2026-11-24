# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format s'appuie sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et adopte un versionnage calendaire `ANNÉE.MAJEURE.MINEURE`.

## [2026.1.0] - 2026-04-01

### Ajouté
- Moteur ESM sans dépendance (`src/index.js`) et déclarations TypeScript (`src/index.d.ts`) pour Node.js 18+.
- **Volume & Eau** (`calculateVolume`, `getUrbanismeStatus`) : calculs exacts pour bassins rectangulaires (fond plat, pente douce, fond composé, pointe de diamant prismatoïdale), ronds, ovales (flancs droits standard et ellipse), octogonaux et forme libre, coût de remplissage SISPEA 2026 et seuils du Code de l'urbanisme (10 m² / 100 m²).
- **Chimie de l'eau** (`calculateDosage`, `calculateHoclEfficiency`) : efficacité réelle du chlore actif (HOCl, équation de Henderson-Hasselbalch à pKa = 7,50), dosage chlore choc / lent / ajustement mg/L, correcteurs pH- / pH+ par paliers de 0,2 unité et calcul de sel en sacs de 25 kg (NF EN 16401).
- **Hydraulique & Filtration** (`calculateFiltration`, `matchFilterTier`) : débit minimal 4 h + 20 %, sélection des filtres Ø 400 à Ø 900 mm, conversion sable vs verre filtrant (-20 %), durée quotidienne `T°C ÷ 2` (hivernage actif et canicule 24 h/24) et coût mensuel électrique.
- **Pompe à chaleur / Thermopompe** (`calculateHeatPump`) : dimensionnement thermique par zone climatique (Sud, Centre/CH, Nord/BE, Québec/Montagne), comparaison avec/sans bâche à bulles et budget saisonnier 2026.
- Jeux de données ouverts (`data/` en JSON et CSV sous licence CC BY 4.0) : tarifs eau/électricité 2026 (SISPEA, EDF Tarif Bleu, Belgique, ElCom Suisse, Hydro-Québec Tarif D), règles de dosage chimique, spécifications filtres/températures et coefficients climatiques PAC.
- Suite complète de tests unitaires `node:test` (`test/calc.test.js`) et workflow GitHub Actions CI sur Node.js 20 et 22.
