import {Suite, assertThat, assertThrows} from '../TestUtil.js';
import {modelCircuit, predictPixels, predictStats, isModelCircuit, modelMetadata, samples} from '../../src/mnist/Model.js';
import {modelReference} from './ReferenceData.js';
import {quantumStructure} from './QuantumStructureData.js';
import {modelMetadata as digitMetadata, samples as digitSamples} from '../../src/mnist/DigitModelData.js';
import {modelMetadata as hybridMetadata, samples as hybridSamples} from '../../src/mnist/LetterModelData.js';
import {CircuitDefinition} from '../../src/circuit/CircuitDefinition.js';
import {CircuitStats} from '../../src/circuit/CircuitStats.js';
import {Serializer} from '../../src/circuit/Serializer.js';
import {imageInput} from '../../src/image/ImageInput.js';

let suite = new Suite('MNISTModel');
const quantum = modelMetadata.readout === 'joint-probabilities';

function checkReadout(actual, expected) {
    if (quantum) {
        assertThat(actual.probabilities).isApproximatelyEqualTo(expected.probabilities, 0.00002);
        assertThat(actual.logits).isEqualTo(undefined);
        assertThat(actual.expectations).isEqualTo(undefined);
    } else {
        assertThat(actual.expectations).isApproximatelyEqualTo(expected.expectations, 0.00002);
    }
}

suite.test('savedModelDimensions', () => {
    assertThat(modelMetadata.theta.length).isEqualTo(modelMetadata.architecture === 'row4' ? 4 : 5);
    if (quantum) {
        assertThat(modelMetadata.head).isEqualTo(undefined);
        assertThat(modelMetadata.readoutTheta.length).isEqualTo(2);
        assertThat(modelMetadata.readoutWires).isEqualTo([7,6]);
        assertThat(modelMetadata.quantumParameters).isEqualTo(84);
        assertThat(modelMetadata.classicalParameters).isEqualTo(0);
    } else {
        assertThat(modelMetadata.head.length).isEqualTo(modelMetadata.qubits+1);
        assertThat(modelMetadata.head[0].length).isEqualTo(modelMetadata.classLabels.length);
    }
    assertThat(modelMetadata.trainingGradient).isEqualTo('parameter-shift');
    assertThat(modelMetadata.trainingShots).isEqualTo(512);
    assertThat(samples.length).isEqualTo(modelMetadata.classLabels.length);
});

suite.test('editedCircuitDoesNotReuseSavedClassifier', () => {
    let original = modelCircuit();
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition, original))).isEqualTo(true);
    let edited = modelCircuit();
    edited.cols.find(col => col[0] && col[0].id === 'Ryft')[0].arg = 'pi*m(0,1)';
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition, edited))).isEqualTo(false);
    let learnedEdit = modelCircuit();
    learnedEdit.cols.find(col => col[0] && col[0].id === 'Rzft')[0].arg = '0.125';
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition, learnedEdit))).isEqualTo(false);
});

suite.test('finalChanceReadoutsKeepOlderSavedModelsCompatible', () => {
    let json = modelCircuit(undefined, hybridMetadata);
    let lastColumn = json.cols.pop();
    assertThat(lastColumn).isEqualTo(Array.from({length: hybridMetadata.qubits}, () => 'Chance'));
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition, json), hybridMetadata)).isEqualTo(true);
    // A real operation after the trained readout must still disable the head.
    json.cols.push(['X']);
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition, json), hybridMetadata)).isEqualTo(false);
});

suite.test('allModelRotationsAreNativeEditableFullPrecisionFormulas', () => {
    for (let pixels of [undefined, samples[0].pixels]) {
        let json = modelCircuit(pixels);
        assertThat(json.gates).isEqualTo(undefined);
        let circuit = Serializer.fromJson(CircuitDefinition, json);
        let rzStage = 0;
        let previousRotation;
        for (let col = 0; col < circuit.columns.length; col++) {
            let gates = circuit.columns[col].gates;
            let outputRotation = quantum && gates[0] === undefined;
            for (let wire = 0; wire < modelMetadata.qubits; wire++) {
                let gate = gates[wire];
                if (gate === undefined) { continue; }
                assertThat(gate.serializedId.startsWith('~')).isEqualTo(false);
                if (gate.serializedId === 'Rzft' || gate.serializedId === 'Ryft') {
                    assertThat(typeof gate.param).isEqualTo('string');
                    assertThat(typeof gate.onClickGateFunc).isEqualTo('function');
                    for (let offset = 1; offset < gate.width; offset++) {
                        let future = circuit.columns[col+offset];
                        assertThat(future === undefined ? undefined : future.gates[wire]).isEqualTo(undefined);
                    }
                }
                if (outputRotation && (gate.serializedId === 'Rzft' || gate.serializedId === 'Ryft')) {
                    assertThat(gate.param).isEqualTo(String(modelMetadata.readoutTheta[wire-6][gate.serializedId === 'Rzft' ? 0 : 1]));
                } else if (gate.serializedId === 'Rzft') {
                    assertThat(gate.param).isEqualTo(String(modelMetadata.theta[rzStage][wire][0]));
                }
                if (!outputRotation && gate.serializedId === 'Ryft' && previousRotation === 'Rzft') {
                    assertThat(gate.param).isEqualTo(String(modelMetadata.theta[rzStage-1][wire][1]));
                }
            }
            if (gates[0] && gates[0].serializedId === 'Rzft') { rzStage++; }
            if (gates[0] && (gates[0].serializedId === 'Rzft' || gates[0].serializedId === 'Ryft')) {
                previousRotation = gates[0].serializedId;
            }
        }
        assertThat(rzStage).isEqualTo(modelMetadata.theta.length);
    }
});

