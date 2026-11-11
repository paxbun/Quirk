import {Suite, assertThat} from '../TestUtil.js';
import {imageInput, ImageInput} from '../../src/image/ImageInput.js';
import {parseTimeFormula} from '../../src/gates/ParametrizedRotationGates.js';
import {Serializer, fromJsonText_CircuitDefinition} from '../../src/circuit/Serializer.js';
import {CircuitDefinition} from '../../src/circuit/CircuitDefinition.js';
import {simulate} from '../../src/ui/sim.js';

const suite = new Suite('ImageInput');

suite.test('safeFormulaPixelLookup', () => {
    let previous=imageInput.active ? imageInput.snapshot() : undefined;
    try {
        imageInput.setPixels(4,Array.from({length:16},(_,i)=>i/15));
        assertThat(parseTimeFormula('pi*m(2,2)',0,false)).isApproximatelyEqualTo(Math.PI*10/15);
        assertThat(parseTimeFormula('m(1+1,sqrt(4))',0,false)).isApproximatelyEqualTo(10/15);
        assertThat(parseTimeFormula('M(m(0,0),1)',0,false)).isApproximatelyEqualTo(1/15);
        assertThat(parseTimeFormula('m(0,0)+m(3,3)',0,false)).isEqualTo(1);
        for (let bad of ['m(-1,0)','m(4,0)','m(0,1.5)','m(0,0,1)','m(0,0','m(0,exp(1000))','m(window.alert(1),0)']) {
            assertThat(parseTimeFormula(bad,0,false)).isEqualTo(undefined);
        }
    } finally { imageInput.restore(previous); }
});

suite.test('canvasDownsampleNormalizesBrightness', () => {
    let canvas=document.createElement('canvas');
    canvas.width=canvas.height=280;
    let ctx=canvas.getContext('2d');
    ctx.fillStyle='black'; ctx.fillRect(0,0,280,280);
    ctx.fillStyle='white'; ctx.fillRect(0,0,140,280);
    let local=new ImageInput();
    local.setCanvas(canvas,4);
    assertThat(local.size).isEqualTo(4);
    assertThat(local.source28.length).isEqualTo(784);
    assertThat(local.getPixel(0,0)>.9).isEqualTo(true);
    assertThat(local.getPixel(0,3)<.1).isEqualTo(true);
    for (let value of local.pixels) {
        assertThat(Number.isFinite(value) && value >= 0 && value <= 1).isEqualTo(true);
    }
});

suite.test('canvasSourceMatchesTrainingBlockMeans', () => {
    let source=new Array(784).fill(0);
    source[0]=255;
    let local=new ImageInput();
    local.setSource28(source,4);
    assertThat(local.getPixel(0,0)).isApproximatelyEqualTo(1/49,1e-12);
    assertThat(local.getPixel(0,1)).isEqualTo(0);
    assertThat(local.source28).isEqualTo(source);
    local.setSource28(source,28);
    assertThat(local.getPixel(0,0)).isEqualTo(1);
    assertThat(local.getPixel(0,1)).isEqualTo(0);

    // At 3×3 the boundary is 9⅓ source pixels; the crossing pixel contributes only ⅓.
    let ramp=Array.from({length:784},(_,i)=>(i%28)*9);
    local.setSource28(ramp,3);
    assertThat(local.getPixel(0,0)).isApproximatelyEqualTo(351/((28/3)*255),1e-12);
    let mean=Array.from(local.pixels).reduce((a,b)=>a+b,0)/9;
    assertThat(mean).isApproximatelyEqualTo(13.5*9/255,1e-12);
});

suite.test('thinStrokesSurviveCanvasDownsampling', () => {
    let canvas=document.createElement('canvas');
    canvas.width=canvas.height=280;
    let ctx=canvas.getContext('2d');
    let local=new ImageInput();
    // Include offsets between the sparse sampling locations of a direct 280→4 resize.
    for (let x of [85, 125, 165, 195]) {
        ctx.fillStyle='black'; ctx.fillRect(0,0,280,280);
        ctx.fillStyle='white'; ctx.fillRect(x-10,55,20,170);
        local.setCanvas(canvas,4);
        assertThat(Array.from(local.pixels).some(v => v>.02)).isEqualTo(true);
        assertThat(Array.from(local.pixels).reduce((a,b)=>a+b,0)>.2).isEqualTo(true);
    }
});

suite.test('imageTravelsWithSerializedCircuit', () => {
    let previous=imageInput.active ? imageInput.snapshot() : undefined;
    try {
        let source=Array.from({length:784},(_,i)=>i%256);
        imageInput.setSource28(source,4);
        let expected=imageInput.getPixel(2,2);
        let circuit=Serializer.fromJson(CircuitDefinition,{cols:[['inputM'],[{id:'Ryft',arg:'pi*m(2,2)'}]]});
        let json=Serializer.toJson(circuit);
        assertThat(json.m.pixels[10]).isApproximatelyEqualTo(expected);
        assertThat(json.m.source28).isEqualTo(source);
        imageInput.setPixels(4,new Float64Array(16));
        fromJsonText_CircuitDefinition(JSON.stringify(json));
        assertThat(imageInput.getPixel(2,2)).isApproximatelyEqualTo(expected);
        assertThat(imageInput.source28).isEqualTo(source);
    } finally { imageInput.restore(previous); }
});

suite.testUsingWebGL('changingImageInvalidatesStableCircuitCache', () => {
    let previous=imageInput.active ? imageInput.snapshot() : undefined;
    try {
        imageInput.setPixels(4,new Float64Array(16));
        let circuit=Serializer.fromJson(CircuitDefinition,{cols:[[{id:'Ryft',arg:'pi*m(0,0)'}]]});
        let first=simulate(circuit).controlledWireProbabilityJustAfter(0,Infinity);
        imageInput.setPixels(4,[1,...new Array(15).fill(0)]);
        let second=simulate(circuit).controlledWireProbabilityJustAfter(0,Infinity);
        assertThat(first).isApproximatelyEqualTo(0,.00002);
        assertThat(second).isApproximatelyEqualTo(1,.00002);
    } finally { imageInput.restore(previous); }
});
