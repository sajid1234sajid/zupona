/** The page at fit.zupona.com. Bundled to public/app.js by `npm run build`. */

import {
  composeWithFill,
  encodeForWeb,
  fitWithBlur,
  needsFitting,
  prepareForAi,
} from "../shared/fit";

const KEY_STORAGE = "zupona-image-fit-key";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const drop = $<HTMLDivElement>("drop");
const picker = $<HTMLInputElement>("files");
const results = $<HTMLElement>("results");
const keyRow = $<HTMLDivElement>("keyRow");
const keyHint = $<HTMLParagraphElement>("keyHint");
const keyInput = $<HTMLInputElement>("key");
const downloadAll = $<HTMLButtonElement>("downloadAll");
const clearAll = $<HTMLButtonElement>("clear");

interface Done {
  name: string;
  blob: Blob;
}
const finished: Done[] = [];

function readStored(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function chosen(name: string): string {
  return (document.querySelector(`input[name=${name}]:checked`) as HTMLInputElement).value;
}

function syncKeyRow() {
  const ai = chosen("mode") === "ai";
  keyRow.hidden = !ai;
  keyHint.hidden = !ai;
}

keyInput.value = readStored();
document.querySelectorAll("input[name=mode]").forEach((input) =>
  input.addEventListener("change", syncKeyRow)
);
syncKeyRow();

$("saveKey").addEventListener("click", async () => {
  const key = keyInput.value.trim();
  const response = await fetch("/api/check", { headers: { "x-access-key": key } });
  if (response.ok) {
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* Private window: the key still works for this visit. */
    }
    keyHint.textContent = "✓ Key ঠিক আছে, রাখা হলো।";
  } else {
    keyHint.textContent = "✗ Key ভুল। আবার দেখুন।";
  }
  keyHint.hidden = false;
});

drop.addEventListener("click", () => picker.click());
drop.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") picker.click();
});
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("over");
  void handle([...(event.dataTransfer?.files ?? [])]);
});
picker.addEventListener("change", () => {
  void handle([...(picker.files ?? [])]);
  picker.value = "";
});

clearAll.addEventListener("click", () => {
  results.innerHTML = "";
  finished.length = 0;
  refreshButtons();
});

downloadAll.addEventListener("click", async () => {
  // One after another: a browser allows a burst of downloads from one click
  // only if they do not all fire in the same instant.
  for (const item of finished) {
    save(item.blob, item.name);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
});

function refreshButtons() {
  downloadAll.disabled = finished.length === 0;
  clearAll.disabled = results.children.length === 0;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function outputName(original: string, blob: Blob): string {
  const base = original.replace(/\.[^.]+$/, "");
  return `${base}-zupona.${blob.type === "image/webp" ? "webp" : "jpg"}`;
}

function note(parent: HTMLElement, kind: "warn" | "error" | "ok", text: string) {
  const element = document.createElement("div");
  element.className = `note ${kind}`;
  element.textContent = text;
  parent.appendChild(element);
}

async function handle(files: File[]) {
  const pictures = files.filter((file) => file.type.startsWith("image/"));
  // In order and one at a time: the AI answers one request per few seconds
  // anyway, and a queue keeps the page responsive on a phone.
  for (const file of pictures) await processOne(file);
}

async function processOne(file: File) {
  const ratio = Number(chosen("ratio"));
  const mode = chosen("mode");

  const card = document.createElement("article");
  card.className = "card result";
  card.innerHTML = `<p class="name"></p><div class="pair"><figure><figcaption>আপনার ছবি</figcaption><img alt=""></figure><figure><figcaption>Fit করার পর</figcaption><div class="busy">বানানো হচ্ছে…</div></figure></div>`;
  (card.querySelector(".name") as HTMLElement).textContent = file.name;
  const originalUrl = URL.createObjectURL(file);
  (card.querySelector("img") as HTMLImageElement).src = originalUrl;
  results.insertBefore(card, results.firstChild);
  refreshButtons();

  const slot = card.querySelectorAll("figure")[1];
  const busy = slot.querySelector(".busy") as HTMLElement;
  busy.style.aspectRatio = String(ratio);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    busy.remove();
    note(card, "error", "এই ফাইলটা ছবি হিসেবে খোলা যাচ্ছে না।");
    return;
  }

  const { width, height } = bitmap;
  const shape = width / height;

  if (!needsFitting(width, height, ratio)) {
    note(card, "ok", "এই ছবি আগে থেকেই ঠিক মাপে আছে, শুধু আকার ঠিক করা হলো।");
  } else if (shape > ratio * 1.6) {
    // Wide banners are the case that cannot look big in a tall frame without
    // cropping -- worth telling someone before they ship it.
    note(
      card,
      "warn",
      "ছবিটা অনেক চওড়া, তাই frame-এ ছোট দেখাবে। সম্ভব হলে লম্বা (4:5) মাপে design করান।"
    );
  }

  try {
    let canvas: HTMLCanvasElement | null = null;
    if (mode === "ai" && needsFitting(width, height, ratio)) {
      try {
        canvas = await fitWithAi(bitmap, ratio);
      } catch (error) {
        // A wrong key is for the person to fix; anything else (the day's
        // allowance spent, an outage) should not stop them getting a picture.
        if (error instanceof Error && error.message === "Access key ভুল।") throw error;
        note(
          card,
          "warn",
          `AI এখন আঁকতে পারছে না (${
            error instanceof Error ? error.message : "উত্তর নেই"
          }), তাই ঝাপসা পদ্ধতিতে বানানো হলো।`
        );
      }
    }
    canvas ??= fitWithBlur(bitmap, width, height, ratio);

    const blob = await encodeForWeb(canvas);
    const name = outputName(file.name, blob);
    const image = document.createElement("img");
    image.alt = "";
    image.src = URL.createObjectURL(blob);
    busy.parentNode?.replaceChild(image, busy);

    const actions = document.createElement("div");
    actions.className = "actions";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Download";
    button.addEventListener("click", () => save(blob, name));
    actions.appendChild(button);
    card.appendChild(actions);

    finished.push({ name, blob });
  } catch (error) {
    busy.remove();
    note(card, "error", error instanceof Error ? error.message : "কিছু একটা ভুল হয়েছে।");
  } finally {
    bitmap.close();
    refreshButtons();
  }
}

async function fitWithAi(bitmap: ImageBitmap, ratio: number): Promise<HTMLCanvasElement> {
  const key = keyInput.value.trim() || readStored();
  if (!key) throw new Error("AI ব্যবহার করতে ওপরে access key দিন।");

  const prepared = await prepareForAi(bitmap, bitmap.width, bitmap.height, ratio);
  const form = new FormData();
  form.append("image", prepared.image, "image.jpg");
  form.append("width", String(prepared.width));
  form.append("height", String(prepared.height));

  const response = await fetch("/api/expand", {
    method: "POST",
    headers: { "x-access-key": key },
    body: form,
  });
  if (response.status === 401) throw new Error("Access key ভুল।");
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    const message = payload.error ?? "";
    throw new Error(
      /allocation|neurons/i.test(message) ? "আজকের ফ্রি AI সীমা শেষ, কাল সকালে আবার চলবে" : message || "AI উত্তর দিচ্ছে না"
    );
  }

  const fill = await createImageBitmap(await response.blob());
  try {
    return composeWithFill(fill, bitmap, bitmap.width, bitmap.height, ratio);
  } finally {
    fill.close();
  }
}
