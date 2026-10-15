import fs from "node:fs";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch,
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

async function seedSession(code = "123", phase = "open") {
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
        setDoc(doc(master, "sessions", "654"), {
            code: "654",
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
    await assertSucceeds(getDoc(doc(participant, "sessions", "123")));
    await assertFails(
        updateDoc(doc(participant, "sessions", "123"), {
            phase: "revealed",
            updatedAt: serverTimestamp(),
        }),
    );
});

test("alleen de eigenaar kan een deelnemerregistratie schrijven", async () => {
    await seedSession("234");
    const participant = environment.authenticatedContext("participant-2").firestore();
    await assertSucceeds(
        setDoc(doc(participant, "sessions", "234", "participants", "participant-2"), {
            uid: "participant-2",
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
        }),
    );
    await assertFails(
        setDoc(doc(participant, "sessions", "234", "participants", "iemand-anders"), {
            uid: "iemand-anders",
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
        }),
    );
});

test("het zaalscherm kan anonieme deelnemers tellen", async () => {
    await seedSession("235");
    await environment.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "sessions", "235", "participants", "anon-1"), {
            uid: "anon-1",
            joinedAt: new Date(),
            lastSeen: new Date(),
        });
    });
    const projector = environment.authenticatedContext("projector-1").firestore();
    await assertSucceeds(
        getDocs(collection(projector, "sessions", "235", "participants")),
    );
});

test("alleen de quizmaster kan een bestaande sessie aan een nieuwe koppelen", async () => {
    await seedSession("236", "finished");
    await seedSession("237", "waiting");
    const master = environment.authenticatedContext("master-1").firestore();
    const stranger = environment.authenticatedContext("master-2").firestore();

    await assertSucceeds(
        updateDoc(doc(master, "sessions", "236"), {
            nextSessionCode: "237",
            updatedAt: serverTimestamp(),
        }),
    );
    await assertFails(
        updateDoc(doc(stranger, "sessions", "236"), {
            nextSessionCode: "237",
            updatedAt: serverTimestamp(),
        }),
    );
    await assertFails(
        updateDoc(doc(master, "sessions", "236"), {
            nextSessionCode: "999",
            updatedAt: serverTimestamp(),
        }),
    );
});

