const DRIVE_FILE_PATTERNS = [
  /\/file\/d\/([A-Za-z0-9_-]{10,})/,
  /[?&]id=([A-Za-z0-9_-]{10,})/,
  /\/d\/([A-Za-z0-9_-]{10,})/,
];

export function extractGoogleDriveFileId(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return null;

    for (const pattern of DRIVE_FILE_PATTERNS) {
      const match = url.href.match(pattern);
      if (match?.[1]) return match[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function getGoogleDriveThumbnailUrl(value: string | null | undefined) {
  const fileId = extractGoogleDriveFileId(value);
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w640` : null;
}

export function getGoogleDrivePreviewUrl(value: string | null | undefined) {
  const fileId = extractGoogleDriveFileId(value);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
}

export function isValidGoogleDriveUrl(value: string) {
  return extractGoogleDriveFileId(value) !== null;
}

