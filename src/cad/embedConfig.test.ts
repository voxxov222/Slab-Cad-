import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAnimatedCadSvg } from './blueprintSvg';
import { calculateEngineeringMetrics } from './engineeringMath';
import {
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_EMBED_OPTIONS,
  DEFAULT_GITHUB_CAD_URL,
  buildAnimatedCadSvgUrl,
  buildCadDownloadUrls,
  buildEmbedSnippets,
  buildGitHubCadReadme,
  parseAppModeAndEmbedFromSearch,
  sanitizeContactEmail,
  sanitizeGitHubRepoUrl,
} from './embedConfig';
import { DEFAULT_SLAB_PARAMETERS } from './types';

test('parseAppModeAndEmbedFromSearch parses cad-only mode, animate, and embed blueprint query params safely', () => {
  const full = parseAppModeAndEmbedFromSearch('');
  assert.equal(full.mode, 'full');
  assert.equal(full.cadOnly, false);
  assert.equal(full.embed.animate, true);

  const cadOnly = parseAppModeAndEmbedFromSearch('?mode=cad-only&serial=VCA-99-001');
  assert.equal(cadOnly.mode, 'cad-only');
  assert.equal(cadOnly.cadOnly, true);
  assert.equal(cadOnly.paramOverrides.serialNumber, 'VCA-99-001');

  const embed = parseAppModeAndEmbedFromSearch(
    '?embed=blueprint&style=xray-nfc&view=nfc_compartment&explode=0&callouts=0&hud=1&animate=0&w=86&turns=8&chip=ntag215&height=700'
  );
  assert.equal(embed.mode, 'embed-blueprint');
  assert.equal(embed.cadOnly, true);
  assert.equal(embed.embed.style, 'xray-nfc');
  assert.equal(embed.embed.view, 'nfc_compartment');
  assert.equal(embed.embed.explode, false);
  assert.equal(embed.embed.callouts, false);
  assert.equal(embed.embed.hud, true);
  assert.equal(embed.embed.animate, false);
  assert.equal(embed.embed.heightPx, 700);
  assert.equal(embed.paramOverrides.overallWidthMm, 86);
  assert.equal(embed.paramOverrides.antennaTurns, 8);
  assert.equal(embed.paramOverrides.nfcChipConfig, 'ntag215');

  const invalid = parseAppModeAndEmbedFromSearch('?embed=blueprint&style=bad&view=unknown&w=9999');
  assert.equal(invalid.embed.style, 'exploded-blueprint');
  assert.equal(invalid.embed.view, 'exploded');
  assert.equal(invalid.paramOverrides.overallWidthMm, 96);

  const readmeMode = parseAppModeAndEmbedFromSearch('?mode=readme&serial=VCA-26-00202');
  assert.equal(readmeMode.mode, 'readme');
  assert.equal(readmeMode.cadOnly, true);

  const readmePath = parseAppModeAndEmbedFromSearch('', '/readme');
  assert.equal(readmePath.mode, 'readme');
  assert.equal(readmePath.cadOnly, true);
});

test('sanitizeGitHubRepoUrl and sanitizeContactEmail enforce valid safe formats', () => {
  assert.equal(
    sanitizeGitHubRepoUrl('vcaslabs/vca-slab-cad'),
    'https://github.com/vcaslabs/vca-slab-cad'
  );
  assert.equal(sanitizeGitHubRepoUrl('javascript:alert(1)'), DEFAULT_GITHUB_CAD_URL);
  assert.equal(sanitizeContactEmail(''), DEFAULT_CONTACT_EMAIL);
  assert.equal(sanitizeContactEmail('not-an-email<script>'), DEFAULT_CONTACT_EMAIL);
  assert.equal(sanitizeContactEmail('  tosmond@vcaslabs.com  '), 'tosmond@vcaslabs.com');
});

