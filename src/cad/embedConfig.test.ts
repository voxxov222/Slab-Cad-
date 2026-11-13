import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEngineeringMetrics } from './engineeringMath';
import {
  DEFAULT_EMBED_OPTIONS,
  DEFAULT_GITHUB_CAD_URL,
  buildEmbedSnippets,
  buildGitHubCadReadme,
  parseAppModeAndEmbedFromSearch,
  sanitizeGitHubRepoUrl,
} from './embedConfig';
import { DEFAULT_SLAB_PARAMETERS } from './types';

test('parseAppModeAndEmbedFromSearch parses cad-only mode and embed blueprint query params safely', () => {
  const full = parseAppModeAndEmbedFromSearch('');
  assert.equal(full.mode, 'full');
  assert.equal(full.cadOnly, false);

  const cadOnly = parseAppModeAndEmbedFromSearch('?mode=cad-only&serial=VCA-99-001');
  assert.equal(cadOnly.mode, 'cad-only');
  assert.equal(cadOnly.cadOnly, true);
  assert.equal(cadOnly.paramOverrides.serialNumber, 'VCA-99-001');

  const embed = parseAppModeAndEmbedFromSearch(
    '?embed=blueprint&style=xray-nfc&view=nfc_compartment&explode=0&callouts=0&hud=1&w=86&turns=8&chip=ntag215&height=700'
  );
  assert.equal(embed.mode, 'embed-blueprint');
  assert.equal(embed.cadOnly, true);
  assert.equal(embed.embed.style, 'xray-nfc');
  assert.equal(embed.embed.view, 'nfc_compartment');
  assert.equal(embed.embed.explode, false);
  assert.equal(embed.embed.callouts, false);
  assert.equal(embed.embed.hud, true);
  assert.equal(embed.embed.heightPx, 700);
  assert.equal(embed.paramOverrides.overallWidthMm, 86);
  assert.equal(embed.paramOverrides.antennaTurns, 8);
  assert.equal(embed.paramOverrides.nfcChipConfig, 'ntag215');

  const invalid = parseAppModeAndEmbedFromSearch('?embed=blueprint&style=bad&view=unknown&w=9999');
  assert.equal(invalid.embed.style, 'exploded-blueprint');
  assert.equal(invalid.embed.view, 'exploded');
  assert.equal(invalid.paramOverrides.overallWidthMm, 96);
});

test('sanitizeGitHubRepoUrl handles owner/repo shorthand and rejects javascript URLs', () => {
  assert.equal(
    sanitizeGitHubRepoUrl('vcaslabs/vca-slab-cad'),
    'https://github.com/vcaslabs/vca-slab-cad'
  );
  assert.equal(sanitizeGitHubRepoUrl('javascript:alert(1)'), DEFAULT_GITHUB_CAD_URL);
});

test('buildEmbedSnippets produces valid iframe, widget, markdown, object, and postMessage snippets', () => {
  const snippets = buildEmbedSnippets(
    'https://vcaslabs.example',
    DEFAULT_EMBED_OPTIONS,
    DEFAULT_SLAB_PARAMETERS
  );
  assert.match(snippets.directUrl, /embed=blueprint/);
  assert.match(snippets.cadOnlyUrl, /mode=cad-only/);
  assert.match(snippets.svgUrl, /\/api\/blueprint\.svg\?/);
  assert.match(snippets.iframeHtml, /<iframe[\s\S]*embed=blueprint/);
  assert.match(snippets.scriptWidgetHtml, /data-vca-blueprint[\s\S]*\/embed\.js/);
  assert.match(snippets.markdownSnippet, /^\[!\[VCA Slab CAD Blueprint/);
  assert.match(snippets.objectSvgHtml, /type="image\/svg\+xml"/);
  assert.match(snippets.postMessageSnippet, /VCA_EMBED_UPDATE/);
});

test('buildGitHubCadReadme documents CAD specs and CAD-only viewer without video studio instructions', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const readme = buildGitHubCadReadme(
    DEFAULT_SLAB_PARAMETERS,
    metrics,
    'https://vcaslabs.example',
    'https://github.com/vcaslabs/vca-slab-cad'
  );
  assert.match(readme, /VCA-26-00202/);
  assert.match(readme, /mode=cad-only/);
  assert.match(readme, /NFC chip operates strictly as a hardware-bound cryptographic access key/);
  assert.doesNotMatch(readme, /Film Studio|90s Launch Film/);
});
