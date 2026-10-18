import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../docs/', import.meta.url));
const pages = ['index.html', 'kennismaken.html', 'handleiding.html', 'uitleg/oefenen.html', 'uitleg/organiseren.html', 'briefje.html', 'deelnemer.html', 'quizmaster.html'];
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

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
