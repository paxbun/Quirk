"""Presentation listing: image(4,4), theta(5,8,2), readout_theta(2,2)."""
import pennylane as qml
from pennylane import numpy as np

dev = qml.device("lightning.qubit", wires=8)

def rotate(weights, wires):
    for angles, wire in zip(weights, wires):
        qml.RZ(angles[0], wires=wire)
        qml.RY(angles[1], wires=wire)

@qml.set_shots(512)
@qml.qnode(dev, interface="autograd", diff_method="parameter-shift")
def model(image, theta, readout_theta):
    for stage in range(4):
        for wire in range(8):
            r, c = (stage, wire) if wire < 4 else (wire - 4, stage)
            qml.RY(np.pi * image[r, c], wires=wire)
        rotate(theta[stage], range(8))
        for offset in (0, 4):
            for wire in range(offset, offset + 3):
                qml.CNOT(wires=[wire, wire + 1])
    for wire in range(4):
        qml.CNOT(wires=[wire, wire + 4])
    rotate(theta[4], range(8))
    for control, target in [(0, 6), (1, 7), (2, 6), (3, 7), (4, 6), (5, 7)]:
        qml.CNOT(wires=[control, target])
    rotate(readout_theta, [6, 7])
    return qml.probs(wires=[7, 6])  # 00=a, 01=b, 10=c, 11=d
