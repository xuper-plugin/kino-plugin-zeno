// Every text the person reads, in Spanish and English: Kino does not translate a plugin's texts. An error's sentence
// names no domain and not the app: Kino hides a sentence that does and shows its own generic one.

const TEXTS = {
  es: {
    unavailable: "La radio no responde ahora. Intenta de nuevo en un rato.",
    noStream: "Esta emisora no tiene transmisión disponible.",
    noAudio: "Este episodio ya no está disponible.",
    noEpisodes: "Este podcast no tiene episodios.",
    tab_radio: "Radio", tab_podcasts: "Podcasts",
    row_top: "Emisoras populares", row_topWorld: "Emisoras del mundo", row_podTop: "Podcasts populares", row_podLang: "Podcasts en tu idioma",
    row_genre: "{genre}",
    genre_Children: "Infantil", "genre_College/University": "Universitaria", genre_Comedy: "Comedia", genre_General: "General",
    genre_Music: "Música", "genre_News/Talk": "Noticias y charla", genre_Religious: "Religiosa", genre_Sports: "Deportes",
    heroPick: "La emisora destacada de hoy.",
    live: "En vivo",
    country_auto: "Automático (según tu idioma)", country_all: "Todo el mundo",
    lang_auto: "Automático (según tu idioma)", lang_all: "Todos",
    episode: "Episodio {n}",
  },
  en: {
    unavailable: "The radio isn't answering right now. Try again in a while.",
    noStream: "This station has no stream available.",
    noAudio: "This episode is no longer available.",
    noEpisodes: "This podcast has no episodes.",
    tab_radio: "Radio", tab_podcasts: "Podcasts",
    row_top: "Popular stations", row_topWorld: "Stations from around the world", row_podTop: "Popular podcasts", row_podLang: "Podcasts in your language",
    row_genre: "{genre}",
    genre_Children: "Children", "genre_College/University": "College", genre_Comedy: "Comedy", genre_General: "General",
    genre_Music: "Music", "genre_News/Talk": "News & talk", genre_Religious: "Religious", genre_Sports: "Sports",
    heroPick: "Today's featured station.",
    live: "Live",
    country_auto: "Automatic (from your language)", country_all: "Worldwide",
    lang_auto: "Automatic (from your language)", lang_all: "All",
    episode: "Episode {n}",
  },
};

export function t(key, vars) {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  const template = TEXTS[lang][key] || TEXTS.es[key] || key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k])) : template;
}
