import {
    copyText,
    confirmAction,
    formatPhase,
    handoutUrl,
    optionLetter,
    participantUrl,
    projectorUrl,
    renderQr,
    setConnection,
} from "./app.js?v=13";
import {
    controlSession,
    ensureAuth,
    watchQuiz,
} from "./firebase-service.js?v=13";
import { activityUrl, managementUrl, queryActivity, validActivity, validKey,
    createActivity, authorizeActivity, startRound, closeActivity, watchActivity } from "./activity-service.js?v=19";
import { watchPreparation } from './preparation-service.js?v=19';
import { preparationDate, preparationSummary, preparationMessage, showPreparationOverview } from './preparation.js?v=22';

const identityKey = "dlq-activity-manager";
import { makeQuizStartFile } from "./quiz-startbestand.js?v=19";
let startFileStamp = new URLSearchParams(location.hash.slice(1)).get('startbestand');
let preparation = null, preparationError = '', stopPreparation = null;
let activityCreatedHere = false;
function renderPreparation() {
    if (!activityState) return;
    const context = {fresh:activityCreatedHere && activityState.roundNumber === 1, phase:latestState?.session?.phase, error:preparationError};
    const message = preparationMessage(activityState, preparation, context);
    const showOverview = showPreparationOverview(activityState, preparation, context);
    document.querySelector('#startFileDate').classList.toggle('hide', !showOverview);
    document.querySelector('#preparationChecklist').classList.toggle('hide', !showOverview);
    document.querySelector('#preparationHeading').textContent = message.heading;
    document.querySelector('#preparationIntro').textContent = message.intro;
    const stamp = preparationDate(startFileStamp);
    document.querySelector('#startFileDate').textContent = stamp ? `Startbestand aangemaakt op ${stamp} (Belgische tijd). Niet de datum van uw bijeenkomst.` : 'Dit overzicht toont de laatste bewaarde voorbereiding.';
    const list = document.querySelector('#preparationChecklist'); list.replaceChildren();
    const summary = preparationSummary(activityState, preparation || {});
    const lines = preparationError ? [preparationError] : preparation === null ? ['Voorbereiding ophalen…']
        : [`Korte deelnemerslink: ${summary.short}`, `Internet voor deelnemers: ${summary.wifi}`, `Deelnemersbriefjes: ${summary.paper}`];
    for (const text of lines) { const li = document.createElement('li'); li.textContent = text; list.append(li); }
    document.querySelector('#preparationNext').textContent = message.next;
    document.querySelector('#startFileInstruction').textContent = activityCreatedHere
        ? 'Briefjes voorbereid? Bewaar daarna dit HTML-startbestand op uw bureaublad. Hiermee opent u in de zaal dezelfde activiteit, ook op een andere laptop. Wilt u tussendoor stoppen? Dan kunt u het bestand ook nu al bewaren om later verder te werken.'
        : 'Gebruik uw bewaarde HTML-startbestand om deze activiteit later te openen. Hebt u het bestand nog niet? Bewaar het hieronder. Niet delen met deelnemers.';
}
let savedIdentity = {};
try { savedIdentity = JSON.parse(localStorage.getItem(identityKey) || "{}"); } catch {}
let activityId = queryActivity() || (validActivity(savedIdentity.id) ? savedIdentity.id : "");
let managementKey = new URLSearchParams(location.hash.slice(1)).get("beheer") ||
    (savedIdentity.id === activityId ? savedIdentity.key || "" : "");
let activityState = null;
let preparingRound = false;
let expectedRound = "";
const activityName = document.querySelector("#activityName");
const setupTitle = document.querySelector("#setupTitle");
const setupLead = document.querySelector("#setupLead");
const closeActivityButton = document.querySelector("#closeActivityButton");
const managementPanel = document.querySelector("#managementPanel");
const closedPanel = document.querySelector("#closedPanel");
const cancelRound = document.querySelector("#cancelRound");

