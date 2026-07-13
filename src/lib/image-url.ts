// Client-safe helpers for building optimized ImageKit delivery URLs. Kept free of any
// server imports (the ImageKit SDK / secrets live in `@/lib/images`).

// Appends ImageKit delivery transformations so images are served resized, compressed
// and in an optimal format instead of at their original (potentially huge) size.
// Non-ImageKit URLs are returned unchanged.
export function optimizedImage(
  url: string | null | undefined,
  width = 1200,
  quality = 80,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("ik.imagekit.io")) return url;

  const sep = url.includes("?") ? "&" : "?";

  return `${url}${sep}tr=w-${width},q-${quality},f-auto`;
}
