import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as preparationHelpers from '../docs/assets/preparation.js';

const read = file => fs.readFileSync(new URL('../docs/' + file, import.meta.url), 'utf8');
test('instructies herhalen de dynamische voorbereidingstekst niet', () => {
    const master = read('quizmaster.html');
    assert.doesNotMatch(master, /Kies hoe deelnemers internet gebruiken/);
    assert.equal((master.match(/id="preparationNext"/g) || []).length, 1);
    assert.ok(master.indexOf('id="preparationNext"') < master.indexOf('id="handoutsStepHeading"'));
    assert.match(master, /Voor uw oefening kunt u deze QR-code scannen/);
    assert.doesNotMatch(read('index.html'), /Kies het aantal vragen en bewaar uw quizmasterlink/);
    assert.doesNotMatch(read('deelnemer.html'), /Open uw deelnemersbriefje/);
    assert.match(read('briefje.html'), /Klik ook op ‘Internetkeuze bewaren’/);
});
test('voorbereiding staat vóór startbestand en zaal; printen staat vóór papieren bevestiging', () => {
    const master = read('quizmaster.html');
    assert.ok(master.indexOf('id="printHandoutsLink"') < master.indexOf('id="saveManagementLink"'));
    assert.ok(master.indexOf('id="saveManagementLink"') < master.indexOf('id="openProjectorLink"'));
    assert.equal((master.match(/id="printHandoutsLink"/g) || []).length, 1);
    const handout = read('briefje.html');
    assert.ok(handout.indexOf('id="saveWifi"') < handout.indexOf('id="printButton"'));
    assert.ok(handout.indexOf('id="printButton"') < handout.indexOf('id="printedConfirmed"'));
    assert.equal((handout.match(/id="printButton"/g) || []).length, 1);
    for (const file of ['quizmaster.html','briefje.html','handleiding.html','uitleg/oefenen.html','uitleg/organiseren.html','assets/preparation.js','assets/briefje.js']) {
        assert.doesNotMatch(read(file), /Deelnemersbriefjes afdrukken|Bewaar eerst uw HTML-startbestand|Klik meteen op/);
    }
});
const element = () => {
    const classes = new Set();
    return { textContent: '', disabled: false, classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name),
    }};
};
test('quizmasterscherm schakelt van voorbereiden naar klaar en terug na wijziging', () => {
    const source = read('assets/quizmaster.js');
    const fn = source.slice(source.indexOf('function renderPreparation()'), source.indexOf('let savedIdentity'));
    const elements = new Map();
    const get = selector => {
        if (!elements.has(selector)) elements.set(selector, {...element(), replaceChildren() {}, append() {}});
        return elements.get(selector);
    };
    const context = {...preparationHelpers, activityState:{title:'Test',roundNumber:1},
        preparation:{wifiConfigured:true,printedAt:'2026-10-16T07:00:00Z',printedShortLink:''},
        preparationError:'', activityCreatedHere:false, latestState:{session:{phase:'waiting'}}, startFileStamp:null,
        document:{querySelector:get,createElement:element}};
    vm.runInNewContext(fn + '\nrenderPreparation();',context);
    assert.equal(get('#printHandoutsLink').textContent,'Bekijken of wijzigen');
    assert.equal(get('#printHandoutsLink').classList.contains('button-link'),false);
    assert.match(get('#startFileStepHeading').textContent,/^Volgende stap:/);
    assert.match(get('#startFileInstruction').textContent,/Hebt u het al bewaard/);
    assert.equal(get('#preparationNext').classList.contains('hide'),true);
    context.preparation.printedAt = null;
    vm.runInNewContext('renderPreparation();',context);
    assert.equal(get('#printHandoutsLink').textContent,'Deelnemersbriefjes voorbereiden');
    assert.equal(get('#printHandoutsLink').classList.contains('button-link'),true);
    assert.equal(get('#preparationNext').classList.contains('hide'),false);
});
for (const [page, joinId, errorId] of [['deelnemer','joinPanel','joinError'], ['projectie','projectorJoin','projectorError']]) {
    test(`${page}: alleen laadmelding zichtbaar vóór JavaScript start`, () => {
        const html = read(page + '.html');
        assert.match(html, new RegExp(`id="${joinId}" class="[^"]*\\bhide\\b`));
        const notice = html.match(/<section id="activityNotice"[^>]*>/)[0];
        assert.doesNotMatch(notice, /\bhide\b/);
        assert.match(html, /Even geduld…/);
        assert.match(html, new RegExp(`${page}\\.js\\?v=${page === 'projectie' ? 16 : 15}`));
    });
    test(`${page}: fout toont melding, geen oud formulier bij vaste activiteit`, () => {
        const source = read('assets/' + page + '.js');
        const start = source.indexOf('function showError(');
        const fn = source.slice(start, source.indexOf('\nfunction ', start + 1));
        for (const activityId of ['abcdef123456', '']) {
            const notice = element(), heading = element(), text = element(), join = element();
            notice.querySelector = selector => selector === 'h1' ? heading : text;
            const context = { activityId, document: {querySelector: () => notice},
                [joinId]: join, [errorId]: element(), quizPanel: element(),
                projectorWaiting: element(), projectorQuestion: element(), projectorFinished: element() };
            vm.runInNewContext(fn + '\nshowError("Testfout");', context);
            assert.equal(join.classList.contains('hide'), Boolean(activityId));
            assert.equal(notice.classList.contains('hide'), !activityId);
            if (activityId) assert.equal(text.textContent, 'Testfout');
        }
    });
}
test('bediening zonder sluitknop; oplossing blijft direct beschikbaar', () => {
    const source = read('assets/quizmaster.js');
    assert.doesNotMatch(source + read('quizmaster.html'), /lockButton|buttons\.lock|Sluit antwoorden/);
    const start = source.indexOf('function renderControls(');
    const fn = source.slice(start, source.indexOf('\nfunction ', start + 1));
    for (const phase of ['waiting', 'open', 'locked', 'revealed', 'finished']) {
        const buttons = Object.fromEntries(['start','reveal','next','previous','finish'].map(key => [key, element()]));
        vm.runInNewContext(fn + '\nrenderControls(state);', {
            buttons, commandBusy: false,
            setButtonVisibility: (button, visible) => button.classList.toggle('hide', !visible),
            state: {session: {phase, activePosition: 4, totalQuestions: 5}},
        });
        assert.equal(buttons.reveal.classList.contains('hide'), !['open','locked'].includes(phase));
        if (phase === 'revealed') assert.equal(buttons.next.textContent, 'Eindanalyse');
    }
});