function linkFor(page) {
    if (activityId) return activityUrl(page, activityId);
    return page === "briefje.html" ? handoutUrl(code) : page === "projectie.html" ? projectorUrl(code) : participantUrl(code);
}
function rememberActivity() {
    localStorage.setItem(identityKey, JSON.stringify({id: activityId, key: managementKey}));
    const url = new URL(validKey(managementKey) ? managementUrl(activityId, managementKey) : activityUrl("quizmaster.html", activityId));
    if (preparationDate(startFileStamp)) { const hash = new URLSearchParams(url.hash.slice(1)); hash.set('startbestand', startFileStamp); url.hash = hash.toString(); }
    history.replaceState(null, "", url);
}
function resetSetup() {
    preparingRound = false;
    setConnection(connectionStatus, 'online', 'Klaar voor een nieuwe activiteit');
    showError(setupError);
    setupTitle.textContent = "Activiteit voorbereiden";
    setupLead.textContent = "Geef uw activiteit een naam en kies het aantal vragen. Daarna bereidt u de deelnemersbriefjes voor en bewaart u het startbestand voor later.";
    activityName.closest(".field").classList.remove("hide");
    activityName.required = true;
    createSessionForm.querySelector("button[type=submit]").textContent = "Activiteit maken";
    cancelRound.classList.add("hide");
}
function activityUpdate(state) {
    activityState = state.activity;
    if (state.closed) {
        latestState = null;
        setupPanel.classList.add("hide"); controlPanel.classList.add("hide");
        closedPanel.classList.remove("hide");
        setConnection(connectionStatus, "online", "Activiteit afgesloten");
        return;
    }
    closedPanel.classList.add("hide");
    if (state.loading) {
        latestState = null;
        Object.values(buttons).forEach(b => b.disabled = true);
        setConnection(connectionStatus, "busy", "Nieuwe ronde openen…");
        return;
    }
    code = state.session.code;
    renderState(state);
    renderPreparation();
    if (!preparingRound) { setupPanel.classList.add("hide"); controlPanel.classList.remove("hide"); }
}
async function beginActivity() {
    await authorizeActivity(activityId, managementKey);
    stopPreparation?.(); preparation = null; preparationError = '';
    stopPreparation = watchPreparation(activityId, data => { preparationError = ''; preparation = data; renderPreparation(); }, () => {
        preparationError = 'Het voorbereidingsoverzicht kon niet worden opgehaald. Controleer uw verbinding en open opnieuw uw bewaarde quizmasterbestand.'; renderPreparation();
    });
    rememberActivity();
    stopWatch?.();
    managementPanel.classList.remove("hide");
    document.querySelector("#copyManagementLink").disabled = !validKey(managementKey);
    document.querySelector("#saveManagementLink").disabled = !validKey(managementKey);
    renderQr(participantQr, linkFor("deelnemer.html"));
    closeActivityButton.classList.remove("hide");
    stopWatch = await watchActivity(activityId, "master", activityUpdate, error => {
        setConnection(connectionStatus, "error", "Verbinding controleren");
        showError(controlError, error.message); showError(setupError, error.message);
    });
}

const storageCodeKey = "dlq-master-code";
const previousStorageCodeKey = "dlq-master-previous-code";

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
    reveal: document.querySelector("#revealButton"),
    next: document.querySelector("#nextButton"),
    previous: document.querySelector("#previousButton"),
    finish: document.querySelector("#finishButton"),
};

