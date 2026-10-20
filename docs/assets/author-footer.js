export function footerVisible(audience, {waiting = false, finished = false, closed = false} = {}) {
    if (audience === 'participant') return waiting || finished || closed;
    if (audience === 'projector') return waiting || closed;
    return true;
}

if (typeof document !== 'undefined') {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./author-footer.css?v=1', import.meta.url).href;
    document.head.append(stylesheet);
    const footer = document.createElement('footer');
    footer.id = 'authorFooter';
    footer.hidden = true;
    footer.innerHTML = '<p>Auteur: <strong>Freddy Sleeuwaert</strong> · <a href="mailto:fredje4711@gmail.com">fredje4711@gmail.com</a></p><p>Deze quiz is bedoeld om kennis over diabetes te delen en vervangt geen persoonlijk medisch advies.</p>';
    document.body.append(footer);
    const audience = document.querySelector('#projectorWaiting') ? 'projector'
        : document.querySelector('#waitingParticipant') ? 'participant' : 'organizer';
    function shown(id) {
        const element = document.getElementById(id);
        return Boolean(element && !element.closest('.hide, [hidden]'));
    }
    function update() {
        const notice = document.querySelector('#activityNotice');
        footer.hidden = !footerVisible(audience, {
            waiting: shown(audience === 'projector' ? 'projectorWaiting' : 'waitingParticipant'),
            finished: shown('finishedParticipant'),
            closed: shown('activityNotice') && Boolean(notice?.classList.contains('is-closed') || notice?.classList.contains('is-farewell')),
        });
    }
    update();
    if (audience !== 'organizer') {
        new MutationObserver(update).observe(document.querySelector('main'), {
            subtree: true, attributes: true, attributeFilter: ['class', 'hidden'],
        });
    }
}
