// Self-contained local launcher. The private URL is deliberately kept intact:
// existing printed participant links still belong to the same activity.
export function makeQuizStartFile(title, url) {
    const target = new URL(url);
    if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Ongeldige quizmasterlink.');
    const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const name = String(title || 'Live Diabetes Quiz');
    const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 60).replace(/[. ]+$/g, '') || 'Live Diabetes Quiz';
    const scriptUrl = JSON.stringify(target.href).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return {
        filename: `Quiz ${safeName} openen.html`,
        html: `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>${escape(name)} — Quizmaster openen</title>
<style>body{font:20px/1.5 system-ui,sans-serif;color:#17232c;background:#eff6f9;margin:0;padding:6vh 20px}main{max-width:700px;margin:auto;padding:32px;background:white;border-radius:18px}h1{line-height:1.2;overflow-wrap:anywhere}a{display:inline-block;background:#075574;color:white;padding:16px 24px;border-radius:10px;text-decoration:none;font-weight:700}small{display:block;margin-top:24px;color:#4b5862}</style></head>
<body><main><p>Live Diabetes Quiz · Alleen voor de quizmaster</p><h1>${escape(name)}</h1>
<p>Uw voorbereide quiz wordt geopend. Daarvoor heeft deze computer internet nodig.</p>
<p>Opent de quiz niet vanzelf? Klik hieronder.</p>
<a href="${escape(target.href)}" rel="noreferrer">Mijn quiz openen</a>
<small>Bewaar dit bestand privé. Wie dit bestand heeft, kan deze activiteit bedienen en definitief afsluiten. Niet delen met deelnemers.</small>
<noscript><p>Automatisch openen is uitgeschakeld. Gebruik de knop hierboven.</p></noscript>
</main><script>window.location.replace(${scriptUrl});</script></body></html>`,
    };
}
