import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBomCsv,
  generateManufacturerRfqSpec,
  generateOpenScadSource,
  generateSlabDxf,
  generateSlabShellAsciiStl,
} from './cadExporters';
import { calculateEngineeringMetrics, generateBom } from './engineeringMath';
import { DEFAULT_SLAB_PARAMETERS } from './types';

test('exports valid ASCII STL geometry matching slab serial and facets', () => {
  const stl = generateSlabShellAsciiStl(DEFAULT_SLAB_PARAMETERS);
  assert.ok(stl.startsWith('solid VCA_Slab_Exterior_VCA-26-00202'));
  assert.ok(stl.endsWith('endsolid VCA_Slab_Exterior_VCA-26-00202'));
  const facetCount = (stl.match(/facet normal/g) || []).length;
  // 8-gon: 8 top + 8 bottom + 16 side triangles = 32 triangles
  assert.equal(facetCount, 32);
});

test('exports valid AutoCAD DXF with OUTLINE, CAVITY, LABEL_BAY, and NFC_POCKET layers', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const dxf = generateSlabDxf(DEFAULT_SLAB_PARAMETERS, metrics);
  assert.ok(dxf.includes('$INSUNITS'));
  assert.ok(dxf.includes('OUTLINE'));
  assert.ok(dxf.includes('CAVITY'));
  assert.ok(dxf.includes('LABEL_BAY'));
  assert.ok(dxf.includes('NFC_POCKET'));
  assert.ok(dxf.trim().endsWith('EOF'));
});

test('exports parametric OpenSCAD script and Manufacturer RFQ spec without fabricated quotes', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const bom = generateBom(DEFAULT_SLAB_PARAMETERS, metrics);
  const scad = generateOpenScadSource(DEFAULT_SLAB_PARAMETERS, metrics);
  const csv = generateBomCsv(bom);
  const rfq = generateManufacturerRfqSpec(DEFAULT_SLAB_PARAMETERS, metrics, bom);

  assert.ok(scad.includes('overall_w = 84.00;'));
  assert.ok(scad.includes('module rear_housing_shell()'));
  assert.ok(csv.includes('VCA-HSG-FRT-01'));
  assert.ok(rfq.includes('Proposed Engineering Targets'));
  assert.ok(rfq.includes('require formal DFM confirmation'));
});
