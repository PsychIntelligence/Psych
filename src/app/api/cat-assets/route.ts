/**
 * GET /api/cat-assets
 *
 * Recursively scans the /catfiles/ directory and returns a structured
 * asset manifest: every supported file with its relative path, detected
 * emotion state, format, and whether it's a "talk" variant.
 *
 * This is the single source of truth for the client-side CatAssetLoader.
 * It scans subdirectories (including /catfiles/GIFs/) and handles:
 * - .gif, .webm, .png, .webp, .apng, .svg, .jpg, .jpeg
 * - .veado files (noted but flagged as non-renderable container)
 *
 * Response shape: { assets: AssetEntry[], scannedDir: string, totalFiles: number }
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const RENDERABLE_EXTENSIONS = new Set([
  '.png', '.gif', '.webp', '.apng', '.svg', '.jpg', '.jpeg', '.webm',
]);

const CONTAINER_EXTENSIONS = new Set(['.veado']);

interface AssetEntry {
  /** Relative path from /catfiles/ root — used as URL path segment */
  relativePath: string;
  /** Filename without extension, lowercased */
  stem: string;
  /** File extension without dot */
  ext: string;
  /** Whether the browser can render this directly */
  renderable: boolean;
  /** File size in bytes */
  size: number;
  /** Detected emotion state (null if unrecognized) */
  emotion: string | null;
  /** Whether this is a "talk" variant (mouth-open animation) */
  isTalkVariant: boolean;
  /** Serving URL */
  url: string;
}

// ── Emotion detection ───────────────────────────────────────────

const EMOTION_RULES: { emotion: string; patterns: RegExp[] }[] = [
  { emotion: 'idle',         patterns: [/idle/i, /default/i, /rest/i, /calm/i, /standing/i] },
  { emotion: 'angry',        patterns: [/angry/i, /anger/i, /mad/i, /rage/i, /furious/i] },
  { emotion: 'excited',      patterns: [/excite/i, /hype/i, /celebrate/i] },
  { emotion: 'happy',        patterns: [/happy/i, /hearts?/i, /love/i, /joy/i, /smile/i] },
  { emotion: 'sad',          patterns: [/sad/i, /cry/i, /tear/i, /unhappy/i] },
  { emotion: 'disappointed', patterns: [/despair/i, /disappoint/i, /dejected/i, /sigh/i] },
  { emotion: 'alert',        patterns: [/alert/i, /focus/i, /attention/i, /notice/i, /glance/i] },
  { emotion: 'warning',      patterns: [/warning/i, /caution/i, /danger/i, /alarm/i] },
  { emotion: 'neutral',      patterns: [/neutral/i, /blank/i, /normal/i, /base/i, /sleep/i] },
  { emotion: 'smug',         patterns: [/smug/i, /confident/i, /proud/i, /sassy/i] },
];

function detectEmotion(stem: string): string | null {
  for (const { emotion, patterns } of EMOTION_RULES) {
    for (const re of patterns) {
      if (re.test(stem)) return emotion;
    }
  }
  return null;
}

function isTalkVariant(stem: string): boolean {
  return /talk/i.test(stem);
}

// ── Recursive directory scanner ─────────────────────────────────

function scanDir(dir: string, baseDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];

  if (!fs.existsSync(dir)) return entries;

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      entries.push(...scanDir(fullPath, baseDir));
      continue;
    }

    if (!item.isFile()) continue;

    const ext = path.extname(item.name).toLowerCase();
    const isRenderable = RENDERABLE_EXTENSIONS.has(ext);
    const isContainer = CONTAINER_EXTENSIONS.has(ext);

    if (!isRenderable && !isContainer) continue;

    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    const stem = path.basename(item.name, ext).toLowerCase().replace(/[-_]/g, ' ');
    const stat = fs.statSync(fullPath);

    entries.push({
      relativePath,
      stem,
      ext: ext.slice(1), // remove leading dot
      renderable: isRenderable,
      size: stat.size,
      emotion: detectEmotion(stem),
      isTalkVariant: isTalkVariant(stem),
      url: `/api/catfile/${relativePath}`,
    });
  }

  return entries;
}

// ── Route handler ───────────────────────────────────────────────

export const dynamic = 'force-dynamic'; // never cache this manifest

export async function GET() {
  const catDir = path.join(process.cwd(), 'catfiles');
  const assets = scanDir(catDir, catDir);

  const renderableCount = assets.filter(a => a.renderable).length;
  const emotionsCovered = [...new Set(assets.filter(a => a.emotion).map(a => a.emotion))];

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[cat-assets] Scanned: ${catDir}\n` +
      `  Total files: ${assets.length}\n` +
      `  Renderable: ${renderableCount}\n` +
      `  Emotions detected: ${emotionsCovered.join(', ') || '(none)'}\n` +
      `  Files: ${assets.map(a => a.relativePath).join(', ')}`
    );
  }

  return NextResponse.json({
    assets,
    scannedDir: catDir,
    totalFiles: assets.length,
    renderableCount,
    emotionsCovered,
  });
}
