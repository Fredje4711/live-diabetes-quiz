import fs from "node:fs";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";

let environment;

before(async () => {
    environment = await initializeTestEnvironment({
        projectId: "diabetes-quiz-test",
        firestore: {
            rules: fs.readFileSync("firestore.rules", "utf8"),
        },
    });
});

after(async () => {
    await environment?.cleanup();
});

async function seedSession(code = "123456", phase = "open") {
    await environment.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "sessions", code), {
            code,
            masterUid: "master-1",
            phase,
            activePosition: 0,
            questionOrder: [0, 1, 2],
            totalQuestions: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });
}

test("een quizmaster kan een geldige sessie maken", async () => {
    const master = environment.authenticatedContext("master-create").firestore();
    await assertSucceeds(
        setDoc(doc(master, "sessions", "654321"), {
            code: "654321",
            masterUid: "master-create",
            phase: "waiting",
            activePosition: 0,
            questionOrder: [0, 1, 2, 3, 4],
            totalQuestions: 5,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }),
    );
});

test("een deelnemer kan de sessie lezen maar niet bedienen", async () => {
    await seedSession();
    const participant = environment.authenticatedContext("participant-1").firestore();
    await assertSucceeds(getDoc(doc(participant, "sessions", "123456")));
    await assertFails(
        updateDoc(doc(participant, "sessions", "123456"), {
            phase: "revealed",
            updatedAt: serverTimestamp(),
        }),
    );
});

test("alleen de eigenaar kan een deelnemerregistratie schrijven", async () => {
    await seedSession("234567");
    const participant = environment.authenticatedContext("participant-2").firestore();
    await assertSucceeds(
        setDoc(doc(participant, "sessions", "234567", "participants", "participant-2"), {
            uid: "participant-2",
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
        }),
    );
    await assertFails(
        setDoc(doc(participant, "sessions", "234567", "participants", "iemand-anders"), {
            uid: "iemand-anders",
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
        }),
    );
});

test("een antwoord kan tijdens de open vraag precies eenmaal worden vastgelegd", async () => {
    await seedSession("345678");
    const participant = environment.authenticatedContext("participant-3").firestore();
    const answer = doc(
        participant,
        "sessions",
        "345678",
        "answers",
        "participant-3_0",
    );
    await assertSucceeds(
        setDoc(answer, {
            participantUid: "participant-3",
            questionPosition: 0,
            optionIndex: 1,
            answeredAt: serverTimestamp(),
        }),
    );
    await assertFails(updateDoc(answer, { optionIndex: 2 }));
});

test("een antwoord wordt geweigerd zodra de vraag gesloten is", async () => {
    await seedSession("456789", "locked");
    const participant = environment.authenticatedContext("participant-4").firestore();
    await assertFails(
        setDoc(doc(participant, "sessions", "456789", "answers", "participant-4_0"), {
            participantUid: "participant-4",
            questionPosition: 0,
            optionIndex: 0,
            answeredAt: serverTimestamp(),
        }),
    );
});

test("alleen de sessie-eigenaar kan de quizfase wijzigen", async () => {
    await seedSession("567890");
    const master = environment.authenticatedContext("master-1").firestore();
    const stranger = environment.authenticatedContext("master-2").firestore();
    await assertSucceeds(
        updateDoc(doc(master, "sessions", "567890"), {
            phase: "locked",
            updatedAt: serverTimestamp(),
        }),
    );
    await assertFails(
        updateDoc(doc(stranger, "sessions", "567890"), {
            phase: "finished",
            updatedAt: serverTimestamp(),
        }),
    );
    assert.ok(true);
});
