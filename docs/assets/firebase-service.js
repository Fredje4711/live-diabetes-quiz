import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
    connectAuthEmulator,
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
    collection,
    connectFirestoreEmulator,
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { QUESTIONS } from "./questions.js?v=4";

const firebaseConfig = {
    apiKey: "AIzaSyAEDsSpOk5CSFHox7Q59IBUbx6XcRmmXDo",
    authDomain: "diabetes-quiz.firebaseapp.com",
    projectId: "diabetes-quiz",
    storageBucket: "diabetes-quiz.appspot.com",
    messagingSenderId: "294763855066",
    appId: "1:294763855066:web:b89433cbf262acdb63b9e3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const useEmulators =
    new URLSearchParams(window.location.search).get("emulator") === "1";

if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8085);
}

let authPromise;

function friendlyError(error) {
    const messages = {
        "auth/admin-restricted-operation":
            "Anonieme deelname is nog niet ingeschakeld in Firebase.",
        "auth/network-request-failed":
            "Geen internetverbinding. Controleer mobiele data of wifi.",
        "auth/operation-not-allowed":
            "Anonieme deelname is nog niet ingeschakeld in Firebase.",
        "permission-denied":
            "Firebase weigert deze handeling. Controleer de beveiligingsregels.",
        "unavailable":
            "De online quizdienst is tijdelijk niet bereikbaar.",
    };
    return new Error(messages[error?.code] || error?.message || "Er ging iets mis.");
}

export function ensureAuth() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (authPromise) return authPromise;

    authPromise = new Promise((resolve, reject) => {
        let settled = false;
        const unsubscribe = onAuthStateChanged(
            auth,
            async (user) => {
                if (settled) return;
                if (user) {
                    settled = true;
                    unsubscribe();
                    resolve(user);
                    return;
                }
                try {
                    const credential = await signInAnonymously(auth);
                    settled = true;
                    unsubscribe();
                    resolve(credential.user);
                } catch (error) {
                    settled = true;
                    unsubscribe();
                    authPromise = null;
                    reject(friendlyError(error));
                }
            },
            (error) => {
                if (settled) return;
                settled = true;
                authPromise = null;
                reject(friendlyError(error));
            },
        );
    });

    return authPromise;
}

function threeDigitCode() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(100 + (values[0] % 900));
}

function shuffledIndexes() {
    const indexes = QUESTIONS.map((_, index) => index);
    for (let index = indexes.length - 1; index > 0; index -= 1) {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const target = random[0] % (index + 1);
        [indexes[index], indexes[target]] = [indexes[target], indexes[index]];
    }
    return indexes;
}

export async function createSession({ questionCount, shuffle }) {
    const user = await ensureAuth();
    const count = Math.min(QUESTIONS.length, Math.max(1, Number(questionCount) || 10));
    const order = (shuffle ? shuffledIndexes() : QUESTIONS.map((_, index) => index)).slice(0, count);

    for (let attempt = 0; attempt < 30; attempt += 1) {
        const code = threeDigitCode();
        const sessionRef = doc(db, "sessions", code);
        try {
            await runTransaction(db, async (transaction) => {
                const existing = await transaction.get(sessionRef);
                if (existing.exists()) throw new Error("CODE_EXISTS");
                transaction.set(sessionRef, {
                    code,
                    masterUid: user.uid,
                    phase: "waiting",
                    activePosition: 0,
                    questionOrder: order,
                    totalQuestions: order.length,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            });
            return { code };
        } catch (error) {
            if (error.message === "CODE_EXISTS") continue;
            throw friendlyError(error);
        }
    }

    throw new Error("Er kon geen vrije quizcode worden gemaakt. Probeer opnieuw.");
}

export async function controlSession(code, command) {
    const user = await ensureAuth();
    const sessionRef = doc(db, "sessions", code);

    try {
        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(sessionRef);
            if (!snapshot.exists()) throw new Error("Quizcode niet gevonden.");

            const session = snapshot.data();
            if (session.masterUid !== user.uid) {
                throw new Error("Deze quiz hoort bij een andere quizmaster.");
            }

            const update = { updatedAt: serverTimestamp() };
            switch (command) {
                case "start":
                    if (session.phase !== "waiting") throw new Error("De quiz is al gestart.");
                    update.phase = "open";
                    update.activePosition = 0;
                    break;
                case "lock":
                    if (session.phase !== "open") throw new Error("Deze vraag is niet open.");
                    update.phase = "locked";
                    break;
                case "reveal":
                    if (!["open", "locked"].includes(session.phase)) {
                        throw new Error("Het antwoord kan nu niet worden getoond.");
                    }
                    update.phase = "revealed";
                    break;
                case "next":
                    if (session.phase !== "revealed") {
                        throw new Error("Toon eerst het juiste antwoord.");
                    }
                    if (session.activePosition >= session.totalQuestions - 1) {
                        update.phase = "finished";
                    } else {
                        update.phase = "open";
                        update.activePosition = session.activePosition + 1;
                    }
                    break;
                case "previous":
                    if (session.activePosition <= 0 || ["waiting", "finished"].includes(session.phase)) {
                        throw new Error("Teruggaan is nu niet mogelijk.");
                    }
                    update.phase = "open";
                    update.activePosition = session.activePosition - 1;
                    break;
                case "finish":
                    if (["waiting", "finished"].includes(session.phase)) {
                        throw new Error("De quiz kan nu niet worden beëindigd.");
                    }
                    update.phase = "finished";
                    break;
                default:
                    throw new Error("Onbekende quizbediening.");
            }

            transaction.update(sessionRef, update);
        });
    } catch (error) {
        throw friendlyError(error);
    }
}

