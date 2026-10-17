export function renderWrongAnswers(entry) {
    const block = document.createElement('div');
    block.className = 'analysis-wrong';
    if (!entry.wrongAnswers?.length) return block;
    const label = document.createElement('p');
    label.textContent = 'Foute antwoorden — aantal keer gekozen:';
    block.append(label);
    const list = document.createElement('div');
    list.className = 'analysis-wrong__options';
    const maximum = Math.max(...entry.wrongAnswers.map(option => option.count));
    for (const option of entry.wrongAnswers) {
        const row = document.createElement('p');
        row.textContent = `${option.letter}. ${option.text} — ${option.count}×`;
        if (maximum > 0 && option.count === maximum) {
            row.className = 'analysis-wrong__most';
            row.textContent += ' (meest gekozen)';
        }
        list.append(row);
    }
    block.append(list);
    return block;
}
