import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/cache";
import { getImageFit } from "@/lib/imageFit";

/** Paints the surroundings of a product picture, for the admin uploader.
 *
 * The browser sends the picture (already shrunk) and the frame size; this
 * passes them to the Zupona Image Fit Worker over its service binding and
 * returns the painting. The browser then pastes the untouched picture over the
 * middle of it, so what comes back here is only ever background.
 *
 * Every call spends the Cloudflare account's AI allowance, so it is for the
 * admin team only and capped per person. */

const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const limit = await rateLimit(`admin-image-fit:${user.id}`, 30, 60).catch(() => null);
  if (limit && !limit.allowed) {
    return NextResponse.json({ error: "Too many pictures at once" }, { status: 429 });
  }

  const service = await getImageFit();
  if (!service) {
    return NextResponse.json({ error: "Image Fit is not connected" }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File) || image.size === 0 || image.size > MAX_BYTES) {
    return NextResponse.json({ error: "No usable picture was sent" }, { status: 400 });
  }

  try {
    const painted = await service.expand({
      image: await image.arrayBuffer(),
      width: Number(form?.get("width")),
      height: Number(form?.get("height")),
    });
    return new Response(new Uint8Array(painted), {
      headers: { "content-type": "application/octet-stream", "cache-control": "no-store" },
    });
  } catch (error) {
    // The AI's own sentence is the useful part -- "daily free allocation used
    // up" tells the admin exactly why the blurred fill was used instead.
    const message = error instanceof Error ? error.message : "The AI did not answer";
    const allowance = /allocation|neurons/i.test(message);
    return NextResponse.json(
      { error: allowance ? "today's free AI allowance is used up" : message.slice(0, 200) },
      { status: 502 }
    );
  }
}
