/**
 * GET /api/catfile/[...path]
 *
 * Serves files from the /catfiles/ directory with proper MIME types.
 * Supports nested paths (e.g., /api/catfile/GIFs/BlackCat_Idle1_ghremlin.gif).
 * Security: blocks path traversal via resolve check.
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.apng': 'image/apng',
  '.webm': 'video/webm',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  // Decode each segment (handles %20 etc.)
  const decoded = pathSegments.map(s => decodeURIComponent(s));
  const filePath = path.join(process.cwd(), 'catfiles', ...decoded);

  // Security: prevent path traversal
  const resolved = path.resolve(filePath);
  const catDir = path.resolve(process.cwd(), 'catfiles');
  if (!resolved.startsWith(catDir)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    return new NextResponse(`Unsupported format: ${ext}`, { status: 415 });
  }

  const buffer = fs.readFileSync(resolved);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
