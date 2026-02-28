export type FoodVisionResult = {
  name: string;
  unit: string;
  carbs: number;
  fat: number;
  protein: number;
  calories?: number;
  price?: number;
  confidence: "label" | "estimate";
  notes?: string;
};

const MAX_IMAGE_EDGE = 1200;

const clampNumber = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? (value as number) : fallback;

const sanitizeUnit = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "serving";
};

const sanitizeName = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "New food";
};

export const resizeImageFile = async (file: File) => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = dataUrl;
  });

  const maxEdge = Math.max(img.width, img.height);
  if (maxEdge <= MAX_IMAGE_EDGE) {
    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    return { dataUrl, width: img.width, height: img.height, mimeType };
  }

  const scale = MAX_IMAGE_EDGE / maxEdge;
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Image processing is not available.");
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const resizedDataUrl = canvas.toDataURL(mimeType, 0.86);

  return { dataUrl: resizedDataUrl, width: targetWidth, height: targetHeight, mimeType };
};

const buildPrompt = () => {
  return [
    "You are a nutrition analyst.",
    "If the image shows a nutrition facts label, read it carefully.",
    "If the image is an actual food (no label), estimate typical nutrition for a reasonable serving.",
    "Return a single JSON object only, no Markdown.",
    "Use this schema:",
    "{\"name\":string,\"unit\":string,\"carbs\":number,\"fat\":number,\"protein\":number,\"calories\":number|null,\"price\":number|null,\"confidence\":\"label\"|\"estimate\",\"notes\":string|null}",
    "Rules:",
    "- Use grams for macros.",
    "- For unit, use the serving size if visible; otherwise use \"serving\".",
    "- If calories or price are unknown, return null.",
    "- If label data is incomplete, estimate missing parts and note it.",
    "- Keep name concise (product name or food name).",
  ].join(" ");
};

export const parseFoodVisionResult = (raw: unknown): FoodVisionResult => {
  if (!raw || typeof raw !== "object") {
    throw new Error("OpenAI response was not a JSON object.");
  }

  const obj = raw as {
    name?: unknown;
    unit?: unknown;
    carbs?: unknown;
    fat?: unknown;
    protein?: unknown;
    calories?: unknown;
    price?: unknown;
    confidence?: unknown;
    notes?: unknown;
  };

  const calories =
    obj.calories === null || Number.isFinite(obj.calories)
      ? (obj.calories as number | null)
      : null;
  const price =
    obj.price === null || Number.isFinite(obj.price) ? (obj.price as number | null) : null;

  return {
    name: sanitizeName(typeof obj.name === "string" ? obj.name : undefined),
    unit: sanitizeUnit(typeof obj.unit === "string" ? obj.unit : undefined),
    carbs: clampNumber(typeof obj.carbs === "number" ? obj.carbs : undefined),
    fat: clampNumber(typeof obj.fat === "number" ? obj.fat : undefined),
    protein: clampNumber(typeof obj.protein === "number" ? obj.protein : undefined),
    calories: calories ?? undefined,
    price: price ?? undefined,
    confidence: obj.confidence === "estimate" ? "estimate" : "label",
    notes: typeof obj.notes === "string" && obj.notes.trim() ? obj.notes.trim() : undefined,
  };
};

export const requestFoodVision = async (payload: {
  apiKey: string;
  dataUrl: string;
}) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildPrompt() },
            { type: "input_image", image_url: payload.dataUrl },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `OpenAI request failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  const text =
    data.output?.[0]?.content?.find((item) => item.type === "output_text")?.text ?? "";
  if (!text) {
    throw new Error("OpenAI returned no content.");
  }
  const parsed = JSON.parse(text) as unknown;
  return parseFoodVisionResult(parsed);
};
