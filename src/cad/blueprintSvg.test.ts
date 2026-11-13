import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEngineeringMetrics } from './engineeringMath';
import { generateBlueprintSvg } from './blueprintSvg';
import { DEFAULT_SLAB_PARAMETERS } from './types';

test('generateBlueprintSvg outputs valid parametric SVG blueprint with XML escaping and engineering metrics', () => {
  const params = {
    ...DEFAULT_SLAB_PARAMETERS,
    serialNumber: 'VCA-26-00999',
    gradeLabel: 'VCA 10 <GEM & MINT>',
    antennaTurns: 7,
  };
  const metrics = calculateEngineeringMetrics(params);
  const svg = generateBlueprintSvg(params, metrics, {
    style: 'exploded-blueprint',
    explode: true,
    hud: true,
  });

  assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /VCA-26-00999/);
  assert.match(svg, /VCA 10 &lt;GEM &amp; MINT&gt;/);
  assert.match(svg, /7 TURNS/);
  assert.match(svg, /EXPLODED Z-AXIS ASSEMBLY STACKUP/);
  assert.match(svg, /NFC ACTS STRICTLY AS ACCESS KEY/);

  const svgNoHud = generateBlueprintSvg(params, metrics, {
    style: 'blueprint',
    explode: false,
    hud: false,
  });
  assert.match(svgNoHud, /ASSEMBLED Z-AXIS CROSS SECTION/);
  assert.doesNotMatch(svgNoHud, /ENGINEERING PARAMETERS/);
});