test('buildEmbedSnippets and buildCadDownloadUrls generate complete embed & manufacturer download links', () => {
  const snippets = buildEmbedSnippets(
    'https://vcaslabs.example',
    DEFAULT_EMBED_OPTIONS,
    DEFAULT_SLAB_PARAMETERS,
    'tosmond@vcaslabs.com'
  );
  assert.match(snippets.directUrl, /embed=blueprint/);
  assert.match(snippets.directUrl, /animate=1/);
  assert.match(snippets.cadOnlyUrl, /mode=cad-only/);
  assert.match(snippets.svgUrl, /\/api\/blueprint\.svg\?/);
  assert.match(snippets.animatedCadSvgUrl, /\/api\/cad-animated\.svg\?/);
  assert.match(snippets.iframeHtml, /<iframe[\s\S]*embed=blueprint/);
  assert.match(snippets.scriptWidgetHtml, /data-vca-blueprint[\s\S]*\/embed\.js/);
  assert.match(snippets.markdownSnippet, /^\[!\[VCA Slab CAD Blueprint/);
  assert.match(snippets.animatedMarkdownSnippet, /^\[!\[VCA Live 3D Animated Slab CAD/);
  assert.match(snippets.objectSvgHtml, /type="image\/svg\+xml"/);
  assert.match(snippets.postMessageSnippet, /VCA_EMBED_UPDATE/);

  const dl = buildCadDownloadUrls('https://vcaslabs.example', DEFAULT_SLAB_PARAMETERS);
  assert.match(dl.stlUrl, /\/api\/cad\/housing\.stl\?/);
  assert.match(dl.dxfUrl, /\/api\/cad\/profile\.dxf\?/);
  assert.match(dl.scadUrl, /\/api\/cad\/parametric\.scad\?/);
  assert.match(dl.bomCsvUrl, /\/api\/cad\/bom\.csv\?/);
  assert.match(dl.rfqUrl, /\/api\/cad\/manufacturer-rfq\.md\?/);
  assert.match(dl.dynamicReadmeUrl, /\/api\/cad\/README\.md\?/);
  assert.match(dl.readmePageUrl, /mode=readme/);
  assert.match(
    buildAnimatedCadSvgUrl('https://vcaslabs.example', DEFAULT_SLAB_PARAMETERS),
    /\/api\/cad-animated\.svg\?/
  );
});

test('buildGitHubCadReadme outputs dynamic manufacturer README with live 3D CAD, downloads, contact, and embeds', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const readme = buildGitHubCadReadme(
    DEFAULT_SLAB_PARAMETERS,
    metrics,
    'https://vcaslabs.example',
    'https://github.com/vcaslabs/vca-slab-cad',
    'tosmond@vcaslabs.com'
  );
  assert.match(readme, /VCA-26-00202/);
  assert.match(readme, /tosmond@vcaslabs\.com/);
  assert.match(readme, /mailto:tosmond@vcaslabs\.com/);
  assert.match(readme, /mode=readme/);
  assert.match(readme, /\/api\/cad-animated\.svg/);
  assert.match(readme, /\/api\/cad\/housing\.stl/);
  assert.match(readme, /\/api\/cad\/profile\.dxf/);
  assert.match(readme, /\/api\/cad\/parametric\.scad/);
  assert.match(readme, /\/api\/cad\/bom\.csv/);
  assert.match(readme, /\/api\/cad\/manufacturer-rfq\.md/);
  assert.match(readme, /SPI A-1 Diamond Polish/);
  assert.match(readme, /Bill of Materials/);
  assert.match(readme, /Embed Options/);
  assert.match(readme, /<iframe/);
  assert.match(readme, /mode=cad-only/);
  assert.match(readme, /NFC chip operates strictly as a hardware-bound cryptographic access key/);
  assert.doesNotMatch(readme, /Film Studio|90s Launch Film|Create Video/);
});

test('generateAnimatedCadSvg produces valid animated 3D isometric CAD SVG with tosmond@vcaslabs.com', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const svg = generateAnimatedCadSvg(DEFAULT_SLAB_PARAMETERS, metrics, 'tosmond@vcaslabs.com');
  assert.ok(svg.startsWith('<?xml version="1.0"'));
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('@keyframes vcaLayer0'));
  assert.ok(svg.includes('vcaRfPulse'));
  assert.ok(svg.includes('vcaScanSweep'));
  assert.ok(svg.includes('#01 FRONT OPTICAL HOUSING'));
  assert.ok(svg.includes('#02 CLEAR OPTICAL PERIMETER FRAME'));
  assert.ok(svg.includes('#12 REAR OPTICAL SHELL'));
  assert.ok(svg.includes('#0A2E73'));
  assert.ok(svg.includes('#B91C1C'));
  assert.ok(svg.includes('tosmond@vcaslabs.com'));
  assert.ok(svg.includes('13.56 MHz'));
});
