import * as THREE from "three";
import { PARTICLES } from "./particles.js";

// Force types with colors
const FORCES = {
    strong: { color: 0xff3333, label: "Strong Force" },
    electromagnetic: { color: 0x3388ff, label: "EM Force" },
    weak: { color: 0x33cc66, label: "Weak Force" },
};

// Build interaction lines as a group per force type
export function createInteractionLines(particleMeshes, positionFn) {
    const groups = {};

    for (const [forceKey, force] of Object.entries(FORCES)) {
        const group = new THREE.Group();
        group.visible = false; // hidden by default
        const material = new THREE.LineBasicMaterial({
            color: force.color,
            transparent: true,
            opacity: 0.15,
        });

        const pairs = getInteractingPairs(forceKey);

        for (const [i, j] of pairs) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                particleMeshes[i].position,
                particleMeshes[j].position,
            ]);
            const line = new THREE.Line(geometry, material);
            group.add(line);
        }

        groups[forceKey] = group;
    }

    return groups;
}

function getInteractingPairs(forceKey) {
    const pairs = [];

    if (forceKey === "strong") {
        // Quarks interact with antiquarks via strong force
        const quarkIndices = [];
        const antiQuarkIndices = [];
        PARTICLES.forEach((p, i) => {
            if (p.category === "quarks") quarkIndices.push(i);
            if (p.category === "antiQuarks") antiQuarkIndices.push(i);
        });
        for (const qi of quarkIndices) {
            for (const ai of antiQuarkIndices) {
                pairs.push([qi, ai]);
            }
        }
    }

    if (forceKey === "electromagnetic") {
        // All charged particles interact electromagnetically
        const chargedIndices = [];
        PARTICLES.forEach((p, i) => {
            if (Math.abs(p.charge) > 0) chargedIndices.push(i);
        });
        for (let a = 0; a < chargedIndices.length; a++) {
            for (let b = a + 1; b < chargedIndices.length; b++) {
                pairs.push([chargedIndices[a], chargedIndices[b]]);
            }
        }
    }

    if (forceKey === "weak") {
        // Leptons interact with quarks via weak force
        const leptonIndices = [];
        const quarkIndices = [];
        PARTICLES.forEach((p, i) => {
            if (["leptons", "antiLeptons", "neutrinos", "antiNeutrinos"].includes(p.category))
                leptonIndices.push(i);
            if (["quarks", "antiQuarks"].includes(p.category))
                quarkIndices.push(i);
        });
        for (const li of leptonIndices) {
            for (const qi of quarkIndices) {
                pairs.push([li, qi]);
            }
        }
    }

    return pairs;
}

export { FORCES };
