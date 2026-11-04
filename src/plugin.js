// Zeno FM: a Kino plugin. Docs: https://kinotvapp.github.io/kino-plugins/
// Every function is async, returns plain JSON and must not throw before its first await (Kino 0.9.49 and older cannot catch that).
//
// The entry of the source: it only re-exports what Kino calls. `npm run build` bundles src/ into the shipped plugin.js
// (one ES module, the file Kino installs); never edit plugin.js by hand.

export { search, home, browse, section, categories, episodes, resolve } from "./catalog.js";
export { liveCategories, liveChannels, liveSearch } from "./live.js";
