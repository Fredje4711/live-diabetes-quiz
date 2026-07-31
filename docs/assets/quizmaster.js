import {
    copyText,
    formatPhase,
    handoutUrl,
    optionLetter,
    participantUrl,
    projectorUrl,
    renderQr,
    setConnection,
} from "./app.js?v=4";
import {
    controlSession,
    createSession,
    ensureAuth,
    watchQuiz,
} from "./firebase-service.js?v=4";

const storageCodeKey = "dlq-master-code";

const setupPanel = document.querySelector("#setupPanel");
const controlPanel = document.querySelector("#controlPanel");
const createSessionForm = document.querySelector("#createSessionForm");
const questionCount = document.querySelector("#questionCount");
const shuffleQuestions = document.querySelector("#shuffleQuestions");
const setupError = document.querySelector("#setupError");
const connectionStatus = document.querySelector("#connectionStatus");
const sessionCode = document.querySelector("#sessionCode");
const phaseBadge = document.querySelector("#phaseBadge");
const openProjectorLink = document.querySelector("#openProjectorLink");
const printHandoutsLink = document.querySelector("#printHandoutsLink");
const copyParticipantLink = document.querySelector("#copyParticipantLink");
const participantQr = document.querySelector("#participantQr");
const waitingMaster = document.querySelector("#waitingMaster");
const questionMaster = document.querySelector("#questionMaster");
const finishedMaster = document.querySelector("#finishedMaster");
const questionNumberMaster = document.querySelector("#questionNumberMaster");
const questionPhase = document.querySelector("#questionPhase");
const questionTextMaster = document.querySelector("#questionTextMaster");
const optionsMaster = document.querySelector("#optionsMaster");
const activeParticipants = document.querySelector("#activeParticipants");
const answeredCount = document.querySelector("#answeredCount");
const totalParticipants = document.querySelector("#totalParticipants");
const liveResultsPanel = document.querySelector("#liveResultsPanel");
const masterResultBars = document.querySelector("#masterResultBars");
const analysisPanel = document.querySelector("#analysisPanel");
const analysisMetrics = document.querySelector("#analysisMetrics");
const analysisList = document.querySelector("#analysisList");
const controlError = document.querySelector("#controlError");
const newSessionButton = document.querySelector("#newSessionButton");

const buttons = {
    start: document.querySelector("#startButton"),
    lock: document.querySelector("#lockButton"),
    reveal: document.querySelector("#revealButton"),
    next: document.querySelector("#nextButton"),
    previous: document.querySelector("#previousButton"),
    finish: document.querySelector("#finishButton"),
};

let code = localStorage.getItem(storageCodeKey) || "";
let latestState = null;
let stopWatch = null;
let commandBusy = false;

function showError(element, message = "") {
    element.textContent = message;
    element.classList.toggle("hide", !message);
}

function setButtonVisibility(element, visible) {
    element.classList.toggle("hide", !visible);
}

function renderOptions(question, phase) {
    optionsMaster.replaceChildren();
    question.options.forEach((answer, index) => {
        const option = document.createElement("div");
        option.className = "option";
        if (index === question.correctOption) option.classList.add("is-correct");

        const letter = document.createElement("span");
        letter.className = "option__letter";
        letter.textContent = optionLetter(index);

        const text = document.createElement("span");
        text.textContent = answer;
        if (index === question.correctOption) {
            const correct = document.createElement("strong");
            correct.textContent =
                phase === "revealed" ? " – juist antwoord" : " – juist (alleen quizmaster)";
            text.append(correct);
        }

        option.append(letter, text);
        optionsMaster.append(option);
    });
}

function renderBars(container, question, statistics, phase) {
    container.replaceChildren();
    const maximum = Math.max(1, ...statistics.counts);

    statistics.counts.forEach((count, index) => {
        const row = document.createElement("div");
        row.className = "result-bar";
        if (phase === "revealed" && index === question.correctOption) {
            row.classList.add("is-correct");
        }

        const header = document.createElement("div");
        header.className = "result-bar__header";
        const label = document.createElement("span");
        label.textContent = `${optionLetter(index)}. ${question.options[index]}`;
        const value = document.createElement("strong");
        value.textContent = String(count);
        header.append(label, value);

        const track = document.createElement("div");
        track.className = "result-bar__track";
        const fill = document.createElement("div");
        fill.className = "result-bar__fill";
        fill.style.width = `${Math.round((count / maximum) * 100)}%`;
        track.append(fill);
        row.append(header, track);
        container.append(row);
    });
}

function renderAnalysis(analysis) {
    analysisPanel.classList.remove("hide");
    analysisMetrics.replaceChildren();

    [
        ["Antwoorden", analysis.totalAnswers],
        ["Juist", `${analysis.correctPercentage}%`],
        ["Fout", analysis.incorrect],
    ].forEach(([label, value]) => {
        const metric = document.createElement("div");
        metric.className = "metric";
        const metricValue = document.createElement("span");
        metricValue.className = "metric__value";
        metricValue.textContent = String(value);
        const metricLabel = document.createElement("span");
        metricLabel.className = "metric__label";
        metricLabel.textContent = label;
        metric.append(metricValue, metricLabel);
        analysisMetrics.append(metric);
    });

    analysisList.replaceChildren();
    if (!analysis.difficultQuestions.length) {
        const item = document.createElement("li");
        item.textContent = "Geen fout beantwoorde vragen.";
        analysisList.append(item);
        return;
    }

    analysis.difficultQuestions.forEach((entry) => {
        const item = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = `${entry.incorrect} fout (${entry.percentage}%) – vraag ${entry.number}`;
        const text = document.createElement("p");
        text.textContent = entry.question;
        item.append(title, text);
        analysisList.append(item);
    });
}

