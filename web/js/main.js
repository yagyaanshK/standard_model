import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { PARTICLES, CATEGORIES, PLOT_MODES } from "./particles.js";
import { createInteractionLines, FORCES } from "./interactions.js";

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

    addAxisLabel("Log₁₀(Mass/MeV)", new THREE.Vector3(AXIS_LENGTH + 3.2, -0.6, 0));
    addAxisLabel("Charge (e)", new THREE.Vector3(-0.8, 2.8, 0));
    zAxisLabelSprite = addAxisLabel(PLOT_MODES[currentMode].axisLabel, new THREE.Vector3(-0.8, -0.6, 3.3));

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

function addAxisLabel(text, position) {
    const { texture, aspect } = makeTextTexture(text);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const height = 0.35;
    sprite.scale.set(height * aspect, height, 1);
    sprite.position.copy(position);
    world.add(sprite);
    return sprite;
}

// ── Grid ──
function createGrid() {
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x222233, transparent: true, opacity: 0.5, depthTest: false });

    for (let x = 0; x <= AXIS_LENGTH + 2; x += 1) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, -2, 0),
            new THREE.Vector3(x, 2, 0),
        ]);
        world.add(new THREE.Line(geo, gridMaterial));
    }
    for (let y = -2; y <= 2; y += 0.5) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, y, 0),
            new THREE.Vector3(AXIS_LENGTH + 2, y, 0),
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
function massToX(mass) {
    const logMass = Math.log10(mass);
    return ((logMass + 3) / 8) * AXIS_LENGTH;
}

const particleMeshes = [];
const particleData = [];
const particleLabels = []; // { css2d, div } for dynamic positioning
const sharedGeometry = new THREE.SphereGeometry(0.12, 24, 24);
const SPHERE_RADIUS = 0.12;

// Anti-particle highlight ring
const ANTI_CATEGORIES = new Set(["antiLeptons", "antiNeutrinos", "antiQuarks"]);
const ringGeometry = new THREE.TorusGeometry(SPHERE_RADIUS * 1.25, 0.012, 12, 48);
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
        label.position.set(0, 0.18, 0); // default: outside
        mesh.add(label);
        particleLabels.push({ css2d: label, div });
    });
}

// ── Particle positioning ──
function positionParticle(mesh, p) {
    const zValue = p[currentMode];
    // Slightly offset overlapping particles at the origin for visibility
    let yOff = 0, zOff = 0;
    if (p.name === "g") { yOff = 0.3; }
    if (p.name === "γ") { zOff = 0.3; }
    if (p.name === "G") { yOff = -0.3; }
    mesh.position.set(massToX(p.mass), p.charge + yOff, zValue + zOff);
}

function switchMode(mode) {
    currentMode = mode;
    // Update particle positions
    particleMeshes.forEach((mesh, i) => {
        positionParticle(mesh, particleData[i]);
    });
    // Update z-axis label sprite
    if (zAxisLabelSprite) {
        const { texture, aspect } = makeTextTexture(PLOT_MODES[mode].axisLabel);
        zAxisLabelSprite.material.map.dispose();
        zAxisLabelSprite.material.map = texture;
        zAxisLabelSprite.material.needsUpdate = true;
        const height = 0.35;
        zAxisLabelSprite.scale.set(height * aspect, height, 1);
    }
    // Update mode switcher UI
    document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
}

// ── Interaction lines ──
let interactionGroups = {};

function setupInteractions() {
    interactionGroups = createInteractionLines(particleMeshes, massToX);
    for (const group of Object.values(interactionGroups)) {
        world.add(group);
    }
}

// ── Hover / Tooltip ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById("tooltip");
let hoveredMesh = null;

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(particleMeshes);

    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const p = particleData[mesh.userData.index];

        if (hoveredMesh !== mesh) {
            resetHover();
            hoveredMesh = mesh;
            mesh.scale.setScalar(1.4);
        }

        tooltip.style.display = "block";
        tooltip.style.left = event.clientX + 16 + "px";
        tooltip.style.top = event.clientY - 10 + "px";
        tooltip.innerHTML = `
            <div class="tooltip-name">${p.name}</div>
            <div class="tooltip-fullname">${p.fullName}</div>
            <div class="tooltip-row">Category: <span>${CATEGORIES[p.category].label}</span></div>
            <div class="tooltip-row">Mass: <span>${formatMass(p.mass)}</span></div>
            <div class="tooltip-row">Charge: <span>${formatCharge(p.charge)}e</span></div>
            <div class="tooltip-row">Spin: <span>${formatCharge(p.spin)}</span></div>
            <div class="tooltip-row">Isospin I₃: <span>${formatCharge(p.isospin)}</span></div>
        `;
    } else {
        resetHover();
        tooltip.style.display = "none";
    }
}

function resetHover() {
    if (hoveredMesh) {
        hoveredMesh.scale.setScalar(1);
        hoveredMesh = null;
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
        const { css2d, div } = particleLabels[i];
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

        const offset = 0.18 * (1 - t);
        const fontSize = outsideSize + (insideSize - outsideSize) * t;
        const opacity = 0.7 + 0.25 * t;

        // Convert camera up to mesh's local space so label is always "above" on screen
        mesh.parent.getWorldQuaternion(_parentWorldQuatInv);
        _parentWorldQuatInv.invert();
        _localUp.copy(_camUp).applyQuaternion(_parentWorldQuatInv).normalize();

        css2d.position.copy(_localUp).multiplyScalar(offset);
        div.style.fontSize = fontSize + "px";
        div.style.color = `rgba(255, 255, 255, ${opacity})`;
    }
}

// ── Billboard anti-particle rings toward camera ──
const _camDir = new THREE.Vector3();
const _ringWorldPos = new THREE.Vector3();
const _parentWorldQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();
const _lookMat = new THREE.Matrix4();

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
setupInteractions();
buildControls();
buildModeSwitcher();

window.addEventListener("mousemove", onMouseMove);
window.addEventListener("resize", onResize);

animate();
