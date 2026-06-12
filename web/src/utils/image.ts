// IMDb / Amazon media images serve the full-resolution original by default
// (often 1000–2000px wide). Rendering dozens of those into small card slots
// makes the browser decode huge bitmaps and hold a lot of memory, so it evicts
// and re-decodes off-screen images while scrolling — which looks like the image
// "reloading". Requesting a capped width returns a right-sized image and keeps
// decoded memory small, so scrolled-past images stay painted.
//
// Amazon media URLs accept transform directives in the `._V1_…` segment:
//   QL{n} = JPEG quality, UX{n} = scale to width n. e.g. ._V1_QL75_UX300_.jpg
export function sizedImage(url: string | undefined, width: number): string {
  if (!url) return '';
  if (!url.includes('media-amazon.com')) return url;
  // Replace the existing `._V1_…(.ext)` transform segment with a width cap.
  return url.replace(/\._v1_.*?\.(jpg|jpeg|png)/i, `._V1_QL75_UX${width}_.$1`);
}
