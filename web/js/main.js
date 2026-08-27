import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { PARTICLES, CATEGORIES, PLOT_MODES, PARTICLE_DATA_SOURCE } from "./particles.js";
import { createInteractionLines, updateInteractionLines, FORCES } from "./interactions.js";
import { registerWebMCPTools } from "./webmcp.js";

const THEME_PALETTE = {
    dark: {
        sceneBackground: 0x0a0a0f,
        labelBackground: "rgba(10, 10, 15, 0.78)",
        labelText: "#aaaaaa",
    },
    light: {
        sceneBackground: 0xf4f7fb,
        labelBackground: "rgba(255, 255, 255, 0.9)",
        labelText: "#263247",
    },
};
const DEFAULT_VISIBLE_CATEGORIES = Object.keys(CATEGORIES).filter((key) => key !== "tensorBosons");
const SCENE_PRESETS = {
    overview: {
        label: "Standard Model overview",
        mode: "spinLinear",
        categories: DEFAULT_VISIBLE_CATEGORIES,
    },
    chargedLeptons: {
        label: "Charged lepton generations",
        mode: "spin",
        categories: ["leptons", "antiLeptons"],
        compare: ["electron", "muon", "tau"],
    },
    quarkFamilies: {
        label: "Quark families",
        mode: "spin",
        categories: ["quarks", "antiQuarks"],
        highlight: ["up", "down", "strange", "charm", "top", "bottom"],
    },
    matterAntimatter: {
        label: "Matter and antimatter",
        mode: "isospin",
        categories: ["leptons", "neutrinos", "antiLeptons", "antiNeutrinos", "quarks", "antiQuarks"],
    },
    forceCarriers: {
        label: "Force carriers and Higgs",
        mode: "spinLinear",
        categories: ["gaugeBosons", "scalarBosons"],
        highlight: ["photon", "gluon", "W⁺ boson", "W⁻ boson", "Z⁰ boson", "higgs"],
    },
    weakNetwork: {
        label: "Weak interaction network",
        mode: "isospin",
        categories: ["leptons", "neutrinos", "antiLeptons", "antiNeutrinos", "quarks", "antiQuarks"],
        forces: ["weak"],
    },
};
const CATEGORY_SETS = {
    standardModel: { label: "Standard Model particles", categories: DEFAULT_VISIBLE_CATEGORIES },
    all: { label: "All entries", categories: Object.keys(CATEGORIES) },
    matter: { label: "Matter only", categories: ["leptons", "neutrinos", "quarks"] },
    antimatter: { label: "Antimatter only", categories: ["antiLeptons", "antiNeutrinos", "antiQuarks"] },
    fermions: { label: "All fermions", categories: ["leptons", "neutrinos", "antiLeptons", "antiNeutrinos", "quarks", "antiQuarks"] },
    bosons: { label: "Bosons only", categories: ["gaugeBosons", "scalarBosons", "tensorBosons"] },
    none: { label: "Hide all particles", categories: [] },
};
let currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
let currentContrast = document.documentElement.dataset.contrast === "high";
let currentRepresentation = "3d";
let activePreset = "overview";
let isApplyingPreset = false;
let scenePresetSelect = null;
let categorySetSelect = null;
let isApplyingCategorySet = false;
let sceneUrlReady = false;
let sceneUrlTimer = null;
let contrastInput = null;
const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

// ── Scene setup ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(THEME_PALETTE[currentTheme].sceneBackground);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(8, 5, 8);

// WebGL renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("role", "application");
renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional particle plot. Use arrow keys to move through visible particles and Enter to inspect one.");
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
controls.enableDamping = !reducedMotionQuery.matches;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// ── World group — all visible objects go in here so we can rotate them ──
const world = new THREE.Group();
scene.add(world);

// ── Plot mode state ──
let currentMode = "spinLinear";
const categoryVisibility = new Map(Object.keys(CATEGORIES).map((key) => [key, DEFAULT_VISIBLE_CATEGORIES.includes(key)]));
const forceVisibility = new Map(Object.keys(FORCES).map((key) => [key, false]));
const categoryInputs = new Map();
const forceInputs = new Map();
const highlightedIndices = new Set();
const comparisonIndices = [];
let isolateHighlights = false;
let focusedParticleIndex = null;

// ── Axes ──
const AXIS_LENGTH = 6;
let zAxisLabelSprite = null;
let massAxisLabelSprite = null;
const axisLabelSprites = [];
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
    ctx.fillStyle = THEME_PALETTE[currentTheme].labelBackground;
    ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
    ctx.fill();
    ctx.fillStyle = THEME_PALETTE[currentTheme].labelText;
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
    sprite.userData.labelText = text;
    sprite.userData.labelHeight = height;
    world.add(sprite);
    axisLabelSprites.push(sprite);
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
            labelDiv.onclick = () => onParticleClick(idx);

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

    syncParticleVisibility();
    applyHighlightState();
}

function updateSpriteTexture(sprite, text, height = 0.35) {
    const { texture, aspect } = makeTextTexture(text);
    sprite.material.map.dispose();
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
    sprite.scale.set(height * aspect, height, 1);
    sprite.userData.labelText = text;
    sprite.userData.labelHeight = height;
}

function applyTheme(theme, { persist = true } = {}) {
    if (!Object.hasOwn(THEME_PALETTE, theme)) throw new Error(`Unknown theme "${theme}".`);
    currentTheme = theme;
    document.documentElement.dataset.theme = theme;
    scene.background.setHex(currentContrast ? (theme === "dark" ? 0x000000 : 0xffffff) : THEME_PALETTE[theme].sceneBackground);

    for (const sprite of axisLabelSprites) {
        updateSpriteTexture(sprite, sprite.userData.labelText, sprite.userData.labelHeight);
    }

    const toggle = document.getElementById("theme-toggle");
    const nextTheme = theme === "dark" ? "light" : "dark";
    toggle.textContent = "\u25D0";
    toggle.setAttribute("aria-checked", String(theme === "light"));
    toggle.setAttribute("aria-label", `Use ${nextTheme} theme`);
    toggle.title = `Use ${nextTheme} theme`;

    if (persist) {
        try {
            localStorage.setItem("particle-atlas-theme", theme);
        } catch {
            // The selected theme still applies when storage is unavailable.
        }
    }
    scheduleSceneUrlUpdate();
}

function applyContrast(enabled, { persist = true } = {}) {
    currentContrast = Boolean(enabled);
    document.documentElement.dataset.contrast = currentContrast ? "high" : "normal";
    scene.background.setHex(currentContrast
        ? (currentTheme === "dark" ? 0x000000 : 0xffffff)
        : THEME_PALETTE[currentTheme].sceneBackground);
    world.traverse((object) => {
        if (!object.isLine && !object.isLineSegments) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
            if (!material) continue;
            if (material.userData.normalOpacity === undefined) material.userData.normalOpacity = material.opacity;
            material.opacity = currentContrast ? Math.max(material.userData.normalOpacity, 0.82) : material.userData.normalOpacity;
            material.needsUpdate = true;
        }
    });
    for (const sprite of axisLabelSprites) {
        updateSpriteTexture(sprite, sprite.userData.labelText, sprite.userData.labelHeight);
    }
    if (contrastInput) contrastInput.checked = currentContrast;
    if (persist) {
        try {
            localStorage.setItem("particle-atlas-contrast", currentContrast ? "high" : "normal");
        } catch {
            // Contrast remains active when storage is unavailable.
        }
    }
    scheduleSceneUrlUpdate();
}

