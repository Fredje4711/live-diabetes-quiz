import {
    formatPhase,
    normalizeCode,
    optionLetter,
    queryCode,
    setConnection,
} from "./app.js";
import {
    ensureAuth,
    submitAnswer as saveAnswer,
    watchQuiz,
} from "./firebase-service.js";

const storageCodeKey = "dlq-participant-code";
const connectionStatus = document.querySelector("#connectionStatus");
const joinPanel = document.querySelector("#joinPanel");
const joinForm = document.querySelector("#joinForm");
const quizCodeInput = document.querySelector("#quizCode");
const joinError = document.querySelector("#joinError");
const quizPanel = document.querySelector("#quizPanel");
const participantCode = document.querySelector("#participantCode");
const participantPhase = document.querySelector("#participantPhase");
const waitingParticipant = document.querySelector("#waitingParticipant");
const questionParticipant = document.querySelector("#questionParticipant");
const finishedParticipant = document.querySelector("#finishedParticipant");
const questionNumberParticipant = document.querySelector("#questionNumberParticipant");
const questionTextParticipant = document.querySelector("#questionTextParticipant");
const answerButtons = document.querySelector("#answerButtons");
const answerFeedback = document.querySelector("#answerFeedback");
const finalScore = document.querySelector("#finalScore");
const finalSummary = document.querySelector("#finalSummary");
const incorrectSection = document.querySelector("#incorrectSection");
const incorrectList = document.querySelector("#incorrectList");

let code = queryCode() || localStorage.getItem(storageCodeKey) || "";
let latestState = null;
let stopWatch = null;
let submitting = false;
let renderedQuestionKey = "";

function showError(message = "") {
    joinError.textContent = message;
    joinError.classList.toggle("hide", !message);
}

function setFeedback(kind, message) {
    answerFeedback.className = `feedback feedback--${kind}`;
    answerFeedback.textContent = message;
}

function renderAnswerButtons(state) {
    const key = `${state.session.code}:${state.session.activePosition}:${state.session.phase}:${state.participantAnswer?.optionIndex ?? "none"}`;
    if (key === renderedQuestionKey && !submitting) return;
    renderedQuestionKey = key;
    answerButtons.replaceChildren();

    state.question.options.forEach((answer, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "answer-button";
        button.dataset.optionIndex = String(index);

        const letter = document.createElement("span");
        letter.className = "option__letter";
        letter.textContent = optionLetter(index);

        const text = document.createElement("span");
        text.textContent = answer;
        button.append(letter, text);

        const selected = state.participantAnswer?.optionIndex === index;
        if (selected) button.classList.add("is-selected");

        if (["revealed", "finished"].includes(state.session.phase)) {
            if (index === state.question.correctOption) button.classList.add("is-correct");
            if (selected && index !== state.question.correctOption) {
                button.classList.add("is-incorrect");
            }
        }

        button.disabled =
            submitting || state.session.phase !== "open" || Boolean(state.participantAnswer);
        button.addEventListener("click", () => submitAnswer(index));
        answerButtons.append(button);
    });

    if (state.participantAnswer) {
        if (state.session.phase === "revealed") {
            setFeedback(
                state.participantAnswer.isCorrect ? "success" : "error",
                state.participantAnswer.isCorrect
                    ? "Juist! Uw antwoord is bewaard."
                    : `Niet juist. Het juiste antwoord is ${optionLetter(state.question.correctOption)}: ${state.question.options[state.question.correctOption]}.`,
            );
        } else {
            setFeedback("success", "Uw antwoord is ontvangen en veilig bewaard.");
        }
    } else if (state.session.phase === "open") {
        setFeedback("neutral", "Kies één antwoord.");
    } else if (state.session.phase === "locked") {
        setFeedback("neutral", "De antwoordtijd is voorbij. Wacht op de oplossing.");
    } else if (state.session.phase === "revealed") {
        setFeedback(
            "neutral",
            `Het juiste antwoord is ${optionLetter(state.question.correctOption)}: ${state.question.options[state.question.correctOption]}.`,
        );
    }
}

