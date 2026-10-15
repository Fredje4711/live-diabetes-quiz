import {
    normalizeCode,
    participantUrl,
    queryCode,
    renderQr,
} from "./app.js?v=13";
import { activityUrl, queryActivity, readActivity, saveActivityShortLink } from "./activity-service.js?v=18";
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
        shortInput.value = savedShortLink;
        document.querySelector("#originalParticipantLink").value = joinLink();
        document.querySelector("#shortLinkControls").classList.remove("hide");
        shortStatus.textContent = savedShortLink ? "De bewaarde korte link staat op het afdrukvoorbeeld hieronder." : "Zonder korte link kunt u ook gewoon afdrukken.";
        ready = true; printButton.disabled = false; renderHandouts();
    } catch (error) { handoutError.textContent = error.message; handoutError.classList.remove("hide"); }
} else if (code.length !== 3) {
    handoutError.textContent =
        "Maak eerst in het quizmasterscherm een activiteit. Open daar ‘Deelnemersbriefjes afdrukken’.";
    handoutError.classList.remove("hide");
    printButton.disabled = true;
} else {
    ready = true; printButton.disabled = false;
    renderHandouts();
}

wifiName.addEventListener("input", renderHandouts);
wifiPassword.addEventListener("input", renderHandouts);
printButton.addEventListener("click", () => { if (ready && !saving && !shortLinkDirty()) window.print(); });
shortInput.addEventListener("input", () => {
    printButton.disabled = !ready || saving || shortLinkDirty();
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
        shortStatus.textContent = "De link wordt bewaard…";
        await saveActivityShortLink(activityId, value);
        savedShortLink = value; shortInput.value = value;
        renderHandouts();
        shortStatus.textContent = value ? "Bewaard bij deze activiteit. De korte link staat nu op beide briefjes hieronder." : "Bewaard. De oorspronkelijke lange link staat nu weer op de briefjes.";
    } catch (error) {
        shortStatus.textContent = error.code === "permission-denied"
            ? "Bewaren lukt niet. Open eerst uw bewaarde quizmasterlink en ga vandaar naar ‘Deelnemersbriefjes afdrukken’. Controleer ook of de activiteit nog open is."
            : `Niet bewaard. ${error.message || "Controleer uw internet en probeer opnieuw."}`;
    } finally {
        saving = false; saveShortButton.disabled = false; shortInput.disabled = false;
        printButton.disabled = !ready || shortLinkDirty();
    }
});
