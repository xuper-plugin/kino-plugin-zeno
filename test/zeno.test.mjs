// Offline tests of the Zeno FM plugin: a stand-in `kino` answers with the shapes zeno.fm's API returned when this was written.
import { test } from "node:test";
import assert from "node:assert/strict";

const STATION = (slug, title) => ({ slug, title, logo: { src: `https://images.zeno.fm/${slug}.png` } });
const calls = [];
const answers = new Map();

globalThis.kino = {
  lang: "es-CO",
  config: { get: (k) => (k === "country" || k === "podcastLanguage" ? "auto" : undefined) },
  log: () => {},
  error: (code, message, extra) => Object.assign(new Error(message), { code, ...extra }),
  fetch: async (url) => {
    calls.push(url);
    for (const [part, body] of answers) {
      if (url.includes(part)) return body === 404 ? { ok: false, status: 404 } : { ok: true, status: 200, json: () => body };
    }
    return { ok: false, status: 500 };
  },
};

const { search, browse, episodes, resolve, section } = await import("../src/catalog.js");
const { liveChannels, liveCategories, liveSearch } = await import("../src/live.js");
const { isoDate, minutesOf, plain } = await import("../src/site.js");

test("dates, durations and HTML descriptions", () => {
  assert.equal(isoDate("21 May 2026"), "2026-05-21");
  assert.equal(isoDate("3 Sept 2025"), "2025-09-03");
  assert.equal(isoDate("3 Foo 2025"), undefined);
  assert.equal(isoDate("nonsense"), undefined);
  assert.equal(minutesOf("33 min"), 33);
  assert.equal(minutesOf("1 h 3 min"), 63);
  assert.equal(minutesOf(""), 0);
  assert.equal(plain("Hola<br /><br />&amp; adiós <b>todos</b>"), "Hola & adiós todos");
});

test("the country comes from Kino's language and filters the radio", async () => {
  calls.length = 0;
  answers.clear();
  answers.set("/api/stations/", { data: [STATION("a", "A"), { slug: "bad slug!", title: "X" }], total: 2 });
  const page = await liveChannels({ categoryId: "top", cursor: null });
  assert.equal(page.items.length, 1);
  assert.deepEqual(page.items[0], { id: "a", title: "A", ref: "station:a", logo: "https://images.zeno.fm/a.png" });
  assert.match(calls[0], /countryCode=CO/);
  assert.match(calls[0], /limit=50/);
  assert.equal(page.next, undefined);
});

test("a full page has a next cursor, and a genre category filters by genre", async () => {
  calls.length = 0;
  answers.clear();
  answers.set("/api/stations/", { data: Array.from({ length: 50 }, (_, i) => STATION("s" + i, "S" + i)) });
  const page = await liveChannels({ categoryId: "genre-News_Talk", cursor: "2" });
  assert.equal(page.next, "3");
  assert.match(calls[0], /genre=News%2FTalk/);
  assert.match(calls[0], /page=2/);
  await assert.rejects(() => liveChannels({ categoryId: "nope", cursor: null }), { code: "not_found" });
});

test("live categories: popular, genres and countries", async () => {
  const cats = await liveCategories();
  assert.equal(cats[0].id, "top");
  assert.ok(cats.some((c) => c.id === "genre-Music" && c.genre === "musica"));
  assert.ok(cats.some((c) => c.id === "country-MX" && c.title === "México"));
  assert.equal(new Set(cats.map((c) => c.id)).size, cats.length);
});

test("search returns stations as live items and podcasts as podcast items", async () => {
  answers.clear();
  answers.set("/api/stations/", { data: [STATION("salsa", "Salsa")] });
  answers.set("/api/podcasts/", { data: [{ slug: "p1", title: "Pod", logo: { src: "https://images.zeno.fm/p1.png" } }] });
  const items = await search({ q: "salsa", type: "any" });
  assert.deepEqual(items.map((i) => [i.kind, i.ref]), [["live", "station:salsa"], ["podcast", "pod:p1"]]);
  const podsFirst = await search({ q: "salsa", type: "podcast" });
  assert.equal(podsFirst[0].kind, "podcast");
  assert.deepEqual(await search({ q: "  " }), []);
  assert.equal((await liveSearch({ query: "salsa" })).items.length, 1);
});

test("browse pages through a list and rejects an unknown one", async () => {
  answers.clear();
  answers.set("/api/podcasts/", { data: Array.from({ length: 50 }, (_, i) => ({ slug: "p" + i, title: "P" + i })) });
  const page = await browse("pod:top", null);
  assert.equal(page.next, "2");
  assert.match(calls.at(-1), /language=Spanish/);
  await assert.rejects(() => browse("whatever", null), { code: "not_found" });
});

test("a podcast lists its episodes, newest with the highest number", async () => {
  answers.clear();
  answers.set("/api/podcasts/show/episodes/", [
    { slug: "e2", title: "Dos", summary: "<p>Hi</p>", duration: "1 h 3 min", publishedDate: "21 May 2026" },
    { slug: "e1", title: "Uno", duration: "5 min", publishedDate: "14 May 2026" },
  ]);
  answers.set("/api/podcasts/show/", { slug: "show", title: "Show", description: "<b>Desc</b>", logo: { src: "https://images.zeno.fm/s.png" }, categories: ["News/Business News"] });
  const r = await episodes("pod:show");
  assert.equal(r.series.title, "Show");
  assert.deepEqual(r.series.genres, ["Business News"]);
  assert.deepEqual(r.episodes.map((e) => [e.number, e.ref, e.runtimeMinutes, e.airDate]), [
    [2, "ep:show/e2", 63, "2026-05-21"],
    [1, "ep:show/e1", 5, "2026-05-14"],
  ]);
  await assert.rejects(() => episodes("pod:bad slug"), { code: "not_found" });
});

test("resolve: a station's stream, an episode's audio, and the errors", async () => {
  answers.clear();
  answers.set("/api/stations/zeno/", { streamURL: "https://stream.zeno.fm/abc" });
  answers.set("/api/stations/hls/", { streamURL: "https://example.com/live/index.m3u8?x=1" });
  answers.set("/api/stations/none/", { streamURL: "" });
  answers.set("/api/podcasts/show/episodes/e1/", { mediaUrl: "https://cdn.example.com/e1.mp3", durationSeconds: 1984 });
  assert.equal((await resolve("station:zeno")).url, "https://stream.zeno.fm/abc");
  assert.equal((await resolve("station:hls")).mime, "application/x-mpegURL");
  await assert.rejects(() => resolve("station:none"), { code: "not_found" });
  const ep = await resolve("ep:show/e1");
  assert.deepEqual([ep.url, ep.durationMs], ["https://cdn.example.com/e1.mp3", 1984000]);
  answers.set("/api/stations/gone/", 404);
  await assert.rejects(() => resolve("station:gone"), { code: "not_found" });
  await assert.rejects(() => resolve("what"), { code: "not_found" });
});

test("the section has a Radio and a Podcasts tab", async () => {
  answers.clear();
  answers.set("/api/stations/", { data: [STATION("a", "A")] });
  const radio = await section({ tab: "radio" });
  assert.deepEqual(radio.tabs.map((t) => t.id), ["radio", "podcasts"]);
  assert.ok(radio.rows.length > 0 && radio.hero.title === "A");
});
