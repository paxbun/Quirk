/** Native Quirk migration of finite-shot-trained PennyLane image classifiers. */
import {modelMetadata, samples} from './ModelData.js';
import {CircuitDefinition} from '../circuit/CircuitDefinition.js';
import {CircuitStats} from '../circuit/CircuitStats.js';
import {Serializer} from '../circuit/Serializer.js';
import {ParametrizedRotationGates} from '../gates/ParametrizedRotationGates.js';

/**
 * All rotations use editable native formula gates, with exact parameter strings.
 * Optional literal pixels are used only by the native-simulator verification helper.
 */
function modelCircuit(pixels=undefined, metadata=modelMetadata) {
    if (pixels !== undefined && (pixels.length !== 16 || Array.from(pixels).some(x => !Number.isFinite(x) || x < 0 || x > 1))) {
        throw new Error('The trained model requires sixteen pixel values in [0,1].');
    }
    if (!['row4', 'rowcol8', 'rowcol8_quantum'].includes(metadata.architecture)) {
        throw new Error('Unsupported saved image-model architecture.');
    }
    const qubits = metadata.qubits;
    const quantumReadout = metadata.readout === 'joint-probabilities';
    const rowcol = metadata.architecture === 'rowcol8' || metadata.architecture === 'rowcol8_quantum';
    if (quantumReadout && (metadata.architecture !== 'rowcol8_quantum' || metadata.head !== undefined ||
            JSON.stringify(metadata.readoutWires) !== '[7,6]' || metadata.classLabels.length !== 4)) {
        throw new Error('Quantum classification requires a headless rowcol8_quantum model with readout wires [7,6].');
    }
    // M uses the native two-column input-gate frame.
    let cols = pixels === undefined ? [['inputM'], []] : [];
    function formulaColumn(column) {
        let width = Math.max(...column.map(g => {
            if (g === 1) { return 1; }
            let nativeGate = g.id === 'Rzft'
                ? ParametrizedRotationGates.FormulaicRotationRz
                : ParametrizedRotationGates.FormulaicRotationRy;
            return nativeGate.withParam(g.arg).width;
        }));
        cols.push(column);
        for (let i = 1; i < width; i++) {
            cols.push([]);
        }
    }
    function learnedRotations(stage) {
        let rz = [];
        let ry = [];
        for (let wire = 0; wire < qubits; wire++) {
            for (let axis of ['Z', 'Y']) {
                let angle = metadata.theta[stage][wire][axis === 'Z' ? 0 : 1];
                (axis === 'Z' ? rz : ry).push({id: axis === 'Z' ? 'Rzft' : 'Ryft', arg: String(angle)});
            }
        }
        formulaColumn(rz);
        formulaColumn(ry);
    }
    function cnot(control, target) {
        let col = Array.from({length: qubits}, () => 1);
        col[control] = '•';
        col[target] = 'X';
        cols.push(col);
    }
    for (let row = 0; row < 4; row++) {
        let inputs = [];
        for (let wire = 0; wire < qubits; wire++) {
            let pixelRow = wire < 4 ? row : wire-4;
            let pixelColumn = wire < 4 ? wire : row;
            if (pixels === undefined) {
                inputs.push({id: 'Ryft', arg: `pi*m(${pixelRow},${pixelColumn})`});
            } else {
                inputs.push({id: 'Ryft', arg: String(Math.PI*pixels[4*pixelRow+pixelColumn])});
            }
        }
        formulaColumn(inputs);
        learnedRotations(row);
        for (let offset of rowcol ? [0, 4] : [0]) {
            for (let control = offset; control < offset+3; control++) {
                cnot(control, control+1);
            }
        }
    }
    if (rowcol) {
        for (let wire = 0; wire < 4; wire++) {
            cnot(wire, wire+4);
        }
        learnedRotations(4);
    }
    if (quantumReadout) {
        for (let [control, target] of [[0,6], [1,7], [2,6], [3,7], [4,6], [5,7]]) {
            cnot(control, target);
        }
        for (let axis = 0; axis < 2; axis++) {
            let rotations = [1, 1, 1, 1, 1, 1];
            for (let wire = 6; wire < 8; wire++) {
                rotations.push({id: axis === 0 ? 'Rzft' : 'Ryft', arg: String(metadata.readoutTheta[wire-6][axis])});
            }
            formulaColumn(rotations);
        }
        // A second editor on wires0–1 shares the same image, beside the output.
        // Its two-column frame ends with the following Chance display column.
        if (pixels === undefined) { cols[cols.length-1][0] = 'inputM'; }
        // Native Chance2 uses wire6 as its low bit: |q7 q6> maps 00,01,10,11 to a,b,c,d.
        cols.push([1, 1, 1, 1, 1, 1, 'Chance2']);
    } else {
        // The older hybrid models use <Z> = 1 - 2 P(1), then their saved classical head.
        cols.push(Array.from({length: qubits}, () => 'Chance'));
    }
    return {cols};
}

