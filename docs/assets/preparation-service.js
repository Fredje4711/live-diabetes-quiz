import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, ensureAuth } from './firebase-service.js?v=13';
const prepRef = id => doc(db, 'activities', id, 'private', 'preparation');
export async function readPreparation(id) {
    await ensureAuth();
    return (await getDoc(prepRef(id))).data() || {};
}
export function watchPreparation(id, onData, onError) {
    return onSnapshot(prepRef(id), snap => onData(snap.data() || {}), onError);
}
export async function savePreparation(id, {wifiName, wifiPassword, confirmed}, expectedShortLink, expectedVersion = null) {
    await ensureAuth();
    wifiName = wifiName.trim(); wifiPassword = wifiPassword.trim();
    if (!wifiName && wifiPassword) throw new Error('Vul ook de wifi-naam in, of maak beide wifi-vakken leeg voor mobiele data.');
    if (wifiName.length > 100 || wifiPassword.length > 128) throw new Error('De wifi-naam of het wachtwoord is te lang.');
    return runTransaction(db, async tx => {
        const activity = (await tx.get(doc(db, 'activities', id))).data();
        const previous = (await tx.get(prepRef(id))).data();
        if ((previous?.updatedAt?.toMillis() || null) !== expectedVersion) throw new Error('De voorbereiding is intussen op een ander scherm gewijzigd. Vernieuw deze pagina en controleer de gegevens opnieuw.');
        if (!activity || activity.status !== 'open') throw new Error('Deze activiteit is afgesloten.');
        if ((activity.shortLink || '') !== expectedShortLink) throw new Error('De korte link is intussen gewijzigd. Vernieuw deze pagina en controleer de briefjes opnieuw.');
        const data = {wifiConfigured:true, wifiName, wifiPassword,
            printedAt: confirmed ? serverTimestamp() : null,
            printedShortLink: expectedShortLink, updatedAt: serverTimestamp()};
        tx.set(prepRef(id), data);
    });
}
