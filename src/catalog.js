// What Kino asks for besides live channels: search, home, browse, section, categories, episodes and resolve.

import { getJson, isSlug, stations, podcasts, stationItem, podcastItem, logoOf, isoDate, minutesOf, plain } from "./site.js";
import { t } from "./i18n.js";
import { country, podcastLanguage } from "./prefs.js";

const ROW_SIZE = 30;
const PAGE_SIZE = 50;

// Kino allows 6 fetches in flight per plugin: never start more than `limit` at once.
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

// ---- lists ------------------------------------------------------------------------------------------------------
// A list ref: "radio:top" (the person's country, or the world), "radio:g:<Genre>" (a genre in that country),
// "pod:top" (the person's language) and "pod:c:<category id>". Home rows, section rows, genre tiles and "Ver más" all page through these.

function listQuery(ref) {
  const s = String(ref || "");
  if (s === "radio:top") return { kind: "radio", params: { countryCode: country() } };
  if (s.startsWith("radio:g:")) return { kind: "radio", params: { countryCode: country(), genre: s.slice(8) } };
  if (s === "pod:top") return { kind: "pod", params: { language: podcastLanguage() } };
  if (s.startsWith("pod:c:")) return { kind: "pod", params: { language: podcastLanguage(), category: s.slice(6) } };
  return null;
}

async function listItems(ref, page, limit) {
  const q = listQuery(ref);
  if (!q) throw kino.error("not_found", `unknown list ${String(ref).slice(0, 60)}`);
  const params = { ...q.params, limit, page: page > 1 ? page : undefined };
  const docs = q.kind === "radio" ? await stations(params) : await podcasts(params);
  return docs.map(q.kind === "radio" ? stationItem : podcastItem).filter(Boolean);
}

// One row, or null: a row Zeno fails to answer is logged and left out, never taking the others with it.
async function rowOf(id, ref, title) {
  try {
    const items = await listItems(ref, 1, ROW_SIZE);
    return items.length ? { id, title, ref, items } : null;
  } catch (e) {
    kino.log(`row ${id} failed: ${e && e.message}`);
    return null;
  }
}

function genreTitle(genre) {
  const key = "genre_" + genre;
  const text = t(key);
  return text === key ? genre : text;
}

const sanitize = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, "_");

// ---- search, home, browse ----------------------------------------------------------------------------------------

// One request for stations and one for podcasts; `type` only orders them.
export async function search(query) {
  const q = String(query.q || "").trim();
  if (!q) return [];
  const [stationDocs, podcastDocs] = await Promise.all([
    stations({ query: q, limit: 30 }).catch((e) => {
      kino.log("station search failed: " + (e && e.message));
      return [];
    }),
    podcasts({ query: q, limit: 30 }).catch((e) => {
      kino.log("podcast search failed: " + (e && e.message));
      return [];
    }),
  ]);
  const radio = stationDocs.map(stationItem).filter(Boolean);
  const pods = podcastDocs.map(podcastItem).filter(Boolean);
  return query.type === "podcast" ? pods.concat(radio) : radio.concat(pods);
}

export async function home() {
  const plan = [
    ["radio-top", "radio:top", country() ? t("row_top") : t("row_topWorld")],
    ["radio-music", "radio:g:Music", genreTitle("Music")],
    ["radio-news", "radio:g:News/Talk", genreTitle("News/Talk")],
    ["pod-top", "pod:top", t("row_podTop")],
  ];
  return (await mapLimit(plan, 4, (r) => rowOf(...r))).filter(Boolean);
}

export async function browse(ref, cursor) {
  const page = Math.max(1, parseInt(cursor || "1", 10) || 1);
  const items = await listItems(ref, page, PAGE_SIZE);
  return items.length === PAGE_SIZE ? { items, next: String(page + 1) } : { items };
}

// ---- section and categories --------------------------------------------------------------------------------------

const RADIO_ROWS = [["radio:top", null], ["radio:g:Music", "Music"], ["radio:g:News/Talk", "News/Talk"], ["radio:g:Sports", "Sports"], ["radio:g:Religious", "Religious"], ["radio:g:Comedy", "Comedy"]];

// Today's pick: the same all day for everyone, a different one tomorrow.
function heroOf(items) {
  const item = items[Math.floor(Date.now() / 86400000) % items.length];
  const hero = { title: item.title, text: t("heroPick") };
  if (item.poster) hero.image = item.poster;
  return hero;
}

async function podcastCategories() {
  const all = await getJson("/api/podcasts/categories/");
  return Array.isArray(all) ? all.filter((c) => c && !c.parent && typeof c.id === "string") : [];
}

export async function section({ tab }) {
  const tabs = [{ id: "radio", label: t("tab_radio") }, { id: "podcasts", label: t("tab_podcasts") }];
  const chosen = tab === "podcasts" ? "podcasts" : "radio";
  let plan;
  if (chosen === "radio") {
    plan = RADIO_ROWS.map(([ref, genre]) => [`radio-${sanitize(ref)}`, ref, genre ? genreTitle(genre) : country() ? t("row_top") : t("row_topWorld")]);
  } else {
    plan = [["pod-top", "pod:top", t("row_podTop")]];
    try {
      for (const c of (await podcastCategories()).slice(0, 8)) plan.push([`pod-${sanitize(c.id)}`, "pod:c:" + c.id, String(c.title || c.id)]);
    } catch (e) {
      kino.log("categories failed: " + (e && e.message));
    }
  }
  const rows = (await mapLimit(plan, 3, (r) => rowOf(...r))).filter(Boolean);
  const answer = { tabs, tab: chosen, rows };
  if (rows.length) answer.hero = heroOf(rows[0].items);
  return answer;
}

