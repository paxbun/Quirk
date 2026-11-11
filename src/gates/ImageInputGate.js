import {GateBuilder} from "../circuit/Gate.js";
import {GatePainting} from "../draw/GatePainting.js";
import {Rect} from '../math/Rect.js';
import {imageInput} from '../image/ImageInput.js';
import {openImageEditor} from '../image/ImageInputEditor.js';

let previewCanvas;
let previewRevision=-1;
function drawImagePreview(args) {
    if (!previewCanvas) { previewCanvas=document.createElement('canvas'); }
    if (previewRevision !== imageInput.revision) {
        let source=imageInput.source28 || Array.from(imageInput.pixels,value => 255*value);
        let size=imageInput.source28 ? 28 : imageInput.size;
        previewCanvas.width=previewCanvas.height=size;
        let ctx=previewCanvas.getContext('2d');
        let data=ctx.createImageData(size,size);
        source.forEach((value,i) => {
            data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=Math.round(value);
            data.data[i*4+3]=255;
        });
        ctx.putImageData(data,0,0);
        previewRevision=imageInput.revision;
    }
    let side=Math.min(64,args.rect.w-26,args.rect.h-26);
    let rect=new Rect(args.rect.center().x-side/2,args.rect.y+6,side,side);
    let ctx=args.painter.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(previewCanvas,rect.x,rect.y,rect.w,rect.h);
    ctx.restore();
    args.painter.strokeRect(rect,'#777');
    args.painter.print('M',args.rect.center().x,args.rect.bottom()-14,'center','middle','black','14px sans-serif');
}

const ImageInputGate = new GateBuilder().
    setSerializedIdAndSymbol('inputM').
    setSymbol('M').
    setTitle('Classical Image Input M').
    setBlurb('Choose Change to draw an image. Formula gates read m(row,column), using zero-based indices and values in [0,1].\nM is classical data; this marker does not prepare or change a qubit.').
    setWidth(2).
    setHeight(2).
    promiseHasNoNetEffectOnStateVector().
    markAsNotInterestedInControls().
    markAsReachingOtherWires().
    setDrawer(args => {
        GatePainting.paintLocationIndependentFrame(args, '#EEE', '#EEE');
        if (args.isInToolbox) { GatePainting.paintGateSymbol(args, 'M\nimage'); }
        else { drawImagePreview(args); }
        GatePainting.paintGateButton(args);
    }).
    setOnClickGateFunc(gate => {
        openImageEditor();
        return gate;
    }).gate;
export {ImageInputGate};