async function registerParticipant(code, user) {
    const sessionRef = doc(db, "sessions", code);
    const participantRef = doc(db, "sessions", code, "participants", user.uid);

    await runTransaction(db, async (transaction) => {
        const session = await transaction.get(sessionRef);
        if (!session.exists()) throw new Error("Deze quizcode bestaat niet.");
        const participant = await transaction.get(participantRef);
        transaction.set(
            participantRef,
            {
                uid: user.uid,
                joinedAt: participant.exists()
                    ? participant.data().joinedAt
                    : serverTimestamp(),
                lastSeen: serverTimestamp(),
            },
            { merge: true },
        );
    });
}

export async function touchParticipant(code) {
    const user = await ensureAuth();
    const participantRef = doc(db, "sessions", code, "participants", user.uid);
    await setDoc(
        participantRef,
        { uid: user.uid, lastSeen: serverTimestamp() },
        { merge: true },
    );
}

export async function submitAnswer({ code, questionPosition, optionIndex }) {
    const user = await ensureAuth();
    const position = Number(questionPosition);
    const selected = Number(optionIndex);
    if (!Number.isInteger(selected) || selected < 0 || selected > 3) {
        throw new Error("Dit antwoord is niet geldig.");
    }

    const sessionRef = doc(db, "sessions", code);
    const answerRef = doc(db, "sessions", code, "answers", `${user.uid}_${position}`);

    try {
        await runTransaction(db, async (transaction) => {
            const [session, existing] = await Promise.all([
                transaction.get(sessionRef),
                transaction.get(answerRef),
            ]);
            if (!session.exists()) throw new Error("Deze quizcode bestaat niet.");
            const data = session.data();
            if (data.phase !== "open" || data.activePosition !== position) {
                throw new Error("Deze vraag is niet meer open.");
            }
            if (existing.exists()) throw new Error("Uw antwoord was al ontvangen.");

            transaction.set(answerRef, {
                participantUid: user.uid,
                questionPosition: position,
                optionIndex: selected,
                answeredAt: serverTimestamp(),
            });
        });
    } catch (error) {
        throw friendlyError(error);
    }
}

function currentQuestion(session, revealCorrect) {
    if (!session.questionOrder?.length) return null;
    const bankIndex = session.questionOrder[session.activePosition];
    const source = QUESTIONS[bankIndex];
    if (!source) return null;
    const question = {
        id: source.id,
        question: source.question,
        options: [...source.options],
    };
    if (revealCorrect) question.correctOption = source.correctOption;
    return question;
}

function statisticsFor(answers, position) {
    const current = answers.filter((answer) => answer.questionPosition === position);
    const counts = [0, 0, 0, 0];
    current.forEach((answer) => {
        if (Number.isInteger(answer.optionIndex) && answer.optionIndex >= 0 && answer.optionIndex < 4) {
            counts[answer.optionIndex] += 1;
        }
    });
    return { total: current.length, counts };
}

function finalReport(session, answers, uid) {
    const own = answers.filter((answer) => answer.participantUid === uid);
    let score = 0;
    const incorrect = [];

    own.forEach((answer) => {
        const bankIndex = session.questionOrder[answer.questionPosition];
        const question = QUESTIONS[bankIndex];
        if (!question) return;
        if (answer.optionIndex === question.correctOption) {
            score += 1;
        } else {
            incorrect.push({
                number: answer.questionPosition + 1,
                question: question.question,
                selectedAnswer: question.options[answer.optionIndex] || "Geen antwoord",
                correctAnswer: question.options[question.correctOption],
            });
        }
    });

    return {
        score,
        answered: own.length,
        totalQuestions: session.totalQuestions,
        incorrect,
    };
}