function renderFinalReport(report) {
    finalScore.textContent = `${report.score} / ${report.totalQuestions}`;
    const missed = report.totalQuestions - report.answered;
    finalSummary.textContent =
        missed > 0
            ? `U beantwoordde ${report.answered} vragen. ${missed} vragen werden niet beantwoord.`
            : `U beantwoordde alle ${report.totalQuestions} vragen.`;

    incorrectList.replaceChildren();
    incorrectSection.classList.toggle("hide", report.incorrect.length === 0);
    report.incorrect.forEach((entry) => {
        const item = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = `Vraag ${entry.number}: ${entry.question}`;
        const selected = document.createElement("p");
        selected.textContent = `Uw antwoord: ${entry.selectedAnswer}`;
        const correct = document.createElement("p");
        correct.textContent = `Juiste antwoord: ${entry.correctAnswer}`;
        item.append(title, selected, correct);
        incorrectList.append(item);
    });
}

function renderState(state) {
    latestState = state;
    joinPanel.classList.add("hide");
    quizPanel.classList.remove("hide");
    participantCode.textContent = state.session.code;
    participantPhase.textContent = formatPhase(state.session.phase);

    waitingParticipant.classList.toggle("hide", state.session.phase !== "waiting");
    questionParticipant.classList.toggle(
        "hide",
        !state.question || ["waiting", "finished"].includes(state.session.phase),
    );
    finishedParticipant.classList.toggle("hide", state.session.phase !== "finished");

    if (state.question && state.session.phase !== "finished") {
        questionNumberParticipant.textContent =
            `Vraag ${state.session.questionNumber} van ${state.session.totalQuestions}`;
        questionTextParticipant.textContent = state.question.question;
        renderAnswerButtons(state);
    }

    if (state.session.phase === "finished" && state.finalReport) {
        renderFinalReport(state.finalReport);
    }

    setConnection(connectionStatus, "online", "Verbonden");
    showError();
}

async function joinQuiz(nextCode) {
    code = normalizeCode(nextCode);
    if (code.length !== 3) {
        showError("Voer de drie cijfers van uw quizbriefje in.");
        return;
    }

    stopWatch?.();
    stopWatch = null;
    localStorage.setItem(storageCodeKey, code);
    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = currentUrl.pathname.replace(/[^/]+$/, "deelnemer.html");
    currentUrl.searchParams.set("code", code);
    history.replaceState(null, "", currentUrl);
    showError();
    joinPanel.classList.add("hide");
    quizPanel.classList.remove("hide");
    participantCode.textContent = code;
    setConnection(connectionStatus, "busy", "Verbinden…");

    try {
        stopWatch = await watchQuiz(
            code,
            "participant",
            renderState,
            (error) => {
                setConnection(connectionStatus, "error", "Niet verbonden");
                if (!latestState) {
                    quizPanel.classList.add("hide");
                    joinPanel.classList.remove("hide");
                    showError(error.message);
                }
            },
        );
    } catch (error) {
        setConnection(connectionStatus, "error", "Niet verbonden");
        quizPanel.classList.add("hide");
        joinPanel.classList.remove("hide");
        showError(error.message);
    }
}

async function submitAnswer(optionIndex) {
    if (!latestState || submitting || latestState.participantAnswer) return;
    submitting = true;
    renderedQuestionKey = "";
    renderAnswerButtons(latestState);
    setFeedback("neutral", "Antwoord versturen…");

    try {
        await saveAnswer({
            code,
            questionPosition: latestState.session.activePosition,
            optionIndex,
        });
    } catch (error) {
        setFeedback("error", `${error.message} Probeer indien mogelijk opnieuw.`);
    } finally {
        submitting = false;
        renderedQuestionKey = "";
        if (latestState) renderAnswerButtons(latestState);
    }
}

joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinQuiz(quizCodeInput.value);
});

quizCodeInput.addEventListener("input", () => {
    quizCodeInput.value = normalizeCode(quizCodeInput.value);
});

try {
    await ensureAuth();
    if (code.length === 3) {
        quizCodeInput.value = code;
        await joinQuiz(code);
    } else {
        setConnection(connectionStatus, "online", "Klaar om te verbinden");
        quizCodeInput.focus();
    }
} catch (error) {
    setConnection(connectionStatus, "error", "Firebase niet beschikbaar");
    showError(error.message);
}
