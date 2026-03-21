import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { PARTICLES, CATEGORIES, PLOT_MODES } from "./particles.js";
import { createInteractionLines, updateInteractionLines, FORCES } from "./interactions.js";

// ── Scene setup ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(8, 5, 8);

// WebGL renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById("canvas-container").appendChild(renderer.domElement);

// CSS2D renderer (for labels)
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.pointerEvents = "none";
document.getElementById("canvas-container").appendChild(labelRenderer.domElement);

// Controls — OrbitControls never gets manually overridden
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(2, 0, 0);
controls.minDistance = 3;
controls.maxDistance = 30;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// ── World group — all visible objects go in here so we can rotate them ──
const world = new THREE.Group();
scene.add(world);

// ── Plot mode state ──
let currentMode = "spin";

// ── Axes ──
const AXIS_LENGTH = 6;
let zAxisLabelSprite = null;
let massAxisLabelSprite = null;
const logTickObjects = [];    // { line, sprite } for log-scale ticks
const linearTickObjects = []; // { line, sprite } for linear-scale ticks + kink markers

function createAxes() {
    const axesMaterial = new THREE.LineBasicMaterial({ color: 0x333344, transparent: true, opacity: 0.5, depthTest: false });

    const xGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.5, 0, 0),
        new THREE.Vector3(AXIS_LENGTH + 3, 0, 0),
    ]);
    world.add(new THREE.Line(xGeo, axesMaterial));

    const yGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -2.5, 0),
        new THREE.Vector3(0, 2.5, 0),
    ]);
    world.add(new THREE.Line(yGeo, axesMaterial));

    const zGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -3.5),
        new THREE.Vector3(0, 0, 3.5),
    ]);
    world.add(new THREE.Line(zGeo, axesMaterial));

    massAxisLabelSprite = addAxisLabel("Mass (MeV) log-scale", new THREE.Vector3(AXIS_LENGTH + 3.2, -0.6, 0));
    addAxisLabel("Charge (e)", new THREE.Vector3(-0.8, 2.8, 0));
    zAxisLabelSprite = addAxisLabel(PLOT_MODES[currentMode].axisLabel, new THREE.Vector3(-0.8, -0.6, 3.3));

    const tickMat = new THREE.LineBasicMaterial({ color: 0x444455, transparent: true, opacity: 0.6, depthTest: false });

    // ── Log-scale tick marks (powers of 10) ──
    const logTicks = [
        { logM: -2, text: "0.01" },
        { logM: -1, text: "0.1" },
        { logM: 0,  text: "1" },
        { logM: 1,  text: "10" },
        { logM: 2,  text: "100" },
        { logM: 3,  text: "1k" },
        { logM: 4,  text: "10k" },
        { logM: 5,  text: "100k" },
    ];
    for (const { logM, text } of logTicks) {
        const x = ((logM + 3) / 8) * AXIS_LENGTH;
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, -0.08, 0),
            new THREE.Vector3(x, 0.08, 0),
        ]);
        const line = new THREE.Line(tickGeo, tickMat);
        world.add(line);
        const sprite = addAxisLabel(text, new THREE.Vector3(x, -0.3, 0), 0.15);
        logTickObjects.push({ line, sprite });
    }

    // ── Linear-scale tick marks (uniform steps within each segment) ──
    // Generate ticks at every step, but only label select values to avoid clutter
    const labelledMasses = new Set([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1, 2, 3, 4, 5, 90, 110, 1000, 2000, 3000, 4000, 5000, 80000, 100000, 120000, 140000, 160000, 180000]);
    // Note: segment 4 has 10k MeV steps but labels only every 20k MeV (80k, 100k, ...)
    for (const seg of LINEAR_SEGMENTS) {
        const nSteps = Math.round((seg.massTo - seg.massFrom) / seg.step);
        for (let s = 0; s <= nSteps; s++) {
            const mass = Math.round((seg.massFrom + s * seg.step) * 1e6) / 1e6;
            const x = massToXLinear(mass);
            // Tick line at every step
            const tickGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, -0.08, 0),
                new THREE.Vector3(x, 0.08, 0),
            ]);
            const line = new THREE.Line(tickGeo, tickMat);
            line.visible = false;
            world.add(line);

            // Label only at selected values
            let sprite = null;
            if (labelledMasses.has(mass)) {
                let text;
                if (mass >= 1000) text = (mass / 1000) + "k";
                else text = String(mass);
                sprite = addAxisLabel(text, new THREE.Vector3(x, -0.3, 0), 0.15);
                sprite.visible = false;
            }
            linearTickObjects.push({ line, sprite });
        }
    }

    // Kink markers — zigzag between segment boundaries
    const kinkMat = new THREE.LineBasicMaterial({ color: 0x666677, transparent: true, opacity: 0.7, depthTest: false });
    for (let i = 0; i < LINEAR_SEGMENTS.length - 1; i++) {
        const xStart = LINEAR_SEGMENTS[i].xTo;
        const xEnd = LINEAR_SEGMENTS[i + 1].xFrom;
        const xMid = (xStart + xEnd) / 2;
        const s = 0.06; // zigzag amplitude
        const kinkGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xStart, 0, 0),
            new THREE.Vector3(xMid - s, -0.1, 0),
            new THREE.Vector3(xMid + s,  0.1, 0),
            new THREE.Vector3(xEnd, 0, 0),
        ]);
        const kinkLine = new THREE.Line(kinkGeo, kinkMat);
        kinkLine.visible = false;
        world.add(kinkLine);
        linearTickObjects.push({ line: kinkLine, sprite: null });
    }

    // 3D arrowhead cones at axis tips
    const arrowGeo = new THREE.ConeGeometry(0.06, 0.2, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x555566 });

    const xArrow = new THREE.Mesh(arrowGeo, arrowMat);
    xArrow.position.set(AXIS_LENGTH + 3, 0, 0);
    xArrow.rotation.z = -Math.PI / 2; // point along +x
    world.add(xArrow);

    const yArrow = new THREE.Mesh(arrowGeo, arrowMat);
    yArrow.position.set(0, 2.5, 0);
    // cone defaults to +y, no rotation needed
    world.add(yArrow);

    const zArrow = new THREE.Mesh(arrowGeo, arrowMat);
    zArrow.position.set(0, 0, 3.5);
    zArrow.rotation.x = Math.PI / 2; // point along +z
    world.add(zArrow);
}

