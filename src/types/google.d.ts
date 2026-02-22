declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
            }) => void;
          }): google.accounts.oauth2.TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

declare namespace google.accounts.oauth2 {
  interface TokenClient {
    callback: (response: { access_token?: string; error?: string }) => void;
    requestAccessToken(options?: { prompt?: "consent" | "" }): void;
  }
}

export {};
