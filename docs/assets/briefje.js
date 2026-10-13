import {
    normalizeCode,
    participantUrl,
    queryCode,
    renderQr,
} from "./app.js?v=13";
import { activityUrl, queryActivity, readActivity } from "./activity-service.js?v=15";
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

function readableParticipantAddress() {
    const url = new URL(joinLink());
    return `${url.host}${url.pathname}${activityId ? url.search : ""}`;
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
printButton.addEventListener("click", () => { if (ready) window.print(); });