suite.test('nativeChangeEditsTheVisibleFullPrecisionParameter', () => {
    let json = modelCircuit();
    let column = json.cols.find(col => col[0] && col[0].id === 'Rzft');
    let circuit = Serializer.fromJson(CircuitDefinition, json);
    let gate = circuit.columns.find(col => col.gates[0] && col.gates[0].serializedId === 'Rzft').gates[0];
    let previousPrompt = window.prompt;
    let edited;
    try {
        window.prompt = (message, initialValue) => {
            assertThat(initialValue).isEqualTo(column[0].arg);
            return '0.12345678901234567';
        };
        edited = gate.onClickGateFunc(gate);
    } finally {
        window.prompt = previousPrompt;
    }
    assertThat(edited.param).isEqualTo('0.12345678901234567');
    column[0].arg = edited.param;
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition, json))).isEqualTo(false);
});

suite.testUsingWebGL('literalNativeCircuitMatchesPennyLaneFixtures', () => {
    let maxExpectationError = 0;
    let maxLogitError = 0;
    let maxProbabilityError = 0;
    let agreements = 0;
    let correct = 0;
    for (let i = 0; i < modelReference.length; i++) {
        let ref = modelReference[i];
        let actual = predictPixels(ref.pixels);
        if (quantum) {
            maxProbabilityError = Math.max(maxProbabilityError, ...actual.probabilities.map((p,k) => Math.abs(p-ref.probabilities[k])));
        } else {
            maxExpectationError = Math.max(maxExpectationError, ...actual.expectations.map((x,w) => Math.abs(x-ref.expectations[w])));
            maxLogitError = Math.max(maxLogitError, ...actual.logits.map((x,d) => Math.abs(x-ref.logits[d])));
            assertThat(actual.logits).isApproximatelyEqualTo(ref.logits, 0.0002);
        }
        agreements += actual.prediction === ref.prediction ? 1 : 0;
        correct += actual.prediction === ref.label ? 1 : 0;
        checkReadout(actual, ref);
        assertThat(actual.prediction).isEqualTo(ref.prediction);
        assertThat(actual.label).isEqualTo(modelMetadata.classLabels[ref.prediction]);
    }
    let report = {backend: 'native Quirk CircuitStats WebGL', fixtures: modelReference.length,
        dataset: modelMetadata.dataset, architecture: modelMetadata.architecture, qubits: modelMetadata.qubits,
        classLabels: modelMetadata.classLabels,
        checkpointSha256: modelMetadata.checkpointSha256,
        rotationImplementation: 'native editable Rzft/Ryft formula gates with full-precision numeric strings',
        readout: modelMetadata.readout || 'classical-head', readoutWires: modelMetadata.readoutWires,
        maxExpectationError: quantum ? undefined : maxExpectationError,
        maxLogitError: quantum ? undefined : maxLogitError,
        maxProbabilityError: quantum ? maxProbabilityError : undefined,
        predictionAgreements: agreements,
        correct, accuracy: correct/modelReference.length,
        pennylaneExactAccuracy: modelMetadata.exactTestAccuracy,
        originalFiniteShotAccuracy: modelMetadata.finiteShotTestAccuracy};
    window.mnistMigrationParityReport = report;
    console.log('MNIST_MIGRATION_PARITY ' + JSON.stringify(report));
    assertThat(correct/modelReference.length).isEqualTo(modelMetadata.exactTestAccuracy);
});

