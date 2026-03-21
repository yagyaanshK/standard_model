# Standard Model 3D Explorer — Implementation Walkthrough

An interactive 3D visualization of all Standard Model particles plotted on physical axes (mass, charge, spin/isospin) using vanilla Three.js with no build tools.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| 3D engine | Three.js 0.170.0 via CDN (ES module importmap from `esm.sh`) |
| Module format | Native ES modules (`<script type="module">`) |
| Label rendering | `CSS2DRenderer` for particle text, `THREE.Sprite` for axis labels |
| Camera controls | `OrbitControls` (left-click rotate, right-click pan, scroll zoom) |
| Build tools | None — runs directly in any modern browser |

---

## File Structure

```
web/
├── index.html          # Entry point, importmap, DOM scaffold
├── style.css           # All styles: panels, tooltips, labels, layout
└── js/
    ├── main.js         # Scene setup, particles, axes, grid, hover, animation loop
    ├── particles.js    # Particle data (31 particles) and category colors
    └── interactions.js # Force interaction lines (strong, EM, weak)
```

---

## Architecture

### Scene Graph

```
scene
├── AmbientLight
├── PointLight
└── world (THREE.Group)              ← all visible objects; rotated for auto-rotate
    ├── Axis lines (x, y, z)         ← LineBasicMaterial, depthTest: false
    ├── Axis label sprites           ← THREE.Sprite with CanvasTexture
    ├── Cone arrowheads              ← ConeGeometry at axis tips
    ├── Grid lines                   ← mass-charge plane + charge-spin plane
    ├── Particle meshes[0..30]       ← SphereGeometry, renderOrder: 1
    │   ├── CSS2DObject (label)      ← DOM text label, child of mesh
    │   └── Torus ring (if anti-particle) ← billboard ring
    ├── Leader lines                 ← dashed lines for overlapping particles
    └── Interaction line groups      ← strong / EM / weak (hidden by default)
```

The `world` group pattern allows auto-rotation of all objects without conflicting with `OrbitControls` (which controls the camera).

### Renderers

Two renderers are layered:
1. **WebGLRenderer** — 3D scene (particles, axes, grid, rings)
2. **CSS2DRenderer** — DOM-based text labels overlaid on 3D positions

The CSS2D renderer's container has `pointer-events: none` so it doesn't block WebGL interactions. Individual overlap labels opt in with `pointer-events: auto`.

---

## Coordinate System & Axes

| Axis | Property | Mapping |
|------|----------|---------|
| X | Mass | `massToX(mass) = ((log10(mass) + 3) / 8) * AXIS_LENGTH` |
| Y | Charge | Direct value in units of *e* (range: -1 to +1 for leptons, ±1/3, ±2/3 for quarks) |
| Z | Spin or Isospin | Switchable via mode buttons |

- `AXIS_LENGTH = 6` — controls the mass axis scale. Changing this affects `massToX()` output.
- Mass uses a log scale: mass values from ~10⁻³ MeV (neutrinos) to ~1.7×10⁵ MeV (top quark) map to x ∈ [0, AXIS_LENGTH].

### Axis Labels

Axis labels use `THREE.Sprite` with `CanvasTexture` (not CSS2D) so they participate in the depth buffer and can be occluded by particles. Created via:
1. `makeTextTexture(text)` — renders text onto a canvas with a rounded-rect background
2. `addAxisLabel(text, position)` — creates a Sprite with `depthTest: true, depthWrite: false`

### Arrowheads

3D `ConeGeometry` meshes at axis tips, rotated to point along each axis direction. This avoids the problem of text arrows ("→") rotating with sprites.

---

## Grid

Two grid planes:
1. **Mass-Charge plane** (z=0) — x from 0 to `AXIS_LENGTH + 2`, y from -2 to +2
2. **Charge-Spin/Isospin plane** (x=0) — y from -2 to +2, z from -3 to +3

Grid and axis lines use `depthTest: false` and `opacity: 0.5` so particles always render on top.

---

## Particle Data (`particles.js`)

### Categories

