/**
 * CatAssetLoader: Client-side asset discovery for PNGtuber files.
 *
 * Fetches the structured manifest from /api/cat-assets (which recursively
 * scans /catfiles/ on the server) and builds the emotion→asset map.
 *
 * Key behaviors:
 * - Recursively finds files in subdirectories (e.g., /catfiles/GIFs/)
 * - Prioritizes "talk" variants for the talking state
 * - Falls back to idle for any missing emotion
 * - If ANY renderable file exists, hasRealAssets is true
 * - .veado files are noted but not rendered directly
 * - If no renderable files: logs exactly what was scanned and why it failed
 */

import type { CatAsset, CatEmotion } from '@/types';

// ── Types from the manifest API ─────────────────────────────────

interface ManifestEntry {
  relativePath: string;
  stem: string;
  ext: string;
  renderable: boolean;
  size: number;
  emotion: string | null;
  isTalkVariant: boolean;
  url: string;
}

interface ManifestResponse {
  assets: ManifestEntry[];
  scannedDir: string;
  totalFiles: number;
  renderableCount: number;
  emotionsCovered: string[];
}

// ── Public types ────────────────────────────────────────────────

export interface CatAssetWithTalk extends CatAsset {
  talkSrc?: string; // separate talk-variant URL for mouth animation
}

export interface AssetMap {
  assets: Map<CatEmotion, CatAssetWithTalk>;
  hasRealAssets: boolean;
  missingEmotions: CatEmotion[];
  loadedCount: number;
  allFiles: string[];
  manifest: ManifestResponse | null;
}

const REQUIRED_EMOTIONS: CatEmotion[] = ['idle', 'talking', 'angry', 'excited', 'disappointed', 'alert'];

const VALID_EMOTIONS: Set<string> = new Set<string>([
  'idle', 'talking', 'angry', 'excited', 'disappointed', 'alert',
  'happy', 'sad', 'smug', 'neutral', 'warning',
]);

function toFormat(ext: string): CatAsset['format'] {
  if (ext === 'jpg' || ext === 'jpeg') return 'png';
  if (ext === 'webm') return 'webp';
  if (['png', 'gif', 'webp', 'apng', 'svg'].includes(ext)) return ext as CatAsset['format'];
  return 'png';
}

/**
 * Fetch manifest from server and build emotion→asset map.
 */