suite.testUsingWebGL('formulaMNativeCircuitMatchesPennyLaneSamples', () => {
    let previous = imageInput.active ? imageInput.snapshot() : undefined;
    try {
    for (let sample of samples) {
        imageInput.setPixels(4, sample.pixels);
        let circuit = Serializer.fromJson(CircuitDefinition, modelCircuit());
        assertThat(isModelCircuit(circuit)).isEqualTo(true);
        for (let col = 0; col < circuit.columns.length; col++) {
            for (let wire = 0; wire < modelMetadata.qubits; wire++) {
                assertThat(circuit.gateAtLocIsDisabledReason(col, wire)).isEqualTo(undefined);
            }
        }
        let result = predictStats(CircuitStats.fromCircuitAtTime(circuit, 0));
        checkReadout(result, sample);
        assertThat(result.prediction).isEqualTo(sample.prediction);
    }
    } finally {
        imageInput.restore(previous);
    }
});

suite.testUsingWebGL('originalDigitModelStillMatchesSavedSamples', () => {
    for (let sample of digitSamples) {
        let result = predictPixels(sample.pixels, digitMetadata);
        assertThat(result.expectations).isApproximatelyEqualTo(sample.expectations, 0.00002);
        assertThat(result.prediction).isEqualTo(sample.prediction);
        assertThat(result.label).isEqualTo(digitMetadata.classLabels[result.prediction]);
    }
});

suite.testUsingWebGL('olderHybridLetterModelStillMatchesSavedSamples', () => {
    for (let sample of hybridSamples) {
        let result = predictPixels(sample.pixels, hybridMetadata);
        assertThat(result.expectations).isApproximatelyEqualTo(sample.expectations, 0.00002);
        assertThat(result.prediction).isEqualTo(sample.prediction);
    }
});

suite.testUsingWebGL('nativeChance2BasisOrderAndEntangledProbabilities', () => {
    const metadata = {qubits:8, classLabels:['a','b','c','d'], readout:'joint-probabilities', readoutWires:[7,6]};
    const display = [1,1,1,1,1,1,'Chance2'];
    for (let outcome = 0; outcome < 4; outcome++) {
        let prep = [1,1,1,1,1,1, outcome&1 ? 'X' : 1, outcome&2 ? 'X' : 1];
        let circuit = Serializer.fromJson(CircuitDefinition, {cols:[prep,display]});
        let result = predictStats(CircuitStats.fromCircuitAtTime(circuit,0),metadata);
        assertThat(result.probabilities).isApproximatelyEqualTo([0,1,2,3].map(k => k === outcome ? 1 : 0));
        assertThat(result.label).isEqualTo(metadata.classLabels[outcome]);
        assertThat(result.logits).isEqualTo(undefined);
    }
    let bell = Serializer.fromJson(CircuitDefinition, {cols:[[1,1,1,1,1,1,'H'],[1,1,1,1,1,1,'•','X'],display]});
    let result = predictStats(CircuitStats.fromCircuitAtTime(bell,0),metadata);
    assertThat(result.probabilities).isApproximatelyEqualTo([0.5,0,0,0.5],0.00001);
    let withoutDisplay = Serializer.fromJson(CircuitDefinition, {cols:[[1,1,1,1,1,1,1,'H']]});
    assertThrows(() => predictStats(CircuitStats.fromCircuitAtTime(withoutDisplay,0),metadata));
});

suite.testUsingWebGL('quantumCircuitStructureMatchesPennyLaneBeforeFitting', () => {
    for (let fixture of quantumStructure.fixtures) {
        let result = predictPixels(fixture.pixels,quantumStructure.metadata);
        assertThat(result.probabilities).isApproximatelyEqualTo(fixture.probabilities,0.00002);
        assertThat(result.prediction).isEqualTo(fixture.prediction);
        assertThat(result.logits).isEqualTo(undefined);
    }
    let json = modelCircuit(undefined,quantumStructure.metadata);
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition,json),quantumStructure.metadata)).isEqualTo(true);
    json.cols.pop();
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition,json),quantumStructure.metadata)).isEqualTo(false);
});

suite.test('quantumReadoutRequiresItsActualChance2Display', () => {
    if (!quantum) { return; }
    let json = modelCircuit();
    assertThat(json.cols.pop()).isEqualTo([1,1,1,1,1,1,'Chance2']);
    assertThat(isModelCircuit(Serializer.fromJson(CircuitDefinition,json))).isEqualTo(false);
});

suite.testUsingWebGL('canvasSourceExamplesMatchOriginalFeaturesAndNativePrediction', () => {
    let previous = imageInput.active ? imageInput.snapshot() : undefined;
    try {
        for (let sample of samples) {
            imageInput.setSource28(sample.raw28, 4);
            assertThat(Array.from(imageInput.pixels)).isApproximatelyEqualTo(sample.pixels, 0.000000000001);
            let circuit = Serializer.fromJson(CircuitDefinition, modelCircuit());
            let result = predictStats(CircuitStats.fromCircuitAtTime(circuit, 0));
            checkReadout(result, sample);
            assertThat(result.prediction).isEqualTo(sample.prediction);
        }
    } finally {
        imageInput.restore(previous);
    }
});
