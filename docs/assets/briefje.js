import {
    normalizeCode,
    participantUrl,
    queryCode,
    renderQr,
} from "./app.js?v=4";

const code = normalizeCode(queryCode());
const handoutError = document.querySelector("#handoutError");
const wifiName = document.querySelector("#wifiName");
const wifiPassword = document.querySelector("#wifiPassword");
const printButton = document.querySelector("#printButton");
const template = document.querySelector("#handoutTemplate");
const targets = [...document.querySelectorAll(".participant-handout__content")];

function readableParticipantAddress() {
    const url = new URL(participantUrl(code));
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
    targets.forEach((target) => {
        target.replaceChildren(template.content.cloneNode(true));
        target.querySelector(".handout-code").textContent = code;
        target.querySelector(".handout-address").textContent = readableParticipantAddress();
        target.querySelector(".wifi-details").textContent = wifiText();
        const wifiCard = target.querySelector(".handout-wifi-card");
        const wifiQr = target.querySelector(".handout-wifi-qr");
        const wifiValue = wifiQrValue();
        wifiCard.classList.toggle("handout-wifi-card--inactive", !wifiValue);
        if (wifiValue) {
            renderQr(wifiQr, wifiValue, 125);
        } else {
            wifiQr.replaceChildren();
            wifiQr.textContent = "Mobiele data gebruiken";
        }
        renderQr(target.querySelector(".handout-quiz-qr"), participantUrl(code), 145);
    });
}

if (code.length !== 3) {
    handoutError.textContent =
        "Maak eerst in het quizmasterscherm een sessie. Daarna kunt u de briefjes met de juiste code afdrukken.";
    handoutError.classList.remove("hide");
    printButton.disabled = true;
} else {
    renderHandouts();
}

wifiName.addEventListener("input", renderHandouts);
wifiPassword.addEventListener("input", renderHandouts);
printButton.addEventListener("click", () => window.print());
