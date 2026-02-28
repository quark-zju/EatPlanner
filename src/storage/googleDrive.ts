import { shouldLog } from "../core/debug";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const OAUTH_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const REDIRECT_STATE_KEY = "eat-planner-drive-oauth-state";
const REDIRECT_RETURN_HASH_KEY = "eat-planner-drive-oauth-return-hash";
const TOKEN_SESSION_KEY = "eat-planner-drive-token";
const logDrive = (...args: unknown[]) => {
  if (shouldLog) {
    console.log("[drive]", ...args);
  }
};

export const DRIVE_FILE_NAME = "eat-planner-export.json";

let accessToken: string | null = null;

const buildRedirectOAuthUrl = (clientId: string, state: string) => {
  const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: OAUTH_SCOPE,
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const beginRedirectOAuth = (clientId: string) => {
  const state = `eat-planner-${crypto.randomUUID()}`;
  sessionStorage.setItem(REDIRECT_STATE_KEY, state);
  const returnHash = window.location.hash || "#settings";
  sessionStorage.setItem(REDIRECT_RETURN_HASH_KEY, returnHash);
  const url = buildRedirectOAuthUrl(clientId, state);
  logDrive("redirectOAuth:start", { state });
  window.location.assign(url);
};

const consumeRedirectTokenIfPresent = () => {
  if (typeof window === "undefined") {
    return;
  }
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return;
  }
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  const returnedState = params.get("state");
  if (!token || !returnedState) {
    return;
  }

  const expectedState = sessionStorage.getItem(REDIRECT_STATE_KEY);
  if (!expectedState || returnedState !== expectedState) {
    logDrive("redirectOAuth:stateMismatch", {
      returnedState,
      expectedState,
    });
    return;
  }

  sessionStorage.removeItem(REDIRECT_STATE_KEY);
  const returnHash = sessionStorage.getItem(REDIRECT_RETURN_HASH_KEY) ?? "#settings";
  sessionStorage.removeItem(REDIRECT_RETURN_HASH_KEY);
  accessToken = token;
  sessionStorage.setItem(TOKEN_SESSION_KEY, token);
  logDrive("redirectOAuth:tokenConsumed");

  // Remove sensitive token from URL fragment.
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${returnHash}`;
  window.history.replaceState({}, document.title, cleanUrl);
};

consumeRedirectTokenIfPresent();

// Restore token from sessionStorage on page refresh (token never enters AppState or exports).
if (!accessToken && typeof sessionStorage !== "undefined") {
  const stored = sessionStorage.getItem(TOKEN_SESSION_KEY);
  if (stored) {
    accessToken = stored;
    logDrive("accessToken:restoredFromSession");
  }
}

const ensureAccessToken = async (clientId: string) => {
  void clientId;
  if (accessToken) {
    return accessToken;
  }
  throw new Error("Not connected to Google Drive. Click Connect Drive first.");
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

export const connectGoogleDrive = async (
  clientId: string
): Promise<"connected" | "redirecting"> => {
  const trimmed = clientId.trim();
  if (!trimmed) {
    throw new Error("Google OAuth Client ID is required.");
  }
  logDrive("connectGoogleDrive:start");
  if (accessToken) {
    logDrive("connectGoogleDrive:alreadyConnected");
    return "connected";
  }
  logDrive("connectGoogleDrive:redirectOnly");
  beginRedirectOAuth(trimmed);
  return "redirecting";
};

export const disconnectGoogleDrive = () => {
  if (!accessToken) {
    return;
  }
  if (window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => undefined);
  }
  accessToken = null;
  sessionStorage.removeItem(TOKEN_SESSION_KEY);
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
