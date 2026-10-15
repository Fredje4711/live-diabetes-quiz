import {
    normalizeCode,
    participantUrl,
    queryCode,
    renderQr,
} from "./app.js?v=13";
import { activityUrl, queryActivity, readActivity, saveActivityShortLink } from "./activity-service.js?v=19";
import { readPreparation, savePreparation } from './preparation-service.js?v=19';
import { preparationSummary } from './preparation.js?v=19';
import { normalizeShortLink, handoutAddress } from "./short-link.js?v=18";
const activityId = queryActivity();
if (activityId) {
    document.querySelectorAll('a[href="quizmaster.html"]').forEach(link => {
        link.href = activityUrl("quizmaster.html", activityId);
    });
}
let activity = null;
let ready = false;
const joinLink = () => activityId ? activityUrl("deelnemer.html", activityId) : participantUrl(code);

const code = normalizeCode(queryCode());
const handoutError = document.querySelector("#handoutError");
const wifiName = document.querySelector("#wifiName");
const wifiPassword = document.querySelector("#wifiPassword");
const printButton = document.querySelector("#printButton");
const template = document.querySelector("#handoutTemplate");
const targets = [...document.querySelectorAll(".participant-handout__content")];
const shortInput = document.querySelector("#shortParticipantLink");
const shortStatus = document.querySelector("#shortLinkStatus");
const saveShortButton = document.querySelector("#saveShortLink");
let savedShortLink = "";
let saving = false;
let prep = {};
const prepStatus = document.querySelector('#preparationStatus');
const printedBox = document.querySelector('#printedConfirmed');
const saveWifi = document.querySelector('#saveWifi');
const wifiDirty = () => activityId && (!prep.wifiConfigured || wifiName.value.trim() !== prep.wifiName || wifiPassword.value.trim() !== prep.wifiPassword);
function updatePreparationControls() {
    const dirty = shortLinkDirty() || wifiDirty();
    printButton.disabled = !ready || saving || dirty;
    printedBox.disabled = !ready || saving || dirty;
    saveWifi.disabled = !ready || saving;
    printedBox.checked = !dirty && preparationSummary({shortLink:savedShortLink}, prep).printed;
}
const shortLinkDirty = () => shortInput.value.trim() !== savedShortLink;

function readableParticipantAddress() {
    if (activityId) return handoutAddress(joinLink(), savedShortLink);
    const url = new URL(joinLink());
    return `${url.host}${url.pathname}`;
}

function wifiText() {
    const name = wifiName.value.trim();
    const password = wifiPassword.value.trim();
    if (!name) return "Vraag indien nodig hulp aan een begeleider.";
    return password
        ? `${name} — wachtwoord: ${password}`
        : `${name} — geen wachtwoord nodig`;
}