test('duidelijke rolnamen met behoud van bestaande quizmasterlinks', () => {
    const html = read('quizmaster.html');
    for (const label of ['Startbestand voor de quizmaster bewaren', 'Quizmasterlink kopiëren', 'Deelnemerslink kopiëren', 'Zaalscherm openen']) assert.ok(html.includes(label));
    for (const file of ['quizmaster.html', 'handleiding.html', 'index.html', 'uitleg/oefenen.html', 'uitleg/organiseren.html', 'assets/quizmaster.js', 'assets/activity-service.js']) assert.doesNotMatch(read(file), /beheerlink/i);
    assert.ok(read('assets/activity-service.js').includes('#beheer='));
    assert.ok(read('assets/quizmaster.js').includes('.get("beheer")'));
});

test('eindanalyse toont aantallen vóór het afzonderlijke percentage', () => {
    const source = read('assets/projectie.js');
    const start = source.indexOf('function renderFinalAnalysis(');
    const fn = source.slice(start, source.indexOf('\nfunction ', start + 1));
    const makeNode = () => ({ ...element(), children: [],
        append(...nodes) { this.children.push(...nodes); },
        replaceChildren() { this.children = []; },
    });
    const list = makeNode();
    vm.runInNewContext(fn + '\nrenderFinalAnalysis(analysis);', {
        document: {createElement: makeNode}, projectorAnalysisList: list,
        projectorAnalysisEmpty: makeNode(),
        analysis: {difficultQuestions: [{number: 4, total: 50, incorrect: 30, percentage: 60, question: 'Voorbeeldvraag', correctAnswer: 'Voorbeeldantwoord'}]},
    });
    const content = list.children[0].children[1].children;
    assert.equal(content[0].textContent, 'Vraag 4 · 30 van de 50 deelnemers hadden deze vraag fout.');
    assert.equal(content[1].textContent, 'Dat is 60%.');
    assert.equal(content[1].className, 'projector-analysis__percentage');
    assert.ok(source.includes('Bedankt voor uw deelname aan de quiz!'));
});
