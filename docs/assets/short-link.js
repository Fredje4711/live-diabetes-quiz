// Only public TinyURL links belong here, never a private quizmaster URL.
export function normalizeShortLink(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    let url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); }
    catch { throw new Error("Plak een korte link van TinyURL, bijvoorbeeld https://tinyurl.com/voorbeeld."); }
    if (url.protocol !== "https:" || !["tinyurl.com", "www.tinyurl.com"].includes(url.hostname)
        || url.username || url.password || url.port || url.search || url.hash
        || !/^\/[a-zA-Z0-9_-]{1,100}$/.test(url.pathname)) {
        throw new Error("Gebruik de korte https://tinyurl.com/… link, niet de quizmasterlink of de lange deelnemerslink.");
    }
    return `https://tinyurl.com${url.pathname}`;
}

export function handoutAddress(original, shortLink = "") {
    const url = new URL(normalizeShortLink(shortLink) || original);
    return `${url.host}${url.pathname}${url.search}`;
}
