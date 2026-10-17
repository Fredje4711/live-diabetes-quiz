import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as preparationHelpers from '../docs/assets/preparation.js';

const read = file => fs.readFileSync(new URL('../docs/' + file, import.meta.url), 'utf8');
test('feestelijk bedankscherm is uitsluitend voor afgesloten activiteiten', () => {
    const html = read('projectie.html');
    const source = read('assets/projectie.js');
    const css = read('assets/styles.css');
    assert.match(html, /class="farewell-art"/);
    assert.doesNotMatch(html, /Samen meedoen|Samen bijleren|<span>A<\/span><span>B<\/span>/);
    assert.match(html, /src="assets\/bedankt-samen.png"/);
    assert.doesNotMatch(html, /diabetesRing|<svg class="farewell-art"/);
    assert.doesNotMatch(html.match(/<section id="activityNotice"[^>]*>/)[0], /is-farewell/);
    assert.ok(source.includes("notice.classList.toggle('is-farewell', Boolean(state.closed))"));
    assert.ok(source.includes("notice.classList.remove('is-farewell')"));
    assert.match(css, /#activityNotice\.is-farewell\.hide \{ display: none/);
    assert.match(css, /#activityNotice\.is-farewell > p/);
});
test('vensters vermelden hun rol in tabtitel en zichtbare kop; beginnersteksten zijn concreet', () => {
    for (const [file, role] of [['quizmaster.html','Quizmastervenster'],['briefje.html','Quizmastervenster'],['deelnemer.html','Deelnemerscherm'],['projectie.html','Zaalscherm']]) {
        const html = read(file);
        assert.match(html.match(/<title>(.*?)<\/title>/)[1],new RegExp(role));
        assert.match(html.match(/<header[\s\S]*?<\/header>/)[0],new RegExp(role));
    }
    const handout = read('briefje.html');
    assert.doesNotMatch(handout,/Eén keer per nieuwe activiteit|Wilt u die weer gebruiken|Gegevens voorbereid|Hebt u dat al/);
    assert.match(handout,/Kies in het quizmastervenster <strong>Quiz opnieuw beginnen/);
    assert.match(handout,/niet ‘Activiteit definitief afsluiten’/);
    assert.match(handout,/Verwijder de korte link uit het invulvak/);
    assert.match(read('quizmaster.html'), /Hoe zet ik het zaalscherm op de tv of projector/);
    assert.match(read('handleiding.html'), /gsm, tablet of computer/);
});
test('zaalscherm is de eerste actie; deelnemerslink heeft afzonderlijke optionele uitleg', () => {
    const master = read('quizmaster.html');
    assert.ok(master.indexOf('id="openProjectorLink"') < master.indexOf('id="copyParticipantLink"'));
    assert.match(master, /aria-describedby="projectorLinkHelp"/);
    assert.match(master, /aria-describedby="participantLinkHelp"/);
    assert.match(master, /De bediening voor de quizmaster blijft op uw laptop/);
    assert.match(master, /plak de link in een e-mail en verstuur die naar hen/);
    assert.match(master, /Zij openen de link op hun gsm, tablet of computer en doen mee aan dezelfde quiz/);
    assert.match(master, /Voor deelnemers op afstand/);
    assert.match(master, /Deel het zaalscherm en de stem van de quizmaster via uw online bijeenkomst/);
    assert.doesNotMatch(master, /online deelnemers/i);
    assert.doesNotMatch(read('handleiding.html'), /online deelnemers/i);
    assert.match(master, /Dan hoeft u deze knop niet te gebruiken/);
    assert.match(master, /niet de link van het zaalscherm/);
    const source = read('assets/quizmaster.js');
    assert.match(source, /openProjectorLink.href = linkFor\("projectie.html"\)/);
    assert.match(source, /copyText\(linkFor\("deelnemer.html"\), copyParticipantLink\)/);
});
test('instructies herhalen de dynamische voorbereidingstekst niet', () => {
    const master = read('quizmaster.html');
    assert.doesNotMatch(master, /Kies hoe deelnemers internet gebruiken/);
    assert.equal((master.match(/id="preparationNext"/g) || []).length, 1);
    assert.ok(master.indexOf('id="preparationNext"') < master.indexOf('id="handoutsStepHeading"'));
    assert.match(master, /Voor uw oefening kunt u deze QR-code scannen/);
    assert.match(master, /Zet het bestand over via e-mail of USB-stick/);
    assert.match(master, /Dubbelklik erop om de quiz te bedienen; internet is nodig/);
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
    assert.match(get('#startFileInstruction').textContent,/^Bewaar nu het startbestand/);
    assert.doesNotMatch(get('#startFileInstruction').textContent,/al bewaard|blijft geldig/);
    assert.equal(get('#preparationNext').classList.contains('hide'),true);
    assert.equal(get('#preparationPause').classList.contains('hide'),false);
    context.preparation.printedAt = null;
    vm.runInNewContext('renderPreparation();',context);
    assert.equal(get('#printHandoutsLink').textContent,'Deelnemersbriefjes voorbereiden');
    assert.equal(get('#printHandoutsLink').classList.contains('button-link'),true);
    assert.equal(get('#preparationNext').classList.contains('hide'),false);
    assert.equal(get('#preparationPause').classList.contains('hide'),true);
    assert.match(get('#startFileInstruction').textContent,/^Bereid eerst/);
    context.startFileStamp = '2026-10-16T07:30:00Z';
    vm.runInNewContext('renderPreparation();',context);
    assert.equal(get('#startFileStepHeading').textContent,'Uw bewaarde startbestand');
    assert.match(get('#startFileInstruction').textContent,/via uw bewaarde startbestand geopend/);
    assert.match(get('#saveManagementLink').textContent,/^Extra exemplaar/);
    context.startFileStamp = 'ongeldig';
    context.preparation.printedAt = '2026-10-16T07:00:00Z';
    vm.runInNewContext('renderPreparation();',context);
    assert.match(get('#startFileInstruction').textContent,/^Bewaar nu/);
    assert.equal(get('#saveManagementLink').textContent,'Startbestand voor de quizmaster bewaren');
    context.latestState.session.phase = 'open';
    vm.runInNewContext('renderPreparation();',context);
    assert.equal(get('#preparationPause').classList.contains('hide'),true);
});
test('thuis stoppen en later dezelfde activiteit openen zijn expliciete afzonderlijke momenten', () => {
    const master = read('quizmaster.html');
    assert.match(master, /Klaar voor vandaag\? U mag hier stoppen/);
    assert.match(master, /Zijn de papieren briefjes klaar en staat het startbestand op uw laptop/);
    assert.match(master, /Kies niet ‘Activiteit definitief afsluiten’/);
    assert.match(master, /u komt terug op dit quizmasterscherm, bij dezelfde activiteit/);
    assert.match(master, /U hoeft dit venster daarvoor niet eerst te sluiten/);
    for (const file of ['handleiding.html','uitleg/organiseren.html']) {
        assert.match(read(file), /Voorbereiding afgerond\? U mag stoppen/);
        assert.match(read(file), /niet ‘Activiteit definitief afsluiten’/);
    }
});
for (const [page, joinId, errorId] of [['deelnemer','joinPanel','joinError'], ['projectie','projectorJoin','projectorError']]) {
    test(`${page}: alleen laadmelding zichtbaar vóór JavaScript start`, () => {
        const html = read(page + '.html');
        assert.match(html, new RegExp(`id="${joinId}" class="[^"]*\\bhide\\b`));
        const notice = html.match(/<section id="activityNotice"[^>]*>/)[0];
        assert.doesNotMatch(notice, /\bhide\b/);
        assert.match(html, /Even geduld…/);
        assert.match(html, new RegExp(`${page}\\.js\\?v=${page === 'projectie' ? 28 : 15}`));
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
        renderWrongAnswers: makeNode,
        analysis: {difficultQuestions: [{number: 4, total: 50, incorrect: 30, percentage: 60, question: 'Voorbeeldvraag', correctAnswer: 'Voorbeeldantwoord'}]},
    });
    const content = list.children[0].children[1].children[0].children;
    assert.equal(content[0].textContent, 'Vraag 4 · 30 van de 50 deelnemers hadden deze vraag fout.');
    assert.equal(content[1].textContent, 'Dat is 60%.');
    assert.equal(content[1].className, 'projector-analysis__percentage');
    assert.ok(source.includes('Bedankt voor uw deelname aan de quiz!'));
});
