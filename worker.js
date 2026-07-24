// Cloudflare Worker entry.
//
// This app is fully client-side (image processing, curve fitting and stats all run
// in the browser), so the Worker only needs to serve the built static site from the
// ASSETS binding. SPA fallback (unknown path -> index.html) is configured in
// wrangler.toml via not_found_handling.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