function makeTextTexture(text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const font = "32px 'Segoe UI', system-ui, sans-serif";
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const pad = 12;
    canvas.width = Math.ceil(metrics.width) + pad * 2;
    canvas.height = 48;
    // Redraw after resize
    ctx.font = font;
    ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
    ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
    ctx.fill();
    ctx.fillStyle = "#aaaaaa";
    ctx.textBaseline = "middle";
    ctx.fillText(text, pad, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return { texture, aspect: canvas.width / canvas.height };
}

function addAxisLabel(text, position, height = 0.35) {
    const { texture, aspect } = makeTextTexture(text);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(height * aspect, height, 1);
    sprite.position.copy(position);
    world.add(sprite);
    return sprite;
}

// ── Grid ──
function createGrid() {
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x222233, transparent: true, opacity: 0.5, depthTest: false });

    for (let x = 0; x <= AXIS_LENGTH + 3; x += 1) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, -2, 0),
            new THREE.Vector3(x, 2, 0),
        ]);
        world.add(new THREE.Line(geo, gridMaterial));
    }
    for (let y = -2; y <= 2; y += 0.5) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, y, 0),
            new THREE.Vector3(AXIS_LENGTH + 3, y, 0),
        ]);
        world.add(new THREE.Line(geo, gridMaterial));
    }

    // Charge–Spin/Isospin plane (x=0, y–z plane)
    for (let y = -2; y <= 2; y += 0.5) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, y, -3),
            new THREE.Vector3(0, y, 3),
        ]);
        world.add(new THREE.Line(geo, gridMaterial));
    }
    for (let z = -3; z <= 3; z += 0.5) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -2, z),
            new THREE.Vector3(0, 2, z),
        ]);
        world.add(new THREE.Line(geo, gridMaterial));
    }
}

// ── Particles ──
function massToXLog(mass) {
    const logMass = Math.log10(mass);
    return ((logMass + 3) / 8) * AXIS_LENGTH;
}

// Piecewise linear scale — each segment has uniform step size,
// and all steps have the same visual width across segments.
// Kink gaps between segments indicate scale changes.
const LINEAR_SEGMENTS = [
    { massFrom: 0,     massTo: 0.6,    step: 0.025 },   // 24 steps
    { massFrom: 1,     massTo: 5,      step: 0.5 },     // 8 steps
    { massFrom: 90,    massTo: 110,    step: 5 },        // 4 steps
    { massFrom: 1000,  massTo: 5000,   step: 500 },      // 8 steps
    { massFrom: 80000, massTo: 180000, step: 5000 },     // 20 steps
];
const KINK_GAP_STEPS = 4; // each kink gap = 4 step widths visually

// Pre-compute x-ranges for each segment
const _segSteps = LINEAR_SEGMENTS.map(s => (s.massTo - s.massFrom) / s.step);
const _totalUnits = _segSteps.reduce((a, b) => a + b, 0) + KINK_GAP_STEPS * (LINEAR_SEGMENTS.length - 1);
const LINEAR_AXIS_LENGTH = AXIS_LENGTH + 2; // linear scale extent; grid extends one column beyond for breather
const _stepWidth = LINEAR_AXIS_LENGTH / _totalUnits;
{
    let cursor = 0;
    for (let i = 0; i < LINEAR_SEGMENTS.length; i++) {
        LINEAR_SEGMENTS[i].xFrom = cursor;
        LINEAR_SEGMENTS[i].xTo = cursor + _segSteps[i] * _stepWidth;
        cursor = LINEAR_SEGMENTS[i].xTo + KINK_GAP_STEPS * _stepWidth;
    }
}

function massToXLinear(mass) {
    // Find which segment this mass belongs to
    for (const seg of LINEAR_SEGMENTS) {
        if (mass >= seg.massFrom && mass <= seg.massTo) {
            const t = (mass - seg.massFrom) / (seg.massTo - seg.massFrom);
            return seg.xFrom + t * (seg.xTo - seg.xFrom);
        }
    }
    // Mass falls in a gap between segments — clamp to nearest boundary
    for (let i = 0; i < LINEAR_SEGMENTS.length - 1; i++) {
        if (mass > LINEAR_SEGMENTS[i].massTo && mass < LINEAR_SEGMENTS[i + 1].massFrom) {
            // Place at midpoint of the kink gap
            return (LINEAR_SEGMENTS[i].xTo + LINEAR_SEGMENTS[i + 1].xFrom) / 2;
        }
    }
    // Beyond all segments
    if (mass > LINEAR_SEGMENTS[LINEAR_SEGMENTS.length - 1].massTo) {
        return LINEAR_SEGMENTS[LINEAR_SEGMENTS.length - 1].xTo;
    }
    return 0;
}

