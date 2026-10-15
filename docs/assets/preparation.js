export function preparationDate(value) {
    const date = value?.toDate ? value.toDate() : new Date(value || NaN);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('nl-BE', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Brussels',
    }).format(date) : '';
}
export function preparationSummary(activity, prep = {}) {
    const printed = Boolean(prep.printedAt) && prep.printedShortLink === (activity.shortLink || '');
    return {
        short: activity.shortLink ? `Ingevuld: ${activity.shortLink}` : 'Niet ingevuld — de lange link blijft bruikbaar.',
        wifi: !prep.wifiConfigured ? 'Nog niet bewaard. Kies zaalwifi of mobiele data bij de briefjes.'
            : prep.wifiName ? `Bewaard: ${prep.wifiName}` : 'Zonder zaalwifi — deelnemers gebruiken mobiele data.',
        printed,
        paper: printed ? `Klaar om mee te nemen — door u bevestigd op ${preparationDate(prep.printedAt)}.`
            : 'Nog niet bevestigd als afgedrukt. Een bewaarde PDF is nog geen papieren briefje.',
    };
}
