// The radio in Kino's En vivo tab: categories (popular, genres, countries), the stations of one, and the search.

import { stations, channelOf } from "./site.js";
import { t } from "./i18n.js";
import { country, COUNTRIES } from "./prefs.js";

const PAGE_SIZE = 50;

// [Zeno genre, Kino's closed vocabulary]
const GENRES = [
  ["Music", "musica"], ["News/Talk", "noticias"], ["Sports", "deportes"], ["Children", "infantil"],
  ["Comedy", "entretenimiento"], ["Religious", "otros"], ["College/University", "otros"], ["General", "otros"],
];

const sanitize = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, "_");

function genreTitle(genre) {
  const key = "genre_" + genre;
  const text = t(key);
  return text === key ? genre : text;
}

export async function liveCategories() {
  const es = String(kino.lang || "").toLowerCase().startsWith("es");
  const cats = [{ id: "top", title: country() ? t("row_top") : t("row_topWorld"), genre: "musica" }];
  for (const [genre, kind] of GENRES) cats.push({ id: "genre-" + sanitize(genre), title: genreTitle(genre), genre: kind });
  for (const [code, nameEs, nameEn] of COUNTRIES) cats.push({ id: "country-" + code, title: es ? nameEs : nameEn, country: code });
  return cats;
}

// The Zeno filter a category stands for.
function paramsOf(categoryId) {
  const id = String(categoryId || "");
  if (id === "top") return { countryCode: country() };
  const genre = GENRES.find(([g]) => "genre-" + sanitize(g) === id);
  if (genre) return { countryCode: country(), genre: genre[0] };
  const c = /^country-([A-Z]{2})$/.exec(id);
  if (c && COUNTRIES.some((x) => x[0] === c[1])) return { countryCode: c[1] };
  return null;
}

export async function liveChannels({ categoryId, cursor }) {
  const params = paramsOf(categoryId);
  if (!params) throw kino.error("not_found", `unknown category ${String(categoryId).slice(0, 40)}`);
  const page = Math.max(1, parseInt(cursor || "1", 10) || 1);
  const docs = await stations({ ...params, limit: PAGE_SIZE, page: page > 1 ? page : undefined });
  const items = docs.map(channelOf).filter(Boolean);
  return docs.length === PAGE_SIZE ? { items, next: String(page + 1) } : { items };
}

export async function liveSearch({ query }) {
  const q = String(query || "").trim();
  if (!q) return { items: [] };
  const docs = await stations({ query: q, limit: PAGE_SIZE });
  return { items: docs.map(channelOf).filter(Boolean) };
}
