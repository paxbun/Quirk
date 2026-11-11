import {ParametrizedRotationGates} from '../gates/ParametrizedRotationGates.js';

/** Two independent qubits show how M pixels set native Y/Z rotation angles. */
function imageRotationCircuit() {
    const levels = [128, 64, 192, 255];
    const source28 = Array.from({length:784}, (_, i) =>
        levels[(Math.floor(i/28) >= 14 ? 2 : 0) + (i%28 >= 14 ? 1 : 0)]);
    const pixels = Array.from({length:16}, (_, i) =>
        levels[(Math.floor(i/4) >= 2 ? 2 : 0) + (i%4 >= 2 ? 1 : 0)]/255);
    const cols = [['inputM'], [], ['Bloch', 'Bloch']];
    for (let [id, gate, args] of [
        ['Ryft', ParametrizedRotationGates.FormulaicRotationRy, ['pi*m(0,0)', 'pi*m(3,0)']],
        ['Rzft', ParametrizedRotationGates.FormulaicRotationRz, ['pi*m(0,3)', 'pi*m(3,3)']]
    ]) {
        cols.push(args.map(arg => ({id, arg})));
        const width = Math.max(...args.map(arg => gate.withParam(arg).width));
        for (let i = 1; i < width; i++) { cols.push([]); }
        cols.push(['Bloch', 'Bloch']);
    }
    return {cols, m:{size:4, pixels, source28}};
}

export {imageRotationCircuit};
