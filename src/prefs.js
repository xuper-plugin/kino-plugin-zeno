// The person's country (radio) and language (podcasts): a setting, or Automatic, which reads Kino's language ("es-CO").

export const COUNTRIES = [
  ["CO", "Colombia", "Colombia"], ["MX", "México", "Mexico"], ["ES", "España", "Spain"], ["AR", "Argentina", "Argentina"],
  ["CL", "Chile", "Chile"], ["PE", "Perú", "Peru"], ["VE", "Venezuela", "Venezuela"], ["EC", "Ecuador", "Ecuador"],
  ["BO", "Bolivia", "Bolivia"], ["UY", "Uruguay", "Uruguay"], ["PY", "Paraguay", "Paraguay"], ["GT", "Guatemala", "Guatemala"],
  ["CR", "Costa Rica", "Costa Rica"], ["PA", "Panamá", "Panama"], ["DO", "República Dominicana", "Dominican Republic"],
  ["US", "Estados Unidos", "United States"], ["BR", "Brasil", "Brazil"], ["GB", "Reino Unido", "United Kingdom"],
  ["FR", "Francia", "France"], ["DE", "Alemania", "Germany"], ["IT", "Italia", "Italy"],
];

export const PODCAST_LANGUAGES = [["Spanish", "Español", "Spanish"], ["English", "Inglés", "English"], ["Portuguese", "Portugués", "Portuguese"], ["French", "Francés", "French"], ["German", "Alemán", "German"], ["Italian", "Italiano", "Italian"]];

const BY_PREFIX = { es: "Spanish", pt: "Portuguese", fr: "French", de: "German", it: "Italian" };

function setting(key) {
  const v = kino.config.get(key);
  return typeof v === "string" && v ? v : "auto";
}

// "" = the whole world.
export function country() {
  const s = setting("country");
  if (s === "all") return "";
  if (s !== "auto") return COUNTRIES.some((c) => c[0] === s) ? s : "";
  const m = /^[a-z]{2}[-_]([A-Za-z]{2})\b/.exec(String(kino.lang || ""));
  const code = m ? m[1].toUpperCase() : "";
  return COUNTRIES.some((c) => c[0] === code) ? code : "";
}

// "" = every language.
export function podcastLanguage() {
  const s = setting("podcastLanguage");
  if (s === "all") return "";
  if (s !== "auto") return PODCAST_LANGUAGES.some((l) => l[0] === s) ? s : "";
  return BY_PREFIX[String(kino.lang || "").slice(0, 2).toLowerCase()] || "English";
}