function classifyExpectations(expectations, metadata=modelMetadata) {
    if (metadata.readout === 'joint-probabilities') {
        throw new Error('The quantum-only model has no classical expectation-value head.');
    }
    const qubits = metadata.qubits;
    const labels = metadata.classLabels || metadata.digits.map(String);
    if (expectations.length !== qubits || expectations.some(x => !Number.isFinite(x))) {
        throw new Error(`The circuit did not produce ${qubits} valid Z expectations.`);
    }
    let logits = metadata.head[qubits].slice();
    for (let wire = 0; wire < qubits; wire++) {
        for (let index = 0; index < labels.length; index++) {
            logits[index] += expectations[wire]*metadata.head[wire][index];
        }
    }
    let max = Math.max(...logits);
    let probabilities = logits.map(x => Math.exp(x-max));
    let total = probabilities.reduce((a,b) => a+b, 0);
    probabilities = probabilities.map(x => x/total);
    let prediction = logits.indexOf(max);
    return {prediction, label: labels[prediction], digit: metadata.digits ? metadata.digits[prediction] : undefined,
        confidence: probabilities[prediction], probabilities, logits, expectations};
}

/** Read class probabilities directly from the actual native Chance2 display. */
function predictJointProbabilities(stats, metadata) {
    if (JSON.stringify(metadata.readoutWires) !== '[7,6]' || metadata.classLabels.length !== 4 || metadata.head !== undefined) {
        throw new Error('Unsupported quantum probability readout.');
    }
    let column = -1;
    for (let col = 0; col < stats.circuitDefinition.columns.length; col++) {
        let gate = stats.circuitDefinition.columns[col].gates[6];
        if (gate && gate.serializedId === 'Chance2') { column = col; }
    }
    if (column < 0) { throw new Error('The quantum classifier needs its native Chance2 display on wires6–7.'); }
    let data = stats.customStatsForSlot(column, 6);
    if (data === undefined || data.height() !== 4 || data.hasNaN()) {
        throw new Error('Native Chance2 probability data is unavailable.');
    }
    let probabilities = Array.from({length: 4}, (_, index) => data.rawBuffer()[2*index]);
    let total = probabilities.reduce((a,b) => a+b, 0);
    if (probabilities.some(p => !Number.isFinite(p) || p < 0 || p > 1) || Math.abs(total-1) > 0.00001) {
        throw new Error('Native Chance2 returned invalid probabilities.');
    }
    let prediction = probabilities.indexOf(Math.max(...probabilities));
    return {prediction, label: metadata.classLabels[prediction], confidence: probabilities[prediction],
        probabilities, readout: 'joint-probabilities', readoutWires: metadata.readoutWires.slice()};
}

/** Use the current native simulation, with direct quantum or legacy hybrid readout. */
function predictStats(stats, metadata=modelMetadata) {
    if (stats.circuitDefinition.numWires < metadata.qubits) {
        throw new Error(`The trained classifier needs ${metadata.qubits} qubits.`);
    }
    if (metadata.readout === 'joint-probabilities') {
        return predictJointProbabilities(stats, metadata);
    }
    let expectations = [];
    for (let wire = 0; wire < metadata.qubits; wire++) {
        expectations.push(1-2*stats.controlledWireProbabilityJustAfter(wire, Infinity));
    }
    return classifyExpectations(expectations, metadata);
}

/** Native Quirk WebGL execution, for parity tests and explicit fixed-input inference. */
function predictPixels(pixels, metadata=modelMetadata) {
    let circuit = Serializer.fromJson(CircuitDefinition, modelCircuit(pixels, metadata));
    let stats = CircuitStats.fromCircuitAtTime(circuit, 0);
    return predictStats(stats, metadata);
}

function circuitSignature(circuit, metadata) {
    if (circuit.numWires !== metadata.qubits || circuit.customInitialValues.size !== 0) {
        return 'not-model';
    }
    // Readout displays do not alter the saved classifier. Also recognize older
    // bookmarked model circuits that were saved before the displays were added.
    let modelColumns = circuit.columns.slice();
    while (metadata.readout !== 'joint-probabilities' && modelColumns.length && modelColumns[modelColumns.length-1].gates.every(
        g => g === undefined || g.serializedId === 'Chance')) {
        modelColumns.pop();
    }
    let columns = modelColumns.map(col => col.gates.map(g => {
        if (g === undefined) {
            return null;
        }
        if (g.param !== undefined) {
            return [g.serializedId, g.param];
        }
        let m = g.knownMatrixAt(0);
        return [g.serializedId, m === undefined ? null : Array.from(m.rawBuffer())];
    }));
    while (columns.length && columns[columns.length-1].every(g => g === null)) {
        columns.pop();
    }
    return JSON.stringify(columns);
}

let expectedSignatures = new Map();
function isModelCircuit(circuit, metadata=modelMetadata) {
    if (!expectedSignatures.has(metadata)) {
        expectedSignatures.set(metadata, circuitSignature(Serializer.fromJson(CircuitDefinition, modelCircuit(undefined, metadata)), metadata));
    }
    return circuitSignature(circuit, metadata) === expectedSignatures.get(metadata);
}

export {modelCircuit, predictPixels, predictStats, classifyExpectations, isModelCircuit, modelMetadata, samples};
