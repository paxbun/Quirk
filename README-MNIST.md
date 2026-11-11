# Quirk with drawable M input and a lowercase letter demo

This is a fork of [Craig Gidney's Quirk](https://github.com/Strilanc/Quirk), the simulator at algassert.com/quirk. The upstream Apache-2.0 license remains in `LICENSE`. The original algassert.com application is unchanged.

## Open it

Open **https://paxbun.github.io/Quirk/** in a WebGL-capable browser. No custom domain, installation, or local server is required. The checked-in `docs/index.html` is also a self-contained offline build; rebuilding produces `out/quirk.html`.

The HTML opens with an empty circuit and the native menu. Select **Quantum Neural Network** in **Example Circuits** to load the saved eight-qubit letter model. Select **Image Rotations** for a two-wire demonstration of `m(row,column)`, native RY/RZ formula gates, and Bloch spheres before and after each rotation.

The rotation example starts with four grayscale quadrants. On the first wire, `RY(pi*m(0,0))` is followed by `RZ(pi*m(0,3))`; the second wire uses `m(3,0)` and `m(3,3)`. Changing M updates the displayed states. Native exported Bloch vectors match the analytic rotations within 5.13e-8; menu and startup checks are recorded in `../integration/quirk-menu-examples-verification.json`.

The octagonal **M** gate shows a 64×64 preview. In the neural-network example, copies at both ends of the circuit occupy the first two rows and edit the same image, so the output-end copy can be used while viewing Chance. **M image** is in the existing **Inputs** toolbox group, below R=#. Its hover-only **Change** button uses exactly the same dimensions and hit testing as the native A/B/R inputs. Click or tap it to open the drawing editor. The plain white dialog contains a canvas, brush, eraser, Clear, examples, downsampling, and the reduced M preview. Close with **Close**, Escape, or a click/tap on the dimmed background. Image changes remain saved when the editor closes.

There is no added classifier toolbar, prediction panel, guidance overlay, or model-details panel. Results appear in the circuit's native Chance display. The model expects a 4×4 input; other sizes remain available for general formula-gate experiments. To restore the original trained circuit, select **Menu → Quantum Neural Network** again. Existing `#circuit=...` URL fragments still load their saved circuits; open the HTML without that fragment for an empty circuit.

The final demo uses **EMNIST ByClass's separate lowercase labels**, not the case-merged EMNIST Letters task. Uppercase inputs and letters outside the displayed set are outside its intended task; the classifier has no extra “unknown” output. The previous ten-digit demo is preserved in `out/quirk-digits.html`.

The selected classes are **a, b, c, d**. The active model uses **direct quantum readout**: one Chance display spans wires 6 and 7 and shows the four probabilities for `|q7 q6⟩`: **00=a, 01=b, 10=c, 11=d**. There is no learned classical output layer or softmax. The other six qubits participate in the computation. All 84 fitted parameters are quantum rotation angles.

Training reuses the larger split of 2,000 training images, 800 validation images, and 900 test images. These are the same partitions as the preceding hybrid a–d experiment, not another newly drawn test set. Validation selects the checkpoint before the test split is evaluated. Scores, confusion matrices, and checkpoint provenance are in `../results/demo_emnist_quantum_abcd/`. The previous hybrid a–d demo is archived at `out/quirk-hybrid-abcd.html`, and the a–e demo at `out/quirk-lowercase-abcde.html`.

Epoch 25 of 30 was selected: **81.625% validation**, **79.556% test accuracy with 512 shots (716/900)**, and **80.111% ideal test accuracy (721/900)**. Fitting took 14.5 minutes. This direct quantum readout is less accurate on this split than the preceding hybrid model (86.0% finite-shot, 87.22% ideal), but all learned inference now occurs inside the quantum circuit.

## Share the demo

`docs/index.html` is the standalone offline application, accompanied by the Apache-2.0 license, instructions, a model summary, and the short PennyLane architecture listing. The original experiment workspace additionally packages `release/quirk.html` and `release/quirk-lowercase-demo.zip` for offline distribution.

For a live URL, the fork's `docs/` folder contains an identical `index.html`, a `.nojekyll` marker, and attribution. In GitHub's repository settings, enable Pages using the intended branch and `/docs` folder. GitHub Pages serves the static files; no Python or Node backend is needed. A normal repository file view and a Release attachment are download/source surfaces, not live application hosting.

## M and formulas

`M` is a classical image input, not an ancilla or an amplitude-loading operation. Its toolbox marker leaves a qubit unchanged. In the existing formulaic rotation gates, use:

```text
pi*m(0,0)
pi*(m(1,2)-m(2,1))
```

`m(row,column)` uses zero-based integer indices and returns brightness from 0 (black) to 1 (white). Formulaic `Ry`/`Rz`/`Rx` gates use radians; the older exponent-style `X^f`, `Y^f`, and `Z^f` gates use their normal exponent units. Arithmetic expressions in the two indices are supported, but non-integer or out-of-range indices are rejected. The function is parsed without JavaScript `eval` or `new Function`.

Drawing uses the Canvas API. Smoothed `drawImage` progressively reduces the drawing to 28×28, preserving thin strokes. `getImageData` then supplies pixels for exact area-weighted averaging into M. At 4×4, these are the same 7×7 block means as the training pipeline. Bundled examples enter from their original 28×28 source, avoiding a display resize round trip. M retains floating-point brightness; only its visible preview is quantized to bytes. Image state, including M values and the 28×28 source, is saved with circuit JSON, links, and offline exports. Changing M invalidates Quirk's cached simulation.

The default brush is **4 pixels at the 28×28 input scale**, or 40 pixels on the 280×280 backing canvas, as requested. The slider adjusts its width. Earlier two-pixel brush estimates remain archived in `../integration/brush_calibration.json` and `../integration/letter_brush_calibration.json`.

The enlarged canvas fits the available viewport while its backing resolution stays 280×280. Pointer coordinates are scaled accordingly. Mouse, touch, and pen input share the same drawing path; the editor prevents page scrolling while drawing. The shared gate-button painter and circuit hit-testing code are unchanged from upstream Quirk.

## Model migration and accuracy

The letter model uses **eight qubits and 4×4 images**. At stage k, wires 0–3 receive row k and wires 4–7 receive column k through `pi*m(row,column)`. Each stage applies learned RZ/RY rotations and a CNOT chain within each four-qubit group. After four stages, corresponding row/column wires are coupled by four CNOTs, followed by another RZ/RY pair on every wire. Six CNOTs, `(0→6, 1→7, 2→6, 3→7, 4→6, 5→7)`, feed the other wires into the readout pair. A final learned RZ/RY pair on wires 6 and 7 completes the circuit. The full circuit has 150 gates, 84 quantum angles, and zero classical output weights.

**All rotations use Quirk's native formula gates** (`Rzft` and `Ryft`), with full-precision learned numbers visible and editable through the native Change action. No custom matrix gates are used. Columns are spaced for each formula's actual width. The final native `Chance2` display supplies the class probabilities; migration tests read its `CircuitStats.customStatsForSlot` data. No extra ancillas are added.

Fitting uses 512-shot measurements and parameter-shift gradients. The original 80-angle body is initialized from the preceding hybrid a–d checkpoint, its classical head is discarded, and all 84 quantum angles are optimized for direct four-outcome classification. A one-count pseudocount is used only in the training loss to avoid log(0); displayed inference probabilities are the raw quantum measurement probabilities. Canvas preprocessing, the optimizer, and counting/selecting measurement outcomes remain classical. Quirk uses ideal inference. Exact probabilities are used only for inference and numerical verification, never fitting.

Bundled 28×28 examples use the same area-averaged input values as training and migration tests. Hand drawings still differ in placement, style, and the browser's initial reduction to 28×28. A large quantum outcome probability is not a guarantee that an arbitrary drawing belongs to that letter.

`../integration/export_quantum_model.py --activate` regenerates the active model and reference fixtures. `../integration/quantum_architecture.py` is the minimal, executable PennyLane listing for presentations; parameter shapes are `theta=(5,8,2)` and `readout_theta=(2,2)`, with a 4×4 input in [0,1]. Its operations are independently compared against the training implementation. Earlier hybrid and digit exports remain available separately.

## Rebuild and verify

The ready-to-use HTML includes the simulator, weights, and examples. It needs no Python process for inference and no remote scripts or data. The optional local server only serves the file.

With Node and pnpm on PATH, run these commands from this `Quirk` directory:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/grunt-cli/bin/grunt build-src
node node_modules/grunt-cli/bin/grunt build-test-page
node ../integration/quirk-native-test.cjs
```

Paths beginning `../integration/` and `../results/` refer to the parent experiment workspace. They are not needed to run or rebuild the standalone fork: all active model weights are already in `src/mnist/`, and a fork-only checkout can use `pnpm run build` and the upstream `pnpm run test-chrome` workflow. The prepared `docs/` files need no build step for Pages hosting.

The original experiment's native test runner uses Google Chrome in an isolated temporary profile.

Two upstream Painter tests fail on font metrics and antialiasing with this browser; both fail identically in an unmodified upstream checkout. See `../integration/quirk-upstream-verification.json`. The test runner intentionally still returns a failure status for these baseline failures.

The current suite passed **801 of 803 tests**, including every quantum readout, formula-gate, M-editor, mouse, and simulated-touch test. The obsolete custom 44-pixel button test was removed when native button geometry was restored. Native Quirk agrees with PennyLane on **900/900 test predictions** on both shader backends; maximum probability error was 1.51e-7. See `../integration/quirk-output-m-native-verification.json` and `../integration/LETTER_MIGRATION.md`.

The simplified UI was checked for native M Change, the enlarged gate preview, four-pixel drawing, Clear, examples, 4×4→7×7→4×4 downsampling, and backdrop dismissal. The original Quirk toolbar is the only toolbar. Portrait 820×1180 layout bounds and landscape 1180×820 controls fit the viewport. The native Chance display continues to match the exported example probabilities. A physical iPad was not available; touch handlers pass the current unit suite. Current screenshots and observations are in `../integration/quirk-plain-ui-verification.json`.
