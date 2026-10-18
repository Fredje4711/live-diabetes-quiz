import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../docs/assets/firebase-service.js', import.meta.url),'utf8');
test('eindanalyse telt alle foute opties inclusief nul en sorteert meest gekozen eerst', () => {
    const start = source.indexOf('function analysisFor(');
    const fn = source.slice(start,source.indexOf('\nfunction ',start + 1));
    const context = {QUESTIONS:[{question:'Test',options:['Een','Twee','Drie','Vier'],correctOption:1}]};
    vm.createContext(context);
    vm.runInContext(fn,context);
    const result = context.analysisFor({questionOrder:[0]},[0,0,1,2].map(optionIndex => ({questionPosition:0,optionIndex})));
    const entry = result.difficultQuestions[0];
    assert.equal(entry.total,4);
    assert.equal(entry.incorrect,3);
    assert.equal(entry.percentage,75);
    assert.equal(entry.correctLetter,'B');
    assert.equal(entry.correctAnswer,'Twee');
    assert.deepEqual(JSON.parse(JSON.stringify(entry.wrongAnswers.map(a => [a.letter,a.count]))),[['A',2],['C',1],['D',0]]);
});

test('juiste antwoordletter volgt de antwoordoptie, ook bij andere vraagvolgorde', () => {
    const start = source.indexOf('function analysisFor(');
    const fn = source.slice(start,source.indexOf('\nfunction ',start + 1));
    const context = {QUESTIONS:[0,1,2,3].map(correctOption => ({question:'Test',options:['Een','Twee','Drie','Vier'],correctOption}))};
    vm.createContext(context); vm.runInContext(fn,context);
    const order = [3,1,0,2];
    const result = context.analysisFor({questionOrder:order},order.map((correctOption,questionPosition) => ({questionPosition,optionIndex:(correctOption+1)%4})));
    assert.deepEqual(Array.from(result.difficultQuestions, entry => entry.correctLetter),['D','B','A','C']);
    for (const file of ['projectie.js','quizmaster.js']) {
        const ui = fs.readFileSync(new URL('../docs/assets/'+file,import.meta.url),'utf8');
        assert.ok(ui.includes('Juiste antwoord: ${entry.correctLetter}. ${entry.correctAnswer}'));
    }
});
test('weergave behoudt antwoordtekst en markeert ook gedeelde hoogste aantallen', () => {
    const src = fs.readFileSync(new URL('../docs/assets/analysis-options.js',import.meta.url),'utf8').replace('export function','function');
    const makeNode = () => ({children:[],textContent:'',append(...nodes){this.children.push(...nodes);}});
    const context = {document:{createElement:makeNode}};
    vm.createContext(context); vm.runInContext(src,context);
    const node = context.renderWrongAnswers({wrongAnswers:[{letter:'A',text:'<test>',count:2},{letter:'C',text:'Ander',count:2},{letter:'D',text:'Nul',count:0}]});
    assert.equal(node.children[1].children[0].textContent,'A. <test> — 2× (meest gekozen)');
    assert.match(node.children[1].children[1].textContent,/meest gekozen/);
    assert.doesNotMatch(node.children[1].children[2].textContent,/meest gekozen/);
});
