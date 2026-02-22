export const APP_SCHEMA = "eat-planner-state";
export const APP_SCHEMA_VERSION = 2;

export type ExportEnvelope<T> = {
  schema: typeof APP_SCHEMA;
  version: number;
  exportedAt: string;
  payload: T;
};

export const makeExportEnvelope = <T>(payload: T): ExportEnvelope<T> => ({
  schema: APP_SCHEMA,
  version: APP_SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  payload,
});

export const serializeExport = <T>(payload: T): string =>
  JSON.stringify(makeExportEnvelope(payload), null, 2);

export const parseImportText = <T>(
  text: string,
  isPayload: (value: unknown) => value is T
): T => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Import is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Import root must be an object.");
  }

  const envelope = parsed as Partial<ExportEnvelope<unknown>>;
  if (envelope.schema !== APP_SCHEMA) {
    throw new Error(`Unexpected schema: ${String(envelope.schema)}.`);
  }

  if (typeof envelope.version !== "number") {
    throw new Error("Missing or invalid version.");
  }

  if (envelope.version > APP_SCHEMA_VERSION) {
    throw new Error(
      `Import version ${envelope.version} is newer than supported version ${APP_SCHEMA_VERSION}.`
    );
  }

  if (!isPayload(envelope.payload)) {
    throw new Error("Import payload shape is invalid.");
  }

  return envelope.payload;
};

export const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
