const GOOGLE_IDENTITY_URL = "https://accounts.google.com/gsi/client";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

export const DRIVE_FILE_NAME = "eat-tracker-export.json";

let accessToken: string | null = null;
type TokenClient = {
  callback: (response: { access_token?: string; error?: string }) => void;
  requestAccessToken(options?: { prompt?: "consent" | "" }): void;
};

let tokenClient: TokenClient | null = null;
let scriptPromise: Promise<void> | null = null;

const ensureGoogleIdentityScript = async () => {
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity script.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity script."));
    document.head.appendChild(script);
  });

  return scriptPromise;
};

const ensureTokenClient = async (clientId: string) => {
  await ensureGoogleIdentityScript();
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity SDK is unavailable.");
  }

  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.appdata",
      callback: () => undefined,
    }) as TokenClient;
  }

  return tokenClient;
};

const requestAccessToken = async (
  clientId: string,
  prompt: "consent" | ""
): Promise<string> => {
  const client = await ensureTokenClient(clientId);

  return new Promise<string>((resolve, reject) => {
    client.callback = (response: { access_token?: string; error?: string }) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error || "Failed to authorize Google Drive."));
        return;
      }
      accessToken = response.access_token;
      resolve(response.access_token);
    };

    client.requestAccessToken({ prompt });
  });
};

const ensureAccessToken = async (clientId: string) => {
  if (accessToken) {
    return accessToken;
  }
  return requestAccessToken(clientId, "consent");
};

const fetchJson = async <T>(input: RequestInfo | URL, init: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive request failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
};

type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
};

const findLatestDriveFile = async (token: string): Promise<DriveFile | null> => {
  const query = encodeURIComponent(
    `name='${DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,modifiedTime)");
  const url = `${DRIVE_API_BASE}/files?q=${query}&spaces=appDataFolder&fields=${fields}`;

  const result = await fetchJson<{ files: DriveFile[] }>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!result.files.length) {
    return null;
  }

  return result.files.sort((a, b) =>
    a.modifiedTime > b.modifiedTime ? -1 : a.modifiedTime < b.modifiedTime ? 1 : 0
  )[0];
};

const uploadFile = async (
  token: string,
  content: string,
  existingFileId?: string
): Promise<void> => {
  const metadata = existingFileId
    ? { name: DRIVE_FILE_NAME }
    : { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] };

  const boundary = `boundary_${crypto.randomUUID()}`;
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${content}\r\n` +
    `--${boundary}--`;

  const url = existingFileId
    ? `${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

  const response = await fetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${text}`);
  }
};

export const connectGoogleDrive = async (clientId: string) => {
  const trimmed = clientId.trim();
  if (!trimmed) {
    throw new Error("Google OAuth Client ID is required.");
  }
  await requestAccessToken(trimmed, "consent");
};

export const disconnectGoogleDrive = () => {
  if (!accessToken) {
    return;
  }
  if (window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => undefined);
  }
  accessToken = null;
};

export const isGoogleDriveConnected = () => Boolean(accessToken);

export const saveToGoogleDrive = async (clientId: string, content: string) => {
  const token = await ensureAccessToken(clientId.trim());
  const existing = await findLatestDriveFile(token);
  await uploadFile(token, content, existing?.id);
};

export const loadFromGoogleDrive = async (clientId: string): Promise<string> => {
  const token = await ensureAccessToken(clientId.trim());
  const existing = await findLatestDriveFile(token);
  if (!existing) {
    throw new Error("No Google Drive backup found yet.");
  }

  const response = await fetch(`${DRIVE_API_BASE}/files/${existing.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive download failed (${response.status}): ${text}`);
  }

  return response.text();
};
