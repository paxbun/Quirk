/** Pointer drawing stays in backing-canvas coordinates, independent of CSS size or device scale. */
function bindImageDrawing(canvas, onBegin, onStroke, onCommit) {
    let activePointer;
    let lastPoint;
    const position = event => {
        let rect=canvas.getBoundingClientRect();
        return {x:(event.clientX-rect.left)*canvas.width/rect.width,
            y:(event.clientY-rect.top)*canvas.height/rect.height};
    };
    const finishStroke = () => {
        if (activePointer === undefined) { return; }
        let id=activePointer;
        activePointer=undefined;
        lastPoint=undefined;
        try { if (canvas.hasPointerCapture(id)) { canvas.releasePointerCapture(id); } } catch (_) {}
        onCommit();
    };
    const down = event => {
        if (event.button !== 0 || activePointer !== undefined) { return; }
        event.preventDefault();
        activePointer=event.pointerId;
        lastPoint=undefined;
        try { canvas.setPointerCapture(activePointer); } catch (_) {}
        onBegin();
        let point=position(event);
        onStroke(point,undefined);
        lastPoint=point;
    };
    const move = event => {
        if (event.pointerId !== activePointer) { return; }
        event.preventDefault();
        let events=event.getCoalescedEvents ? event.getCoalescedEvents() : [];
        if (events.length === 0) { events=[event]; }
        for (let next of events) {
            let point=position(next);
            onStroke(point,lastPoint);
            lastPoint=point;
        }
    };
    const end = event => {
        if (event.pointerId !== activePointer) { return; }
        if (event.cancelable) { event.preventDefault(); }
        finishStroke();
    };
    const preventTouchScroll = event => event.preventDefault();
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',end);
    canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('lostpointercapture',end);
    canvas.addEventListener('touchmove',preventTouchScroll,{passive:false});
    // The window fallback also handles a release outside when pointer capture was unavailable.
    window.addEventListener('pointerup',end);
    window.addEventListener('pointercancel',end);
    return {finishStroke,dispose:() => {
        finishStroke();
        canvas.removeEventListener('pointerdown',down);
        canvas.removeEventListener('pointermove',move);
        canvas.removeEventListener('pointerup',end);
        canvas.removeEventListener('pointercancel',end);
        canvas.removeEventListener('lostpointercapture',end);
        canvas.removeEventListener('touchmove',preventTouchScroll);
        window.removeEventListener('pointerup',end);
        window.removeEventListener('pointercancel',end);
    }};
}

/** Modal focus/scroll handling and gesture-safe backdrop dismissal. */
function bindImageEditorDialog(overlay, dialog, closeButton, onClose, beforeHide) {
    let visible=false;
    let backdropPointer;
    let priorFocus;
    let priorScroll;
    let priorBodyStyle;
    let priorHtmlOverflow;
    const requestClose = () => { if (visible) { onClose(); } };
    const down = event => { backdropPointer=visible && event.target === overlay ? event.pointerId : undefined; };
    const up = event => {
        let shouldClose=visible && backdropPointer === event.pointerId && event.target === overlay;
        backdropPointer=undefined;
        if (shouldClose) { event.preventDefault(); requestClose(); }
    };
    const cancel = () => { backdropPointer=undefined; };
    // Never let the opening gesture's release or a synthetic/ghost click dismiss the editor.
    const click = event => { if (event.target === overlay) { event.preventDefault(); event.stopPropagation(); } };
    const focusables = () => Array.from(dialog.querySelectorAll('button,input,select,textarea,summary,a[href],[tabindex]')).
        filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0);
    const keydown = event => {
        if (!visible) { return; }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); }
        if (event.key === 'Tab') {
            let elements=focusables();
            let first=elements[0] || dialog;
            let last=elements[elements.length-1] || dialog;
            if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                event.preventDefault(); first.focus();
            }
        }
    };
    const setVisible = show => {
        if (show === visible) { return; }
        visible=show;
        backdropPointer=undefined;
        if (show) {
            priorFocus=document.activeElement;
            priorScroll={x:window.scrollX,y:window.scrollY};
            priorBodyStyle={};
            for (let key of ['position','top','left','width','overflow']) { priorBodyStyle[key]=document.body.style[key]; }
            priorHtmlOverflow=document.documentElement.style.overflow;
            document.body.style.position='fixed';
            document.body.style.top=-priorScroll.y+'px';
            document.body.style.left=-priorScroll.x+'px';
            document.body.style.width='100%';
            document.body.style.overflow='hidden';
            document.documentElement.style.overflow='hidden';
            overlay.style.display='flex';
            overlay.setAttribute('aria-hidden','false');
            closeButton.focus({preventScroll:true});
        } else {
            beforeHide();
            overlay.style.display='none';
            overlay.setAttribute('aria-hidden','true');
            for (let key of Object.keys(priorBodyStyle)) { document.body.style[key]=priorBodyStyle[key]; }
            document.documentElement.style.overflow=priorHtmlOverflow;
            window.scrollTo(priorScroll.x,priorScroll.y);
            if (priorFocus && priorFocus.isConnected) { priorFocus.focus({preventScroll:true}); }
        }
    };
    overlay.addEventListener('pointerdown',down);
    overlay.addEventListener('pointerup',up);
    overlay.addEventListener('pointercancel',cancel);
    overlay.addEventListener('click',click);
    window.addEventListener('pointerup',cancel);
    window.addEventListener('pointercancel',cancel);
    closeButton.addEventListener('click',requestClose);
    document.addEventListener('keydown',keydown,true);
    return {setVisible,dispose:() => {
        setVisible(false);
        overlay.removeEventListener('pointerdown',down);
        overlay.removeEventListener('pointerup',up);
        overlay.removeEventListener('pointercancel',cancel);
        overlay.removeEventListener('click',click);
        window.removeEventListener('pointerup',cancel);
        window.removeEventListener('pointercancel',cancel);
        closeButton.removeEventListener('click',requestClose);
        document.removeEventListener('keydown',keydown,true);
    }};
}

export {bindImageDrawing, bindImageEditorDialog};