test("een antwoord kan tijdens de open vraag precies eenmaal worden vastgelegd", async () => {
    await seedSession("345");
    const participant = environment.authenticatedContext("participant-3").firestore();
    const answer = doc(
        participant,
        "sessions",
        "345",
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
    await seedSession("456", "locked");
    const participant = environment.authenticatedContext("participant-4").firestore();
    await assertFails(
        setDoc(doc(participant, "sessions", "456", "answers", "participant-4_0"), {
            participantUid: "participant-4",
            questionPosition: 0,
            optionIndex: 0,
            answeredAt: serverTimestamp(),
        }),
    );
});

test("alleen de sessie-eigenaar kan de quizfase wijzigen", async () => {
    await seedSession("567");
    const master = environment.authenticatedContext("master-1").firestore();
    const stranger = environment.authenticatedContext("master-2").firestore();
    await assertSucceeds(
        updateDoc(doc(master, "sessions", "567"), {
            phase: "locked",
            updatedAt: serverTimestamp(),
        }),
    );
    await assertFails(
        updateDoc(doc(stranger, "sessions", "567"), {
            phase: "finished",
            updatedAt: serverTimestamp(),
        }),
    );
    assert.ok(true);
});

const activityId = "abcdef123456";
const secret = "a".repeat(64);
const firstRound = "b".repeat(32);
const secondRound = "c".repeat(32);
test("korte link: eigenaar en andere quizmaster mogen bewaren, deelnemers niet", async () => {
    const id = "123456abcdef";
    await environment.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'activities', id), {ownerUid:'short-owner',status:'open',currentSession:'old',roundNumber:1});
        await setDoc(doc(context.firestore(), 'activities', id, 'managers', 'short-manager'), {key:secret});
    });
    const owner = environment.authenticatedContext('short-owner').firestore();
    const manager = environment.authenticatedContext('short-manager').firestore();
    const player = environment.authenticatedContext('short-player').firestore();
    const change = shortLink => ({shortLink, updatedAt:serverTimestamp()});
    await assertSucceeds(updateDoc(doc(owner,'activities',id),change('https://tinyurl.com/test-123')));
    assert.equal((await getDoc(doc(manager,'activities',id))).data().shortLink,'https://tinyurl.com/test-123');
    await assertFails(updateDoc(doc(player,'activities',id),change('https://tinyurl.com/other')));
    for (const value of ['javascript:alert(1)','https://evil.com/test','https://tinyurl.com/a#beheer=secret',42]) {
        await assertFails(updateDoc(doc(owner,'activities',id),change(value)));
    }
    await assertFails(updateDoc(doc(owner,'activities',id),{...change(''),ownerUid:'short-player'}));
    await assertSucceeds(updateDoc(doc(manager,'activities',id),change('')));
    await assertSucceeds(updateDoc(doc(owner,'activities',id),{status:'closed',updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(manager,'activities',id),change('https://tinyurl.com/test-123')));
});
function newRound(uid, code, id = activityId) {
    return { activityId: id, code, masterUid: uid, phase: "waiting", activePosition: 0,
        questionOrder: [0,1,2,3,4], totalQuestions: 5, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
test("activiteit: vaste toegang, privébeheer, nieuwe ronde, definitief sluiten", async () => {
    const master = environment.authenticatedContext("activity-owner").firestore();
    const participant = environment.authenticatedContext("activity-player").firestore();
    const replacement = environment.authenticatedContext("other-laptop").firestore();
    const batch = writeBatch(master);
    batch.set(doc(master,"activities",activityId), {title:"Testavond",ownerUid:"activity-owner",status:"open",currentSession:firstRound,roundNumber:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    batch.set(doc(master,"sessions",firstRound),newRound("activity-owner",firstRound));
    batch.set(doc(master,"activityKeys",secret),{activityId,ownerUid:"activity-owner"});
    await assertSucceeds(batch.commit());
    const publicData = (await assertSucceeds(getDoc(doc(participant,"activities",activityId)))).data();
    assert.equal(publicData.currentSession, firstRound);
    assert.equal(publicData.key, undefined);
    await assertFails(getDocs(collection(participant,"activities")));
    await assertFails(getDocs(collection(participant,"activityKeys")));
    await assertFails(setDoc(doc(participant,"activities",activityId,"managers","activity-player"),{key:"d".repeat(64)}));
    await assertFails(setDoc(doc(participant,"activityKeys","d".repeat(64)),{activityId,ownerUid:"activity-player"}));
    await assertFails(updateDoc(doc(participant,"activities",activityId),{status:"closed",updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(participant,"sessions",firstRound),{phase:"open",updatedAt:serverTimestamp()}));
    await assertSucceeds(setDoc(doc(replacement,"activities",activityId,"managers","other-laptop"),{key:secret}));
    await assertFails(getDoc(doc(participant,"activities",activityId,"managers","other-laptop")));
    await assertSucceeds(updateDoc(doc(replacement,"sessions",firstRound),{phase:"open",updatedAt:serverTimestamp()}));
    const answer = {participantUid:"activity-player",questionPosition:0,optionIndex:1,answeredAt:serverTimestamp()};
    await assertSucceeds(setDoc(doc(participant,"sessions",firstRound,"answers","activity-player_0"),answer));
    await assertSucceeds(updateDoc(doc(master,"activities",activityId),{shortLink:'https://tinyurl.com/blijft-geldig',updatedAt:serverTimestamp()}));
    const restart = writeBatch(replacement);
    restart.set(doc(replacement,"sessions",secondRound),newRound("other-laptop",secondRound));
    restart.update(doc(replacement,"activities",activityId),{currentSession:secondRound,roundNumber:2,updatedAt:serverTimestamp()});
    await assertSucceeds(restart.commit());
    assert.equal((await getDoc(doc(participant,"activities",activityId))).data().currentSession,secondRound);
    assert.equal((await getDoc(doc(replacement,"activities",activityId))).data().shortLink,'https://tinyurl.com/blijft-geldig');
    await assertFails(updateDoc(doc(master,"sessions",firstRound),{phase:"open",updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(master,"activities",activityId),{currentSession:firstRound,roundNumber:3,updatedAt:serverTimestamp()}));
    await assertSucceeds(updateDoc(doc(master,"sessions",secondRound),{phase:"open",updatedAt:serverTimestamp()}));
    await assertSucceeds(setDoc(doc(participant,"sessions",secondRound,"answers","activity-player_0"),answer));
    await assertSucceeds(updateDoc(doc(replacement,"activities",activityId),{status:"closed",updatedAt:serverTimestamp()}));
    assert.equal((await getDoc(doc(participant,"activities",activityId))).data().status,"closed");
    await assertFails(updateDoc(doc(master,"activities",activityId),{status:"open",updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(master,"sessions",secondRound),{phase:"open",updatedAt:serverTimestamp()}));
    const newcomer = environment.authenticatedContext("late-player").firestore();
    await assertFails(setDoc(doc(newcomer,"sessions",secondRound,"answers","late-player_0"),{...answer,participantUid:"late-player"}));
    await assertFails(setDoc(doc(newcomer,"sessions",secondRound,"participants","late-player"),{uid:"late-player",joinedAt:serverTimestamp(),lastSeen:serverTimestamp()}));
    await assertFails(setDoc(doc(newcomer,"activities",activityId,"managers","late-player"),{key:secret}));
});
