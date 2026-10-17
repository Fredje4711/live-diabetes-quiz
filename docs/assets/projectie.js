import {
    formatPhase,
    normalizeCode,
    optionLetter,
    queryCode,
    setConnection,
} from "./app.js?v=13";
import {
    ensureAuth,
    resolveLatestSessionCode,
    watchQuiz,
} from "./firebase-service.js?v=27";
import { queryActivity, watchActivity } from "./activity-service.js?v=15";
const activityId = queryActivity();

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
const projectorAnalysisList = document.querySelector("#projectorAnalysisList");
const projectorAnalysisEmpty = document.querySelector("#projectorAnalysisEmpty");
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
    if (message) {
        const notice = document.querySelector("#activityNotice");
        notice.classList.remove('is-farewell');
        projectorJoin.classList.toggle("hide", Boolean(activityId));
        notice.classList.toggle("hide", !activityId);
        if (activityId) {
            [projectorWaiting, projectorQuestion, projectorFinished].forEach(el => el.classList.add("hide"));
            notice.querySelector("h1").textContent = "Verbinding controleren";
            notice.querySelector("p").textContent = message;
        }
    }
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

import { renderWrongAnswers } from './analysis-options.js';
function renderFinalAnalysis(analysis) {
    projectorAnalysisList.replaceChildren();
    const topThree = analysis?.difficultQuestions?.slice(0, 3) || [];
    projectorAnalysisEmpty.classList.toggle("hide", topThree.length > 0);

    topThree.forEach((entry, index) => {
        const item = document.createElement("li");

        const rank = document.createElement("span");
        rank.className = "projector-analysis__rank";
        rank.textContent = String(index + 1);

        const content = document.createElement("div");
        const meta = document.createElement("p");
        meta.className = "projector-analysis__meta";
        meta.textContent = `Vraag ${entry.number} · ${entry.incorrect} van de ${entry.total} ${entry.total === 1 ? "deelnemer" : "deelnemers"} ${entry.incorrect === 1 ? "had" : "hadden"} deze vraag fout.`;
        const percentage = document.createElement("p");
        percentage.className = "projector-analysis__percentage";
        percentage.textContent = `Dat is ${entry.percentage}%.`;

        const question = document.createElement("h2");
        question.textContent = entry.question;

        const answer = document.createElement("p");
        answer.className = "projector-analysis__answer";
        answer.textContent = `Juiste antwoord: ${entry.correctAnswer}`;

        const summary = document.createElement('div');
        summary.className = 'analysis-summary';
        summary.append(meta, percentage);
        content.append(summary, question, answer, renderWrongAnswers(entry));
        item.append(rank, content);
        projectorAnalysisList.append(item);
    });
}

function renderState(state) {
    if (state.session.nextSessionCode && state.session.nextSessionCode !== code) {
        switchProjection(state.session.nextSessionCode);
        return;
    }

    latestState = state;
    document.querySelector("#activityNotice").classList.add("hide");
    projectorJoin.classList.add("hide");
    projectorWaiting.classList.toggle("hide", state.session.phase !== "waiting");
    projectorQuestion.classList.toggle(
        "hide",
        !state.question || ["waiting", "finished"].includes(state.session.phase),
    );
    projectorFinished.classList.toggle("hide", state.session.phase !== "finished");
    projectorPhase.textContent = formatPhase(state.session.phase);
    projectorSessionCode.textContent = state.activity?.title || state.session.code;
    if (state.activity) projectorSessionCode.classList.add("projector-activity-name");

    if (state.question && state.session.phase !== "finished") {
        projectorQuestionNumber.textContent =
            `Vraag ${state.session.questionNumber} van ${state.session.totalQuestions}`;
        projectorQuestionText.textContent = state.question.question;
        projectorAnswered.textContent = state.statistics.total;
        projectorParticipants.textContent = state.participants.active;
        renderOptions(state);
    }

    if (state.session.phase === "finished") {
        renderFinalAnalysis(state.analysis);
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
    if (activityId) {
        projectorJoin.classList.add("hide");
        stopWatch = await watchActivity(activityId, "projector", state => {
            if (state.closed || state.loading) {
                latestState = null;
                [projectorWaiting,projectorQuestion,projectorFinished].forEach(el => el.classList.add("hide"));
                const notice = document.querySelector("#activityNotice");
                notice.classList.toggle('is-farewell', Boolean(state.closed));
                notice.classList.remove("hide");
                const heading = notice.querySelector("h1");
                heading.textContent = "Een nieuwe ronde komt eraan";
                if (state.closed) {
                    heading.innerHTML = '<span class="farewell-thanks">Bedankt</span> <span class="farewell-subtitle">voor uw deelname aan de quiz!</span>';
                }
                notice.querySelector("p").textContent = state.closed ? "Fijn dat u erbij was." : "Blijf verbonden op uw gsm. Dezelfde briefjes blijven geldig.";
                projectorPhase.textContent = state.closed ? "Afgesloten" : "Even geduld";
                return;
            }
            document.querySelector("#activityNotice").classList.add("hide");
            code = state.session.code; renderState(state);
        }, error => {
            setConnection(connectionStatus, "error", "Verbinding controleren");
            projectorJoin.classList.remove("hide"); showError(error.message);
        });
    } else if (code.length === 3) {
        projectorCodeInput.value = code;
        await openProjection(code, openExactSession);
    } else {
        setConnection(connectionStatus, "online", "Klaar voor quizcode");
        document.querySelector("#activityNotice").classList.add("hide");
        projectorJoin.classList.remove("hide");
        projectorCodeInput.focus();
    }
} catch (error) {
    setConnection(connectionStatus, "error", "Firebase niet beschikbaar");
    showError(error.message);
}
