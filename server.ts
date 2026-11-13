import 'dotenv/config';
import express from 'express';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { calculateEngineeringMetrics } from './src/cad/engineeringMath';
import {
  RawCreatedVideoInput,
  VideoFormatCategory,
  buildFallbackCreatedVideo,
  detectVideoCategory,
  normalizeCreatedVideoPlan,
  validateCreateVideoPrompt,
} from './src/cad/videoCreator';
import { generateBlueprintSvg } from './src/cad/blueprintSvg';
import { parseAppModeAndEmbedFromSearch } from './src/cad/embedConfig';
import { DEFAULT_SLAB_PARAMETERS, SlabParameters } from './src/cad/types';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_STUDIO_VOICES = new Set(['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr']);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Allow dynamic embedding across external websites, CMS text boxes, and iframes
  app.use((_req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ttsConfigured: Boolean(getGeminiClient()),
    });
  });

  app.get('/api/blueprint.svg', (req, res) => {
    const queryIdx = req.originalUrl.indexOf('?');
    const search = queryIdx >= 0 ? req.originalUrl.slice(queryIdx) : '';
    const parsed = parseAppModeAndEmbedFromSearch(search);
    const params: SlabParameters = {
      ...DEFAULT_SLAB_PARAMETERS,
      ...parsed.paramOverrides,
    };
    const metrics = calculateEngineeringMetrics(params);
    const svg = generateBlueprintSvg(params, metrics, {
      style: parsed.embed.style,
      view: parsed.embed.view,
      explode: parsed.embed.explode,
      hud: parsed.embed.hud,
    });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(svg);
  });

  app.get('/api/oembed', (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const host = req.get('host') || `localhost:${PORT}`;
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const origin = `${proto}://${host}`;
    const targetSrc = rawUrl.startsWith('http')
      ? rawUrl
      : `${origin}/?embed=blueprint&style=exploded-blueprint&explode=1`;
    res.json({
      version: '1.0',
      type: 'rich',
      provider_name: 'VCA — Verified Card Authority',
      provider_url: origin,
      title: 'VCA Certified Slab Interactive CAD Blueprint',
      width: 960,
      height: 560,
      html: `<iframe src="${targetSrc.replace(/"/g, '&quot;')}" width="100%" height="560" style="border:1px solid #1E3A5F;border-radius:8px;background:#041224;" loading="lazy" allow="fullscreen"></iframe>`,
    });
  });

  app.get('/embed.js', (req, res) => {
    const host = req.get('host') || `localhost:${PORT}`;
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const scriptOrigin = `${proto}://${host}`;
    const js = `(function () {
  var origin = ${JSON.stringify(scriptOrigin)};
  function mountAll() {
    var nodes = document.querySelectorAll('[data-vca-blueprint]:not([data-vca-mounted])');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.setAttribute('data-vca-mounted', '1');
      var ds = el.dataset || {};
      var q = new URLSearchParams();
      q.set('embed', 'blueprint');
      q.set('style', ds.style || 'exploded-blueprint');
      q.set('view', ds.view || 'exploded');
      q.set('explode', ds.explode !== undefined ? ds.explode : '1');
      q.set('callouts', ds.callouts !== undefined ? ds.callouts : '1');
      q.set('hud', ds.hud !== undefined ? ds.hud : '1');
      if (ds.serial) q.set('serial', ds.serial);
      if (ds.w) q.set('w', ds.w);
      if (ds.h) q.set('h', ds.h);
      if (ds.t) q.set('t', ds.t);
      if (ds.wall) q.set('wall', ds.wall);
      if (ds.chip) q.set('chip', ds.chip);
      if (ds.turns) q.set('turns', ds.turns);
      var hPx = parseInt(ds.height || '560', 10) || 560;
      var iframe = document.createElement('iframe');
      iframe.src = origin + '/?' + q.toString();
      iframe.title = 'VCA Slab CAD Blueprint';
      iframe.style.width = '100%';
      iframe.style.height = hPx + 'px';
      iframe.style.border = '1px solid #1E3A5F';
      iframe.style.borderRadius = '8px';
      iframe.style.background = '#041224';
      iframe.style.display = 'block';
      iframe.loading = 'lazy';
      iframe.allow = 'fullscreen';
      el.innerHTML = '';
      el.appendChild(iframe);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();`;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.send(js);
  });

  app.post('/api/voiceover-tts', async (req, res) => {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const requestedVoice =
      typeof req.body?.voiceName === 'string' && ALLOWED_STUDIO_VOICES.has(req.body.voiceName)
        ? req.body.voiceName
        : 'Charon';
    const style =
      typeof req.body?.style === 'string' && req.body.style.trim()
        ? req.body.style.trim()
        : 'Confident, clear studio narrator recording a clean voiceover with natural human pacing and zero background audio';

    if (!rawText) {
      res.status(400).json({ error: 'Narration text is required.' });
      return;
    }

    const cacheKey = `${requestedVoice}:${rawText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({
        available: true,
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        voiceName: requestedVoice,
        cached: true,
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(200).json({
        available: false,
        error: 'GEMINI_API_KEY is not configured; using browser speech synthesis fallback.',
      });
      return;
    }

    const ttsConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: requestedVoice,
          },
        },
      },
    };

    try {
      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: rawText,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: ttsConfig,
        });
      } catch (metaErr) {
        const msg = metaErr instanceof Error ? metaErr.message : '';
        if (!msg.includes('speechMetadata')) {
          throw metaErr;
        }
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: `Speak in a ${style}: ${rawText}` }],
            },
          ],
          config: ttsConfig,
        });
      }

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) {
        res.status(200).json({
          available: false,
          error: 'No audio payload returned from Gemini TTS.',
        });
        return;
      }

      const payload = {
        audioBase64: inlineData.data,
        mimeType: inlineData.mimeType || 'audio/wav',
      };
      ttsCache.set(cacheKey, payload);

      res.json({
        available: true,
        audioBase64: payload.audioBase64,
        mimeType: payload.mimeType,
        voiceName: requestedVoice,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS generation failed';
      res.status(200).json({
        available: false,
        error: message,
      });
    }
  });

  app.post('/api/create-video', async (req, res) => {
    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const validation = validateCreateVideoPrompt(rawPrompt);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error || 'Prompt is required.' });
      return;
    }

    const rawCat = req.body?.category as VideoFormatCategory | undefined;
    const category = detectVideoCategory(
      validation.cleaned,
      rawCat &&
        ['pitch-deck', 'presentation', 'advertising', 'blueprint-explainer'].includes(rawCat)
        ? rawCat
        : undefined
    );

    const incomingParams: SlabParameters = {
      ...DEFAULT_SLAB_PARAMETERS,
      ...(typeof req.body?.params === 'object' && req.body.params ? req.body.params : {}),
    };
    const metrics = calculateEngineeringMetrics(incomingParams);

    const ai = getGeminiClient();
    if (!ai) {
      const plan = buildFallbackCreatedVideo(validation.cleaned, category, incomingParams, metrics);
      res.json({
        available: true,
        generatedBy: 'studio-director',
        plan,
      });
      return;
    }

    const keyframeSchema = {
      type: Type.OBJECT,
      properties: {
        cameraPos: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        target: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        fov: { type: Type.NUMBER },
        orbitSweepDeg: { type: Type.NUMBER },
        explode: { type: Type.NUMBER },
        housingOpacity: { type: Type.NUMBER },
        rfFieldIntensity: { type: Type.NUMBER },
        phoneApproach: { type: Type.NUMBER },
        dataStreamProgress: { type: Type.NUMBER },
        mfgStageProgress: { type: Type.NUMBER },
        outlineTraceProgress: { type: Type.NUMBER },
        sectionEnabled: { type: Type.BOOLEAN },
        sectionOffsetMm: { type: Type.NUMBER },
      },
      required: [
        'cameraPos',
        'target',
        'fov',
        'orbitSweepDeg',
        'explode',
        'housingOpacity',
        'rfFieldIntensity',
        'phoneApproach',
        'dataStreamProgress',
        'mfgStageProgress',
        'outlineTraceProgress',
        'sectionEnabled',
        'sectionOffsetMm',
      ],
    };

    try {
      const systemPrompt = `You are an elite 3D industrial product cinematographer & presentation director for VCA (Verified Card Authority, vcaslabs.com).
Create a high-detail 3D CAD presentation video storyboard for the category "${category}" inside a Three.js viewport:
- Prototype Serial: ${incomingParams.serialNumber}
- Dimensions: ${incomingParams.overallWidthMm} x ${incomingParams.overallHeightMm} x ${incomingParams.overallThicknessMm} mm
- Card cavity: ${metrics.internalCavityWidthMm} x ${metrics.internalCavityHeightMm} mm (63.5 x 88.9 mm card)
- NFC: ${incomingParams.nfcChipConfig.toUpperCase()} (${incomingParams.antennaTurns}-turn coil, ${metrics.estimatedInductanceUh} uH @ 13.56 MHz, ~${metrics.estimatedReadRangeMm} mm range). NFC acts strictly as a cryptographic access key; digital records live off-chip.
- CRITICAL AUDIO RULE: Narration is realistic studio voiceover ONLY — do NOT reference background music or sound effects in narration or metadata.

Cinematography & Exploded Label Rules:
- Slab stands centered at [0, 0, 0], height 138mm (Y -69..+69), width 84mm (X -42..+42). NFC bay & label sit at upper zone [18, +44, 0].
- Each scene has 3 keyframes (start, mid, end). Vary cameraPos dynamically across scenes (low-angle hero, crane sweep, 360 turntable using orbitSweepDeg, macro top-right dive, cross-section glide).
- Keep cameraPos at safe distance >= 92mm in XZ (e.g. [168, -22, 245], [0, 18, 246], [208, 42, 180], [42, 42, 128]).
- visualStyle must be one of: "studio", "blueprint", "exploded-blueprint", "xray-nfc".
- shotStyle must be one of: "low-angle-hero", "orbital-crane", "exploded-stack-orbit", "top-macro-nfc", "cross-section-glide", "turntable-360", "chamfer-pullback".
- Whenever exploded layers are showcased (explode >= 0.35 or blueprint walkthrough), set showLiveLabels: true so live #01–#12 hardware indexing callouts track every component.
- highlightComponent can be null or one of: front_housing, rear_housing, perimeter_bezel, card_support_frame, inner_sleeve, trading_card, cert_label, hologram_qr_seal, nfc_compartment, nfc_chip, nfc_antenna, tamper_weld_pins.
- Design 3 to 5 cohesive scenes tailored specifically to the user's request and category (${category}), honoring any requested scene count or duration.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a high-quality VCA "${category}" presentation video storyboard for:\n"${validation.cleaned}"`,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              creativeSummary: { type: Type.STRING },
              accentHex: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    shotLabel: { type: Type.STRING },
                    shotStyle: { type: Type.STRING },
                    cameraDescription: { type: Type.STRING },
                    durationSec: { type: Type.NUMBER },
                    narration: { type: Type.STRING },
                    visualStyle: { type: Type.STRING },
                    showLiveLabels: { type: Type.BOOLEAN },
                    highlightComponent: { type: Type.STRING, nullable: true },
                    hudHeadline: { type: Type.STRING },
                    hudSubline: { type: Type.STRING },
                    hudMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
                    accentHex: { type: Type.STRING },
                    keyframes: { type: Type.ARRAY, items: keyframeSchema },
                  },
                  required: [
                    'title',
                    'shotLabel',
                    'shotStyle',
                    'cameraDescription',
                    'durationSec',
                    'narration',
                    'visualStyle',
                    'showLiveLabels',
                    'hudHeadline',
                    'hudSubline',
                    'hudMetrics',
                    'keyframes',
                  ],
                },
              },
            },
            required: ['title', 'creativeSummary', 'accentHex', 'scenes'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as RawCreatedVideoInput;
      const plan = normalizeCreatedVideoPlan(
        parsed,
        validation.cleaned,
        category,
        incomingParams,
        metrics,
        'gemini'
      );
      res.json({
        available: true,
        generatedBy: plan.generatedBy,
        plan,
      });
    } catch (err) {
      const note = err instanceof Error ? err.message : 'VCA Director fallback';
      const plan = buildFallbackCreatedVideo(validation.cleaned, category, incomingParams, metrics);
      res.json({
        available: true,
        generatedBy: 'studio-director',
        plan,
        note,
      });
    }
  });

  app.post(
    '/api/export-media',
    express.raw({
      type: ['application/octet-stream', 'video/webm', 'video/mp4', 'audio/wav', 'audio/*'],
      limit: '350mb',
    }),
    async (req, res) => {
      const format = typeof req.query.format === 'string' ? req.query.format : 'mp4-hd';
      const serialRaw = typeof req.query.serial === 'string' ? req.query.serial : 'VCA-26-00202';
      const safeSerial = serialRaw.replace(/[^a-zA-Z0-9_-]/g, '') || 'VCA-26-00202';

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Media payload is empty.' });
        return;
      }

      const id = randomUUID();
      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `vca-in-${id}.bin`);
      const isMp3 = format === 'mp3';
      const ext = isMp3 ? 'mp3' : 'mp4';
      const outputPath = path.join(tmpDir, `vca-out-${id}.${ext}`);

      try {
        await fs.writeFile(inputPath, req.body);

        let args: string[];
        let downloadName: string;
        let contentType: string;

        if (isMp3) {
          args = [
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-c:a',
            'libmp3lame',
            '-b:a',
            '192k',
            '-ar',
            '48000',
            outputPath,
          ];
          downloadName = `${safeSerial}-Voiceover-Audio.mp3`;
          contentType = 'audio/mpeg';
        } else if (format === 'mp4-regular') {
          args = [
            '-y',
            '-i',
            inputPath,
            '-vf',
            'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2:color=#03050a',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '22',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            outputPath,
          ];
          downloadName = `${safeSerial}-Presentation-Regular-480p.mp4`;
          contentType = 'video/mp4';
        } else if (format === 'mp4-4k') {
          args = [
            '-y',
            '-i',
            inputPath,
            '-vf',
            'scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:color=#03050a',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '18',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '256k',
            '-movflags',
            '+faststart',
            outputPath,
          ];
          downloadName = `${safeSerial}-Presentation-4K-2160p.mp4`;
          contentType = 'video/mp4';
        } else {
          args = [
            '-y',
            '-i',
            inputPath,
            '-vf',
            'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#03050a',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '19',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-movflags',
            '+faststart',
            outputPath,
          ];
          downloadName = `${safeSerial}-Presentation-HD-1080p.mp4`;
          contentType = 'video/mp4';
        }

        await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 20 });
        const outBuffer = await fs.readFile(outputPath);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(outBuffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Media transcoding failed';
        res.status(500).json({ error: message });
      } finally {
        await fs.unlink(inputPath).catch(() => undefined);
        await fs.unlink(outputPath).catch(() => undefined);
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VCA Slab Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
