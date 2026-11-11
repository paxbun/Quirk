import {imageInput} from '../image/ImageInput.js';
import {samples} from '../mnist/ModelData.js';
import {closeImageEditor, obsImageEditorShowing} from '../image/ImageInputEditor.js';
import {bindImageDrawing, bindImageEditorDialog} from './ImageInputInteractions.js';

function initImageInput(commitImage) {
    const canvas=document.getElementById('image-input-canvas');
    const preview=document.getElementById('image-input-preview');
    const ctx=canvas.getContext('2d');
    const size=document.getElementById('image-input-size');
    const brush=document.getElementById('image-input-brush');
    const brushValue=document.getElementById('image-input-brush-value');
    const sampleSelect=document.getElementById('image-input-sample');
    let writing=false;

    function paintSource(source, sourceSize) {
        let temp=document.createElement('canvas');
        temp.width=temp.height=sourceSize;
        let tctx=temp.getContext('2d');
        let data=tctx.createImageData(sourceSize,sourceSize);
        source.forEach((value,i) => {
            data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=Math.round(value);
            data.data[i*4+3]=255;
        });
        tctx.putImageData(data,0,0);
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(temp,0,0,canvas.width,canvas.height);
    }

    function render() {
        if (sampleSelect.value !== '') {
            let sample=samples[Number(sampleSelect.value)];
            if (!sample || !imageInput.source28 || !sample.raw28.every((v,i) => v === imageInput.source28[i])) {
                sampleSelect.value='';
            }
        }
        size.value=String(imageInput.size);
        preview.width=preview.height=imageInput.size;
        let pctx=preview.getContext('2d');
        let data=pctx.createImageData(imageInput.size,imageInput.size);
        imageInput.pixels.forEach((value,i) => {
            data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=Math.round(value*255);
            data.data[i*4+3]=255;
        });
        pctx.putImageData(data,0,0);
        document.getElementById('image-input-preview-label').textContent=`${imageInput.size}×${imageInput.size} M input`;
        if (!writing) {
            if (imageInput.source28) { paintSource(imageInput.source28,28); }
            else { paintSource(Array.from(imageInput.pixels,value => value*255),imageInput.size); }
        }
    }

    function syncCanvas(commit, useCurrentSource=false) {
        writing=true;
        try {
            if (useCurrentSource && imageInput.source28 !== undefined) {
                imageInput.setSource28(imageInput.source28,Number(size.value));
            } else {
                imageInput.setCanvas(canvas,Number(size.value));
            }
        } finally { writing=false; }
        if (commit) { commitImage(); }
    }

    function stroke(point, previous) {
        ctx.strokeStyle=document.getElementById('image-input-erase').checked ? 'black' : 'white';
        ctx.fillStyle=ctx.strokeStyle;
        ctx.lineWidth=Number(brush.value)*canvas.width/28;
        ctx.lineCap='round';
        ctx.lineJoin='round';
        ctx.beginPath();
        if (previous) {
            ctx.moveTo(previous.x,previous.y);
            ctx.lineTo(point.x,point.y);
            ctx.stroke();
        } else {
            ctx.arc(point.x,point.y,ctx.lineWidth/2,0,2*Math.PI);
            ctx.fill();
        }
        syncCanvas(false);
    }

    const drawing=bindImageDrawing(canvas,() => { sampleSelect.value=''; },stroke,() => syncCanvas(true));
    const editor=bindImageEditorDialog(
        document.getElementById('image-input-editor'),
        document.getElementById('image-input-dialog'),
        document.getElementById('image-input-close'),
        closeImageEditor,
        drawing.finishStroke);
    obsImageEditorShowing.subscribe(editor.setVisible);
    document.getElementById('image-input-clear').addEventListener('click',() => {
        ctx.fillStyle='black';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        sampleSelect.value='';
        syncCanvas(true);
    });
    size.addEventListener('change',() => syncCanvas(true,true));
    brush.addEventListener('input',() => { brushValue.textContent=Number(brush.value).toFixed(1); });
    samples.forEach((sample,i) => {
        let option=document.createElement('option');
        option.value=String(i);
        option.textContent=String(sample.label);
        sampleSelect.appendChild(option);
    });
    sampleSelect.addEventListener('change',() => {
        if (sampleSelect.value === '') { return; }
        let sample=samples[Number(sampleSelect.value)];
        paintSource(sample.raw28,28);
        imageInput.setSource28(sample.raw28,Number(size.value));
        commitImage();
    });
    imageInput.subscribe(render);
    render();
}

export {initImageInput};
