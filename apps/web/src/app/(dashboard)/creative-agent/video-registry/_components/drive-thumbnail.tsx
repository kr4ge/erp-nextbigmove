'use client';

import { useEffect, useState } from 'react';
import { Facebook, Link2Off, Play, Video } from 'lucide-react';
import { getGoogleDriveThumbnailUrl } from '../_utils/google-drive-url';
import { isValidFacebookPostUrl } from '../_utils/facebook-post-url';

type Props = {
  mediaUrl: string | null;
  title: string;
  compact?: boolean;
  onClick?: () => void;
  /**
   * Signed URL for a cover image the ERP already cached (resolved from the
   * Facebook post's og:image). Preferred over any URL-derived thumbnail
   * because it is stored by us and never expires.
   */
  cachedThumbnailUrl?: string | null;
  /** Draws the play affordance for video posts and reels. */
  isVideo?: boolean;
};

export function DriveThumbnail({
  mediaUrl,
  title,
  compact = false,
  onClick,
  cachedThumbnailUrl = null,
  isVideo = false,
}: Props) {
  // Cached cover wins; a Drive link can still derive one directly.
  const thumbnailUrl = cachedThumbnailUrl ?? getGoogleDriveThumbnailUrl(mediaUrl);
  // A Facebook post with no cached cover yet cannot be framed — link out.
  const isFacebookPost = mediaUrl ? isValidFacebookPostUrl(mediaUrl) : false;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [thumbnailUrl]);

  const dimensions = compact ? 'h-14 w-20' : 'aspect-video w-full';
  const content = thumbnailUrl && !failed ? (
    <>
      {/* Runtime URLs (Drive or signed object storage) intentionally bypass Next's image proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl}
        alt={`Thumbnail for ${title}`}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
      <span className={`absolute inset-0 flex items-center justify-center bg-foreground/10 transition ${isVideo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-primary shadow-sm">
          <Play className="h-4 w-4 fill-current" />
        </span>
      </span>
    </>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-background-secondary px-2 text-center text-muted">
      {isFacebookPost ? <Facebook className="h-5 w-5" /> : mediaUrl ? <Link2Off className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      {!compact ? (
        <span className="text-xs-tight font-medium">
          {isFacebookPost ? 'Open the Facebook post' : mediaUrl ? 'Preview unavailable for this link' : 'No post link yet'}
        </span>
      ) : null}
    </div>
  );

  if (!onClick) {
    return <div className={`${dimensions} relative overflow-hidden rounded-xl border border-border`}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${dimensions} group relative overflow-hidden rounded-xl border border-border text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
      aria-label={`Review ${title}`}
    >
      {content}
    </button>
  );
}
