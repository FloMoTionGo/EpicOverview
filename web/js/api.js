// Where the EPIC Overview server is.
// - Served by server.py (laptop at the table, or Fly.io): the same origin, so relative paths.
// - Served by GitHub Pages: the Fly.io app.
// - ?server=https://host/ overrides both, e.g. a test app on Fly.io. It must be https: the Pages copy
//   cannot reach an http:// laptop server (browsers block mixed content); open the laptop's own address instead.
export const FLY_SERVER = 'https://epic-overview.fly.dev/';

function pick() {
  if (typeof location === 'undefined') return '';            // node tests render views without a page
  const fromUrl = new URLSearchParams(location.search).get('server');
  if (fromUrl) return fromUrl.replace(/\/*$/, '/');
  return location.hostname.endsWith('.github.io') ? FLY_SERVER : '';
}

export const API_BASE = pick();
export const api = (path) => API_BASE + path;              // api('api/state')
