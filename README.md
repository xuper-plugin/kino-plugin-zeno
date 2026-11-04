# Zeno FM

A [Kino](https://github.com/kinotvapp/kino-plugin-archive) plugin for [Zeno.FM](https://zeno.fm): live radio and podcasts.

- **Radio** appears in Kino's **En vivo** tab: popular stations, genres and countries, plus the En vivo search. Stations also show
  in Kino's search and in the plugin's own **Radio** section (Radio and Podcasts tabs).
- **Podcasts** open like any series: all their episodes (newest has the highest number), with date and length.
- **Settings**: the stations' country and the podcasts' language. Automatic reads Kino's language (`es-CO` → Colombia, Spanish).

It reads Zeno's public JSON API (`/api/stations/`, `/api/podcasts/`, `/api/podcasts/<slug>/episodes/`); no account, no keys.

## Hosts

`zeno.fm` and `*.zeno.fm` (the API, `stream.zeno.fm`, `images.zeno.fm`). Stations outside Zeno stream from their own servers
(StreamTheWorld, Icecast…) and podcast audio comes from each podcast's host, so the manifest asks for `liveStreamHosts: "any"` and
`streamHosts: "any"`; the person approves both on the consent sheet. `kino.fetch` still reaches only the Zeno hosts.

## Develop

The code lives in `src/` (`src/plugin.js` only re-exports); `npm run build` bundles it into `plugin.js`, the one file Kino installs.
Commit `plugin.js` and never edit it by hand.

```
npm install                # esbuild
npm run build              # src/ -> plugin.js
npm run check:built        # plugin.js is exactly what src/ builds to
node sdk/validate.mjs .
npm test
node sdk/run.mjs ./plugin.js search salsa
node sdk/run.mjs . live channels top
node sdk/run.mjs ./plugin.js resolve station:salsa-y-mas-cali
```
