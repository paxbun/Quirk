import {Suite, assertThat} from '../TestUtil.js';
import {bindImageDrawing, bindImageEditorDialog} from '../../src/ui/ImageInputInteractions.js';

const suite=new Suite('ImageInputInteractions');
const pointer=(type,id,pointerType='touch',extra={}) => new PointerEvent(type,Object.assign({
    pointerId:id,pointerType,button:0,buttons:type === 'pointerup' ? 0 : 1,
    clientX:290,clientY:90,bubbles:true,cancelable:true,isPrimary:true
},extra));

for (let kind of ['mouse','touch']) {
    suite.test('drawingScaledCoordinatesAndOutsideRelease_'+kind,() => {
        let canvas=document.createElement('canvas');
        canvas.width=canvas.height=280;
        canvas.getBoundingClientRect=() => ({left:10,top:20,width:560,height:280});
        let captured=new Set();
        canvas.setPointerCapture=id => captured.add(id);
        canvas.hasPointerCapture=id => captured.has(id);
        canvas.releasePointerCapture=id => captured.delete(id);
        let starts=0,commits=0,points=[];
        let binding=bindImageDrawing(canvas,()=>starts++,(p,previous)=>points.push({p,previous}),()=>commits++);
        try {
            let down=pointer('pointerdown',11,kind);
            canvas.dispatchEvent(down);
            assertThat(down.defaultPrevented).isEqualTo(true);
            assertThat(points[0].p).isEqualTo({x:140,y:70});
            canvas.dispatchEvent(pointer('pointerdown',22,'touch'));
            canvas.dispatchEvent(pointer('pointermove',22,'touch'));
            assertThat(starts).isEqualTo(1);
            canvas.dispatchEvent(pointer('pointermove',11,kind,{clientX:570,clientY:160}));
            assertThat(points[1]).isEqualTo({p:{x:280,y:140},previous:{x:140,y:70}});
            window.dispatchEvent(pointer('pointerup',11,kind,{clientX:900,clientY:900}));
            assertThat(commits).isEqualTo(1);
            assertThat(captured.size).isEqualTo(0);
            canvas.dispatchEvent(pointer('pointermove',11,kind));
            assertThat(points.length).isEqualTo(2);
        } finally { binding.dispose(); }
    });
}

suite.test('cancelAndCaptureLossCommitOnceAndAllowNextStroke',() => {
    let canvas=document.createElement('canvas');
    canvas.width=canvas.height=280;
    canvas.getBoundingClientRect=() => ({left:0,top:0,width:280,height:280});
    canvas.setPointerCapture=()=>{};
    canvas.hasPointerCapture=()=>false;
    let commits=0,starts=0;
    let binding=bindImageDrawing(canvas,()=>starts++,()=>{},()=>commits++);
    try {
        canvas.dispatchEvent(pointer('pointerdown',1));
        canvas.dispatchEvent(pointer('pointercancel',1));
        window.dispatchEvent(pointer('pointerup',1));
        assertThat(commits).isEqualTo(1);
        canvas.dispatchEvent(pointer('pointerdown',2,'mouse'));
        canvas.dispatchEvent(pointer('lostpointercapture',2,'mouse'));
        assertThat(commits).isEqualTo(2);
        canvas.dispatchEvent(pointer('pointerdown',3));
        binding.finishStroke();
        assertThat(commits).isEqualTo(3);
        assertThat(starts).isEqualTo(3);
    } finally { binding.dispose(); }
});

suite.test('modalBackdropGestureFocusAndClose',() => {
    let opener=document.createElement('button');
    let overlay=document.createElement('div');
    let dialog=document.createElement('section');
    let select=document.createElement('select');
    let close=document.createElement('button');
    overlay.style.display='none';
    dialog.appendChild(select); dialog.appendChild(close); overlay.appendChild(dialog);
    document.body.appendChild(opener); document.body.appendChild(overlay);
    opener.focus();
    let priorBodyPosition=document.body.style.position;
    let closes=0,finishes=0;
    let modal;
    modal=bindImageEditorDialog(overlay,dialog,close,()=>{closes++;modal.setVisible(false);},()=>finishes++);
    try {
        modal.setVisible(true);
        assertThat(document.activeElement===close).isEqualTo(true);
        assertThat(document.body.style.position).isEqualTo('fixed');
        close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
        assertThat(document.activeElement===select).isEqualTo(true);
        select.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
        assertThat(document.activeElement===close).isEqualTo(true);
        // Opener release and its compatibility click must not close the newly opened editor.
        overlay.dispatchEvent(pointer('pointerup',1));
        overlay.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
        assertThat(closes).isEqualTo(0);
        dialog.dispatchEvent(pointer('pointerdown',2));
        overlay.dispatchEvent(pointer('pointerup',2));
        overlay.dispatchEvent(pointer('pointerdown',3));
        overlay.dispatchEvent(pointer('pointercancel',3));
        overlay.dispatchEvent(pointer('pointerup',3));
        assertThat(closes).isEqualTo(0);
        for (let kind of ['mouse','touch']) {
            modal.setVisible(true);
            overlay.dispatchEvent(pointer('pointerdown',4,kind));
            overlay.dispatchEvent(pointer('pointerup',4,kind));
            assertThat(overlay.style.display).isEqualTo('none');
            assertThat(document.activeElement===opener).isEqualTo(true);
        }
        assertThat(closes).isEqualTo(2);
        modal.setVisible(true);
        close.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        assertThat(closes).isEqualTo(3);
        modal.setVisible(true);
        dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
        assertThat(closes).isEqualTo(4);
        assertThat(finishes).isEqualTo(4);
        assertThat(document.body.style.position).isEqualTo(priorBodyPosition);
    } finally {
        modal.dispose();
        opener.remove(); overlay.remove();
    }
});