function currentMassToX(mass) {
    return PLOT_MODES[currentMode].massScale === "linear" ? massToXLinear(mass) : massToXLog(mass);
}

const particleMeshes = [];
const particleData = [];
const particleLabels = []; // { css2d, div } for dynamic positioning
const sharedGeometry = new THREE.SphereGeometry(0.06, 16, 16);
const SPHERE_RADIUS = 0.06;

// Anti-particle highlight ring
const ANTI_CATEGORIES = new Set(["antiLeptons", "antiNeutrinos", "antiQuarks"]);
const RING_TUBE_RADIUS = SPHERE_RADIUS * 0.1;
const ringGeometry = new THREE.TorusGeometry(SPHERE_RADIUS * 1.25, RING_TUBE_RADIUS, 12, 48);
const antiRings = []; // collect rings for billboard update

// Cache bright ring materials per category color
const _brightColor = new THREE.Color();
const ringMaterialCache = new Map();
function getBrightRingMaterial(baseColor) {
    if (ringMaterialCache.has(baseColor)) return ringMaterialCache.get(baseColor);
    _brightColor.set(baseColor);
    const hsl = {};
    _brightColor.getHSL(hsl);
    _brightColor.setHSL(hsl.h, Math.min(1, hsl.s * 1.3), Math.min(1, hsl.l * 1.6));
    const mat = new THREE.MeshBasicMaterial({ color: _brightColor.clone() });
    ringMaterialCache.set(baseColor, mat);
    return mat;
}

function createParticles() {
    PARTICLES.forEach((p, i) => {
        const cat = CATEGORIES[p.category];
        const material = new THREE.MeshPhongMaterial({
            color: cat.color,
            shininess: 80,
        });
        const mesh = new THREE.Mesh(sharedGeometry, material);
        mesh.renderOrder = 1;
        mesh.userData = { index: i, category: p.category };
        positionParticle(mesh, p);

        // Add bright-hue ring around anti-particles
        if (ANTI_CATEGORIES.has(p.category)) {
            const ring = new THREE.Mesh(ringGeometry, getBrightRingMaterial(cat.color));
            mesh.add(ring);
            antiRings.push(ring);
        }

        world.add(mesh);
        particleMeshes.push(mesh);
        particleData.push(p);

        const div = document.createElement("div");
        div.className = "particle-label";
        div.innerHTML = p.name;
        const label = new CSS2DObject(div);
        label.position.set(0, 0.08, 0); // default: outside
        mesh.add(label);
        particleLabels.push({ css2d: label, div });
    });
}

// ── Particle positioning ──
function positionParticle(mesh, p) {
    const zProp = PLOT_MODES[currentMode].zProp;
    const zValue = p[zProp];
    mesh.position.set(currentMassToX(p.mass), p.charge, zValue);
}

// ── Overlap resolution ──
// Leader lines from shrunk particles to spread-out labels
const leaderLines = []; // { line, meshIdx, offset }
const multiColorSpheres = []; // { mesh, hiddenIndices[] } for mixed-color overlap groups
const overlapRings = []; // { ring, hiddenRingIndices[] } for half-ring on anti-particle overlap groups

function posKey(p) {
    const x = currentMassToX(p.mass).toFixed(4);
    const y = p.charge.toFixed(4);
    const zProp = PLOT_MODES[currentMode].zProp;
    const z = p[zProp].toFixed(4);
    return `${x},${y},${z}`;
}

