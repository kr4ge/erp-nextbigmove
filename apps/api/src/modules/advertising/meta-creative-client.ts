/**
 * Reads ad creatives from Meta.
 *
 * Deliberately its own client rather than a method on the shared MetaAdsProvider.
 * That provider belongs to the ERP's integrations module and is on the path
 * every spend sync takes; this module has no business editing it to add a
 * feature only the advertising console wants. The cost is a second copy of the
 * batching loop, which is cheap next to a change nobody else asked for.
 *
 * Read-only. It asks Meta what an ad looked like and writes nothing back.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

/** Meta takes at most 50 ids per lookup. */
const BATCH_SIZE = 50;

/** One ad's creative, as Meta returns it. */
export interface MetaAdCreative {
  creativeId: string;
  name: string | null;
  /** Meta-hosted and short-lived — stored as a pointer, refreshed on each sync. */
  thumbnailUrl: string | null;
  imageUrl: string | null;
  videoId: string | null;
  title: string | null;
  body: string | null;
}

/**
 * Fetch the creative behind each ad id.
 *
 * A batch that fails is warned about and skipped rather than thrown: a missing
 * thumbnail is not worth losing the other forty-nine, and the caller is told how
 * many ads came back without one.
 */
export async function fetchAdCreatives(
  accessToken: string,
  adIds: string[],
  onBatchError?: (message: string) => void,
): Promise<Record<string, MetaAdCreative>> {
  if (!adIds.length) return {};

  const creatives: Record<string, MetaAdCreative> = {};

  for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
    const batch = adIds.slice(i, i + BATCH_SIZE);

    const params = new URLSearchParams({
      ids: batch.join(','),
      fields: 'id,creative{id,name,thumbnail_url,image_url,video_id,title,body}',
      access_token: accessToken,
    });

    const response = await fetch(`${GRAPH_API_BASE}/?${params.toString()}`);

    if (!response.ok) {
      onBatchError?.(`Meta refused a batch of ${batch.length} ads: ${response.statusText}`);
      continue;
    }

    const data = await response.json();

    for (const [adId, adData] of Object.entries(data)) {
      const creative = (adData as any)?.creative;
      if (!creative?.id) continue;

      creatives[adId] = {
        creativeId: String(creative.id),
        name: creative.name ?? null,
        thumbnailUrl: creative.thumbnail_url ?? null,
        imageUrl: creative.image_url ?? null,
        videoId: creative.video_id ? String(creative.video_id) : null,
        title: creative.title ?? null,
        body: creative.body ?? null,
      };
    }
  }

  return creatives;
}
