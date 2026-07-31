import {
    formatPhase,
    normalizeCode,
    optionLetter,
    participantUrl,
    queryCode,
    renderQr,
    setConnection,
} from "./app.js";
import { ensureAuth, watchQuiz } from "./firebase-service.js";

const storageCodeKey = "dlq-projector-code";
const connectionStatus = document.querySelector("#connectionStatus");
const projectorPhase = document.querySelector("#projectorPhase");
const projectorJoin = document.querySelector("#projectorJoin");
const projectorJoinForm = document.querySelector("#projectorJoinForm");
const projectorCodeInput = document.querySelector("#projectorCode");
const projectorError = document.querySelector("#projectorError");
const projectorWaiting = document.querySelector("#projectorWaiting");
const projectorQuestion = document.querySelector("#projectorQuestion");
const projectorFinished = document.querySelector("#projectorFinished");
const projectorSessionCode = document.querySelector("#projectorSessionCode");
const joinAddress = document.querySelector("#joinAddress");
const projectorQr = document.querySelector("#projectorQr");
const projectorQuestionNumber = document.querySelector("#projectorQuestionNumber");
const projectorQuestionText = document.querySelector("#projectorQuestionText");
const projectorOptions = document.querySelector("#projectorOptions");
const projectorAnswered = document.querySelector("#projectorAnswered");
const projectorResults = document.querySelector("#projectorResults");
const projectorResultBars = document.querySelector("#projectorResultBars");

let code = queryCode() || localStorage.getItem(storageCodeKey) || "";
let stopWatch = null;
let latestState = null;

function showError(message = "") {
    projectorError.textContent = message;
    projectorError.classList.toggle("hide", !message);
}

function renderOptions(state) {
    projectorOptions.replaceChildren();
    state.question.options.forEach((answer, index) => {
        const option = document.createElement("div");
        option.className = "option";
        if (state.session.phase === "revealed" && index === state.question.correctOption) {
            option.classList.add("is-correct");
        }

        const letter = document.createElement("span");
        letter.className = "option__letter";
        letter.textContent = optionLetter(index);
        const text = document.createElement("span");
        text.textContent = answer;
        option.append(letter, text);
        projectorOptions.append(option);
    });
}

function renderBars(state) {
    projectorResultBars.replaceChildren();
    const maximum = Math.max(1, ...state.statistics.counts);

    state.statistics.counts.forEach((count, index) => {
        const row = document.createElement("div");
        row.className = "result-bar";
        if (index === state.question.correctOption) row.classList.add("is-correct");

        const header = document.createElement("div");
        header.className = "result-bar__header";
        const label = document.createElement("span");
        label.textContent = `${optionLetter(index)}. ${state.question.options[index]}`;
        const value = document.createElement("strong");
        value.textContent = `${count} antwoord${count === 1 ? "" : "en"}`;
        header.append(label, value);

        const track = document.createElement("div");
        track.className = "result-bar__track";
        const fill = document.createElement("div");
        fill.className = "result-bar__fill";
        fill.style.width = `${Math.round((count / maximum) * 100)}%`;
        track.append(fill);
        row.append(header, track);
        projectorResultBars.append(row);
    });
}

function renderState(state) {
    latestState = state;
    projectorJoin.classList.add("hide");
    projectorWaiting.classList.toggle("hide", state.session.phase !== "waiting");
    projectorQuestion.classList.toggle(
        "hide",
        !state.question || ["waiting", "finished"].includes(state.session.phase),
    );
    projectorFinished.classList.toggle("hide", state.session.phase !== "finished");
    projectorPhase.textContent = formatPhase(state.session.phase);
    projectorSessionCode.textContent = state.session.code;

    const joinUrl = participantUrl(state.session.code);
    const readableUrl = new URL(joinUrl);
    joinAddress.textContent = `${readableUrl.host}${readableUrl.pathname}`;
    renderQr(projectorQr, joinUrl);

    if (state.question && state.session.phase !== "finished") {
        projectorQuestionNumber.textContent =
            `Vraag ${state.session.questionNumber} van ${state.session.totalQuestions}`;
        projectorQuestionText.textContent = state.question.question;
        projectorAnswered.textContent = state.statistics.total;
        renderOptions(state);

        const showResults = state.session.phase === "revealed";
        projectorResults.classList.toggle("hide", !showResults);
        if (showResults) renderBars(state);
    }

    setConnection(connectionStatus, "online", "Live verbonden");
    showError();
}

async function openProjection(nextCode) {
    code = normalizeCode(nextCode);
    if (code.length !== 6) {
        showError("Voer zes cijfers in.");
        return;
    }

    stopWatch?.();
    stopWatch = null;
    localStorage.setItem(storageCodeKey, code);
    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = currentUrl.pathname.replace(/[^/]+$/, "projectie.html");
    currentUrl.searchParams.set("code", code);
    history.replaceState(null, "", currentUrl);
    showError();
    setConnection(connectionStatus, "busy", "Verbinden…");

    try {
        stopWatch = await watchQuiz(
            code,
            "projector",
            renderState,
            (error) => {
                setConnection(connectionStatus, "error", "Verbinding onderbroken");
                if (!latestState) {
                    projectorJoin.classList.remove("hide");
                    showError(error.message);
                }
            },
        );
    } catch (error) {
        setConnection(connectionStatus, "error", "Niet verbonden");
        projectorJoin.classList.remove("hide");
        showError(error.message);
    }
}

projectorJoinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    openProjection(projectorCodeInput.value);
});

projectorCodeInput.addEventListener("input", () => {
    projectorCodeInput.value = normalizeCode(projectorCodeInput.value);
});

try {
    await ensureAuth();
    if (code.length === 6) {
        projectorCodeInput.value = code;
        await openProjection(code);
    } else {
        setConnection(connectionStatus, "online", "Klaar voor quizcode");
        projectorCodeInput.focus();
    }
} catch (error) {
    setConnection(connectionStatus, "error", "Firebase niet beschikbaar");
    showError(error.message);
}