function resolveOverlaps() {
    // Remove old leader lines
    for (const { line } of leaderLines) {
        world.remove(line);
        line.geometry.dispose();
    }
    leaderLines.length = 0;

    // Remove old multi-color spheres and restore hidden meshes
    for (const { mesh, hiddenIndices } of multiColorSpheres) {
        world.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        for (const idx of hiddenIndices) {
            particleMeshes[idx].material.visible = true;
            // Restore anti-particle rings
            for (const child of particleMeshes[idx].children) {
                if (child.geometry === ringGeometry) child.visible = true;
            }
        }
    }
    multiColorSpheres.length = 0;

    // Remove old overlap half-rings and restore hidden individual rings
    for (const { ring, hiddenRingIndices } of overlapRings) {
        world.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
        for (const idx of hiddenRingIndices) {
            for (const child of particleMeshes[idx].children) {
                if (child.geometry === ringGeometry) child.visible = true;
            }
        }
    }
    overlapRings.length = 0;

    // Reset all meshes to default scale and labels to default state
    overlapScales.clear();
    for (let i = 0; i < particleMeshes.length; i++) {
        particleMeshes[i].scale.setScalar(1);
        particleLabels[i].leaderOffset = null;
        // Reset pointer events on labels
        particleLabels[i].div.classList.remove("overlap-interactive");
        particleLabels[i].div.onmouseenter = null;
        particleLabels[i].div.onmouseleave = null;
        particleLabels[i].div.onmousemove = null;
    }

    // Group particles by position
    const groups = new Map();
    for (let i = 0; i < particleData.length; i++) {
        const key = posKey(particleData[i]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
    }

    // Collect overlap groups with their positions
    const overlapGroups = [];
    for (const indices of groups.values()) {
        if (indices.length <= 1) continue;
        const pos = particleMeshes[indices[0]].position.clone();
        overlapGroups.push({ indices, pos });
    }

    for (const group of overlapGroups) {
        const { indices, pos } = group;

        // Shrink spheres proportional to group size
        const shrink = 1; // point-like particles — no further shrinking needed
        for (const idx of indices) {
            particleMeshes[idx].scale.setScalar(shrink);
            overlapScales.set(idx, shrink);
        }

        // Identify what kind of group this is by checking member categories
        const cats = new Set(indices.map(i => particleData[i].category));
        const hasNeutrinos = cats.has("neutrinos");
        const hasAntiNeutrinos = cats.has("antiNeutrinos");
        const hasBosons = cats.has("gaugeBosons") || cats.has("tensorBosons");

        // Hardcoded fan configurations per group type and mode
        // plane: "yz" = charge-spin/isospin, "xy" = mass-charge
        // baseAngle: central direction of fan (radians)
        //   For yz plane: 0 = +z direction, π/2 = +y, -π/2 = -y
        //   For xy plane: 0 = +x direction, π/2 = +y
        let plane, baseAngle, fanSpread;

        if (PLOT_MODES[currentMode].zProp === "isospin") {
            if (hasNeutrinos && !hasAntiNeutrinos) {
                // Neutrinos at isospin=+0.5: fan in y-z plane, away from origin (+z)
                plane = "yz";
                baseAngle = 0; // +z direction
                fanSpread = Math.PI * 0.8;
            } else if (hasAntiNeutrinos && !hasNeutrinos) {
                // Anti-neutrinos at isospin=-0.5: fan in y-z plane, away from origin (-z)
                plane = "yz";
                baseAngle = Math.PI; // -z direction
                fanSpread = Math.PI * 0.8;
            } else if (hasBosons) {
                // γ, g, G at isospin=0: fan in x-y plane, equal 120° spacing
                plane = "xy";
                baseAngle = -Math.PI / 2; // start pointing down
                fanSpread = (2 * Math.PI) * (indices.length - 1) / indices.length;
            } else {
                // Fallback for any other group
                plane = "xy";
                baseAngle = -Math.PI / 2;
                fanSpread = Math.PI * 0.8;
            }
        } else {
            // Spin mode
            if (hasNeutrinos && hasAntiNeutrinos) {
                // 6 particles as hexagon in x-y (mass-charge) plane
                // Neutrinos above, anti-neutrinos below, each opposite its counterpart
                plane = "xy";
                baseAngle = 0;
                fanSpread = 0; // per-particle angles used instead
            } else if (hasBosons) {
                // γ and g at spin=1: fan in x-z (mass-spin) plane, away from origin (+z)
                plane = "xz";
                baseAngle = Math.PI / 2; // +z direction (away from origin since spin=1)
                fanSpread = Math.PI * 0.5;
            } else {
                // Generic fallback
                plane = "xy";
                baseAngle = -Math.PI / 2;
                fanSpread = Math.PI * 0.8;
            }
        }

        const spreadRadius = 0.25 + indices.length * 0.06;
        const angleStep = indices.length > 1 ? fanSpread / (indices.length - 1) : 0;
        const startAngle = baseAngle - fanSpread / 2;

        // Per-particle angle overrides for hexagon layout (spin mode neutrinos)
        const perParticleAngles = new Map();
        if (PLOT_MODES[currentMode].zProp === "spin" && hasNeutrinos && hasAntiNeutrinos) {
            const neutrinos = indices.filter(i => particleData[i].category === "neutrinos");
            const antiNeutrinos = indices.filter(i => particleData[i].category === "antiNeutrinos");
            // Upper half: 30°, 90°, 150° — one per flavor (e, μ, τ)
            const hexAngles = [Math.PI / 6, Math.PI / 2, 5 * Math.PI / 6];
            for (let k = 0; k < neutrinos.length; k++) {
                perParticleAngles.set(neutrinos[k], hexAngles[k]);
                // Anti-particle on opposite vertex
                perParticleAngles.set(antiNeutrinos[k], hexAngles[k] - Math.PI);
            }
        }

        // Track each particle's fan angle and color for multi-color sphere
        const sectorInfo = []; // { angle, color }

        for (let j = 0; j < indices.length; j++) {
            const idx = indices[j];
            const angle = perParticleAngles.has(idx)
                ? perParticleAngles.get(idx)
                : (indices.length === 1 ? baseAngle : startAngle + angleStep * j);
            const scale = 1 / shrink;
            const cat = CATEGORIES[particleData[idx].category];

            sectorInfo.push({ angle, color: cat.color });

            let offx, offy, offz;
            if (plane === "yz") {
                offx = 0;
                offy = Math.sin(angle) * spreadRadius * scale;
                offz = Math.cos(angle) * spreadRadius * scale;
            } else if (plane === "xz") {
                offx = Math.cos(angle) * spreadRadius * scale;
                offy = 0;
                offz = Math.sin(angle) * spreadRadius * scale;
            } else {
                offx = Math.cos(angle) * spreadRadius * scale;
                offy = Math.sin(angle) * spreadRadius * scale;
                offz = 0;
            }
            const offset = new THREE.Vector3(offx, offy, offz);

            particleLabels[idx].leaderOffset = offset;

            // Make label interactive for overlapping particles
            const labelDiv = particleLabels[idx].div;
            const mesh = particleMeshes[idx];
            labelDiv.classList.add("overlap-interactive");
            labelDiv.onmouseenter = (e) => {
                resetHover();
                showTooltip(idx, e.clientX, e.clientY);
            };
            labelDiv.onmousemove = (e) => {
                showTooltip(idx, e.clientX, e.clientY);
            };
            labelDiv.onmouseleave = () => {
                tooltip.style.display = "none";
            };

            // Dashed leader line in world group space
            const lineMat = new THREE.LineDashedMaterial({
                color: cat.color,
                dashSize: 0.04,
                gapSize: 0.03,
                transparent: true,
                opacity: 0.5,
                depthTest: false,
            });
            const meshPos = particleMeshes[idx].position;
            let wox, woy, woz;
            if (plane === "yz") {
                wox = 0;
                woy = Math.sin(angle) * spreadRadius;
                woz = Math.cos(angle) * spreadRadius;
            } else if (plane === "xz") {
                wox = Math.cos(angle) * spreadRadius;
                woy = 0;
                woz = Math.sin(angle) * spreadRadius;
            } else {
                wox = Math.cos(angle) * spreadRadius;
                woy = Math.sin(angle) * spreadRadius;
                woz = 0;
            }
            const worldOffset = new THREE.Vector3(wox, woy, woz);
            const geo = new THREE.BufferGeometry().setFromPoints([
                meshPos.clone(),
                meshPos.clone().add(worldOffset),
            ]);
            const line = new THREE.Line(geo, lineMat);
            line.computeLineDistances();
            world.add(line);
            leaderLines.push({ line, meshIdx: idx });
        }

        // Create multi-colored sphere if particles in group have different colors
        const uniqueColors = new Set(sectorInfo.map(s => s.color));
        if (uniqueColors.size > 1) {
            // Build a vertex-colored sphere with sectors pointing toward each particle's fan angle
            const mcGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 24);
            const posAttr = mcGeo.getAttribute("position");
            const colorArray = new Float32Array(posAttr.count * 3);

            // Sort sectors by angle for boundary detection
            const sorted = sectorInfo.map((s, i) => ({ ...s, idx: i })).sort((a, b) => a.angle - b.angle);

            for (let v = 0; v < posAttr.count; v++) {
                const vx = posAttr.getX(v);
                const vy = posAttr.getY(v);
                const vz = posAttr.getZ(v);

                // Compute vertex angle in the fan plane
                let vertexAngle;
                if (plane === "yz") {
                    vertexAngle = Math.atan2(vy, vz);
                } else if (plane === "xz") {
                    vertexAngle = Math.atan2(vz, vx);
                } else {
                    vertexAngle = Math.atan2(vy, vx);
                }

                // Find which sector this vertex belongs to (nearest fan angle)
                let bestDist = Infinity;
                let bestColor = sectorInfo[0].color;
                for (const sector of sectorInfo) {
                    let diff = vertexAngle - sector.angle;
                    // Normalize to [-π, π]
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    const dist = Math.abs(diff);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestColor = sector.color;
                    }
                }

                const c = new THREE.Color(bestColor);
                colorArray[v * 3] = c.r;
                colorArray[v * 3 + 1] = c.g;
                colorArray[v * 3 + 2] = c.b;
            }

            mcGeo.setAttribute("color", new THREE.Float32BufferAttribute(colorArray, 3));
            const mcMat = new THREE.MeshPhongMaterial({
                vertexColors: true,
                shininess: 80,
            });
            const mcMesh = new THREE.Mesh(mcGeo, mcMat);
            mcMesh.position.copy(pos);
            mcMesh.scale.setScalar(shrink);
            mcMesh.renderOrder = 1;
            world.add(mcMesh);

            // Make individual meshes invisible (but keep children like labels visible)
            const hiddenIndices = [];
            for (const idx of indices) {
                particleMeshes[idx].material.visible = false;
                // Hide anti-particle rings too — the sphere coloring replaces them
                for (const child of particleMeshes[idx].children) {
                    if (child.geometry === ringGeometry) child.visible = false;
                }
                hiddenIndices.push(idx);
            }
            multiColorSpheres.push({ mesh: mcMesh, hiddenIndices });
        }

        // Add half-ring for overlap groups mixing particles and anti-particles
        const antiInGroup = indices.filter(i => ANTI_CATEGORIES.has(particleData[i].category));
        const nonAntiInGroup = indices.filter(i => !ANTI_CATEGORIES.has(particleData[i].category));
        if (antiInGroup.length > 0 && nonAntiInGroup.length > 0) {
            // Hide individual anti-particle rings — replaced by shared half-ring
            for (const idx of antiInGroup) {
                for (const child of particleMeshes[idx].children) {
                    if (child.geometry === ringGeometry) child.visible = false;
                }
            }

            // Compute the angular range of anti-particle sectors to determine arc coverage
            const antiAnglesInGroup = antiInGroup.map(idx => {
                return perParticleAngles.has(idx)
                    ? perParticleAngles.get(idx)
                    : sectorInfo[indices.indexOf(idx)]?.angle ?? 0;
            });
            // Arc spans from min to max anti-particle angle
            const minAngle = Math.min(...antiAnglesInGroup);
            const maxAngle = Math.max(...antiAnglesInGroup);
            // Add padding so arc extends slightly beyond outermost anti-particles
            const arcLength = (maxAngle - minAngle) + Math.PI / 3;
            const arcCenter = (minAngle + maxAngle) / 2;

            const halfRingGeo = new THREE.TorusGeometry(SPHERE_RADIUS * 1.25, RING_TUBE_RADIUS, 12, 48, arcLength);
            const baseColor = CATEGORIES[particleData[antiInGroup[0]].category].color;
            const halfRing = new THREE.Mesh(halfRingGeo, getBrightRingMaterial(baseColor));
            halfRing.position.copy(pos);
            halfRing.scale.setScalar(shrink);
            halfRing.renderOrder = 1;
            // Store arc geometry info for billboarding
            halfRing.userData.arcCenter = arcCenter;
            halfRing.userData.arcLength = arcLength;
            halfRing.userData.plane = plane;
            world.add(halfRing);
            overlapRings.push({ ring: halfRing, hiddenRingIndices: antiInGroup });
        }
    }
}

