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
