import {
    formatPhase,
    normalizeCode,
    optionLetter,
    queryCode,
    setConnection,
} from "./app.js?v=9";
import {
    ensureAuth,
    resolveLatestSessionCode,
    watchQuiz,
} from "./firebase-service.js?v=8";

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
const projectorQuestionNumber = document.querySelector("#projectorQuestionNumber");
const projectorQuestionText = document.querySelector("#projectorQuestionText");
const projectorOptions = document.querySelector("#projectorOptions");
const projectorAnswered = document.querySelector("#projectorAnswered");
const projectorParticipants = document.querySelector("#projectorParticipants");

let code = queryCode() || localStorage.getItem(storageCodeKey) || "";
const openExactSession = new URLSearchParams(window.location.search).get("exact") === "1";
let stopWatch = null;
let latestState = null;
let switchingSession = false;

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

function renderState(state) {
    if (state.session.nextSessionCode && state.session.nextSessionCode !== code) {
        switchProjection(state.session.nextSessionCode);
        return;
    }

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

    if (state.question && state.session.phase !== "finished") {
        projectorQuestionNumber.textContent =
            `Vraag ${state.session.questionNumber} van ${state.session.totalQuestions}`;
        projectorQuestionText.textContent = state.question.question;
        projectorAnswered.textContent = state.statistics.total;
        projectorParticipants.textContent = state.participants.active;
        renderOptions(state);
    }

    setConnection(connectionStatus, "online", "Live verbonden");
    showError();
}

async function switchProjection(nextCode) {
    if (switchingSession) return;
    switchingSession = true;
    setConnection(connectionStatus, "busy", "Nieuwe quiz openen…");
    try {
        await openProjection(nextCode, true);
    } finally {
        switchingSession = false;
    }
}

async function openProjection(nextCode, exactSession = false) {
    const requestedCode = normalizeCode(nextCode);
    if (requestedCode.length !== 3) {
        showError("Voer de drie cijfers van de quizcode in.");
        return;
    }

    stopWatch?.();
    stopWatch = null;
    latestState = null;
    code = exactSession ? requestedCode : await resolveLatestSessionCode(requestedCode);
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
    if (code.length === 3) {
        projectorCodeInput.value = code;
        await openProjection(code, openExactSession);
    } else {
        setConnection(connectionStatus, "online", "Klaar voor quizcode");
        projectorCodeInput.focus();
    }
} catch (error) {
    setConnection(connectionStatus, "error", "Firebase niet beschikbaar");
    showError(error.message);
}