function updateSpriteTexture(sprite, text, height = 0.35) {
    const { texture, aspect } = makeTextTexture(text);
    sprite.material.map.dispose();
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
    sprite.scale.set(height * aspect, height, 1);
}

function switchMode(mode) {
    currentMode = mode;
    // Update particle positions
    particleMeshes.forEach((mesh, i) => {
        positionParticle(mesh, particleData[i]);
    });
    // Re-resolve overlaps for new mode
    resolveOverlaps();
    // Update interaction line endpoints to match new positions
    updateInteractionLines(interactionGroups);
    // Update z-axis label
    if (zAxisLabelSprite) {
        updateSpriteTexture(zAxisLabelSprite, PLOT_MODES[mode].axisLabel);
    }
    // Update mass axis label and tick visibility
    const isLinear = PLOT_MODES[mode].massScale === "linear";
    if (massAxisLabelSprite) {
        updateSpriteTexture(massAxisLabelSprite, isLinear ? "Mass (MeV) linear" : "Mass (MeV) log-scale");
    }
    for (const { line, sprite } of logTickObjects) {
        line.visible = !isLinear;
        if (sprite) sprite.visible = !isLinear;
    }
    for (const { line, sprite } of linearTickObjects) {
        line.visible = isLinear;
        if (sprite) sprite.visible = isLinear;
    }
    // Update mode switcher UI
    document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
}