function escapeWifiValue(value) {
    return value.replace(/([\\;,:"])/g, "\\$1");
}

function wifiQrValue() {
    const name = wifiName.value.trim();
    const password = wifiPassword.value.trim();
    if (!name) return "";
    const security = password ? "WPA" : "nopass";
    return `WIFI:T:${security};S:${escapeWifiValue(name)};P:${escapeWifiValue(password)};;`;
}

function renderHandouts() {
    if (!ready) return;
    targets.forEach((target) => {
        target.replaceChildren(template.content.cloneNode(true));
        target.querySelector(".handout-code").textContent = code;
        target.querySelector(".handout-code-instruction").classList.toggle("hide", Boolean(activityId));
        target.querySelector(".handout-activity").textContent = activity?.title || "Live Diabetes Quiz";
        target.querySelector(".handout-address").textContent = readableParticipantAddress();
        target.querySelector(".wifi-details").textContent = wifiText();
        const wifiCard = target.querySelector(".handout-wifi-card");
        const wifiQr = target.querySelector(".handout-wifi-qr");
        const wifiHeading = target.querySelector(".wifi-heading");
        const wifiInstruction = target.querySelector(".wifi-instruction");
        const wifiValue = wifiQrValue();
        wifiCard.classList.toggle("handout-wifi-card--inactive", !wifiValue);
        wifiCard.classList.toggle("handout-wifi-card--mobile", !wifiValue);
        if (wifiValue) {
            wifiHeading.textContent = "Wifi van de zaal (alleen indien gewenst)";
            wifiInstruction.innerHTML =
                "Scan met uw gewone camera-app of QR-app en tik op <strong>Verbinden</strong>.";
            wifiQr.classList.remove("hide");
            renderQr(wifiQr, wifiValue, 125);
        } else {
            wifiHeading.textContent = "Mobiele data gebruiken";
            wifiInstruction.textContent =
                "Zet mobiele data aan op uw gsm. Er is geen zaalwifi voorzien.";
            target.querySelector(".wifi-details").textContent =
                "Controleer eventueel of een gewone website opent.";
            wifiQr.replaceChildren();
            wifiQr.classList.add("hide");
        }
        renderQr(target.querySelector(".handout-quiz-qr"), joinLink(), 145);
    });
}

printButton.disabled = true;
if (activityId) {
    try {
        activity = await readActivity(activityId);
        if (activity.status !== "open") throw new Error("Deze activiteit is afgesloten. Maak voor een volgende gelegenheid een nieuwe activiteit en nieuwe briefjes.");
        savedShortLink = normalizeShortLink(activity.shortLink || "");
        prep = await readPreparation(activityId);
        wifiName.value = prep.wifiName || ''; wifiPassword.value = prep.wifiPassword || '';
        document.querySelector('#preparationControls').classList.remove('hide');
        document.querySelector('#paperConfirmationControls').classList.remove('hide');
        prepStatus.textContent = preparationSummary(activity, prep).paper;
        shortInput.value = savedShortLink;
        document.querySelector("#originalParticipantLink").value = joinLink();
        document.querySelector("#shortLinkControls").classList.remove("hide");
        shortStatus.textContent = savedShortLink ? "De bewaarde korte link staat op het afdrukvoorbeeld hieronder." : "Zonder korte link kunt u ook gewoon afdrukken.";
        ready = true; updatePreparationControls(); renderHandouts();
    } catch (error) {
        handoutError.textContent = error.code === 'permission-denied'
            ? 'Open eerst uw bewaarde HTML-startbestand of quizmasterlink. Kies daar ‘Deelnemersbriefjes voorbereiden’ om uw voorbereiding te bekijken.' : error.message;
        handoutError.classList.remove("hide");
    }
} else if (code.length !== 3) {
    handoutError.textContent =
        "Maak eerst in het quizmasterscherm een activiteit. Open daar ‘Deelnemersbriefjes voorbereiden’.";
    handoutError.classList.remove("hide");
    printButton.disabled = true;
} else {
    ready = true; printButton.disabled = false;
    renderHandouts();
}

for (const input of [wifiName, wifiPassword]) input.addEventListener('input', () => {
    renderHandouts(); updatePreparationControls();
    prepStatus.textContent = 'Internetkeuze gewijzigd. Bewaar die eerst. Controleer daarna uw papieren briefjes opnieuw.';
});
printButton.addEventListener("click", () => { if (ready && !saving && !shortLinkDirty() && !wifiDirty()) window.print(); });
shortInput.addEventListener("input", () => {
    updatePreparationControls();
    shortStatus.textContent = shortLinkDirty() ? "Nog niet bewaard. Bewaar uw wijziging vóór het afdrukken." : "Het afdrukvoorbeeld gebruikt de bewaarde link.";
});
document.querySelector("#copyOriginalLink").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(joinLink());
        shortStatus.textContent = "Deelnemerslink gekopieerd. Open nu TinyURL en plak de link daar.";
    } catch {
        const original = document.querySelector("#originalParticipantLink");
        original.focus(); original.select();
        shortStatus.textContent = "De link is geselecteerd. Druk op Ctrl+C om hem te kopiëren.";
    }
});
saveShortButton.addEventListener("click", async () => {
    if (!ready || saving || !activityId) return;
    try {
        const value = normalizeShortLink(shortInput.value);
        saving = true; saveShortButton.disabled = true; shortInput.disabled = true; printButton.disabled = true;
        wifiName.disabled = true; wifiPassword.disabled = true; updatePreparationControls();
        shortStatus.textContent = "De link wordt bewaard…";
        await saveActivityShortLink(activityId, value);
        prep = await readPreparation(activityId);
        savedShortLink = value; shortInput.value = value;
        renderHandouts();
        prepStatus.textContent = preparationSummary({shortLink:savedShortLink}, prep).paper;
        shortStatus.textContent = value ? "Bewaard bij deze activiteit. De korte link staat nu op beide briefjes hieronder." : "Bewaard. De oorspronkelijke lange link staat nu weer op de briefjes.";
    } catch (error) {
        shortStatus.textContent = error.code === "permission-denied"
            ? "Bewaren lukt niet. Open eerst uw bewaarde quizmasterlink en ga vandaar naar ‘Deelnemersbriefjes voorbereiden’. Controleer ook of de activiteit nog open is."
            : `Niet bewaard. ${error.message || "Controleer uw internet en probeer opnieuw."}`;
    } finally {
        saving = false; saveShortButton.disabled = false; shortInput.disabled = false;
        wifiName.disabled = false; wifiPassword.disabled = false;
        updatePreparationControls();
    }
});
async function storePreparation(confirmed) {
    if (!ready || saving || !activityId) return;
    saving = true; updatePreparationControls(); saveShortButton.disabled = true;
    wifiName.disabled = true; wifiPassword.disabled = true; shortInput.disabled = true;
    try {
        await savePreparation(activityId, {wifiName:wifiName.value, wifiPassword:wifiPassword.value, confirmed}, savedShortLink, prep.updatedAt?.toMillis() || null);
        prep = await readPreparation(activityId);
        prepStatus.textContent = confirmed ? preparationSummary({shortLink:savedShortLink}, prep).paper
            : 'Internetkeuze bewaard. U kunt nu afdrukken of een PDF bewaren. Bevestig pas daarna wanneer uw papieren briefjes klaar zijn.';
    } catch (error) {
        prepStatus.textContent = `Niet bewaard. ${error.message || 'Controleer uw verbinding en probeer opnieuw.'}`;
    } finally {
        saving = false; saveShortButton.disabled = false;
        wifiName.disabled = false; wifiPassword.disabled = false; shortInput.disabled = false;
        updatePreparationControls();
    }
}
saveWifi.addEventListener('click', () => storePreparation(false));
printedBox.addEventListener('change', () => storePreparation(printedBox.checked));