| Category | Color | Description |
|----------|-------|-------------|
| Leptons | `#88dd55` (green) | e⁻, μ⁻, τ⁻ |
| Neutrinos | `#88dd55` (green) | νₑ, νμ, ντ |
| Anti-leptons | `#88dd55` (green) | e⁺, μ⁺, τ⁺ |
| Anti-neutrinos | `#88dd55` (green) | ν̄ₑ, ν̄μ, ν̄τ |
| Quarks | `#cc99ee` (purple) | u, d, s, c, t, b |
| Anti-quarks | `#cc99ee` (purple) | ū, d̄, s̄, c̄, t̄, b̄ |
| Gauge Bosons | `#ee775e` (red) | γ, g, W⁺, W⁻, Z⁰ |
| Scalar Bosons | `#eed055` (yellow) | H (Higgs) |
| Tensor Bosons | `#888899` (grey) | G (graviton, hypothetical) |

### Plot Modes

Two modes switchable via the top-left panel:
- **Spin**: z-axis maps to particle spin (0, ½, 1, 2)
- **Isospin**: z-axis maps to weak isospin I₃ (-1, -½, 0, +½, +1)

Each particle stores: `name` (HTML), `fullName`, `mass` (MeV), `charge` (e), `isospin`, `spin`, `category`.

---

## Anti-Particle Rings

Anti-particles (categories: `antiLeptons`, `antiNeutrinos`, `antiQuarks`) get a bright-hue torus ring around their sphere.

### Ring Material

`getBrightRingMaterial(baseColor)`:
- Converts the category's base color to HSL
- Increases saturation by ×1.3 and lightness by ×1.6
- Caches per category color to avoid redundant material creation

### Ring Billboarding

Rings must always face the camera (appear as circles, not edge-on ellipses). `updateAntiRings()` runs every frame:
1. Gets the ring's world position
2. Builds a world-space lookAt quaternion toward the camera
3. Converts to local space by multiplying with the inverse of the parent mesh's world quaternion
4. Sets `ring.quaternion` to the result

---

## Label System

### Dynamic Positioning

`updateLabels()` runs every frame. Labels transition between two states based on camera orbit distance:

| Distance | Behavior |
|----------|----------|
| Far (> 14 units) | Labels sit outside/above the sphere, sized proportional to sphere's screen size |
| Near (< 5 units) | Labels sit inside the sphere, fill the sphere area |
| Between | Smooth interpolation using `t = clamp((FAR - dist) / (FAR - NEAR), 0, 1)` |

### Camera-Up Billboarding

Non-overlapping labels are always positioned "above" the sphere relative to the screen, regardless of world rotation:
1. Get camera's up direction in world space: `(0,1,0).applyQuaternion(camera.quaternion)`
2. Convert to mesh's local space: multiply by inverse of parent's world quaternion
3. Position label along that local-up direction

### Per-Particle Distance Sizing

Each particle's label size is computed individually based on its distance to the camera (not just orbit distance). This means distant particles get proportionally smaller labels:
- `sphereScreenPx = (SPHERE_RADIUS / particleDist) * projScale * 2`
- Outside size: `max(6, sphereScreenPx * 0.7)`
- Inside size: `max(9, sphereScreenPx * 0.55)`

---

## Overlap Resolution System

Multiple particles can occupy the same 3D coordinates (e.g., all 3 neutrinos at mass≈0, charge=0, spin=½). The overlap system handles this.

### Detection

`posKey(p)` generates a string key from the particle's quantized position (`massToX(mass).toFixed(4), charge.toFixed(4), mode_value.toFixed(4)`). Particles are grouped by this key.

### Visual Treatment

For groups with > 1 particle at the same position:

1. **Shrink spheres**: `scale = max(0.35, 0.8 / groupSize)` — stored in `overlapScales` Map
2. **Spread labels**: Fan out in the mass-charge (x-y) plane with a small z component
   - `spreadRadius = 0.25 + groupSize * 0.06`
   - Offsets are divided by `shrink` to compensate for mesh scale (since labels are children of the mesh)
3. **Leader lines**: Dashed lines from mesh center to label position
   - Added to `world` group (NOT as mesh children) so they're immune to mesh scale changes
   - Use uncompensated world-space offsets for correct positioning
   - Color-matched to particle category with 50% opacity

### Hover for Overlapping Particles

Since shrunk spheres are too small to hover via raycaster, overlapping particle labels get `pointer-events: auto` via the `.overlap-interactive` CSS class:

- `onmouseenter` → show tooltip with particle info
- `onmousemove` → update tooltip position
- `onmouseleave` → hide tooltip

The window-level `onMouseMove` handler has an early return for events targeting `.overlap-interactive` elements, preventing raycaster interference.

For non-overlapping particles, raycaster-based hover scales the mesh to 1.4× on hover and shows the tooltip.