// ── Interaction lines ──
let interactionGroups = {};

function setupInteractions() {
    interactionGroups = createInteractionLines(particleMeshes, currentMassToX);
    for (const group of Object.values(interactionGroups)) {
        world.add(group);
    }
}

// ── Hover / Tooltip ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById("tooltip");
let hoveredMesh = null;
let hoveredIdx = -1;
const overlapScales = new Map(); // idx → shrunk scale for overlapping particles

function showTooltip(idx, clientX, clientY) {
    const p = particleData[idx];
    tooltip.style.display = "block";
    tooltip.style.left = clientX + 16 + "px";
    tooltip.style.top = clientY - 10 + "px";
    tooltip.innerHTML = `
        <div class="tooltip-name">${p.name}</div>
        <div class="tooltip-fullname">${p.fullName}</div>
        <div class="tooltip-row">Category: <span>${CATEGORIES[p.category].label}</span></div>
        <div class="tooltip-row">Mass: <span>${formatMass(p.mass)}</span></div>
        <div class="tooltip-row">Charge: <span>${formatCharge(p.charge)}e</span></div>
        <div class="tooltip-row">Spin: <span>${formatCharge(p.spin)}</span></div>
        <div class="tooltip-row">Isospin I₃: <span>${formatCharge(p.isospin)}</span></div>
    `;
}

function onMouseMove(event) {
    // If hovering an overlap-interactive label, let its own handlers manage tooltip
    if (event.target && event.target.closest && event.target.closest(".overlap-interactive")) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    // Exclude overlap particles — their labels handle hover instead
    const nonOverlapMeshes = particleMeshes.filter((_, i) => !overlapScales.has(i));
    const intersects = raycaster.intersectObjects(nonOverlapMeshes);

    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const idx = mesh.userData.index;

        if (hoveredMesh !== mesh) {
            resetHover();
            hoveredMesh = mesh;
            hoveredIdx = idx;
            mesh.scale.setScalar(2.5);
        }

        showTooltip(idx, event.clientX, event.clientY);
    } else {
        resetHover();
        tooltip.style.display = "none";
    }
}

function resetHover() {
    if (hoveredMesh) {
        // Restore correct scale (shrunk if overlapping, 1 otherwise)
        const baseScale = overlapScales.get(hoveredIdx) ?? 1;
        hoveredMesh.scale.setScalar(baseScale);
        hoveredMesh = null;
        hoveredIdx = -1;
    }
}

function formatMass(m) {
    if (m >= 1e3) return (m / 1e3).toFixed(1) + " GeV";
    if (m < 0.01) return "≈ 0 (< 1 eV)";
    return m.toFixed(2) + " MeV";
}

