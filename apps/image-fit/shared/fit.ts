/** Fitting a product picture to the shop's frame without losing any of it.
 *
 * Shared by the Zupona Image Fit app and by the Zupona admin's image uploader,
 * so a picture fitted in one looks exactly like a picture fitted in the other.
 * Browser-only: everything here draws on a canvas.
 *
 * The one rule is that the picture itself is never cut, stretched or redrawn.
 * It is scaled to fit inside the frame whole and pasted back at the end at
 * full sharpness; only the empty space around it is filled, either with a
 * blurred copy of the picture or with background an AI has painted. */

/** A frame shape, width over height. The shop's product frame is 4:5. */
export type Ratio = number;

export const PRODUCT_RATIO: Ratio = 4 / 5;

/** How far off the frame a picture may be before it is worth fitting at all.
 * A picture already this close shows with a hair-thin band, and filling that
 * would only soften its edge for nothing. */
const CLOSE_ENOUGH = 0.03;

/** Longest edge of a fitted picture. The storefront never asks for more. */
export const OUTPUT_LONG_EDGE = 1500;

/** Roughly how many pixels the AI paints. FLUX works in blocks of 16 and
 * slows sharply above about three quarters of a megapixel; the painting is
 * only the backdrop, scaled up behind the picture, so this is plenty. */
const AI_AREA = 768 * 960;

/** The longest edge of the reference picture sent to the AI. */
const AI_REFERENCE_EDGE = 1024;

export interface Placement {
  /** The whole frame. */
  width: number;
  height: number;
  /** Where the picture sits inside it, unscaled from its own shape. */
  x: number;
  y: number;
  drawWidth: number;
  drawHeight: number;
}

export function needsFitting(width: number, height: number, ratio: Ratio = PRODUCT_RATIO): boolean {
  return Math.abs(width / height - ratio) / ratio > CLOSE_ENOUGH;
}

/** Where a picture goes in a frame of `ratio` whose longest edge is `longEdge`.
 * Contained, never covered: the picture always fits inside whole. */
export function place(
  sourceWidth: number,
  sourceHeight: number,
  ratio: Ratio,
  longEdge: number
): Placement {
  const width = ratio >= 1 ? longEdge : Math.round(longEdge * ratio);
  const height = ratio >= 1 ? Math.round(longEdge / ratio) : longEdge;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);
  return {
    width,
    height,
    x: Math.round((width - drawWidth) / 2),
    y: Math.round((height - drawHeight) / 2),
    drawWidth,
    drawHeight,
  };
}

/** The frame the AI paints: the requested shape at about 0.7 megapixels,
 * both edges a multiple of 16. */
export function aiFrame(ratio: Ratio): { width: number; height: number } {
  const snap = (value: number) => Math.max(256, Math.round(value / 16) * 16);
  return { width: snap(Math.sqrt(AI_AREA * ratio)), height: snap(Math.sqrt(AI_AREA / ratio)) };
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw pictures.");
  return { canvas, context };
}

/** The picture stretched to cover the whole frame and blurred, darkened a
 * touch so the sharp picture on top reads as the subject. */
function paintBlurredBackdrop(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number
) {
  const cover = Math.max(width / sourceWidth, height / sourceHeight);
  const coverWidth = sourceWidth * cover;
  const coverHeight = sourceHeight * cover;
  context.save();
  context.filter = `blur(${Math.round(Math.max(width, height) / 30)}px) brightness(0.9)`;
  // Drawn a little oversize so the blur has no soft transparent rim.
  const bleed = Math.max(width, height) * 0.08;
  context.drawImage(
    source,
    (width - coverWidth) / 2 - bleed,
    (height - coverHeight) / 2 - bleed,
    coverWidth + bleed * 2,
    coverHeight + bleed * 2
  );
  context.restore();
}

/** The frame with the picture inside and its surroundings blurred. Instant,
 * free, and needs no network. */
export function fitWithBlur(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  ratio: Ratio = PRODUCT_RATIO,
  longEdge: number = OUTPUT_LONG_EDGE
): HTMLCanvasElement {
  const spot = place(sourceWidth, sourceHeight, ratio, longEdge);
  const { canvas, context } = canvasOf(spot.width, spot.height);
  paintBlurredBackdrop(context, source, sourceWidth, sourceHeight, spot.width, spot.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, spot.x, spot.y, spot.drawWidth, spot.drawHeight);
  return canvas;
}

/** What gets sent to the AI: the bare picture, shrunk, and the frame to
 * paint around it.
 *
 * Bare on purpose. Handed a frame whose margins were already filled with a
 * blurred copy, the model took the blur for intended bokeh and kept it; given
 * the picture alone it continues the scene into the new space. */
export async function prepareForAi(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  ratio: Ratio = PRODUCT_RATIO
): Promise<{ image: Blob; width: number; height: number }> {
  const scale = Math.min(1, AI_REFERENCE_EDGE / Math.max(sourceWidth, sourceHeight));
  const { canvas, context } = canvasOf(
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale)
  );
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = await toBlob(canvas, "image/jpeg", 0.9);
  if (!image) throw new Error("Could not prepare the picture.");
  return { image, ...aiFrame(ratio) };
}

/** The final frame: the AI's painting scaled up behind, the untouched picture
 * pasted over it at full sharpness.
 *
 * The painting never lines up with the picture to the pixel, so the picture's
 * edges that meet painted space are faded over a hair-thin band -- one and a
 * half percent of its size -- rather than leaving a hard seam. Nothing is
 * cropped: every pixel of the picture is still there, the outermost ones
 * merely blend into what continues them. */
export function composeWithFill(
  fill: CanvasImageSource,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  ratio: Ratio = PRODUCT_RATIO,
  longEdge: number = OUTPUT_LONG_EDGE
): HTMLCanvasElement {
  const spot = place(sourceWidth, sourceHeight, ratio, longEdge);
  const { canvas, context } = canvasOf(spot.width, spot.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(fill, 0, 0, spot.width, spot.height);

  const picture = canvasOf(spot.drawWidth, spot.drawHeight);
  picture.context.imageSmoothingQuality = "high";
  picture.context.drawImage(source, 0, 0, spot.drawWidth, spot.drawHeight);

  const fadeEdge = (vertical: boolean) => {
    const size = vertical ? spot.drawHeight : spot.drawWidth;
    const band = Math.max(3, Math.round(size * 0.015));
    const gradient = vertical
      ? picture.context.createLinearGradient(0, 0, 0, spot.drawHeight)
      : picture.context.createLinearGradient(0, 0, spot.drawWidth, 0);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(band / size, "rgba(0,0,0,1)");
    gradient.addColorStop(1 - band / size, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    picture.context.globalCompositeOperation = "destination-in";
    picture.context.fillStyle = gradient;
    picture.context.fillRect(0, 0, spot.drawWidth, spot.drawHeight);
    picture.context.globalCompositeOperation = "source-over";
  };
  // Only the edges that meet painted space; an edge on the frame's border
  // stays exactly as it was.
  if (spot.y > 0) fadeEdge(true);
  if (spot.x > 0) fadeEdge(false);

  context.drawImage(picture.canvas, spot.x, spot.y);
  return canvas;
}

export function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality = 0.88
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP where the browser can make it, JPEG where it quietly cannot. */
export async function encodeForWeb(canvas: HTMLCanvasElement): Promise<Blob> {
  let blob = await toBlob(canvas, "image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg");
  if (!blob) throw new Error("Could not save the picture.");
  return blob;
}