export async function loadCatAssets(basePath = '/api/cat-assets'): Promise<AssetMap> {
  const assets = new Map<CatEmotion, CatAssetWithTalk>();
  let manifest: ManifestResponse | null = null;
  let allFiles: string[] = [];

  try {
    const response = await fetch(basePath, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Manifest API returned ${response.status}`);

    manifest = await response.json() as ManifestResponse;
    allFiles = manifest.assets.map(a => a.relativePath);

    // Filter to renderable only
    const renderable = manifest.assets.filter(a => a.renderable);

    // ── Phase 1: Map detected emotions ────────────────────────

    for (const entry of renderable) {
      if (!entry.emotion) continue;
      if (!VALID_EMOTIONS.has(entry.emotion)) continue;

      const emotion = entry.emotion as CatEmotion;

      if (entry.isTalkVariant) {
        // Talk variants: attach as talkSrc to the base emotion
        // Also set as the 'talking' state if we don't have one yet
        const existing = assets.get(emotion);
        if (existing) {
          existing.talkSrc = entry.url;
        }

        // Map "angryTalk" → talking (if no talk-only is found yet)
        if (!assets.has('talking')) {
          assets.set('talking', {
            emotion: 'talking',
            src: entry.url,
            format: toFormat(entry.ext),
          });
        }
      } else {
        // Base emotion
        if (!assets.has(emotion)) {
          assets.set(emotion, {
            emotion,
            src: entry.url,
            format: toFormat(entry.ext),
          });
        }
      }
    }

    // ── Phase 2: Find a dedicated talk asset ──────────────────

    // If we still don't have a 'talking' asset, find ANY talk variant
    if (!assets.has('talking')) {
      const anyTalk = renderable.find(e => e.isTalkVariant);
      if (anyTalk) {
        assets.set('talking', {
          emotion: 'talking',
          src: anyTalk.url,
          format: toFormat(anyTalk.ext),
        });
      }
    }

    // ── Phase 3: Ensure idle exists ───────────────────────────

    // If no 'idle' detected, pick the first non-talk renderable file
    if (!assets.has('idle') && renderable.length > 0) {
      const firstNonTalk = renderable.find(e => !e.isTalkVariant) ?? renderable[0];
      assets.set('idle', {
        emotion: 'idle',
        src: firstNonTalk.url,
        format: toFormat(firstNonTalk.ext),
      });
    }

    // ── Phase 4: Map Veado-specific emotion names ─────────────

    // The actual files follow pattern: BlackCat_<State>_ghremlin.gif
    // Remap: Despair → disappointed, Excite → excited, Hearts → happy,
    //        Sleep → neutral, Idle1/Idle2 → idle
    const ALIAS_MAP: Record<string, CatEmotion> = {
      'despair': 'disappointed',
      'excite': 'excited',
      'hearts': 'happy',
      'sleep': 'neutral',
    };

    for (const entry of renderable) {
      if (entry.isTalkVariant) continue;
      const stem = entry.stem;
      for (const [alias, target] of Object.entries(ALIAS_MAP)) {
        if (stem.includes(alias) && !assets.has(target)) {
          assets.set(target, {
            emotion: target,
            src: entry.url,
            format: toFormat(entry.ext),
          });
        }
      }
    }

    // Also wire up talk variants for aliased emotions
    for (const entry of renderable) {
      if (!entry.isTalkVariant) continue;
      const stem = entry.stem;
      for (const [alias, target] of Object.entries(ALIAS_MAP)) {
        if (stem.includes(alias)) {
          const existing = assets.get(target);
          if (existing && !existing.talkSrc) {
            existing.talkSrc = entry.url;
          }
        }
      }
    }

    // ── Phase 5: Fill 'talking' from idle's talk variant ──────

    if (!assets.has('talking')) {
      const idle = assets.get('idle');
      if (idle?.talkSrc) {
        assets.set('talking', {
          emotion: 'talking',
          src: idle.talkSrc,
          format: idle.format,
        });
      }
    }

  } catch (err) {
    console.error('[CatAssetLoader] Failed to load manifest:', err);
  }

  const missingEmotions = REQUIRED_EMOTIONS.filter(e => !assets.has(e));
  const hasReal = assets.size > 0;

  // ── Logging ─────────────────────────────────────────────────

  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    if (!hasReal) {
      console.warn(
        `[CatAssetLoader] No renderable assets found.\n` +
        `  Scanned: ${manifest?.scannedDir ?? '(unknown)'}\n` +
        `  Total files on disk: ${manifest?.totalFiles ?? 0}\n` +
        `  Renderable: ${manifest?.renderableCount ?? 0}\n` +
        `  Files: ${allFiles.join(', ') || '(none)'}`
      );
    } else {
      const mapped = Array.from(assets.entries()).map(([k, v]) => `${k} → ${v.src.split('/').pop()}`);
      console.log(
        `[CatAssetLoader] Loaded ${assets.size} emotion states:\n` +
        `  ${mapped.join('\n  ')}\n` +
        `  Missing: ${missingEmotions.join(', ') || '(none)'}`
      );
    }
  }

  return {
    assets,
    hasRealAssets: hasReal,
    missingEmotions,
    loadedCount: assets.size,
    allFiles,
    manifest,
  };
}

/**
 * Get the best asset for a given emotion.
 * Falls back: requested → idle → neutral → first available → null
 */
export function getAssetForEmotion(map: AssetMap, emotion: CatEmotion): CatAssetWithTalk | null {
  return (
    map.assets.get(emotion) ??
    map.assets.get('idle') ??
    map.assets.get('neutral') ??
    (map.assets.size > 0 ? map.assets.values().next().value ?? null : null)
  );
}

/**
 * Preload all assets into browser cache.
 */
export async function preloadAssets(map: AssetMap): Promise<void> {
  const urls: string[] = [];
  for (const asset of map.assets.values()) {
    urls.push(asset.src);
    if (asset.talkSrc) urls.push(asset.talkSrc);
  }

  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
}