const storedCode = localStorage.getItem(storageCodeKey) || "";
let code = /^\d{3}$/.test(storedCode) ? storedCode : "";
if (storedCode && !code) localStorage.removeItem(storageCodeKey);
const storedPreviousCode = localStorage.getItem(previousStorageCodeKey) || "";
let previousCode = /^\d{3}$/.test(storedPreviousCode) ? storedPreviousCode : "";
if (storedPreviousCode && !previousCode) {
    localStorage.removeItem(previousStorageCodeKey);
}
let latestState = null;
let stopWatch = null;
let commandBusy = false;
let restoringStoredSession = !activityId && Boolean(code);

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
        title.textContent = `Vraag ${entry.number} · ${entry.incorrect} van de ${entry.total} ${entry.total === 1 ? "deelnemer" : "deelnemers"} ${entry.incorrect === 1 ? "had" : "hadden"} deze vraag fout.`;
        const percentage = document.createElement("p");
        percentage.className = "analysis-percentage";
        percentage.textContent = `Dat is ${entry.percentage}%.`;
        const text = document.createElement("p");
        text.textContent = entry.question;
        item.append(title, percentage, text);
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
    setButtonVisibility(buttons.reveal, phase === "open" || phase === "locked");
    setButtonVisibility(buttons.next, phase === "revealed");
    setButtonVisibility(buttons.previous, position > 0 && !["waiting", "finished"].includes(phase));
    setButtonVisibility(buttons.finish, !["waiting", "finished"].includes(phase));

    if (phase === "revealed") {
        buttons.next.textContent =
            position >= state.session.totalQuestions - 1 ? "Eindanalyse" : "Volgende vraag";
    }
}

