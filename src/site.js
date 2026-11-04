// The site this plugin reads: Zeno.FM's public JSON API, and how its results become Kino items.

export const BASE = "https://zeno.fm";

// A slug Kino can carry as an item id and inside a ref.
const VALID_SLUG = /^[A-Za-z0-9._-]{1,100}$/;

export function isSlug(s) {
  return typeof s === "string" && VALID_SLUG.test(s);
}

// Throws only AFTER its first await. Zeno answers a missing station or podcast with 404 and a JSON error.
export async function getJson(path, params) {
  const query = params ? "?" + Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&") : "";
  const r = await kino.fetch(BASE + path + query);
  if (r.status === 404) throw kino.error("not_found", "zeno answered 404 for " + path.slice(0, 80));
  if (r.status === 429) throw kino.error("rate_limited", "zeno answered 429");
  if (!r.ok) throw kino.error("unavailable", "zeno answered " + r.status);
  try {
    return r.json();
  } catch {
    throw kino.error("unavailable", "zeno answered something that is not JSON");
  }
}

function list(body) {
  if (Array.isArray(body)) return body;
  return body && Array.isArray(body.data) ? body.data : [];
}

export const logoOf = (x) => (x && x.logo && x.logo.src) || (x && x.logoImage && x.logoImage.src) || undefined;

// A radio station is a live channel: it opens like one from En vivo.
export function stationItem(x) {
  if (!x || !isSlug(x.slug) || !x.title) return null;
  const item = { id: "r-" + x.slug, ref: "station:" + x.slug, title: String(x.title).slice(0, 120), kind: "live" };
  const logo = logoOf(x);
  if (logo) item.poster = logo;
  return item;
}

export function podcastItem(x) {
  if (!x || !isSlug(x.slug) || !x.title) return null;
  const item = { id: "p-" + x.slug, ref: "pod:" + x.slug, title: String(x.title).slice(0, 120), kind: "podcast" };
  const logo = logoOf(x);
  if (logo) item.poster = logo;
  return item;
}

export function channelOf(x) {
  if (!x || !isSlug(x.slug) || !x.title) return null;
  const channel = { id: x.slug, title: String(x.title).slice(0, 120), ref: "station:" + x.slug };
  const logo = logoOf(x);
  if (logo) channel.logo = logo;
  return channel;
}

export async function stations(params) {
  return list(await getJson("/api/stations/", params));
}

export async function podcasts(params) {
  return list(await getJson("/api/podcasts/", params));
}

// "21 May 2026" -> "2026-05-21", or undefined.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function isoDate(text) {
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/.exec(String(text || "").trim());
  if (!m || !MONTHS[m[2].toLowerCase()]) return undefined;
  return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// "33 min", "1 h 3 min", "2 h": minutes, or 0 when unknown.
export function minutesOf(text) {
  const s = String(text || "");
  const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*min/.exec(s);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

// Zeno descriptions are HTML: Kino shows plain text.
export function plain(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}
