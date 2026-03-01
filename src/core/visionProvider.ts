import { AiProvider } from "../state/appAiConfig";
import {
  FoodVisionResult,
  requestOpenAiVision,
  requestGeminiVision,
} from "./foodVision";

export const requestUnifiedVision = async (params: {
  provider: AiProvider;
  apiKey: string;
  dataUrl: string;
  mimeType: string;
}): Promise<FoodVisionResult> => {
  const { provider, apiKey, dataUrl, mimeType } = params;

  if (provider === "openai") {
    return requestOpenAiVision({ apiKey, dataUrl });
  }

  if (provider === "gemini") {
    return requestGeminiVision({ apiKey, dataUrl, mimeType });
  }

  throw new Error("No AI provider configured for image recognition.");
};
