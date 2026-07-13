import ImageKit from "imagekit";
import { serverEnv } from "./env";

let imageKit: ImageKit | null = null;
function getImageKit(): ImageKit {
  if (!imageKit) {
    imageKit = new ImageKit({
      publicKey: serverEnv.imagekitPublicKey,
      privateKey: serverEnv.imagekitPrivateKey,
      urlEndpoint: serverEnv.imagekitUrlEndpoint,
    });
  }

  return imageKit;
}

type UnsplashPhoto = {
  sourceUrl: string;
  photographer: string;
  photographerUrl: string;
};

// Finds a landscape stock photo for the destination via the Unsplash Search API,
// returning the source URL plus attribution (required by Unsplash ToS, see R6).
// Returns null if nothing is found.
async function findUnsplashCover(
  destination: string,
): Promise<UnsplashPhoto | null> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", destination);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${serverEnv.unsplashAccessKey}` },
  });

  if (!res.ok) {
    throw new Error(`Unsplash search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    results?: {
      urls?: { regular?: string; full?: string };
      user?: { name?: string; links?: { html?: string } };
    }[];
  };

  const photo = data.results?.[0];
  const sourceUrl = photo?.urls?.regular ?? photo?.urls?.full;
  if (!sourceUrl) return null;

  return {
    sourceUrl,
    photographer: photo?.user?.name ?? "Unsplash",
    // Append Unsplash's required referral params to the photographer link.
    photographerUrl:
      (photo?.user?.links?.html ?? "https://unsplash.com") +
      "?utm_source=triply&utm_medium=referral",
  };
}

export type TripCover = {
  url: string;
  photographer: string;
  photographerUrl: string;
};

// Sources a cover image for the destination (Unsplash) and re-hosts it through
// ImageKit for optimization/delivery. Returns the ImageKit URL + attribution, or
// null if a cover couldn't be produced — the cover is non-critical, so callers
// should treat null as "no cover yet" rather than a hard failure.
export async function generateTripCoverImage(
  destination: string,
  tripId: string,
): Promise<TripCover | null> {
  const photo = await findUnsplashCover(destination);
  if (!photo) return null;

  // ImageKit can ingest a remote URL directly as the upload source.
  const uploaded = await getImageKit().upload({
    file: photo.sourceUrl,
    fileName: `${tripId}.jpg`,
    folder: "/tripme/covers",
    useUniqueFileName: false,
  });

  return {
    url: uploaded.url,
    photographer: photo.photographer,
    photographerUrl: photo.photographerUrl,
  };
}

// Uploads a user-picked cover image (raw base64, no data-URI prefix) to ImageKit and
// returns the delivered URL. A unique filename is used so the CDN URL changes on each
// upload (avoids serving a stale cached image at the same path).
export async function uploadTripCover(
  base64: string,
  tripId: string,
): Promise<string> {
  const uploaded = await getImageKit().upload({
    file: base64,
    fileName: `${tripId}.jpg`,
    folder: "/tripme/covers",
    useUniqueFileName: false,
  });

  return uploaded.url;
}
