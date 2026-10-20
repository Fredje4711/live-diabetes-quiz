import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../docs/' + file, import.meta.url),'utf8');
const source = read('assets/quizmaster.js');
function initialState(search) {
    const storage = new Map([['dlq-activity-manager',JSON.stringify({id:'abcdef123456',key:'saved-key'})],['dlq-master-code','737']]);
    const before = [...storage];
    const context = {URLSearchParams,location:{search,hash:''},
        queryActivity:()=>new URLSearchParams(search).get('a') || '',
        validActivity:id=>/^[a-f0-9]{12}$/.test(id || ''),
        localStorage:{getItem:key=>storage.get(key),removeItem:key=>storage.delete(key)}};
    const code = `const identityKey='dlq-activity-manager', storageCodeKey='dlq-master-code';\n`
        + source.slice(source.indexOf('const startNewActivity'),source.indexOf('let preparation ='))
        + source.slice(source.indexOf('let savedIdentity'),source.indexOf('let activityState'))
        + source.slice(source.indexOf('const storedCode'),source.indexOf('const storedPreviousCode'))
        + '\n({activityId,managementKey,code,startNewActivity})';
    const result = vm.runInNewContext(code,context);
    assert.deepEqual([...storage],before,'opening a form must not erase the saved activity');
    return result;
}
test('new preparation ignores saved activity and old session without deleting them',()=>{
    const state=initialState('?nieuw=1');
    assert.equal(state.activityId,'');
    assert.equal(state.managementKey,'');
    assert.equal(state.code,'');
    assert.equal(state.startNewActivity,true);
});
test('normal opening still resumes saved activity; explicit activity takes priority',()=>{
    assert.equal(initialState('').activityId,'abcdef123456');
    assert.equal(initialState('?nieuw=1&a=123456abcdef').activityId,'123456abcdef');
    assert.equal(initialState('?nieuw=1&a=123456abcdef').startNewActivity,false);
});
test('landing has real new activity link, author, disclaimer and downloadable generic start file',()=>{
    const html=read('start.html');
    assert.match(html,/quizmaster\.html\?nieuw=1/);
    assert.match(html,/aria-describedby="newActivityReminder"/);
    assert.match(html,/Al briefjes voorbereid\?/);
    assert.match(html,/Maak alleen een nieuwe activiteit voor een nieuwe bijeenkomst/);
    assert.match(html,/Freddy Sleeuwaert/);
    assert.match(html,/mailto:fredje4711@gmail\.com/);
    assert.match(html,/vervangt geen persoonlijk medisch advies/);
    assert.match(html,/download="Live Diabetes Quiz - Start hier.html"/);
    assert.doesNotMatch(html,/<dialog|ontwerpvoorstel|Twee bestanden, elk hun doel|newPreview|>Voorstel</);
    assert.match(read('Live Diabetes Quiz - Start hier.html'),/url=https:\/\/fredje4711\.github\.io\/live-diabetes-quiz\/start\.html/);
    assert.match(read('start-voorstel.html'),/url=https:\/\/fredje4711\.github\.io\/live-diabetes-quiz\/start\.html/);
});