function motionDuration(duration) {
    return reducedMotionQuery.matches ? 0 : duration;
}

function markSceneCustom() {
    if (isApplyingPreset) return;
    activePreset = "custom";
    if (scenePresetSelect) scenePresetSelect.value = "custom";
    scheduleSceneUrlUpdate();
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
        const active = btn.dataset.massScale === PLOT_MODES[mode].massScale
            || btn.dataset.zProp === PLOT_MODES[mode].zProp;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
    });
    markSceneCustom();
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

let isZoomedIn = false;
let zoomAnimation = null;
let preZoomState = null;
const zoomedInfo = document.getElementById("zoomed-info");
const zoomedContent = document.getElementById("zoomed-content");
const closeZoomBtn = document.getElementById("close-zoom");

closeZoomBtn.addEventListener("click", closeZoom);
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeZoom(); });

function showZoomedInfo(idx) {
    if (isZoomedIn && focusedParticleIndex === idx) return;
    
    if (!preZoomState) {
        preZoomState = {
            pos: camera.position.clone(),
            target: controls.target.clone()
        };
    }

    const p = particleData[idx];
    zoomedContent.innerHTML = `
        <div class="zoom-name">${p.name}</div>
        <div class="zoom-fullname">${p.fullName}</div>
        <div class="zoom-row">Category: <span>${CATEGORIES[p.category].label}</span></div>
        <div class="zoom-row">Mass: <span>${formatParticleMass(p)}</span></div>
        <div class="zoom-row">Status: <span>${p.massStatus}</span></div>
        <div class="zoom-row">Uncertainty: <span>${p.massUncertainty}</span></div>
        <div class="zoom-row">Charge: <span>${formatCharge(p.charge)}e</span></div>
        <div class="zoom-row">Spin: <span>${formatCharge(p.spin)}</span></div>
        <div class="zoom-row">Isospin I₃: <span>${formatCharge(p.isospin)}</span></div>
        <button class="comparison-add-focused" type="button">Add to comparison</button>
    `;
    const comparisonButton = zoomedContent.querySelector(".comparison-add-focused");
    comparisonButton.disabled = comparisonIndices.includes(idx);
    comparisonButton.textContent = comparisonButton.disabled ? "Added to comparison" : "Add to comparison";
    comparisonButton.addEventListener("click", () => {
        addParticleToComparison(idx);
        comparisonButton.disabled = true;
        comparisonButton.textContent = "Added to comparison";
    });
    zoomedInfo.classList.add("visible");
    document.body.classList.add("particle-focused");
    isZoomedIn = true;
    focusedParticleIndex = idx;
    
    const mesh = particleMeshes[idx];
    const targetPos = new THREE.Vector3();
    mesh.getWorldPosition(targetPos);
    
    const sphereR = typeof SPHERE_RADIUS !== 'undefined' ? SPHERE_RADIUS : 0.06;
    const vFovRad = camera.fov * Math.PI / 180;
    const requiredDist = (sphereR / 0.4) / Math.tan(vFovRad / 2);
    
    const currentCamPos = camera.position.clone();
    let dir = currentCamPos.clone().sub(targetPos);
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    dir.normalize();
    
    const baseCamPos = targetPos.clone().add(dir.multiplyScalar(requiredDist));
    
    const visibleWidth = 2 * requiredDist * Math.tan(vFovRad / 2) * camera.aspect;
    const rightOffset = visibleWidth * 0.25;
    
    const newRight = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    if (newRight.lengthSq() < 0.001) newRight.set(1, 0, 0);
    
    const endTargetPos = targetPos.clone().add(newRight.clone().multiplyScalar(rightOffset));
    const endCamPos = baseCamPos.clone().add(newRight.clone().multiplyScalar(rightOffset));
    
    zoomAnimation = {
        startTime: performance.now(),
        duration: motionDuration(800),
        startPos: currentCamPos,
        endPos: endCamPos,
        startTarget: controls.target.clone(),
        endTarget: endTargetPos
    };
    
    controls.enabled = false;
    tooltip.style.display = "none";
}

function closeZoom() {
    if (!isZoomedIn) return;
    zoomedInfo.classList.remove("visible");
    document.body.classList.remove("particle-focused");
    isZoomedIn = false;
    focusedParticleIndex = null;
    if (comparisonIndices.length) setHighlights(comparisonIndices, false);
    
    if (preZoomState) {
        zoomAnimation = {
            startTime: performance.now(),
            duration: motionDuration(800),
            startPos: camera.position.clone(),
            endPos: preZoomState.pos,
            startTarget: controls.target.clone(),
            endTarget: preZoomState.target
        };
        preZoomState = null;
    }
}

function onParticleClick(idx) {
    showZoomedInfo(idx);
}

let hoveredMesh = null;
let hoveredIdx = -1;

function particleBaseScale(idx) {
    return overlapScales.get(idx) ?? 1;
}

function applyParticleScale(idx) {
    const highlightScale = highlightedIndices.has(idx) ? 1.8 : 1;
    particleMeshes[idx].scale.setScalar(particleBaseScale(idx) * highlightScale);
}