// Genre tiles in Kino's Categorías: the station genres and the top podcast categories, with the art Zeno draws for them.
export async function categories() {
  const [genres, cats] = await Promise.all([
    getJson("/api/stations/genres/").catch(() => []),
    podcastCategories().catch(() => []),
  ]);
  const tiles = [];
  for (const g of Array.isArray(genres) ? genres : []) {
    if (!g || typeof g.title !== "string") continue;
    const tile = { id: "radio-" + sanitize(g.title), title: genreTitle(g.title).slice(0, 40), ref: "radio:g:" + g.title };
    if (g.image && g.image.src) tile.art = g.image.src;
    tiles.push(tile);
  }
  for (const c of cats) {
    const tile = { id: "pod-" + sanitize(c.id), title: String(c.title || c.id).slice(0, 40), ref: "pod:c:" + c.id };
    if (c.image && c.image.src) tile.art = c.image.src;
    tiles.push(tile);
  }
  return tiles;
}

// ---- episodes and resolve ----------------------------------------------------------------------------------------

function podSlugOf(ref) {
  const m = /^pod:([A-Za-z0-9._-]{1,100})$/.exec(String(ref || ""));
  return m ? m[1] : null;
}

// Zeno lists a podcast's episodes newest first, 100 at most per request.
const EPISODES_PER_REQUEST = 100;
const EPISODES_MAX = 300;

export async function episodes(ref) {
  const slug = podSlugOf(ref);
  if (!slug) throw kino.error("not_found", `not a podcast ref: ${String(ref).slice(0, 80)}`);
  const detail = await getJson(`/api/podcasts/${slug}/`);
  const all = [];
  for (let offset = 0; offset < EPISODES_MAX; offset += EPISODES_PER_REQUEST) {
    const page = await getJson(`/api/podcasts/${slug}/episodes/`, { limit: EPISODES_PER_REQUEST, offset });
    if (!Array.isArray(page) || !page.length) break;
    all.push(...page);
    if (page.length < EPISODES_PER_REQUEST) break;
  }
  const valid = all.filter((e) => e && isSlug(e.slug));
  if (!valid.length) throw kino.error("not_found", `no episodes in ${slug}`, { userMessage: t("noEpisodes") });
  const poster = logoOf(detail);
  const series = { title: String(detail.title || slug) };
  if (poster) series.poster = poster;
  const overview = plain(detail.description);
  if (overview) series.overview = overview;
  const cats = Array.isArray(detail.categories) ? detail.categories.map((c) => String(c).split("/").pop().slice(0, 30)).slice(0, 5) : [];
  if (cats.length) series.genres = cats;
  return {
    series,
    // Numbered oldest first, so the newest episode has the highest number.
    episodes: valid.map((e, i) => {
      const ep = { season: 1, number: Math.min(99999, valid.length - i), ref: `ep:${slug}/${e.slug}`, title: String(e.title || t("episode", { n: valid.length - i })).slice(0, 200) };
      if (poster) ep.still = poster;
      const summary = plain(e.summary);
      if (summary) ep.overview = summary.slice(0, 500);
      const air = isoDate(e.publishedDate);
      if (air) ep.airDate = air;
      const minutes = minutesOf(e.duration);
      if (minutes) ep.runtimeMinutes = Math.min(1000, minutes);
      return ep;
    }),
  };
}

// A station's mime: Zeno's own and most external streams are plain MP3/AAC, which the player sniffs; only HLS needs saying.
function mimeOf(url) {
  return /\.m3u8(\?|$)/i.test(url) ? "application/x-mpegURL" : undefined;
}

export async function resolve(ref) {
  const s = String(ref || "");
  const station = /^station:([A-Za-z0-9._-]{1,100})$/.exec(s);
  if (station) {
    const d = await getJson(`/api/stations/${station[1]}/`);
    const url = d && typeof d.streamURL === "string" ? d.streamURL : "";
    if (!/^https?:\/\//i.test(url)) throw kino.error("not_found", `${station[1]} has no stream`, { userMessage: t("noStream") });
    const stream = { url, label: t("live"), expiresInSeconds: 600 };
    const mime = mimeOf(url);
    if (mime) stream.mime = mime;
    return stream;
  }
  const ep = /^ep:([A-Za-z0-9._-]{1,100})\/([A-Za-z0-9._-]{1,100})$/.exec(s);
  if (ep) {
    const d = await getJson(`/api/podcasts/${ep[1]}/episodes/${ep[2]}/`);
    const url = d && typeof d.mediaUrl === "string" ? d.mediaUrl : "";
    if (!/^https?:\/\//i.test(url)) throw kino.error("not_found", `${ep[2]} has no audio`, { userMessage: t("noAudio") });
    const stream = { url };
    if (d.durationSeconds > 0) stream.durationMs = Math.round(d.durationSeconds * 1000);
    return stream;
  }
  throw kino.error("not_found", `unknown ref ${s.slice(0, 80)}`);
}