function formatCharge(q) {
    if (q === 0) return "0";
    const sign = q > 0 ? "+" : "−";
    const abs = Math.abs(q);
    if (Math.abs(abs - 1) < 0.01) return sign + "1";
    if (Math.abs(abs - 1 / 3) < 0.01) return sign + "⅓";
    if (Math.abs(abs - 2 / 3) < 0.01) return sign + "⅔";
    if (Math.abs(abs - 0.5) < 0.01) return sign + "½";
    return sign + abs.toFixed(2);
}

// ── Auto-rotate (rotates the world group, not the camera) ──
let activeRotateAxis = null;
let activeRotateBtn = null;
const ROTATE_SPEED = 0.008;

// Axis vectors in world-group local space
const AXIS_VECTORS = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
};

function toggleAutoRotate(axis, btn) {
    if (activeRotateAxis === axis) {
        stopAutoRotate();
    } else {
        stopAutoRotate();
        activeRotateAxis = axis;
        activeRotateBtn = btn;
        btn.classList.add("active");
    }
}

function stopAutoRotate() {
    activeRotateAxis = null;
    if (activeRotateBtn) {
        activeRotateBtn.classList.remove("active");
        activeRotateBtn = null;
    }
}

function applyAutoRotate() {
    if (!activeRotateAxis) return;
    // Rotate the entire world group around the chosen axis
    world.rotateOnAxis(AXIS_VECTORS[activeRotateAxis], ROTATE_SPEED);
}

// ── Controls panel ──
function buildControls() {
    const panel = document.getElementById("controls");

    // Category filters
    const catLabel = document.createElement("div");
    catLabel.className = "section-label";
    catLabel.textContent = "Particles";
    panel.appendChild(catLabel);

    for (const [key, cat] of Object.entries(CATEGORIES)) {
        const item = document.createElement("label");
        item.className = "filter-item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.addEventListener("change", () => toggleCategory(key, cb.checked));

        const dot = document.createElement("span");
        dot.className = "color-dot";
        dot.style.backgroundColor = "#" + cat.color.toString(16).padStart(6, "0");

        const text = document.createTextNode(cat.label);

        item.appendChild(cb);
        item.appendChild(dot);
        item.appendChild(text);
        panel.appendChild(item);
    }

    // View controls
    const viewLabel = document.createElement("div");
    viewLabel.className = "section-label";
    viewLabel.textContent = "View";
    panel.appendChild(viewLabel);

    const axisRotations = [
        { label: "Mass",    axis: "x", icon: "↻" },
        { label: "Charge",  axis: "y", icon: "↻" },
        { label: "Isospin", axis: "z", icon: "↻" },
    ];

    const rotateRow = document.createElement("div");
    rotateRow.className = "rotate-row";

    for (const { label, axis, icon } of axisRotations) {
        const btn = document.createElement("button");
        btn.className = "rotate-btn";
        btn.title = `Rotate around ${label} axis`;
        btn.innerHTML = `${icon} ${label}`;
        btn.addEventListener("click", () => toggleAutoRotate(axis, btn));
        rotateRow.appendChild(btn);
    }
    panel.appendChild(rotateRow);

    // Reset view button
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset View";
    resetBtn.className = "reset-btn";
    resetBtn.addEventListener("click", () => {
        stopAutoRotate();
        // Reset world rotation
        world.rotation.set(0, 0, 0);
        // Reset camera
        camera.position.set(8, 5, 8);
        controls.target.set(2, 0, 0);
        controls.update();
    });
    panel.appendChild(resetBtn);

    // Force toggles
    const forceLabel = document.createElement("div");
    forceLabel.className = "section-label";
    forceLabel.textContent = "Interactions";
    panel.appendChild(forceLabel);

    for (const [key, force] of Object.entries(FORCES)) {
        const item = document.createElement("label");
        item.className = "filter-item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = false;
        cb.addEventListener("change", () => {
            if (interactionGroups[key]) interactionGroups[key].visible = cb.checked;
        });

        const dot = document.createElement("span");
        dot.className = "color-dot";
        dot.style.backgroundColor = "#" + force.color.toString(16).padStart(6, "0");

        const text = document.createTextNode(force.label);

        item.appendChild(cb);
        item.appendChild(dot);
        item.appendChild(text);
        panel.appendChild(item);
    }
}

function toggleCategory(category, visible) {
    particleMeshes.forEach((mesh) => {
        if (mesh.userData.category === category) {
            mesh.visible = visible;
        }
    });

    // Hide/show leader lines for affected particles
    for (const { line, meshIdx } of leaderLines) {
        if (particleData[meshIdx].category === category) {
            line.visible = visible;
        }
    }

    // Hide/show multi-color spheres if any member category is toggled
    for (const { mesh, hiddenIndices } of multiColorSpheres) {
        // Visible only if ALL member particles' categories are visible
        const allVisible = hiddenIndices.every(idx => particleMeshes[idx].visible);
        mesh.visible = allVisible;
    }

    // Hide/show overlap half-rings
    for (const { ring, hiddenRingIndices } of overlapRings) {
        // Visible only if at least one anti-particle in the group is visible
        const anyVisible = hiddenRingIndices.some(idx => particleMeshes[idx].visible);
        ring.visible = anyVisible;
    }
}

