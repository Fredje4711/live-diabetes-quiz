import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { db, ensureAuth, watchQuiz } from "./firebase-service.js?v=13";
import { QUESTIONS } from "./questions.js?v=8";

export const validActivity = value => /^[a-f0-9]{12}$/.test(value || "");
export const validKey = value => /^[a-f0-9]{64}$/.test(value || "");
export const queryActivity = () => {
    const id = new URLSearchParams(location.search).get("a");
    return validActivity(id) ? id : "";
};
function randomHex(bytes) {
    return [...crypto.getRandomValues(new Uint8Array(bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
}
function roundData(uid, activityId, code, count, shuffle) {
    if (![5,10,15,20,25,30,35,40,45,50].includes(Number(count))) throw new Error("Kies een geldig aantal vragen.");
    const order = QUESTIONS.map((_,i) => i);
    if (shuffle) {
        for (let i = order.length - 1; i > 0; i--) {
            const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
            [order[i],order[j]] = [order[j],order[i]];
        }
    }
    return { code, activityId, masterUid: uid, phase: "waiting", activePosition: 0,
        questionOrder: order.slice(0, Number(count)), totalQuestions: Number(count),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
export function activityUrl(page, id) {
    const url = new URL(page, location.href);
    url.search = ""; url.hash = "";
    url.searchParams.set("a", id);
    if (new URLSearchParams(location.search).get("emulator") === "1") url.searchParams.set("emulator", "1");
    return url.href;
}
export function managementUrl(id, key) {
    return `${activityUrl("quizmaster.html", id)}#beheer=${key}`;
}
export async function createActivity({ title, questionCount, shuffle }) {
    const user = await ensureAuth();
    const id = randomHex(6), key = randomHex(32), code = randomHex(16);
    title = String(title || "").trim();
    if (!title || title.length > 80) throw new Error("Geef de activiteit een naam (maximaal 80 tekens).");
    const round = roundData(user.uid, id, code, questionCount, shuffle);
    await runTransaction(db, async tx => {
        const ref = doc(db, "activities", id);
        if ((await tx.get(ref)).exists()) throw new Error("Probeer opnieuw: deze activiteit bestaat al.");
        tx.set(ref, { title, ownerUid: user.uid, status: "open", currentSession: code, roundNumber: 1,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        tx.set(doc(db, "activityKeys", key), { activityId: id, ownerUid: user.uid });
        tx.set(doc(db, "sessions", code), round);
    });
    return { id, key };
}
export async function authorizeActivity(id, key) {
    const user = await ensureAuth();
    const activity = await getDoc(doc(db, "activities", id));
    if (!activity.exists()) throw new Error("Deze activiteit bestaat niet. Controleer uw beheerlink.");
    if (activity.data().status === "closed") return;
    if (activity.data().ownerUid === user.uid) return;
    const ref = doc(db, "activities", id, "managers", user.uid);
    if ((await getDoc(ref)).exists()) return;
    if (!validKey(key)) throw new Error("Open de bewaarde privébeheerlink om deze activiteit te bedienen.");
    await setDoc(ref, { key });
}
export async function readActivity(id) {
    await ensureAuth();
    const snapshot = await getDoc(doc(db, "activities", id));
    if (!snapshot.exists()) throw new Error("Deze activiteit bestaat niet.");
    return snapshot.data();
}
export async function startRound(id, expectedSession, options) {
    const user = await ensureAuth();
    const code = randomHex(16);
    const round = roundData(user.uid, id, code, options.questionCount, options.shuffle);
    await runTransaction(db, async tx => {
        const ref = doc(db, "activities", id);
        const snapshot = await tx.get(ref);
        if (!snapshot.exists() || snapshot.data().status !== "open") throw new Error("Deze activiteit is definitief afgesloten.");
        const current = snapshot.data();
        if (current.currentSession !== expectedSession) throw new Error("Er is intussen al een nieuwe ronde gestart. Open de bediening opnieuw.");
        tx.set(doc(db, "sessions", code), round);
        tx.update(ref, { currentSession: code, roundNumber: current.roundNumber + 1, updatedAt: serverTimestamp() });
    });
}
export async function closeActivity(id, expectedSession) {
    await ensureAuth();
    await runTransaction(db, async tx => {
        const ref = doc(db, "activities", id);
        const snapshot = await tx.get(ref);
        if (!snapshot.exists()) throw new Error("Activiteit niet gevonden.");
        if (snapshot.data().status === "closed") return;
        if (snapshot.data().currentSession !== expectedSession) throw new Error("De ronde is intussen gewijzigd. Controleer de bediening en probeer opnieuw.");
        tx.update(ref, { status: "closed", updatedAt: serverTimestamp() });
    });
}
// The activity is the permanent address. No session chains or local browser state
// are needed to find its current round; stale async subscriptions are discarded.
export async function watchActivity(id, role, onState, onError) {
    await ensureAuth();
    let disposed = false, generation = 0, current = "", stopRound = null;
    let activity = null;
    const stopActivity = onSnapshot(doc(db, "activities", id), async snapshot => {
        if (disposed) return;
        if (!snapshot.exists()) { onError(new Error("Deze activiteit bestaat niet. Controleer de link op uw briefje.")); return; }
        activity = { id, ...snapshot.data() };
        if (activity.status === "closed") {
            generation++; current = ""; stopRound?.(); stopRound = null;
            onState({ activity, closed: true }); return;
        }
        if (current === activity.currentSession) return;
        current = activity.currentSession;
        const token = ++generation;
        stopRound?.(); stopRound = null;
        onState({ activity, loading: true });
        try {
            const stop = await watchQuiz(current, role, state => {
                if (!disposed && token === generation) onState({ ...state, activity });
            }, error => { if (!disposed && token === generation) onError(error); });
            if (disposed || token !== generation) stop(); else stopRound = stop;
        } catch (error) { if (!disposed && token === generation) onError(error); }
    }, onError);
    return () => { disposed = true; generation++; stopActivity(); stopRound?.(); };
}