function analysisFor(session, answers) {
    let correct = 0;
    const byPosition = new Map();
    answers.forEach((answer) => {
        const bankIndex = session.questionOrder[answer.questionPosition];
        const question = QUESTIONS[bankIndex];
        if (!question) return;
        const isCorrect = answer.optionIndex === question.correctOption;
        if (isCorrect) correct += 1;
        const item = byPosition.get(answer.questionPosition) || { total: 0, incorrect: 0 };
        item.total += 1;
        if (!isCorrect) item.incorrect += 1;
        byPosition.set(answer.questionPosition, item);
    });

    const difficultQuestions = [...byPosition.entries()]
        .filter(([, item]) => item.incorrect > 0)
        .map(([position, item]) => ({
            number: position + 1,
            question: QUESTIONS[session.questionOrder[position]]?.question || "",
            incorrect: item.incorrect,
            percentage: Math.round((item.incorrect / item.total) * 100),
        }))
        .sort((a, b) => b.percentage - a.percentage || b.incorrect - a.incorrect)
        .slice(0, 5);

    return {
        totalAnswers: answers.length,
        correctPercentage: answers.length ? Math.round((correct / answers.length) * 100) : 0,
        incorrect: answers.length - correct,
        difficultQuestions,
    };
}

function activeParticipants(participants) {
    const cutoff = Date.now() - 45000;
    return participants.filter((participant) => {
        const timestamp = participant.lastSeen;
        return timestamp?.toMillis ? timestamp.toMillis() >= cutoff : true;
    }).length;
}

export async function watchQuiz(code, role, onState, onError) {
    const user = await ensureAuth();
    const sessionRef = doc(db, "sessions", code);
    let session = null;
    let answers = [];
    let participants = [];
    let stopped = false;
    let answerUnsubscribe = null;
    let participantUnsubscribe = null;
    let heartbeat = null;

    const fail = (error) => {
        if (!stopped) onError(friendlyError(error));
    };

    const emit = () => {
        if (stopped || !session) return;
        const isMaster = session.masterUid === user.uid;
        if (role === "master" && !isMaster) {
            fail(new Error("De quizmastertoegang is niet meer geldig."));
            return;
        }

        const revealCorrect =
            isMaster || ["revealed", "finished"].includes(session.phase);
        const question = currentQuestion(session, revealCorrect);
        const statistics = statisticsFor(answers, session.activePosition);
        const answer = answers.find(
            (entry) =>
                entry.participantUid === user.uid &&
                entry.questionPosition === session.activePosition,
        );
        const bankQuestion = QUESTIONS[session.questionOrder[session.activePosition]];

        onState({
            ok: true,
            isMaster,
            session: {
                code,
                phase: session.phase,
                activePosition: session.activePosition,
                questionNumber: session.activePosition + 1,
                totalQuestions: session.totalQuestions,
            },
            question,
            statistics,
            participants: {
                active: activeParticipants(participants),
                total: participants.length,
            },
            participantAnswer: answer
                ? {
                      optionIndex: answer.optionIndex,
                      isCorrect: bankQuestion
                          ? answer.optionIndex === bankQuestion.correctOption
                          : false,
                  }
                : null,
            finalReport:
                session.phase === "finished"
                    ? finalReport(session, answers, user.uid)
                    : null,
            analysis:
                isMaster && session.phase === "finished"
                    ? analysisFor(session, answers)
                    : null,
        });
    };

    const startRoleSubscriptions = async () => {
        if (role === "participant") {
            await registerParticipant(code, user);
            heartbeat = window.setInterval(() => {
                touchParticipant(code).catch(() => {});
            }, 20000);
        }

        const answersRef = collection(db, "sessions", code, "answers");
        const answersQuery =
            role === "participant"
                ? query(answersRef, where("participantUid", "==", user.uid))
                : answersRef;
        answerUnsubscribe = onSnapshot(
            answersQuery,
            (snapshot) => {
                answers = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
                emit();
            },
            fail,
        );

        if (role === "master" || role === "projector") {
            participantUnsubscribe = onSnapshot(
                collection(db, "sessions", code, "participants"),
                (snapshot) => {
                    participants = snapshot.docs.map((item) => ({
                        id: item.id,
                        ...item.data(),
                    }));
                    emit();
                },
                fail,
            );
        }
    };

    let subscriptionsStarted = false;
    const sessionUnsubscribe = onSnapshot(
        sessionRef,
        async (snapshot) => {
            if (!snapshot.exists()) {
                fail(new Error("Deze quizcode bestaat niet."));
                return;
            }
            session = snapshot.data();
            if (!subscriptionsStarted) {
                subscriptionsStarted = true;
                try {
                    await startRoleSubscriptions();
                } catch (error) {
                    fail(error);
                }
            }
            emit();
        },
        fail,
    );

    return () => {
        stopped = true;
        sessionUnsubscribe();
        answerUnsubscribe?.();
        participantUnsubscribe?.();
        if (heartbeat) window.clearInterval(heartbeat);
    };
}

export async function sessionExists(code) {
    await ensureAuth();
    const snapshot = await getDoc(doc(db, "sessions", code));
    return snapshot.exists();
}