// ── Resize ──
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// ── Dynamic label positioning based on zoom ──
const LABEL_FAR = 14;   // camera distance where labels are fully outside
const LABEL_NEAR = 5;   // camera distance where labels are fully inside
const _worldPos = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _localUp = new THREE.Vector3();
const _parentWorldQuatInv = new THREE.Quaternion();

function updateLabels() {
    const camDist = camera.position.distanceTo(controls.target);
    // t = 0 when far (outside), t = 1 when near (inside) — based on orbit distance
    const t = THREE.MathUtils.clamp((LABEL_FAR - camDist) / (LABEL_FAR - LABEL_NEAR), 0, 1);

    const vFov = camera.fov * Math.PI / 180;
    const projScale = window.innerHeight / (2 * Math.tan(vFov / 2));

    // Camera's up direction in world space
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

    for (let i = 0; i < particleLabels.length; i++) {
        const { css2d, div, leaderOffset } = particleLabels[i];
        const mesh = particleMeshes[i];

        // Get this particle's world position and distance to camera
        mesh.getWorldPosition(_worldPos);
        const particleDist = _worldPos.distanceTo(camera.position);

        // How big this sphere appears on screen (pixels)
        const sphereScreenPx = (SPHERE_RADIUS / particleDist) * projScale * 2;

        // Outside: font proportional to screen size of sphere (so distant = smaller)
        const outsideSize = Math.max(6, sphereScreenPx * 0.7);
        // Inside: fill the sphere
        const insideSize = Math.max(9, sphereScreenPx * 0.55);

        const offset = 0.08 * (1 - t);
        const fontSize = outsideSize + (insideSize - outsideSize) * t;
        const opacity = 0.7 + 0.25 * t;

        if (leaderOffset) {
            // Overlapping particle: label sits at end of leader line
            css2d.position.copy(leaderOffset);
            div.style.fontSize = Math.max(8, outsideSize * 0.9) + "px";
            div.style.color = `rgba(255, 255, 255, 0.9)`;
        } else {
            // Normal: offset in camera-up direction
            mesh.parent.getWorldQuaternion(_parentWorldQuatInv);
            _parentWorldQuatInv.invert();
            _localUp.copy(_camUp).applyQuaternion(_parentWorldQuatInv).normalize();

            css2d.position.copy(_localUp).multiplyScalar(offset);
            div.style.fontSize = fontSize + "px";
            div.style.color = `rgba(255, 255, 255, ${opacity})`;
        }
    }
}

// ── Billboard anti-particle rings toward camera ──
const _camDir = new THREE.Vector3();
const _ringWorldPos = new THREE.Vector3();
const _parentWorldQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();
const _lookMat = new THREE.Matrix4();

const _flipQuat = new THREE.Quaternion();
const _arcRotQuat = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);

function updateAntiRings() {
    for (const ring of antiRings) {
        // Get ring world position and look-at direction
        ring.getWorldPosition(_ringWorldPos);
        _camDir.copy(camera.position).sub(_ringWorldPos);

        // Build world-space quaternion that faces the camera
        _lookMat.lookAt(_ringWorldPos, camera.position, camera.up);
        _targetQuat.setFromRotationMatrix(_lookMat);

        // Convert to local space by removing parent's world rotation
        ring.parent.getWorldQuaternion(_parentWorldQuat);
        _parentWorldQuat.invert();
        ring.quaternion.copy(_parentWorldQuat.multiply(_targetQuat));
    }

    // Billboard overlap half-rings
    for (const { ring } of overlapRings) {
        ring.getWorldPosition(_ringWorldPos);

        // Face the camera
        _lookMat.lookAt(_ringWorldPos, camera.position, camera.up);
        _targetQuat.setFromRotationMatrix(_lookMat);

        // Convert to world group's local space
        world.getWorldQuaternion(_parentWorldQuat);
        _parentWorldQuat.invert();
        const localQuat = _parentWorldQuat.multiply(_targetQuat);

        // Rotate around local z so the arc start aligns with the anti-particle region
        // TorusGeometry arc starts at angle 0 (+x in local space)
        // We need to rotate so the arc center aligns with arcCenter
        const arcCenter = ring.userData.arcCenter;
        const arcLength = ring.userData.arcLength;
        const arcStartAngle = arcCenter - arcLength / 2;
        _arcRotQuat.setFromAxisAngle(_zAxis, arcStartAngle);
        localQuat.multiply(_arcRotQuat);

        ring.quaternion.copy(localQuat);
    }
}

// ── Animation loop ──
function animate() {
    requestAnimationFrame(animate);
    applyAutoRotate();
    updateLabels();
    updateAntiRings();
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// ── Mode switcher ──
function buildModeSwitcher() {
    const container = document.getElementById("mode-switcher");
    const label = document.createElement("div");
    label.className = "mode-label";
    label.textContent = "Plot axes";
    container.appendChild(label);

    for (const [key, mode] of Object.entries(PLOT_MODES)) {
        const btn = document.createElement("button");
        btn.className = "mode-btn";
        btn.dataset.mode = key;
        btn.textContent = mode.label;
        if (key === currentMode) btn.classList.add("active");
        btn.addEventListener("click", () => switchMode(key));
        container.appendChild(btn);
    }
}

// ── Init ──
createAxes();
createGrid();
createParticles();
resolveOverlaps();
setupInteractions();
buildControls();
buildModeSwitcher();

window.addEventListener("mousemove", onMouseMove);
window.addEventListener("resize", onResize);

animate();
