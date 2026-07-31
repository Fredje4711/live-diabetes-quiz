export function queryCode() {
    const value = new URLSearchParams(window.location.search).get("code") || "";
    return value.replace(/\D/g, "").slice(0, 3);
}

export function normalizeCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 3);
}

export function optionLetter(index) {
    return String.fromCharCode(65 + Number(index));
}

export function formatPhase(phase) {
    return {
        waiting: "Wachtkamer",
        open: "Vraag open",
        locked: "Antwoorden gesloten",
        revealed: "Antwoord getoond",
        finished: "Quiz afgelopen",
    }[phase] || "Onbekende status";
}

export function setConnection(element, state, text) {
    element.dataset.state = state;
    element.textContent = text;
}

export async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        const original = button.textContent;
        button.textContent = "Gekopieerd";
        window.setTimeout(() => {
            button.textContent = original;
        }, 1600);
    } catch {
        window.prompt("Kopieer deze tekst:", text);
    }
}

export function participantUrl(code) {
    const url = new URL(`deelnemer.html?code=${encodeURIComponent(code)}`, window.location.href);
    if (new URLSearchParams(window.location.search).get("emulator") === "1") {
        url.searchParams.set("emulator", "1");
    }
    return url.href;
}

export function projectorUrl(code) {
    const url = new URL(`projectie.html?code=${encodeURIComponent(code)}`, window.location.href);
    url.searchParams.set("exact", "1");
    if (new URLSearchParams(window.location.search).get("emulator") === "1") {
        url.searchParams.set("emulator", "1");
    }
    return url.href;
}

export function handoutUrl(code) {
    return new URL(`briefje.html?code=${encodeURIComponent(code)}`, window.location.href).href;
}

export function renderQr(container, value, size = 220) {
    if (!container) return false;
    container.replaceChildren();

    if (!window.QRCode) {
        container.textContent = "QR-code kon niet worden gemaakt.";
        container.classList.add("qr-output--error");
        return false;
    }

    container.classList.remove("qr-output--error");
    new window.QRCode(container, {
        text: value,
        width: size,
        height: size,
        colorDark: "#075b78",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
    });
    return true;
}