### Scale Restoration

`resetHover()` restores the previously hovered mesh's scale:
- Overlap particles: restored to their `overlapScales` value (shrunk)
- Normal particles: restored to 1.0

---

## Interaction Lines (`interactions.js`)

Three force types, each rendered as a `THREE.Group` of lines between interacting particle pairs:

| Force | Color | Connects |
|-------|-------|----------|
| Strong | Red `#ff3333` | Quarks ↔ Anti-quarks |
| EM | Blue `#3388ff` | All charged particles (pairwise) |
| Weak | Green `#33cc66` | Leptons/neutrinos ↔ Quarks/anti-quarks |

All hidden by default; toggled via checkboxes in the controls panel.

---

## Controls Panel (Right Side)

Built dynamically in `buildControls()`:

1. **Category Filters** — Checkboxes to show/hide particle categories. Toggles `mesh.visible` for matching particles.
2. **View Controls**
   - Rotate buttons (Mass/Charge/Isospin axis) — auto-rotates the `world` group at `ROTATE_SPEED = 0.008` rad/frame
   - Reset View — restores camera position `(8, 5, 8)`, orbit target `(2, 0, 0)`, and world rotation to identity
3. **Interaction Toggles** — Checkboxes for each force type

---

## Mode Switching

`switchMode(mode)`:
1. Updates `currentMode` (affects z-axis mapping)
2. Repositions all particles via `positionParticle()`
3. Re-runs `resolveOverlaps()` (different mode = different overlap groups)
4. Updates the z-axis label sprite texture
5. Updates mode button active states

---

## Animation Loop

`animate()` runs every frame via `requestAnimationFrame`:
1. `applyAutoRotate()` — rotates world group if auto-rotate is active
2. `updateLabels()` — reposition/resize all labels based on camera
3. `updateAntiRings()` — billboard all anti-particle rings
4. `controls.update()` — OrbitControls damping
5. `renderer.render()` — WebGL pass
6. `labelRenderer.render()` — CSS2D pass

---

## Initialization Order

```
createAxes()        → axis lines, sprites, cone arrowheads
createGrid()        → grid lines on two planes
createParticles()   → spheres, rings, CSS2D labels
resolveOverlaps()   → shrink/spread overlapping particles
setupInteractions() → force lines (hidden)
buildControls()     → right panel UI
buildModeSwitcher() → top-left mode buttons

window.addEventListener("mousemove", onMouseMove)
window.addEventListener("resize", onResize)

animate()           → start render loop
```

---

## Key Implementation Details & Gotchas

### Why `AXIS_LENGTH = 6` must not change
The `massToX()` function maps log-scale mass to the range `[0, AXIS_LENGTH]`. Changing it stretches/compresses the mass distribution and breaks the visual scale. To extend the axis visually, extend grid/axis lines beyond `AXIS_LENGTH` instead.

### CSS2D vs Sprite for labels
- **Particle labels** use CSS2D (`CSS2DRenderer`) for sharp DOM text at any zoom level
- **Axis labels** use `THREE.Sprite` with `CanvasTexture` so they participate in the depth buffer and can be occluded by particles. CSS2D elements always render on top of WebGL content.

### Leader lines in world space
Leader lines are added to the `world` group (not as children of particle meshes) so that mesh scale changes during hover don't affect their length. The label CSS2DObject remains a mesh child with scale-compensated offsets.

### Render ordering
- Particles use `renderOrder: 1` to render on top of grid/axis lines
- Grid and axis lines use `depthTest: false` so they don't occlude particles
- Axis label sprites use `depthTest: true, depthWrite: false` for correct occlusion without blocking other objects

### Event handling for overlapping particles
The CSS2D renderer container has `pointer-events: none`. Overlap labels opt in with `pointer-events: auto`. The window-level `mousemove` handler checks `event.target.closest(".overlap-interactive")` to avoid raycaster interference when hovering labels.

---

## CSS Highlights

| Selector | Purpose |
|----------|---------|
| `.particle-label` | Base label style: small, semi-transparent, `pointer-events: none` |
| `.particle-label.overlap-interactive` | Tight hit area for overlap labels: `padding: 0 1px`, `line-height: 1` |
| `.particle-label .overbar` | Overline decoration for anti-particle symbols (ν̄, ū, etc.) |
| `#tooltip` | Fixed-position hover card with blur backdrop |
| `#nav-hint` | Bottom-center navigation instructions, non-interactive |
