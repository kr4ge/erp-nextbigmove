import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export const IMAGE_SOURCE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const VIDEO_SOURCE_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'] as const;

/**
 * A static creative is an image and a video creative is a video. The check is
 * by extension, the same rule the analysis upload applies, so a file refused
 * at enrollment would have been refused at analysis too.
 */
export function assertSourceMatchesKind(kind: 'VIDEO' | 'STATIC', originalName: string | null | undefined) {
  const extension = extname(originalName || '').toLowerCase();
  const isImage = (IMAGE_SOURCE_EXTENSIONS as readonly string[]).includes(extension);
  const isVideo = (VIDEO_SOURCE_EXTENSIONS as readonly string[]).includes(extension);
  if (kind === 'STATIC' && !isImage) {
    throw new BadRequestException('This is a static creative. Upload a JPG, PNG, or WebP image.');
  }
  if (kind === 'VIDEO' && !isVideo) {
    throw new BadRequestException('This is a video creative. Upload an MP4, MOV, M4V, or WebM video.');
  }
}
