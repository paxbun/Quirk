Quirk lowercase demo: a, b, c, d

Open index.html in a WebGL-capable browser. The application, learned model,
and example images are embedded; no Python, Node, server, or network is required
for inference. The HTML opens with an empty circuit and the native menu.
Choose Quantum Neural Network from Example Circuits to load the trained model.
Choose Image Rotations for a small M/Ry/Rz example with intermediate Bloch spheres.
Click or tap Change on the octagonal M gate to open the drawing editor.
Draw a supported lowercase letter, or choose a bundled example.
The default brush is 4 pixels at the 28x28 input scale. Brush width and
downsampling are adjustable. Close with
the Close button or by clicking/tapping the dimmed background.
M appears on the first two rows at both ends of the neural-network example; both copies
edit the same image. M image is in the existing Inputs toolbox group below R=#.
To start empty, open the HTML without an old #circuit= URL fragment.
Saved circuit URLs retain their own layout.

The model uses 8 qubits, 4x4 pixels, row/column encoding,
and direct two-qubit measurement probabilities. The readout bit order is
q7 q6: 00=a, 01=b, 10=c, 11=d. One native Chance display spans wires 6/7.
There is no learned classical output layer or softmax. The other six qubits
participate in the circuit. quantum_architecture.py is the short PennyLane
listing for presentations; it matches the trained circuit exactly.
Learned angles appear directly in native formula
rotation gates. It was fitted with 512
shots and parameter-shift gradients. The browser uses ideal inference.
Dataset splits: 2,000 training, 800
validation, and 900 test images.
Validation accuracy: 81.6%.
Held-out test: 79.6% finite-shot,
80.1% ideal (900 images).
These dataset scores do not guarantee accuracy for arbitrary hand drawings.

For GitHub Releases: attach this ZIP, or distribute the HTML with its license.
For a live URL: enable GitHub Pages for the fork's branch and /docs folder.
The prepared /docs/index.html is identical to this offline build.
A normal GitHub repository file view or Release attachment is not a live site.

This is a modified local fork of Craig Gidney's Quirk:
https://github.com/Strilanc/Quirk
Modifications add drawable M input, m(row,column) formula lookup, and a trained
lowercase classifier. The original Apache-2.0 license is included as LICENSE.
Dataset: NIST EMNIST ByClass, separate lowercase classes:
https://www.nist.gov/itl/products-and-services/emnist-dataset

Verification: native Quirk agrees with PennyLane on every saved test prediction.
Mouse interaction, tablet portrait/landscape layouts, and simulated touch
handlers were checked. A physical iPad was not available for device testing.
