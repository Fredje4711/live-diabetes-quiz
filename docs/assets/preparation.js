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

export function showPreparationOverview(activity, prep, {fresh = false, phase = 'waiting', error = ''} = {}) {
    return !fresh || phase !== 'waiting' || Boolean(error || activity.shortLink || prep?.wifiConfigured || prep?.printedAt);
}

// Choose wording from actual preparation and quiz state, never from the URL alone.
export function preparationMessage(activity, prep, {fresh = false, phase = 'waiting', error = ''} = {}) {
    const title = activity.title || 'Live Diabetes Quiz';
    if (activity.status === 'closed') return {heading:`Activiteit afgesloten: ${title}`, intro:'Deze activiteit is definitief afgesloten.', next:'Maak voor een andere gelegenheid een nieuwe activiteit met nieuwe briefjes.'};
    if (phase === 'finished') return {heading:`Ronde afgelopen: ${title}`, intro:'Deze ronde is afgelopen. De activiteit is nog open.', next:'Bespreek de eindanalyse. Voor nog een ronde kiest u ‘Nog een quiz spelen’. Dezelfde deelnemersbriefjes blijven geldig.'};
    if (['open','locked','revealed'].includes(phase)) return {heading:`Quiz bezig: ${title}`, intro:'De quiz is al gestart. U kunt verdergaan met de huidige vraag.', next:'Gebruik hieronder de quizbediening. U hoeft geen nieuwe activiteit te maken.'};
    if (error || prep === null) return {heading:`Uw activiteit: ${title}`, intro:error ? 'De voorbereiding kon niet worden gecontroleerd.' : 'We halen uw voorbereiding op.', next:error ? 'Controleer uw internetverbinding en vernieuw deze pagina. Maak geen nieuwe activiteit.' : 'Even geduld voordat u de voorbereiding controleert.'};
    const ready = prep.wifiConfigured && preparationSummary(activity, prep).printed;
    if (ready) return {heading:`Voorbereiding klaar: ${title}`, intro:'Uw internetkeuze is bewaard en u hebt bevestigd dat de papieren briefjes klaar zijn.', next:'Hebt u uw startbestand al? Ga dan verder bij stap 3: in de zaal.'};
    const next = !prep.wifiConfigured
        ? 'Kies ‘Deelnemersbriefjes voorbereiden’. Bewaar daar de internetkeuze en maak eventueel een korte link. Druk daarna de briefjes af.'
        : 'Uw internetkeuze is bewaard. Ga naar ‘Deelnemersbriefjes voorbereiden’ en bevestig daar pas dat de briefjes klaar zijn wanneer u ze werkelijk op papier hebt.';
    return fresh
        ? {heading:`Nieuwe activiteit aangemaakt: ${title}`, intro:'Uw activiteit is aangemaakt. Nu bereiden we de deelnemersbriefjes voor.', next:'Klik op ‘Deelnemersbriefjes voorbereiden’. Daar stelt u de internetgegevens en eventueel een korte link in. Daarna kunt u de briefjes afdrukken of als PDF bewaren.'}
        : {heading:`Voorbereiding verder afwerken: ${title}`, intro:'U opent een bestaande activiteit. De voorbereiding is nog niet volledig bevestigd; hieronder ziet u wat al bewaard is. Maak geen nieuwe activiteit.', next};
}