function renderState(state) {
    if (restoringStoredSession) {
        restoringStoredSession = false;
        if (state.session.phase === "finished") {
            localStorage.removeItem(storageCodeKey);
            code = "";
            latestState = null;
            controlPanel.classList.add("hide");
            setupPanel.classList.remove("hide");
            setConnection(connectionStatus, "online", "Klaar om te starten");
            setTimeout(() => {
                stopWatch?.();
                stopWatch = null;
            }, 0);
            return;
        }
    }

    latestState = state;
    sessionCode.textContent = activityState?.title || `Oude sessie ${state.session.code}`;
    phaseBadge.textContent = formatPhase(state.session.phase);
    questionPhase.textContent = formatPhase(state.session.phase);
    activeParticipants.textContent = state.participants.active;
    totalParticipants.textContent = state.participants.total;
    answeredCount.textContent = state.statistics?.total ?? 0;
    openProjectorLink.href = linkFor("projectie.html");
    printHandoutsLink.href = linkFor("briefje.html");
    newSessionButton.textContent = state.session.phase === "finished" ? "Nog een quiz spelen" : "Quiz opnieuw beginnen";

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

    if (state.session.phase === "finished") {
        localStorage.removeItem(storageCodeKey);
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
        const options = { questionCount: Number(questionCount.value), shuffle: shuffleQuestions.checked };
        if (activityId) {
            await startRound(activityId, expectedRound, options);
            preparingRound = false;
            setupPanel.classList.add("hide"); controlPanel.classList.remove("hide");
        } else {
            const result = await createActivity({ ...options, title: activityName.value });
            activityCreatedHere = true; startFileStamp = null; activityState = null; latestState = null;
            activityId = result.id; managementKey = result.key;
            rememberActivity();
            localStorage.removeItem(storageCodeKey);
            localStorage.removeItem(previousStorageCodeKey);
            await beginActivity();
        }
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
buttons.reveal.addEventListener("click", () => runCommand("reveal"));
buttons.next.addEventListener("click", () => runCommand("next"));

buttons.previous.addEventListener("click", async () => {
    if (
        await confirmAction(
            "Teruggaan opent de vorige vraag opnieuw. Reeds gegeven antwoorden blijven bewaard. Doorgaan?",
        )
    ) {
        runCommand("previous");
    }
});

buttons.finish.addEventListener("click", async () => {
    if (await confirmAction("Wilt u deze ronde stoppen en de eindanalyse tonen? De activiteit en de briefjes blijven geldig.", "Ronde stoppen")) {
        runCommand("finish");
    }
});

copyParticipantLink.addEventListener("click", () =>
    copyText(linkFor("deelnemer.html"), copyParticipantLink),
);

newSessionButton.addEventListener("click", async () => {
    if (
        !await confirmAction(
            activityId ? "Een nieuwe ronde voorbereiden? Na het bevestigen begint iedereen met een lege score. Dezelfde briefjes blijven geldig." : "Dit is een oude sessie met cijfercode. Maak een nieuwe activiteit en druk daarvoor nieuwe briefjes af. Doorgaan?",
        )
    ) {
        return;
    }
    if (activityId) {
        preparingRound = true;
        expectedRound = activityState.currentSession;
        activityName.required = false;
        activityName.closest(".field").classList.add("hide");
        setupTitle.textContent = "Nieuwe ronde, dezelfde briefjes";
        setupLead.textContent = "Kies het aantal vragen. Iedereen gaat daarna automatisch naar de wachtkamer. De huidige ronde blijft staan tot u bevestigt.";
        createSessionForm.querySelector("button[type=submit]").textContent = "Nieuwe ronde klaarzetten";
        cancelRound.classList.remove("hide");
    } else { stopWatch?.(); stopWatch = null; code = ""; resetSetup(); }
    controlPanel.classList.add("hide");
    setupPanel.classList.remove("hide");
    setConnection(connectionStatus, "online", "Klaar voor nieuwe sessie");
});

cancelRound.addEventListener("click", () => {
    preparingRound = false; setupPanel.classList.add("hide"); controlPanel.classList.remove("hide");
});
document.querySelector("#copyManagementLink").addEventListener("click", event => copyText(managementUrl(activityId, managementKey), event.currentTarget));
document.querySelector("#saveManagementLink").addEventListener("click", () => {
    const file = makeQuizStartFile(activityState?.title, managementUrl(activityId, managementKey));
    const url = URL.createObjectURL(new Blob([file.html], {type:"text/html;charset=utf-8"}));
    const a = document.createElement("a"); a.href = url; a.download = file.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.querySelector("#saveLinkHelp").textContent = "Het startbestand is gedownload (meestal in Downloads). Zet het op uw bureaublad. Dubbelklik er later op om deze quiz te openen. Gebruik een andere computer? Neem dit bestand dan mee, bijvoorbeeld op een USB-stick. Bewaar het privé.";
});
closeActivityButton.addEventListener("click", async () => {
    if (!activityState || !await confirmAction("Activiteit DEFINITIEF afsluiten? Alle uitgedeelde briefjes stoppen met werken. Dit kan niet ongedaan worden gemaakt. Kies Annuleren als u nog een ronde wilt spelen.", "Ja, definitief afsluiten")) return;
    closeActivityButton.disabled = true;
    try { await closeActivity(activityId, activityState.currentSession); }
    catch (error) { showError(controlError, error.message); }
    finally { closeActivityButton.disabled = false; }
});
document.querySelector("#newActivityButton").addEventListener("click", () => {
    activityCreatedHere = false; preparationError = ''; latestState = null;
    stopPreparation?.(); stopPreparation = null; preparation = null; startFileStamp = null;
    stopWatch?.(); stopWatch = null;
    activityId = ""; managementKey = ""; activityState = null; code = "";
    localStorage.removeItem(identityKey); localStorage.removeItem(storageCodeKey);
    const url = new URL(location.href); url.searchParams.delete("a"); url.hash = "";
    history.replaceState(null, "", url);
    closedPanel.classList.add("hide"); managementPanel.classList.add("hide");
    resetSetup(); setupPanel.classList.remove("hide");
});

try {
    await ensureAuth();
    if (activityId) {
        await beginActivity();
    } else if (code) {
        await beginControl();
    } else {
        setupPanel.classList.remove("hide");
        setConnection(connectionStatus, "online", "Klaar om te starten");
    }
} catch (error) {
    setupPanel.classList.remove("hide");
    if (activityId) {
        setupTitle.textContent = "Activiteit niet geopend";
        setupLead.textContent = "Open de volledige quizmasterlink die u bij deze activiteit hebt bewaard. Controleer ook uw internetverbinding.";
        createSessionForm.classList.add("hide");
    }
    setConnection(connectionStatus, "error", "Bediening niet geopend");
    showError(setupError, error.message);
} finally {
    document.querySelector("#loadingPanel").classList.add("hide");
}
