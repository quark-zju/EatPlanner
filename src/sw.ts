import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { registerRoute } from "workbox-routing";

declare const self: {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

type SWEvent = {
  waitUntil: (promise: Promise<unknown>) => void;
};

type SWFetchEvent = SWEvent & {
  request: Request;
  respondWith: (promise: Promise<Response>) => void;
};

const sw = self as unknown as {
  clients: { claim: () => Promise<void> };
  addEventListener: (
    type: "activate" | "fetch",
    listener: (event: SWEvent | SWFetchEvent) => void
  ) => void;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === "navigate",
  createHandlerBoundToURL("/index.html")
);

sw.addEventListener("activate", (event: SWEvent) => {
  event.waitUntil(sw.clients.claim());
});

const coepHeaders = new Headers({
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
});

sw.addEventListener("fetch", (event) => {
  const fetchEvent = event as SWFetchEvent;
  const { request } = fetchEvent;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  fetchEvent.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.type === "opaque") {
          return response;
        }

        const headers = new Headers(response.headers);
        coepHeaders.forEach((value, key) => headers.set(key, value));
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })
      .catch(() => fetch(request))
  );
});