function renderControls(state) {
    const phase = state.session.phase;
    const position = state.session.activePosition;

    Object.values(buttons).forEach((button) => {
        button.disabled = commandBusy;
    });

    setButtonVisibility(buttons.start, phase === "waiting");
    setButtonVisibility(buttons.lock, phase === "open");
    setButtonVisibility(buttons.reveal, phase === "open" || phase === "locked");
    setButtonVisibility(buttons.next, phase === "revealed");
    setButtonVisibility(buttons.previous, position > 0 && !["waiting", "finished"].includes(phase));
    setButtonVisibility(buttons.finish, !["waiting", "finished"].includes(phase));

    if (phase === "revealed") {
        buttons.next.textContent =
            position >= state.session.totalQuestions - 1 ? "Rond quiz af" : "Volgende vraag";
    }
}

function renderState(state) {
    latestState = state;
    sessionCode.textContent = state.session.code;
    phaseBadge.textContent = formatPhase(state.session.phase);
    questionPhase.textContent = formatPhase(state.session.phase);
    activeParticipants.textContent = state.participants.active;
    totalParticipants.textContent = state.participants.total;
    answeredCount.textContent = state.statistics?.total ?? 0;
    openProjectorLink.href = projectorUrl(code);
    printHandoutsLink.href = handoutUrl(code);

    waitingMaster.classList.toggle("hide", state.session.phase !== "waiting");
    questionMaster.classList.toggle(
        "hide",
        !state.question || ["waiting", "finished"].includes(state.session.phase),
    );
    finishedMaster.classList.toggle("hide", state.session.phase !== "finished");
    liveResultsPanel.classList.toggle("hide", !state.question || state.session.phase === "waiting");

    if (state.question) {
        questionNumberMaster.textContent =
            `Vraag ${state.session.questionNumber} van ${state.session.totalQuestions}`;
        questionTextMaster.textContent = state.question.question;
        renderOptions(state.question, state.session.phase);
        renderBars(masterResultBars, state.question, state.statistics, state.session.phase);
    }

    if (state.session.phase === "finished" && state.analysis) {
        renderAnalysis(state.analysis);
    } else {
        analysisPanel.classList.add("hide");
    }

    renderControls(state);
    setConnection(connectionStatus, "online", "Live verbonden");
    showError(controlError);
}

async function beginControl() {
    stopWatch?.();
    stopWatch = null;
    setupPanel.classList.add("hide");
    controlPanel.classList.remove("hide");
    sessionCode.textContent = code;
    const joinLink = participantUrl(code);
    openProjectorLink.href = projectorUrl(code);
    printHandoutsLink.href = handoutUrl(code);
    renderQr(participantQr, joinLink);
    setConnection(connectionStatus, "busy", "Verbinden…");

    try {
        stopWatch = await watchQuiz(
            code,
            "master",
            renderState,
            (error) => {
                setConnection(connectionStatus, "error", "Verbinding onderbroken");
                showError(controlError, error.message);
            },
        );
    } catch (error) {
        setConnection(connectionStatus, "error", "Niet verbonden");
        showError(controlError, error.message);
    }
}

createSessionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(setupError);
    const submitButton = createSessionForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setConnection(connectionStatus, "busy", "Sessie maken…");

    try {
        const result = await createSession({
            questionCount: Number(questionCount.value),
            shuffle: shuffleQuestions.checked,
        });
        code = result.code;
        localStorage.setItem(storageCodeKey, code);
        await beginControl();
    } catch (error) {
        showError(setupError, error.message);
        setConnection(connectionStatus, "error", "Sessie niet gemaakt");
    } finally {
        submitButton.disabled = false;
    }
});

async function runCommand(command) {
    if (commandBusy) return;
    commandBusy = true;
    showError(controlError);
    if (latestState) renderControls(latestState);

    try {
        await controlSession(code, command);
    } catch (error) {
        showError(controlError, error.message);
    } finally {
        commandBusy = false;
        if (latestState) renderControls(latestState);
    }
}

buttons.start.addEventListener("click", () => runCommand("start"));
buttons.lock.addEventListener("click", () => runCommand("lock"));
buttons.reveal.addEventListener("click", () => runCommand("reveal"));
buttons.next.addEventListener("click", () => runCommand("next"));

buttons.previous.addEventListener("click", () => {
    if (
        window.confirm(
            "Teruggaan opent de vorige vraag opnieuw. Reeds gegeven antwoorden blijven bewaard. Doorgaan?",
        )
    ) {
        runCommand("previous");
    }
});

buttons.finish.addEventListener("click", () => {
    if (window.confirm("Wilt u de quiz nu beëindigen en de eindscores tonen?")) {
        runCommand("finish");
    }
});

copyParticipantLink.addEventListener("click", () =>
    copyText(participantUrl(code), copyParticipantLink),
);

newSessionButton.addEventListener("click", () => {
    if (
        !window.confirm(
            "Een nieuwe sessie voorbereiden? De huidige sessie blijft online bewaard.",
        )
    ) {
        return;
    }
    stopWatch?.();
    stopWatch = null;
    localStorage.removeItem(storageCodeKey);
    code = "";
    latestState = null;
    controlPanel.classList.add("hide");
    setupPanel.classList.remove("hide");
    setConnection(connectionStatus, "online", "Klaar voor nieuwe sessie");
});

try {
    await ensureAuth();
    if (code) {
        await beginControl();
    } else {
        setConnection(connectionStatus, "online", "Klaar om te starten");
    }
} catch (error) {
    setConnection(connectionStatus, "error", "Firebase niet beschikbaar");
    showError(setupError, error.message);
}
