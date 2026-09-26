/** Paints the space around a product picture with Workers AI.
 *
 * The model is FLUX.2 [klein] 9B, which takes a reference picture and a
 * prompt and paints a new frame of any shape. Asked to show "this exact
 * photograph in a taller frame", it redraws the scene with room above and
 * below (or beside) it. That painting is only ever used as the backdrop: the
 * browser pastes the untouched original back over the middle, so the lettering
 * and the product the shopper reads are always the uploaded pixels, never the
 * model's version of them.
 *
 * Two approaches were measured and dropped before this one. Stable Diffusion
 * 1.5 inpainting, the mask-based model, painted stray legs and garbled
 * lettering into the margins. And FLUX handed a frame whose margins were
 * already filled with a blurred copy read the blur as intentional bokeh and
 * left it there; given the bare original it continues the scene properly.
 *
 * It runs on the Cloudflare account's own AI allowance, so there is no key to
 * paste and nothing to leak. */

export const MODEL = "@cf/black-forest-labs/flux-2-klein-9b";

/** The shape of the answer, described in terms that suit any product
 * picture rather than any one of them. Specific nouns ("the house, the sky")
 * help the model, but those would have to come from a second model reading the
 * picture first, and the generic wording below was already enough in testing. */
/** "Frame" is deliberately not a word in it: an earlier wording asked for
 * "a frame of a different shape" and the model drew a literal picture frame --
 * a gold octagon, wooden edges -- around the photograph. */
const PROMPT =
  "Outpaint this photograph onto a larger canvas. Keep the original photograph at the same " +
  "size in the centre, unchanged, and continue its scene naturally into the new space " +
  "around it, as if the camera had captured a wider view of the same place: the same " +
  "walls, floor, sky, plants and background carrying on past the edges. Photorealistic, " +
  "sharp, seamless. No borders, no picture frames, no panels, no text, no letters, no " +
  "logos, no people and no extra products in the new space.";

/** Bounds on what is accepted, so one request cannot run up the bill. */
const MIN_EDGE = 256;
const MAX_EDGE = 1280;
const MAX_BYTES = 6 * 1024 * 1024;

export class ExpandError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ExpandInput {
  /** The original picture, already shrunk by the browser. */
  image: ArrayBuffer;
  /** The frame to paint, in pixels. */
  width: number;
  height: number;
}

/** Returns the painted frame as image bytes. */
export async function expand(ai: Ai, input: ExpandInput): Promise<Uint8Array<ArrayBuffer>> {
  const { image, width, height } = input;

  if (image.byteLength === 0) throw new ExpandError("The picture is missing.");
  if (image.byteLength > MAX_BYTES) {
    throw new ExpandError("The picture is too large to send to the AI.");
  }
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_EDGE ||
    height < MIN_EDGE ||
    width > MAX_EDGE ||
    height > MAX_EDGE ||
    width % 16 !== 0 ||
    height % 16 !== 0
  ) {
    throw new ExpandError(
      `The frame must be a multiple of 16 between ${MIN_EDGE} and ${MAX_EDGE} pixels.`
    );
  }

  // The model takes its inputs as a multipart form; building it through a
  // Response is what yields the body and its boundary together.
  const form = new FormData();
  form.append("prompt", PROMPT);
  form.append("input_image_0", new Blob([image]));
  form.append("width", String(width));
  form.append("height", String(height));
  const encoded = new Response(form);

  let result: { image?: string };
  try {
    result = (await ai.run(MODEL, {
      multipart: {
        body: encoded.body ?? new ReadableStream(),
        contentType: encoded.headers.get("content-type") ?? "multipart/form-data",
      },
    })) as { image?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExpandError(`The AI could not paint this picture: ${message}`, 502);
  }

  if (!result.image) throw new ExpandError("The AI returned no picture.", 502);
  const binary = atob(result.image);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