function applyHighlightState() {
    particleMeshes.forEach((mesh, idx) => {
        const highlighted = highlightedIndices.has(idx);
        if (highlighted) mesh.material.emissive.copy(mesh.material.color);
        else mesh.material.emissive.setHex(0x000000);
        mesh.material.emissiveIntensity = highlighted ? 0.9 : 1;
        particleLabels[idx].div.classList.toggle("agent-highlighted", highlighted);
        if (mesh !== hoveredMesh) applyParticleScale(idx);
    });
}
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
        <div class="tooltip-row">Mass: <span>${formatParticleMass(p)}</span></div>
        <div class="tooltip-row">Status: <span>${p.massStatus}</span></div>
        <div class="tooltip-row">Charge: <span>${formatCharge(p.charge)}e</span></div>
        <div class="tooltip-row">Spin: <span>${formatCharge(p.spin)}</span></div>
        <div class="tooltip-row">Isospin I₃: <span>${formatCharge(p.isospin)}</span></div>
    `;
}

function onMouseMove(event) {
    if (isZoomedIn || zoomAnimation) {
        document.body.style.cursor = "default";
        return;
    }

    // If hovering an overlap-interactive label, let its own handlers manage tooltip
    if (event.target && event.target.closest && event.target.closest(".overlap-interactive")) {
        document.body.style.cursor = "pointer";
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    // Exclude overlap particles — their labels handle hover instead
    const nonOverlapMeshes = particleMeshes.filter((_, i) => !overlapScales.has(i));
    const intersects = raycaster.intersectObjects(nonOverlapMeshes, true); // true = include children (rings)

    if (intersects.length > 0) {
        let hit = intersects[0].object;
        // If we hit a child (anti-particle ring), use its parent sphere
        let mesh = hit.userData.index !== undefined ? hit : hit.parent;
        
        if (mesh && mesh.userData.index !== undefined) {
            const idx = mesh.userData.index;

            if (hoveredMesh !== mesh) {
                resetHover();
                hoveredMesh = mesh;
                hoveredIdx = idx;
                mesh.scale.setScalar(Math.max(2.5, particleBaseScale(idx) * 2.5));
            }

            showTooltip(idx, event.clientX, event.clientY);
            document.body.style.cursor = "pointer";
            return;
        }
    }
    
    // Fallback if nothing intersected
    resetHover();
    tooltip.style.display = "none";
    document.body.style.cursor = "default";
}

window.addEventListener("click", (event) => {
    if (isZoomedIn) return;
    if (event.target && event.target.closest && (event.target.closest(".overlap-interactive") || event.target.closest("#controls") || event.target.closest("#mode-switcher"))) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const nonOverlapMeshes = particleMeshes.filter((_, i) => !overlapScales.has(i));
    const intersects = raycaster.intersectObjects(nonOverlapMeshes, true);

    if (intersects.length > 0) {
        let hit = intersects[0].object;
        let mesh = hit.userData.index !== undefined ? hit : hit.parent;
        if (mesh && mesh.userData.index !== undefined) {
            onParticleClick(mesh.userData.index);
        }
    }
});

function resetHover() {
    if (hoveredMesh) {
        applyParticleScale(hoveredIdx);
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

    const presetLabel = document.createElement("label");
    presetLabel.className = "section-label preset-label";
    presetLabel.htmlFor = "scene-preset";
    presetLabel.textContent = "Scene preset";
    scenePresetSelect = document.createElement("select");
    scenePresetSelect.id = "scene-preset";
    for (const [key, preset] of Object.entries(SCENE_PRESETS)) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = preset.label;
        scenePresetSelect.appendChild(option);
    }
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "Custom view";
    scenePresetSelect.appendChild(customOption);
    scenePresetSelect.value = activePreset;
    scenePresetSelect.addEventListener("change", () => {
        if (scenePresetSelect.value !== "custom") applyScenePreset(scenePresetSelect.value);
    });
    panel.append(presetLabel, scenePresetSelect);

    // Category filters
    const catLabel = document.createElement("div");
    catLabel.className = "section-label";
    catLabel.textContent = "Particles";
    panel.appendChild(catLabel);

    categorySetSelect = document.createElement("select");
    categorySetSelect.id = "category-set";
    categorySetSelect.setAttribute("aria-label", "Apply a particle category set");
    for (const [key, set] of Object.entries(CATEGORY_SETS)) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = set.label;
        categorySetSelect.appendChild(option);
    }
    const customSetOption = document.createElement("option");
    customSetOption.value = "custom";
    customSetOption.textContent = "Custom selection";
    categorySetSelect.appendChild(customSetOption);
    categorySetSelect.value = "standardModel";
    categorySetSelect.addEventListener("change", () => {
        if (categorySetSelect.value !== "custom") setCategorySet(categorySetSelect.value);
    });
    panel.appendChild(categorySetSelect);

    for (const [key, cat] of Object.entries(CATEGORIES)) {
        const item = document.createElement("label");
        item.className = "filter-item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = categoryVisibility.get(key) !== false;
        cb.addEventListener("change", () => toggleCategory(key, cb.checked));
        categoryInputs.set(key, cb);

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
        btn.disabled = reducedMotionQuery.matches;
        btn.addEventListener("click", () => toggleAutoRotate(axis, btn));
        rotateRow.appendChild(btn);
    }
    panel.appendChild(rotateRow);

    // Reset view button
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset View";
    resetBtn.className = "reset-btn";
    resetBtn.addEventListener("click", resetView);
    panel.appendChild(resetBtn);

    const contrastLabel = document.createElement("label");
    contrastLabel.className = "filter-item contrast-toggle";
    contrastInput = document.createElement("input");
    contrastInput.type = "checkbox";
    contrastInput.checked = currentContrast;
    contrastInput.addEventListener("change", () => applyContrast(contrastInput.checked));
    contrastLabel.append(contrastInput, document.createTextNode("High contrast"));
    panel.appendChild(contrastLabel);

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
            setForceVisibility(key, cb.checked);
        });
        forceInputs.set(key, cb);

        const dot = document.createElement("span");
        dot.className = "color-dot";
        dot.style.backgroundColor = "#" + force.color.toString(16).padStart(6, "0");

        const text = document.createTextNode(force.label);

        item.appendChild(cb);
        item.appendChild(dot);
        item.appendChild(text);
        panel.appendChild(item);
    }

    const sourceButton = document.createElement("button");
    sourceButton.type = "button";
    sourceButton.className = "data-source-button";
    sourceButton.textContent = "Data: PDG 2025";
    sourceButton.addEventListener("click", () => document.getElementById("data-source-dialog").showModal());
    panel.appendChild(sourceButton);
}

function toggleCategory(category, visible) {
    categoryVisibility.set(category, visible);
    if (categoryInputs.has(category)) categoryInputs.get(category).checked = visible;
    syncParticleVisibility();
    if (!isApplyingCategorySet) syncCategorySetSelect();
    markSceneCustom();
}

function syncCategorySetSelect() {
    if (!categorySetSelect) return;
    const visible = Object.keys(CATEGORIES).filter((key) => categoryVisibility.get(key) !== false);
    const match = Object.entries(CATEGORY_SETS).find(([, set]) => {
        return set.categories.length === visible.length && set.categories.every((key) => visible.includes(key));
    });
    categorySetSelect.value = match?.[0] ?? "custom";
}

function setCategorySet(key) {
    const set = CATEGORY_SETS[key];
    if (!set) throw new Error(`Unknown category set "${key}".`);
    isApplyingCategorySet = true;
    try {
        const visible = new Set(set.categories);
        for (const category of Object.keys(CATEGORIES)) toggleCategory(category, visible.has(category));
    } finally {
        isApplyingCategorySet = false;
    }
    categorySetSelect.value = key;
    markSceneCustom();
    return key;
}

function syncParticleVisibility() {
    particleMeshes.forEach((mesh, idx) => {
        const categoryVisible = categoryVisibility.get(mesh.userData.category) !== false;
        mesh.visible = categoryVisible && (!isolateHighlights || highlightedIndices.has(idx));
    });

    // Hide/show leader lines for affected particles
    for (const { line, meshIdx } of leaderLines) {
        line.visible = particleMeshes[meshIdx].visible;
    }

    // Hide/show multi-color spheres if any member category is toggled
    for (const { mesh, hiddenIndices } of multiColorSpheres) {
        // Visible only if ALL member particles' categories are visible
        const allVisible = hiddenIndices.every(idx => particleMeshes[idx].visible);
        mesh.visible = allVisible;
    }

    // Hide/show overlap half-rings
    for (const { ring, hiddenRingIndices } of overlapRings) {
        const anyVisible = hiddenRingIndices.some(idx => particleMeshes[idx].visible);
        ring.visible = anyVisible;
    }
    renderParticleTable();
}

function setForceVisibility(force, visible) {
    forceVisibility.set(force, visible);
    if (interactionGroups[force]) interactionGroups[force].visible = visible;
    if (forceInputs.has(force)) forceInputs.get(force).checked = visible;
    markSceneCustom();
}

function resetView() {
    stopAutoRotate();
    world.rotation.set(0, 0, 0);
    camera.position.set(8, 5, 8);
    controls.target.set(2, 0, 0);
    controls.update();
    scheduleSceneUrlUpdate();
}

function textFromMarkup(markup) {
    const element = document.createElement("span");
    element.innerHTML = markup;
    return element.textContent.trim();
}

function normalizeName(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

const PARTICLE_ALIASES = new Map([
    ["higgs boson", "higgs"],
    ["up quark", "up"],
    ["down quark", "down"],
    ["strange quark", "strange"],
    ["charm quark", "charm"],
    ["top quark", "top"],
    ["bottom quark", "bottom"],
    ["anti up", "antiup"],
    ["anti down", "antidown"],
    ["anti strange", "antistrange"],
    ["anti charm", "anticharm"],
    ["anti top", "antitop"],
    ["anti bottom", "antibottom"],
]);

function findParticleIndex(requestedName) {
    const normalized = normalizeName(requestedName);
    if (!normalized) throw new Error("A particle name is required.");

    if (["w+", "w plus", "w plus boson"].includes(normalized)) {
        return particleData.findIndex((particle) => particle.category === "gaugeBosons" && particle.charge === 1);
    }
    if (["w-", "w minus", "w minus boson"].includes(normalized)) {
        return particleData.findIndex((particle) => particle.category === "gaugeBosons" && particle.charge === -1);
    }

    const target = PARTICLE_ALIASES.get(normalized) ?? normalized;
    const exactMatches = particleData
        .map((particle, idx) => ({
            idx,
            fullName: normalizeName(particle.fullName),
            symbol: normalizeName(textFromMarkup(particle.name)),
        }))
        .filter(({ fullName, symbol }) => fullName === target || symbol === target);

    if (exactMatches.length === 1) return exactMatches[0].idx;

    const partialMatches = particleData
        .map((particle, idx) => ({ idx, fullName: normalizeName(particle.fullName) }))
        .filter(({ fullName }) => fullName.includes(target));

    if (partialMatches.length === 1) return partialMatches[0].idx;
    if (partialMatches.length > 1) {
        const choices = partialMatches.map(({ idx }) => particleData[idx].fullName).join(", ");
        throw new Error(`Particle name "${requestedName}" is ambiguous. Choose one of: ${choices}.`);
    }
    throw new Error(`Particle "${requestedName}" was not found.`);
}

function resolveCategory(requestedCategory) {
    const normalized = normalizeName(requestedCategory);
    const match = Object.entries(CATEGORIES).find(([key, category]) => {
        return normalizeName(key) === normalized || normalizeName(category.label) === normalized;
    });
    if (!match) throw new Error(`Unknown category "${requestedCategory}".`);
    return match[0];
}

function serializeParticle(particle) {
    return {
        name: particle.fullName,
        symbol: textFromMarkup(particle.name),
        category: particle.category,
        categoryLabel: CATEGORIES[particle.category].label,
        massMeV: particle.reportedMassMeV,
        massDisplay: particle.massDisplay,
        massUncertainty: particle.massUncertainty,
        massStatus: particle.massStatus,
        plotMassMeV: particle.plotMassMeV,
        chargeE: particle.charge,
        spin: particle.spin,
        weakIsospin: particle.isospin,
        source: particle.source,
        sourceUrl: particle.sourceUrl,
    };
}

function formatParticleMass(particle) {
    return particle.massDisplay ?? formatMass(particle.mass);
}

function setHighlights(indices, isolate = false) {
    highlightedIndices.clear();
    for (const idx of indices) {
        highlightedIndices.add(idx);
        const category = particleData[idx].category;
        categoryVisibility.set(category, true);
        if (categoryInputs.has(category)) categoryInputs.get(category).checked = true;
    }
    isolateHighlights = isolate;
    syncParticleVisibility();
    applyHighlightState();
    syncCategorySetSelect();
    markSceneCustom();
}

function clearFocusedParticle() {
    zoomedInfo.classList.remove("visible");
    document.body.classList.remove("particle-focused");
    isZoomedIn = false;
    focusedParticleIndex = null;
    preZoomState = null;
    zoomAnimation = null;
    controls.enabled = true;
    scheduleSceneUrlUpdate();
}

const comparisonPanel = document.getElementById("comparison-panel");
const comparisonCount = document.getElementById("comparison-count");
const comparisonTableWrap = comparisonPanel.querySelector(".comparison-table-wrap");
const comparisonTableBody = document.getElementById("comparison-table-body");
const comparisonClose = document.getElementById("comparison-close");

function renderComparisonWorkspace() {
    comparisonPanel.hidden = comparisonIndices.length === 0;
    comparisonCount.textContent = comparisonIndices.length ? `(${comparisonIndices.length}/6)` : "";
    comparisonTableBody.replaceChildren();

    for (const idx of comparisonIndices) {
        const particle = particleData[idx];
        const row = document.createElement("tr");

        const particleCell = document.createElement("td");
        const focusButton = document.createElement("button");
        focusButton.className = "comparison-particle";
        focusButton.type = "button";
        focusButton.title = `Focus ${particle.fullName}`;
        const symbol = document.createElement("strong");
        symbol.innerHTML = particle.name;
        const name = document.createElement("span");
        name.textContent = particle.fullName;
        focusButton.append(symbol, name);
        focusButton.addEventListener("click", () => particleAtlas.focusParticle(particle.fullName));
        particleCell.appendChild(focusButton);
        row.appendChild(particleCell);

        const values = [
            CATEGORIES[particle.category].label,
            formatParticleMass(particle),
            `${formatCharge(particle.charge)}e`,
            formatCharge(particle.spin),
            formatCharge(particle.isospin),
        ];
        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        const removeCell = document.createElement("td");
        const removeButton = document.createElement("button");
        removeButton.className = "comparison-remove";
        removeButton.type = "button";
        removeButton.textContent = "\u00d7";
        removeButton.setAttribute("aria-label", `Remove ${particle.fullName} from comparison`);
        removeButton.title = `Remove ${particle.fullName}`;
        removeButton.addEventListener("click", () => removeParticleFromComparison(idx));
        removeCell.appendChild(removeButton);
        row.appendChild(removeCell);
        comparisonTableBody.appendChild(row);
    }
    comparisonTableWrap.scrollLeft = 0;
    renderParticleTable();
    scheduleSceneUrlUpdate();
}

function setComparison(indices, isolate = false) {
    const unique = [...new Set(indices)].slice(0, 6);
    comparisonIndices.splice(0, comparisonIndices.length, ...unique);
    setHighlights(comparisonIndices, isolate);
    renderComparisonWorkspace();
}

function addParticleToComparison(idx) {
    if (comparisonIndices.includes(idx) || comparisonIndices.length >= 6) return false;
    comparisonIndices.push(idx);
    setHighlights(comparisonIndices, false);
    renderComparisonWorkspace();
    return true;
}

function removeParticleFromComparison(idx) {
    const position = comparisonIndices.indexOf(idx);
    if (position < 0) return;
    comparisonIndices.splice(position, 1);
    if (comparisonIndices.length) setHighlights(comparisonIndices, false);
    else {
        highlightedIndices.clear();
        isolateHighlights = false;
        syncParticleVisibility();
        applyHighlightState();
    }
    renderComparisonWorkspace();
}

function clearComparison() {
    comparisonIndices.length = 0;
    highlightedIndices.clear();
    isolateHighlights = false;
    syncParticleVisibility();
    applyHighlightState();
    renderComparisonWorkspace();
}

function applyScenePreset(key) {
    const preset = SCENE_PRESETS[key];
    if (!preset) throw new Error(`Unknown scene preset "${key}".`);

    isApplyingPreset = true;
    try {
        clearFocusedParticle();
        comparisonIndices.length = 0;
        renderComparisonWorkspace();
        highlightedIndices.clear();
        isolateHighlights = false;

        const visibleCategories = new Set(preset.categories);
        for (const category of Object.keys(CATEGORIES)) toggleCategory(category, visibleCategories.has(category));
        for (const force of Object.keys(FORCES)) setForceVisibility(force, preset.forces?.includes(force) ?? false);
        switchMode(preset.mode);

        if (preset.compare) setComparison(preset.compare.map(findParticleIndex), false);
        else if (preset.highlight) setHighlights(preset.highlight.map(findParticleIndex), false);
        else {
            syncParticleVisibility();
            applyHighlightState();
        }
        resetView();
        activePreset = key;
        if (scenePresetSelect) scenePresetSelect.value = key;
    } finally {
        isApplyingPreset = false;
    }
    return key;
}

comparisonClose.addEventListener("click", clearComparison);

const particleAtlas = {
    captureSceneState() {
        return {
            theme: currentTheme,
            highContrast: currentContrast,
            representation: currentRepresentation,
            preset: activePreset,
            plotMode: currentMode,
            categories: Object.fromEntries(categoryVisibility),
            forces: Object.fromEntries(forceVisibility),
            highlightedParticles: [...highlightedIndices].map((idx) => particleData[idx].fullName),
            comparisonParticles: comparisonIndices.map((idx) => particleData[idx].fullName),
            isolated: isolateHighlights,
            focusedParticle: focusedParticleIndex === null ? null : particleData[focusedParticleIndex].fullName,
            camera: camera.position.toArray(),
            target: controls.target.toArray(),
            worldRotation: world.rotation.toArray().slice(0, 3),
            preZoom: preZoomState ? {
                camera: preZoomState.pos.toArray(),
                target: preZoomState.target.toArray(),
            } : null,
        };
    },

    restoreSceneState(snapshot) {
        if (!snapshot) throw new Error("A scene snapshot is required.");
        isApplyingPreset = true;
        try {
            clearFocusedParticle();
            applyTheme(snapshot.theme);
            applyContrast(Boolean(snapshot.highContrast));
            setRepresentation(snapshot.representation ?? "3d");
            for (const category of Object.keys(CATEGORIES)) {
                toggleCategory(category, snapshot.categories?.[category] !== false);
            }
            for (const force of Object.keys(FORCES)) {
                setForceVisibility(force, snapshot.forces?.[force] === true);
            }
            switchMode(snapshot.plotMode);

            comparisonIndices.length = 0;
            highlightedIndices.clear();
            isolateHighlights = false;
            const highlights = (snapshot.highlightedParticles ?? []).map(findParticleIndex);
            const comparison = (snapshot.comparisonParticles ?? []).map(findParticleIndex);
            if (comparison.length) setComparison(comparison, Boolean(snapshot.isolated));
            else if (highlights.length) setHighlights(highlights, Boolean(snapshot.isolated));
            else {
                syncParticleVisibility();
                applyHighlightState();
                renderComparisonWorkspace();
            }

            camera.position.fromArray(snapshot.camera);
            controls.target.fromArray(snapshot.target);
            world.rotation.set(...snapshot.worldRotation);
            controls.update();

            if (snapshot.focusedParticle) {
                showZoomedInfo(findParticleIndex(snapshot.focusedParticle));
                zoomAnimation = null;
                camera.position.fromArray(snapshot.camera);
                controls.target.fromArray(snapshot.target);
                preZoomState = snapshot.preZoom ? {
                    pos: new THREE.Vector3().fromArray(snapshot.preZoom.camera),
                    target: new THREE.Vector3().fromArray(snapshot.preZoom.target),
                } : null;
                controls.enabled = false;
            }

            activePreset = snapshot.preset ?? "custom";
            if (scenePresetSelect) scenePresetSelect.value = activePreset;
        } finally {
            isApplyingPreset = false;
        }
        scheduleSceneUrlUpdate();
        return this.getSceneState();
    },

    getParticleCatalog(filters = {}) {
        const category = filters.category ? resolveCategory(filters.category) : null;
        const name = normalizeName(filters.name);
        const particles = particleData.filter((particle) => {
            if (category && particle.category !== category) return false;
            if (name && !normalizeName(particle.fullName).includes(name)) return false;
            if (Number.isFinite(filters.minMassMeV) && (particle.reportedMassMeV === null || particle.reportedMassMeV < filters.minMassMeV)) return false;
            if (Number.isFinite(filters.maxMassMeV) && (particle.reportedMassMeV === null || particle.reportedMassMeV > filters.maxMassMeV)) return false;
            if (Number.isFinite(filters.charge) && Math.abs(particle.charge - filters.charge) > 1e-9) return false;
            return true;
        }).map(serializeParticle);
        return { count: particles.length, particles };
    },

    getSceneState() {
        return {
            theme: currentTheme,
            highContrast: currentContrast,
            representation: currentRepresentation,
            preset: activePreset,
            plotMode: currentMode,
            plotLabel: PLOT_MODES[currentMode].label,
            visibleCategories: [...categoryVisibility.entries()].filter(([, visible]) => visible).map(([key]) => key),
            visibleForces: [...forceVisibility.entries()].filter(([, visible]) => visible).map(([key]) => key),
            highlightedParticles: [...highlightedIndices].map((idx) => particleData[idx].fullName),
            comparisonParticles: comparisonIndices.map((idx) => particleData[idx].fullName),
            isolated: isolateHighlights,
            focusedParticle: focusedParticleIndex === null ? null : particleData[focusedParticleIndex].fullName,
        };
    },

    focusParticle(name) {
        const idx = findParticleIndex(name);
        setHighlights([idx], false);
        showZoomedInfo(idx);
        return { focused: serializeParticle(particleData[idx]), scene: this.getSceneState() };
    },

    compareParticles(names, isolate = false) {
        if (!Array.isArray(names) || names.length < 2 || names.length > 6) {
            throw new Error("Choose between two and six particles to compare.");
        }
        const indices = [...new Set(names.map(findParticleIndex))];
        if (indices.length < 2) throw new Error("Choose at least two distinct particles to compare.");
        clearFocusedParticle();
        setComparison(indices, isolate);
        return {
            compared: indices.map((idx) => serializeParticle(particleData[idx])),
            isolated: isolate,
        };
    },

    configurePlot({ mode, visibleCategories, theme, preset, categorySet, highContrast, view } = {}) {
        if (preset !== undefined) applyScenePreset(preset);
        if (theme !== undefined) applyTheme(theme);
        if (highContrast !== undefined) applyContrast(highContrast);
        if (view !== undefined) setRepresentation(view);
        if (categorySet !== undefined) setCategorySet(categorySet);
        if (mode !== undefined) {
            if (!Object.hasOwn(PLOT_MODES, mode)) throw new Error(`Unknown plot mode "${mode}".`);
            switchMode(mode);
        }
        if (visibleCategories !== undefined) {
            if (!Array.isArray(visibleCategories)) throw new Error("visibleCategories must be an array.");
            const requested = new Set(visibleCategories.map(resolveCategory));
            for (const key of Object.keys(CATEGORIES)) toggleCategory(key, requested.has(key));
        }
        isolateHighlights = false;
        syncParticleVisibility();
        return this.getSceneState();
    },

    showForceNetwork(force, visible = true, exclusive = false) {
        if (!Object.hasOwn(FORCES, force)) throw new Error(`Unknown force network "${force}".`);
        if (exclusive) {
            for (const key of Object.keys(FORCES)) setForceVisibility(key, false);
        }
        setForceVisibility(force, visible);
        return this.getSceneState();
    },

    highlightParticles(names, isolate = false) {
        if (!Array.isArray(names) || names.length === 0 || names.length > 12) {
            throw new Error("Choose between one and twelve particles to highlight.");
        }
        const indices = [...new Set(names.map(findParticleIndex))];
        clearFocusedParticle();
        comparisonIndices.length = 0;
        renderComparisonWorkspace();
        setHighlights(indices, isolate);
        return {
            highlighted: indices.map((idx) => particleData[idx].fullName),
            isolated: isolate,
        };
    },

    resetExplorer() {
        applyScenePreset("overview");
        return this.getSceneState();
    },

    describeToolResult(toolName, result) {
        switch (toolName) {
            case "get_particle_catalog": return `${result.count} particles returned`;
            case "get_scene_state": return `Scene inspected in ${result.plotMode} mode`;
            case "focus_particle": return `Focused ${result.focused.name}`;
            case "compare_particles": return `Compared ${result.compared.map((particle) => particle.name).join(", ")}`;
            case "configure_plot": return `Configured ${result.plotMode} in ${result.theme} mode`;
            case "show_force_network": return `Visible forces: ${result.visibleForces.join(", ") || "none"}`;
            case "highlight_particles": return `Highlighted ${result.highlighted.join(", ")}`;
            case "reset_explorer": return "Restored the default explorer";
            default: return "Updated Particle Atlas";
        }
    },
};

window.particleAtlas = particleAtlas;

const viewTabs = document.getElementById("view-tabs");
const particleTableView = document.getElementById("particle-table-view");
const particleTableBody = document.getElementById("particle-table-body");
const particleTableCount = document.getElementById("particle-table-count");
const sceneAnnouncer = document.getElementById("scene-announcer");

function setRepresentation(view) {
    if (!["3d", "table"].includes(view)) throw new Error(`Unknown representation "${view}".`);
    currentRepresentation = view;
    document.body.dataset.view = view;
    particleTableView.hidden = view !== "table";
    renderer.domElement.setAttribute("aria-hidden", String(view !== "3d"));
    for (const tab of viewTabs.querySelectorAll("[data-view]")) {
        const selected = tab.dataset.view === view;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
    }
    if (view === "table") renderParticleTable();
    scheduleSceneUrlUpdate();
    return view;
}

function renderParticleTable() {
    if (!particleTableBody) return;
    const visible = particleData
        .map((particle, idx) => ({ particle, idx }))
        .filter(({ particle }) => categoryVisibility.get(particle.category) !== false);
    particleTableCount.textContent = `${visible.length} entries`;
    particleTableBody.replaceChildren();

    for (const { particle, idx } of visible) {
        const row = document.createElement("tr");
        if (particle.massStatus.startsWith("hypothetical")) row.classList.add("hypothetical");
        const values = [
            { html: particle.name, className: "particle-table-symbol" },
            { text: particle.fullName },
            { text: CATEGORIES[particle.category].label },
            { text: formatParticleMass(particle) },
            { text: particle.massStatus },
            { text: `${formatCharge(particle.charge)}e` },
            { text: formatCharge(particle.spin) },
            { text: formatCharge(particle.isospin) },
        ];
        for (const value of values) {
            const cell = document.createElement("td");
            if (value.html) cell.innerHTML = value.html;
            else cell.textContent = value.text;
            if (value.className) cell.className = value.className;
            row.appendChild(cell);
        }

        const actions = document.createElement("td");
        actions.className = "particle-table-actions";
        const focusButton = document.createElement("button");
        focusButton.type = "button";
        focusButton.textContent = "View in 3D";
        focusButton.addEventListener("click", () => {
            setRepresentation("3d");
            particleAtlas.focusParticle(particle.fullName);
        });
        const compareButton = document.createElement("button");
        compareButton.type = "button";
        compareButton.textContent = comparisonIndices.includes(idx) ? "Added" : "Compare";
        compareButton.disabled = comparisonIndices.includes(idx) || comparisonIndices.length >= 6;
        compareButton.addEventListener("click", () => addParticleToComparison(idx));
        actions.append(focusButton, compareButton);
        row.appendChild(actions);
        particleTableBody.appendChild(row);
    }
}

viewTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-view]");
    if (tab) setRepresentation(tab.dataset.view);
});

viewTabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const view = currentRepresentation === "3d" ? "table" : "3d";
    setRepresentation(view);
    viewTabs.querySelector(`[data-view="${view}"]`).focus();
});

function compactVector(values) {
    return values.map((value) => Number(value.toFixed(3))).join(",");
}

function parseVector(value, expectedLength = 3) {
    if (!value) return null;
    const values = value.split(",").map(Number);
    return values.length === expectedLength && values.every(Number.isFinite) ? values : null;
}

function serializeSceneUrl() {
    const state = particleAtlas.captureSceneState();
    const params = new URLSearchParams();
    params.set("mode", state.plotMode);
    params.set("theme", state.theme);
    params.set("contrast", state.highContrast ? "high" : "normal");
    params.set("view", state.representation);
    params.set("preset", state.preset);
    params.set("categories", Object.entries(state.categories).filter(([, visible]) => visible).map(([key]) => key).join(","));
    if (Object.values(state.forces).some(Boolean)) {
        params.set("forces", Object.entries(state.forces).filter(([, visible]) => visible).map(([key]) => key).join(","));
    }
    if (state.comparisonParticles.length) params.set("compare", state.comparisonParticles.join(","));
    else if (state.highlightedParticles.length) params.set("highlight", state.highlightedParticles.join(","));
    if (state.isolated) params.set("isolate", "1");
    if (state.focusedParticle) params.set("focus", state.focusedParticle);
    params.set("camera", compactVector(state.camera));
    params.set("target", compactVector(state.target));
    params.set("rotation", compactVector(state.worldRotation));
    return params;
}

function updateSceneUrl() {
    if (!sceneUrlReady) return;
    const url = new URL(window.location.href);
    url.search = serializeSceneUrl().toString();
    history.replaceState(null, "", url);
}

function scheduleSceneUrlUpdate() {
    if (!sceneUrlReady) return;
    clearTimeout(sceneUrlTimer);
    sceneUrlTimer = setTimeout(updateSceneUrl, 120);
}

function applySceneUrl() {
    const params = new URLSearchParams(window.location.search);
    const knownKeys = new Set(["mode", "theme", "contrast", "view", "preset", "categories", "forces", "compare", "highlight", "isolate", "focus", "camera", "target", "rotation"]);
    if (![...params.keys()].some((key) => knownKeys.has(key))) return false;

    const snapshot = particleAtlas.captureSceneState();
    const mode = params.get("mode");
    const theme = params.get("theme");
    const preset = params.get("preset");
    if (mode && Object.hasOwn(PLOT_MODES, mode)) snapshot.plotMode = mode;
    if (theme && Object.hasOwn(THEME_PALETTE, theme)) snapshot.theme = theme;
    snapshot.highContrast = params.get("contrast") === "high";
    snapshot.representation = params.get("view") === "table" ? "table" : "3d";
    snapshot.preset = preset && (preset === "custom" || Object.hasOwn(SCENE_PRESETS, preset)) ? preset : "custom";

    if (params.has("categories")) {
        const visible = new Set(params.get("categories").split(",").filter((key) => Object.hasOwn(CATEGORIES, key)));
        snapshot.categories = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, visible.has(key)]));
    }
    const visibleForces = new Set((params.get("forces") ?? "").split(",").filter((key) => Object.hasOwn(FORCES, key)));
    snapshot.forces = Object.fromEntries(Object.keys(FORCES).map((key) => [key, visibleForces.has(key)]));
    snapshot.comparisonParticles = (params.get("compare") ?? "").split(",").filter(Boolean);
    snapshot.highlightedParticles = snapshot.comparisonParticles.length
        ? snapshot.comparisonParticles
        : (params.get("highlight") ?? "").split(",").filter(Boolean);
    snapshot.isolated = params.get("isolate") === "1";
    snapshot.focusedParticle = params.get("focus") || null;
    snapshot.camera = parseVector(params.get("camera")) ?? snapshot.camera;
    snapshot.target = parseVector(params.get("target")) ?? snapshot.target;
    snapshot.worldRotation = parseVector(params.get("rotation")) ?? snapshot.worldRotation;
    snapshot.preZoom = null;
    particleAtlas.restoreSceneState(snapshot);
    return true;
}

const particleSearch = document.getElementById("particle-search");
const particleSearchInput = document.getElementById("particle-search-input");
const particleSearchClear = document.getElementById("particle-search-clear");
const particleSearchResults = document.getElementById("particle-search-results");
let particleSearchMatches = [];
let particleSearchActiveIndex = -1;

function closeParticleSearch() {
    particleSearchResults.classList.remove("open");
    particleSearchInput.setAttribute("aria-expanded", "false");
    particleSearchInput.removeAttribute("aria-activedescendant");
    particleSearchActiveIndex = -1;
}

function chooseParticleSearchResult(idx) {
    const particleIndex = particleSearchMatches[idx];
    if (particleIndex === undefined) return;
    const particle = particleData[particleIndex];
    particleSearchInput.value = particle.fullName;
    particleSearchClear.hidden = false;
    closeParticleSearch();
    particleAtlas.focusParticle(particle.fullName);
}

function setParticleSearchActive(idx) {
    const options = [...particleSearchResults.children];
    if (options.length === 0) return;
    particleSearchActiveIndex = (idx + options.length) % options.length;
    options.forEach((option, optionIdx) => {
        const active = optionIdx === particleSearchActiveIndex;
        option.classList.toggle("active", active);
        option.setAttribute("aria-selected", String(active));
    });
    const activeOption = options[particleSearchActiveIndex];
    particleSearchInput.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({ block: "nearest" });
}

function renderParticleSearch(query) {
    const normalized = normalizeName(query);
    particleSearchResults.replaceChildren();
    particleSearchMatches = [];
    particleSearchActiveIndex = -1;
    particleSearchClear.hidden = query.length === 0;

    if (!normalized) {
        closeParticleSearch();
        return;
    }

    particleSearchMatches = particleData
        .map((particle, idx) => ({
            idx,
            name: normalizeName(particle.fullName),
            symbol: normalizeName(textFromMarkup(particle.name)),
            category: normalizeName(CATEGORIES[particle.category].label),
        }))
        .filter(({ name, symbol, category }) => name.includes(normalized) || symbol.includes(normalized) || category.includes(normalized))
        .map((match) => ({
            ...match,
            score: match.name === normalized ? 0
                : match.symbol === normalized ? 1
                    : match.name.startsWith(normalized) ? 2
                        : match.symbol.startsWith(normalized) ? 3
                            : match.name.includes(normalized) ? 4 : 5,
        }))
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
        .slice(0, 8)
        .map(({ idx }) => idx);

    for (const [resultIdx, particleIdx] of particleSearchMatches.entries()) {
        const particle = particleData[particleIdx];
        const option = document.createElement("li");
        option.id = `particle-search-option-${resultIdx}`;
        option.className = "particle-search-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");

        const symbol = document.createElement("span");
        symbol.className = "particle-search-symbol";
        symbol.innerHTML = particle.name;
        const name = document.createElement("span");
        name.className = "particle-search-name";
        name.textContent = particle.fullName;
        const category = document.createElement("span");
        category.className = "particle-search-category";
        category.textContent = CATEGORIES[particle.category].label;
        const compareButton = document.createElement("button");
        compareButton.className = "particle-search-compare";
        compareButton.type = "button";
        compareButton.textContent = comparisonIndices.includes(particleIdx) ? "\u2713" : "+";
        compareButton.disabled = comparisonIndices.includes(particleIdx) || comparisonIndices.length >= 6;
        compareButton.setAttribute("aria-label", `Add ${particle.fullName} to comparison`);
        compareButton.title = comparisonIndices.includes(particleIdx) ? "Already in comparison" : `Compare ${particle.fullName}`;
        compareButton.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (addParticleToComparison(particleIdx)) {
                compareButton.textContent = "\u2713";
                compareButton.disabled = true;
                compareButton.title = "Already in comparison";
            }
        });

        option.append(symbol, name, category, compareButton);
        option.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            chooseParticleSearchResult(resultIdx);
        });
        particleSearchResults.appendChild(option);
    }

    const hasResults = particleSearchMatches.length > 0;
    particleSearchResults.classList.toggle("open", hasResults);
    particleSearchInput.setAttribute("aria-expanded", String(hasResults));
    if (hasResults) setParticleSearchActive(0);
}

particleSearchInput.addEventListener("input", () => renderParticleSearch(particleSearchInput.value));
particleSearchInput.addEventListener("focus", () => renderParticleSearch(particleSearchInput.value));
particleSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        setParticleSearchActive(particleSearchActiveIndex + 1);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setParticleSearchActive(particleSearchActiveIndex - 1);
    } else if (event.key === "Enter" && particleSearchActiveIndex >= 0) {
        event.preventDefault();
        chooseParticleSearchResult(particleSearchActiveIndex);
    } else if (event.key === "Escape") {
        closeParticleSearch();
    }
});
particleSearchClear.addEventListener("click", () => {
    particleSearchInput.value = "";
    particleSearchClear.hidden = true;
    closeParticleSearch();
    particleSearchInput.focus();
});
document.addEventListener("pointerdown", (event) => {
    if (!particleSearch.contains(event.target)) closeParticleSearch();
});

const webMCPStatus = document.getElementById("webmcp-status");
const agentActivity = document.getElementById("agent-activity");

function setWebMCPStatus({ state, count = 0 }) {
    const labels = {
        unavailable: "Manual mode",
        registering: "Registering tools",
        ready: `${count} tools ready`,
        error: "Registration failed",
    };
    webMCPStatus.textContent = labels[state] ?? state;
    webMCPStatus.className = state;
    webMCPStatus.title = state === "unavailable"
        ? "WebMCP tools activate automatically in a supported browser"
        : "";
}

function recordAgentActivity({ name, summary, ok, args, result, undoState }) {
    agentActivity.querySelector(".empty")?.remove();
    const item = document.createElement("li");
    if (!ok) item.classList.add("error");

    const heading = document.createElement("div");
    heading.className = "agent-activity-heading";
    const tool = document.createElement("strong");
    tool.textContent = name;
    const detail = document.createElement("span");
    detail.textContent = summary;
    heading.append(tool, detail);

    if (undoState) {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "agent-undo";
        undo.textContent = "Undo";
        undo.title = `Undo ${name}`;
        undo.addEventListener("click", () => {
            particleAtlas.restoreSceneState(undoState);
            undo.disabled = true;
            undo.textContent = "Undone";
            item.classList.add("undone");
        });
        heading.appendChild(undo);
    }

    if (args !== undefined || result !== undefined) {
        const inspection = document.createElement("details");
        inspection.className = "agent-activity-details";
        const inspectionLabel = document.createElement("summary");
        inspectionLabel.textContent = "Inspect";
        const payload = document.createElement("pre");
        payload.textContent = JSON.stringify({ input: args ?? {}, output: result }, null, 2);
        inspection.append(inspectionLabel, payload);
        item.append(heading, inspection);
    } else {
        item.appendChild(heading);
    }

    agentActivity.prepend(item);
    while (agentActivity.children.length > 8) agentActivity.lastElementChild.remove();
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
        const currentRadius = SPHERE_RADIUS * mesh.scale.x;
        const sphereScreenPx = (currentRadius / particleDist) * projScale * 2;

        // Outside: font proportional to screen size of sphere (capped to 28px)
        const outsideSize = Math.min(Math.max(6, sphereScreenPx * 0.7), 28);
        // Inside: fill the sphere (capped to 40px)
        const insideSize = Math.min(Math.max(9, sphereScreenPx * 0.55), 40);

        const offset = 0.08 * (1 - t);
        const fontSize = outsideSize + (insideSize - outsideSize) * t;
        const opacity = 0.7 + 0.25 * t;

        if (leaderOffset) {
            // Overlapping particle: label sits at end of leader line
            css2d.position.copy(leaderOffset);
            div.style.fontSize = Math.max(8, Math.min(outsideSize * 0.9, 26)) + "px";
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
    if (isZoomedIn || zoomAnimation) return;

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

    if (zoomAnimation) {
        const t = (performance.now() - zoomAnimation.startTime) / zoomAnimation.duration;
        if (t >= 1) {
            camera.position.copy(zoomAnimation.endPos);
            controls.target.copy(zoomAnimation.endTarget);
            zoomAnimation = null;
            if (!isZoomedIn) controls.enabled = true;
        } else {
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            camera.position.lerpVectors(zoomAnimation.startPos, zoomAnimation.endPos, ease);
            controls.target.lerpVectors(zoomAnimation.startTarget, zoomAnimation.endTarget, ease);
        }
    }

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

    const buildSegment = ({ title, values, dataKey }) => {
        const control = document.createElement("div");
        control.className = "mode-control";
        const controlLabel = document.createElement("span");
        controlLabel.className = "mode-control-label";
        controlLabel.textContent = title;
        const segment = document.createElement("div");
        segment.className = "segmented-control";

        for (const { value, text } of values) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "mode-btn";
            button.dataset[dataKey] = value;
            button.textContent = text;
            button.addEventListener("click", () => {
                const current = PLOT_MODES[currentMode];
                const massScale = dataKey === "massScale" ? value : current.massScale;
                const zProp = dataKey === "zProp" ? value : current.zProp;
                const nextMode = Object.keys(PLOT_MODES).find((key) => {
                    return PLOT_MODES[key].massScale === massScale && PLOT_MODES[key].zProp === zProp;
                });
                switchMode(nextMode);
            });
            segment.appendChild(button);
        }

        control.append(controlLabel, segment);
        container.appendChild(control);
    };

    buildSegment({
        title: "Mass scale",
        dataKey: "massScale",
        values: [{ value: "linear", text: "Linear" }, { value: "log", text: "Log" }],
    });
    buildSegment({
        title: "Third axis",
        dataKey: "zProp",
        values: [{ value: "spin", text: "Spin" }, { value: "isospin", text: "Isospin" }],
    });
}

// ── Init ──
createAxes();
createGrid();
createParticles();
setupInteractions();
buildControls();
buildModeSwitcher();
switchMode(currentMode); // apply correct axis visibility and particle positions for default mode
activePreset = "overview";
scenePresetSelect.value = "overview";
applyTheme(currentTheme, { persist: false });
applyContrast(currentContrast, { persist: false });
setRepresentation("3d");
applySceneUrl();
sceneUrlReady = true;

const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", () => {
    applyTheme(currentTheme === "dark" ? "light" : "dark");
});

const shareSceneButton = document.getElementById("share-scene");
shareSceneButton.addEventListener("click", async () => {
    updateSceneUrl();
    const shareUrl = window.location.href;
    try {
        await navigator.clipboard.writeText(shareUrl);
    } catch {
        const fallback = document.createElement("textarea");
        fallback.value = shareUrl;
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand("copy");
        fallback.remove();
    }
    shareSceneButton.textContent = "Copied";
    shareSceneButton.disabled = true;
    setTimeout(() => {
        shareSceneButton.textContent = "Share";
        shareSceneButton.disabled = false;
    }, 1200);
});

controls.addEventListener("end", scheduleSceneUrlUpdate);

let keyboardParticleIndex = -1;
renderer.domElement.addEventListener("keydown", (event) => {
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1
        : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
    const visible = particleMeshes.map((mesh, idx) => mesh.visible ? idx : -1).filter((idx) => idx >= 0);
    if (!visible.length) return;

    if (direction || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const currentPosition = visible.indexOf(keyboardParticleIndex);
        if (event.key === "Home") keyboardParticleIndex = visible[0];
        else if (event.key === "End") keyboardParticleIndex = visible.at(-1);
        else keyboardParticleIndex = visible[(currentPosition + direction + visible.length) % visible.length];
        const particle = particleData[keyboardParticleIndex];
        setHighlights([keyboardParticleIndex], false);
        sceneAnnouncer.textContent = `${particle.fullName}. ${formatParticleMass(particle)}. Charge ${formatCharge(particle.charge)} e. Spin ${formatCharge(particle.spin)}.`;
    } else if (event.key === "Enter" && keyboardParticleIndex >= 0) {
        event.preventDefault();
        showZoomedInfo(keyboardParticleIndex);
    }
});

reducedMotionQuery.addEventListener("change", () => {
    controls.enableDamping = !reducedMotionQuery.matches;
    if (reducedMotionQuery.matches) stopAutoRotate();
    document.querySelectorAll(".rotate-btn").forEach((button) => {
        button.disabled = reducedMotionQuery.matches;
    });
});

const dataSourceDialog = document.getElementById("data-source-dialog");
dataSourceDialog.dataset.source = PARTICLE_DATA_SOURCE.label;
document.getElementById("data-source-close").addEventListener("click", () => dataSourceDialog.close());

window.addEventListener("mousemove", onMouseMove);
window.addEventListener("resize", onResize);

// ── Burger menu (mobile) ──
const controlsToggle = document.getElementById("controls-toggle");
const controlsPanel = document.getElementById("controls");
controlsToggle.addEventListener("click", () => {
    const isOpen = controlsPanel.classList.toggle("open");
    controlsToggle.textContent = isOpen ? "\u2715" : "\u2630";
    controlsToggle.setAttribute("aria-expanded", isOpen);
});

registerWebMCPTools(particleAtlas, {
    onStatus: setWebMCPStatus,
    onActivity: recordAgentActivity,
}).then((controllers) => {
    window.particleAtlasWebMCPControllers = controllers;
}).catch((error) => {
    setWebMCPStatus({ state: "error" });
    recordAgentActivity({ name: "register_tools", summary: error.message, ok: false });
});

animate();
