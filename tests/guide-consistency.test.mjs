import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../docs/', import.meta.url));
const pages = ['index.html', 'kennismaken.html', 'handleiding.html', 'uitleg/oefenen.html', 'uitleg/organiseren.html', 'briefje.html', 'deelnemer.html', 'quizmaster.html'];
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('de handleiding biedt uitsluitend de actuele korte video aan', () => {
    const html = read('handleiding.html');
    assert.equal((html.match(/<video\b/g) || []).length, 1);
    assert.match(html, /4 minuten en 2 seconden/);
    assert.match(html, /live-diabetes-quiz-uitleg\.mp4\?v=20261019/);
    assert.doesNotMatch(html, /videohandleiding-organisatoren|nog niet bijgewerkt|Uitgebreide eerdere/);
    assert.equal(fs.existsSync(path.join(root, 'assets/video/videohandleiding-organisatoren.mp4')), false);
});

test('vraagvoorbeeld staat afzonderlijk vóór het uitklapbare top-3-kader', () => {
    const html = read('handleiding.html');
    const figure = html.match(/<figure class="question-example"[\s\S]*?<\/figure>/)?.[0];
    assert.ok(figure);
    assert.match(figure, /Zo ziet een vraag eruit op het zaalscherm/);
    assert.match(figure, /zaalscherm-vraag\.jpg/);
    const details = html.match(/<details class="analysis-help">[\s\S]*?<\/details>/)?.[0];
    assert.ok(details);
    assert.match(details, /Wat ziet u in de top 3\?/);
    assert.doesNotMatch(details, /<img|<figure/);
    assert.ok(html.indexOf(figure) < html.indexOf(details));
    assert.match(html, /\.analysis-help\{[^}]*background:#edf8fc/);
});

test('publieke uitleg bevat geen verwijzingen naar de vervallen cijfercode', () => {
    for (const file of [...pages, 'projectie.html']) {
        assert.doesNotMatch(read(file), /cijfercode|drie cijfers|driecijfer|oude sessie|oude quiz|quizcode/i, file);
    }
    for (const file of ['assets/deelnemer.js','assets/projectie.js']) {
        assert.doesNotMatch(read(file), /(?:quizCodeInput|projectorCodeInput|joinForm|projectorJoinForm)/, file);
    }
    assert.doesNotMatch(read('assets/briefje.js'), /querySelector\("\.handout-code/);
    assert.match(read('projectie.html'), /Open het zaalscherm via de quizmaster/);
});

test('geschreven uitleg gebruikt actuele knoppen en verwijst naar het zaalblok', () => {
    for (const file of pages) {
        assert.doesNotMatch(read(file), /Deelnemersbriefjes afdrukken|Quizmasterlink bewaren|Sluit antwoorden|online deelnemers/i, file);
    }
    for (const file of ['index.html','handleiding.html','uitleg/oefenen.html','uitleg/organiseren.html']) {
        assert.ok(read(file).includes('In de zaal: ga hier verder'), file);
        assert.ok(read(file).includes('startbestand'), file);
    }
});

test('scan-alternatief en TinyURL worden consequent uitgelegd', () => {
    for (const file of ['handleiding.html','uitleg/oefenen.html','uitleg/organiseren.html','briefje.html','deelnemer.html']) {
        const html = read(file);
        assert.match(html, /adresbalk/, file);
        assert.match(html, /zoekvak (?:op|in) de Google-pagina/, file);
        assert.match(html, /www\./, file);
        assert.match(html, /https:\/\//, file);
    }
    assert.match(read('handleiding.html'), /Niet iedere camera herkent QR-codes automatisch/);
    assert.match(read('briefje.html'), /Met of zonder <strong>https:\/\/<\/strong> is allebei goed/);
});

test('handleidingen beschrijven antwoordletters, foute opties en definitieve afsluiting', () => {
    for (const file of ['handleiding.html','uitleg/oefenen.html','uitleg/organiseren.html']) {
        const html = read(file);
        assert.match(html, /met de letter/, file);
        assert.match(html, /foute (antwoordmogelijkheden|opties)/, file);
        assert.match(html, /Fijn dat u erbij was\./, file);
        assert.match(html, /Nieuwe ronde klaarzetten/, file);
    }
    assert.match(read('handleiding.html'), /ontvangen antwoorden voor die vraag/);
    assert.match(read('uitleg/oefenen.html'), /dit verhindert het oefenen niet/);
});

test('lokale verwijzingen en ankers in actieve uitleg bestaan', () => {
    for (const file of pages) {
        const html = read(file);
        for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
            if (/^(?:[a-z]+:|\/\/)/i.test(value)) continue;
            const [urlPath, fragment] = value.split('#');
            const target = urlPath.split('?')[0];
            const targetFile = target ? path.resolve(path.dirname(path.join(root,file)), decodeURIComponent(target)) : path.join(root,file);
            assert.ok(fs.existsSync(targetFile), `${file}: ${value}`);
            if (fragment && targetFile.endsWith('.html')) {
                assert.ok(fs.readFileSync(targetFile,'utf8').includes(`id="${fragment}"`), `${file}: anker ${value}`);
            }
        }
    }
});
