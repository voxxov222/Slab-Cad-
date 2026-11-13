import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEngineeringMetrics, generateBom } from './engineeringMath';
import { DEFAULT_SLAB_PARAMETERS } from './types';

test('calculates cavity clearance and Z-axis play accurately with and without sleeve', () => {
  const withSleeve = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const withoutSleeve = calculateEngineeringMetrics({
    ...DEFAULT_SLAB_PARAMETERS,
    useInnerSleeve: false,
  });

  assert.equal(withSleeve.cavityClearanceOk, true);
  assert.equal(withSleeve.structuralMarginOk, true);
  assert.ok(withSleeve.internalCavityWidthMm > withoutSleeve.internalCavityWidthMm);
  assert.ok(withSleeve.effectiveCardPackageThicknessMm > withoutSleeve.effectiveCardPackageThicknessMm);
  assert.equal(withSleeve.zAxisPlayMm, DEFAULT_SLAB_PARAMETERS.cavityDepthAllowanceMm);
});

test('computes Wheeler planar spiral NFC inductance and 13.56 MHz tuning capacitance', () => {
  const base = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const moreTurns = calculateEngineeringMetrics({
    ...DEFAULT_SLAB_PARAMETERS,
    antennaTurns: 8,
  });

  assert.ok(base.estimatedInductanceUh > 0.5 && base.estimatedInductanceUh < 5.0);
  assert.ok(base.requiredTuningCapacitancePf > 20 && base.requiredTuningCapacitancePf < 300);
  assert.ok(moreTurns.estimatedInductanceUh > base.estimatedInductanceUh);
  assert.ok(moreTurns.requiredTuningCapacitancePf < base.requiredTuningCapacitancePf);
});

test('flags design rule warning when antenna exceeds NFC pocket dimensions', () => {
  const oversized = calculateEngineeringMetrics({
    ...DEFAULT_SLAB_PARAMETERS,
    antennaOuterWidthMm: 21.8,
    nfcPocketWidthMm: 22.0,
  });

  assert.equal(oversized.nfcFitInPocketOk, false);
  assert.ok(oversized.warnings.some((w) => w.includes('exceed recessed pocket')));
});

test('generates complete 7-item BOM reflecting sleeve toggle and NFC chip selection', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const bom424 = generateBom(DEFAULT_SLAB_PARAMETERS, metrics);
  assert.equal(bom424.length, 7);
  assert.equal(bom424[3].partNumber, 'VCA-NFC-424-04');
  assert.equal(bom424[6].qty, 1);

  const bom215NoSleeve = generateBom(
    { ...DEFAULT_SLAB_PARAMETERS, nfcChipConfig: 'ntag215', useInnerSleeve: false },
    metrics
  );
  assert.equal(bom215NoSleeve[3].partNumber, 'VCA-NFC-215-04');
  assert.equal(bom215NoSleeve[6].qty, 0);
});
