export function preparationDate(value) {
    const date = value?.toDate ? value.toDate() : new Date(value || NaN);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('nl-BE', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Brussels',
    }).format(date) : '';
}
export function preparationSummary(activity, prep = {}) {
    const printed = Boolean(prep.printedAt) && prep.printedShortLink === (activity.shortLink || '');
    return {
        short: activity.shortLink || 'Niet ingesteld (optioneel).',
        wifi: !prep.wifiConfigured ? 'Nog niet bewaard.'
            : prep.wifiName ? `Bewaard: ${prep.wifiName}` : 'Zonder zaalwifi — deelnemers gebruiken mobiele data.',
        printed,
        paper: printed ? `Klaar — bevestigd op ${preparationDate(prep.printedAt)}.`
            : 'Nog niet bevestigd als afgedrukt.',
    };
}

// Only change disclosure defaults when the workflow changes, not on every live update.
export function preparationLayout({ready = false, resumed = false, phase = 'waiting', error = ''} = {}) {
    const playing = ['open', 'locked', 'revealed', 'finished'].includes(phase);
    return {preparationOpen: Boolean(error) || (!playing && !(ready && resumed)), venueOpen: !playing};
}

export function showPreparationOverview(activity, prep, {fresh = false, phase = 'waiting', error = ''} = {}) {
    return !fresh || phase !== 'waiting' || Boolean(error || activity.shortLink || prep?.wifiConfigured || prep?.printedAt);
}

export function preparationSteps(activity, prep, {phase = 'waiting', error = ''} = {}) {
    const ready = !error && Boolean(prep?.wifiConfigured && preparationSummary(activity, prep).printed);
    return {
        ready,
        handoutsHeading: ready ? '✓ Deelnemersbriefjes klaar' : '1. Deelnemersbriefjes voorbereiden',
        handoutsLink: ready ? 'Bekijken of wijzigen' : 'Deelnemersbriefjes voorbereiden',
        fileHeading: ready && phase === 'waiting'
            ? 'Volgende stap: startbestand voor de quizmaster bewaren'
            : '2. Startbestand voor de quizmaster bewaren',
    };
}

// Choose wording from actual preparation and quiz state, never from the URL alone.
export function preparationMessage(activity, prep, {fresh = false, phase = 'waiting', error = ''} = {}) {
    const title = activity.title || 'Live Diabetes Quiz';
    if (activity.status === 'closed') return {heading:`Activiteit afgesloten: ${title}`, intro:'Deze activiteit is definitief afgesloten.', next:'Maak voor een andere gelegenheid een nieuwe activiteit met nieuwe briefjes.'};
    if (phase === 'finished') return {heading:`Ronde afgelopen: ${title}`, intro:'Deze ronde is afgelopen. De activiteit is nog open.', next:'Bespreek de eindanalyse. Voor nog een ronde kiest u ‘Nog een quiz spelen’. Dezelfde deelnemersbriefjes blijven geldig.'};
    if (['open','locked','revealed'].includes(phase)) return {heading:`Quiz bezig: ${title}`, intro:'De quiz is al gestart. U kunt verdergaan met de huidige vraag.', next:'Gebruik hieronder de quizbediening. U hoeft geen nieuwe activiteit te maken.'};
    if (error || prep === null) return {heading:`Uw activiteit: ${title}`, intro:error ? 'De voorbereiding kon niet worden gecontroleerd.' : 'We halen uw voorbereiding op.', next:error ? 'Controleer uw internetverbinding en vernieuw deze pagina. Maak geen nieuwe activiteit.' : 'Even geduld voordat u de voorbereiding controleert.'};
    const ready = prep.wifiConfigured && preparationSummary(activity, prep).printed;
    if (ready) return {heading:`Voorbereiding klaar: ${title}`, intro:'De deelnemersbriefjes zijn klaar.', next:''};
    const next = !prep.wifiConfigured
        ? 'Stel bij ‘Deelnemersbriefjes voorbereiden’ de internetgegevens en eventueel een korte link in.'
        : 'Bevestig bij ‘Deelnemersbriefjes voorbereiden’ dat de briefjes werkelijk op papier klaar zijn.';
    return fresh
        ? {heading:`Nieuwe activiteit aangemaakt: ${title}`, intro:'Maak de deelnemersbriefjes klaar. Bewaar daarna uw startbestand.', next:'Bij ‘Deelnemersbriefjes voorbereiden’ stelt u de internetgegevens en eventueel een korte link in.'}
        : {heading:`Voorbereiding verder afwerken: ${title}`, intro:'Werk de voorbereiding hieronder af. U hoeft geen nieuwe activiteit te maken.', next};
}
