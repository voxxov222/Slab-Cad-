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
  RawPresentationPlanInput,
  buildStudioPresentationFallback,
  normalizeGeneratedPresentation,
  validatePresentationPrompt,
} from './src/cad/presentationGenerator';
import { DEFAULT_SLAB_PARAMETERS, SlabParameters } from './src/cad/types';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_MALE_VOICES = new Set(['Charon', 'Fenrir', 'Puck']);

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

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ttsConfigured: Boolean(getGeminiClient()),
    });
  });

  app.post('/api/explainer-tts', async (req, res) => {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const requestedVoice =
      typeof req.body?.voiceName === 'string' && ALLOWED_MALE_VOICES.has(req.body.voiceName)
        ? req.body.voiceName
        : 'Charon';
    const style =
      typeof req.body?.style === 'string' && req.body.style.trim()
        ? req.body.style.trim()
        : 'Confident, deep male industrial design narrator for a 60-second luxury engineering launch video';

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

  app.post('/api/generate-presentation', async (req, res) => {
    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const validation = validatePresentationPrompt(rawPrompt);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error || 'Prompt is required.' });
      return;
    }

    const incomingParams: SlabParameters = {
      ...DEFAULT_SLAB_PARAMETERS,
      ...(typeof req.body?.params === 'object' && req.body.params ? req.body.params : {}),
    };
    const metrics = calculateEngineeringMetrics(incomingParams);

    const ai = getGeminiClient();
    if (!ai) {
      const plan = buildStudioPresentationFallback(validation.cleaned, incomingParams, metrics);
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
      const systemPrompt = `You are an elite 3D industrial product film director for VCA (Verified Card Authority, vcaslabs.com).
Create a high-detail 3D presentation video storyboard inside a Three.js dark obsidian studio showcasing the VCA certified NFC trading card slab:
- Serial: ${incomingParams.serialNumber}
- Dimensions: ${incomingParams.overallWidthMm} x ${incomingParams.overallHeightMm} x ${incomingParams.overallThicknessMm} mm
- Card cavity: ${metrics.internalCavityWidthMm} x ${metrics.internalCavityHeightMm} mm (63.5 x 88.9 mm card)
- NFC: ${incomingParams.nfcChipConfig.toUpperCase()} (${incomingParams.antennaTurns}-turn coil, ${metrics.estimatedInductanceUh} uH @ 13.56 MHz, ~${metrics.estimatedReadRangeMm} mm range). NFC acts strictly as a secure access key; the digital certificate/NFT lives on-chain, never on the chip.
- Present unvalidated manufacturing specs carefully without fabricating certifications.

Coordinate rules for Three.js camera keyframes (3 keyframes per scene: start, mid, end):
- Slab stands centered at [0, 0, 0], height 138mm (Y -69..+69), width 84mm (X -42..+42). NFC bay & label are at upper zone [18, +44, 0].
- Keep cameraPos at safe distance >= 90mm in XZ (e.g. [160, 24, 200], [-90, 42, 140], [45, 48, 125]), Y between -30 and +160.
- highlightComponent can be null or one of: front_housing, rear_housing, perimeter_bezel, card_support_frame, inner_sleeve, trading_card, cert_label, hologram_qr_seal, nfc_compartment, nfc_chip, nfc_antenna, tamper_weld_pins.
- sfxStyle must be one of: impact, mechanical, nfc, telemetry, laser.
- accentHex must be a 6-digit hex color matching the mood (prefer #38BDF8 cyan, #34D399 emerald, #F59E0B gold, or #A855F7 violet).
- Use clean editorial copy in title, hudHeadline, hudSubline, and hudMetrics without "//" or underscores "_".
- Set showCallouts to true ONLY on wide exploded views where explode >= 0.4; keep showCallouts false on reveal, macro, and finale shots.
- Design 3 to 6 rich scenes tailored specifically to the user's request, honoring any requested duration (default 35-50s total).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Direct a high-detail VCA slab presentation video for this user request:\n"${validation.cleaned}"`,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              creativeDirection: { type: Type.STRING },
              accentHex: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    angleLabel: { type: Type.STRING },
                    durationSec: { type: Type.NUMBER },
                    cameraPathDescription: { type: Type.STRING },
                    soundDesignCue: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    highlightComponent: { type: Type.STRING, nullable: true },
                    showCallouts: { type: Type.BOOLEAN },
                    hudHeadline: { type: Type.STRING },
                    hudSubline: { type: Type.STRING },
                    hudMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sfxStyle: { type: Type.STRING },
                    keyframes: { type: Type.ARRAY, items: keyframeSchema },
                  },
                  required: [
                    'title',
                    'angleLabel',
                    'durationSec',
                    'cameraPathDescription',
                    'soundDesignCue',
                    'narration',
                    'showCallouts',
                    'hudHeadline',
                    'hudSubline',
                    'hudMetrics',
                    'sfxStyle',
                    'keyframes',
                  ],
                },
              },
            },
            required: ['title', 'creativeDirection', 'accentHex', 'scenes'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as RawPresentationPlanInput;
      const plan = normalizeGeneratedPresentation(
        parsed,
        validation.cleaned,
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
      const note = err instanceof Error ? err.message : 'Gemini creative generation fallback';
      const plan = buildStudioPresentationFallback(validation.cleaned, incomingParams, metrics);
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
          downloadName = `${safeSerial}-Launch-Audio.mp3`;
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
          downloadName = `${safeSerial}-Launch-Regular-480p.mp4`;
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
          downloadName = `${safeSerial}-Launch-4K-2160p.mp4`;
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
          downloadName = `${safeSerial}-Launch-HD-1080p.mp4`;
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
