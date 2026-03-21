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
├── walkthrough.md      # This file — implementation documentation
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
    ├── Axis tick marks + labels     ← log-scale and linear-scale (toggled by mode)
    ├── Kink zigzag markers          ← between linear-scale segments (visible in linear mode)
    ├── Cone arrowheads              ← ConeGeometry at axis tips
    ├── Grid lines                   ← mass-charge plane + charge-spin plane
    ├── Particle meshes[0..30]       ← SphereGeometry, renderOrder: 1
    │   ├── CSS2DObject (label)      ← DOM text label, child of mesh
    │   └── Torus ring (if anti-particle) ← billboard ring
    ├── Leader lines                 ← dashed lines for overlapping particles
    ├── Multi-color spheres          ← vertex-colored spheres for mixed-category overlaps
    ├── Overlap half-rings           ← partial torus arcs for anti-particle overlap groups
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
| X | Mass | Log or piecewise-linear scale (switchable via mode buttons) |
| Y | Charge | Direct value in units of *e* (range: -1 to +1 for leptons, ±1/3, ±2/3 for quarks) |
| Z | Spin or Isospin | Switchable via mode buttons |

- `AXIS_LENGTH = 6` — controls the mass axis extent.

### Mass Scales

**Log scale** (`massToXLog`):
- `x = ((log10(mass) + 3) / 8) * AXIS_LENGTH`
- Maps ~10⁻³ MeV (neutrinos) to ~10⁵ MeV (top quark) across x ∈ [0, AXIS_LENGTH]
- Tick marks at each power of 10 from 0.01 to 100k MeV

**Piecewise linear scale** (`massToXLinear`):
- Five linear segments separated by kink markers (zigzag on the axis)
- Each step within a segment is the same visual width, and all steps across segments have the same visual width
- This means 0.025 MeV in segment 1 looks the same as 500 MeV in segment 4
- `KINK_GAP_STEPS = 4` — each kink gap is 4 step widths visually

| Segment | Mass Range | Step Size | Steps | Labels | Particles |
|---------|-----------|-----------|-------|--------|-----------|
| 1 | 0–0.1 MeV | 0.025 MeV | 4 | 0, 0.1 | neutrinos (0.001), γ, g, G (0.001) |
| 2 | 0.5–5 MeV | 0.5 MeV | 9 | 0.5, 2, 3, 4, 5 | e (0.511), u (2.2), d (4.7) |
| 3 | 90–110 MeV | 5 MeV | 4 | 90, 100, 110 | s (95), μ (105.66) |
| 4 | 1k–5k MeV | 500 MeV | 8 | 1k, 2k, 3k, 4k, 5k | c (1275), τ (1777), b (4180) |
| 5 | 80k–200k MeV | 10k MeV | 12 | every 20k (80k, 100k, ..., 200k) | W (80,360), Z (91,190), H (124,970), t (173,100) |

The four gaps (0.1–0.5, 5–90, 110–1000, 5000–80000 MeV) contain no particles. Masses falling in gaps are placed at the kink midpoint.

Segment x-ranges are pre-computed at module load time from the step counts and a fixed kink gap of 4 step widths.

`currentMassToX(mass)` dispatches to `massToXLog` or `massToXLinear` based on `PLOT_MODES[currentMode].massScale`.

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

Four modes switchable via the top-left panel, combining two z-axis properties with two mass scales:

| Mode Key | Label | Z-Axis | Mass Scale |
|----------|-------|--------|------------|
| `spin` | Mass (log) / Charge / Spin | Spin (0, ½, 1, 2) | Logarithmic |
| `isospin` | Mass (log) / Charge / Isospin | Isospin I₃ (-1, -½, 0, +½, +1) | Logarithmic |
| `spinLinear` | Mass / Charge / Spin | Spin | Piecewise linear with kinks |
| `isospinLinear` | Mass / Charge / Isospin | Isospin I₃ | Piecewise linear with kinks |

Each mode has `zProp` (property name on particle data) and `massScale` ("log" or "linear") fields.

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

### Overlap Groups by Mode

**Spin mode** (z = spin):
- 6 neutrinos + anti-neutrinos at (mass≈0, charge=0, spin=½) — hexagon in x-y (mass-charge) plane
- γ + g at (mass≈0, charge=0, spin=1) — fan in x-z (mass-spin) plane, away from origin

**Isospin mode** (z = isospin I₃):
- 3 neutrinos at (mass≈0, charge=0, I₃=+½) — fan in y-z plane, pointing +z (away from origin)
- 3 anti-neutrinos at (mass≈0, charge=0, I₃=-½) — fan in y-z plane, pointing -z (away from origin)
- γ, g, G at (mass≈0, charge=0, I₃=0) — fan in x-y plane, 120° equal spacing

### Hardcoded Fan Configurations

Rather than a generic algorithm, fan directions are hardcoded per group type and mode for precise control:

```javascript
// plane: "yz" = charge-spin/isospin, "xy" = mass-charge, "xz" = mass-spin
// baseAngle: central direction of fan (radians)
// Fan configs use zProp (not mode key) so log/linear modes with the same z-axis share configs
if (zProp === "isospin") {
    if (hasNeutrinos)       → plane="yz", baseAngle=0      (fan toward +z)
    if (hasAntiNeutrinos)   → plane="yz", baseAngle=π      (fan toward -z)
    if (hasBosons)          → plane="xy", 120° equal spread
} else { // zProp === "spin"
    if (hasNeutrinos && hasAntiNeutrinos) → plane="xy", hexagon with per-particle angles
    if (hasBosons)                        → plane="xz", baseAngle=π/2 (away from origin)
}
```

This ensures adjacent overlap groups fan their labels in opposite directions, avoiding label collisions.

### Per-Particle Angle Overrides (Hexagon Layout)

For the spin mode neutrino+anti-neutrino group (6 particles), generic fan spread is insufficient — each anti-particle must sit exactly opposite its particle counterpart. A `perParticleAngles` Map assigns explicit angles:

| Particle | Angle | Position |
|----------|-------|----------|
| νₑ | 30° (π/6) | Upper right |
| νμ | 90° (π/2) | Top |
| ντ | 150° (5π/6) | Upper left |
| ν̄ₑ | -150° | Lower left (opposite νₑ) |
| ν̄μ | -90° | Bottom (opposite νμ) |
| ν̄τ | -30° | Lower right (opposite ντ) |

### Visual Treatment

For groups with > 1 particle at the same position:

1. **Shrink spheres**: `scale = max(0.35, 0.8 / groupSize)` — stored in `overlapScales` Map
2. **Spread labels**: Fan out in the configured plane
   - `spreadRadius = 0.25 + groupSize * 0.06`
   - Offsets are divided by `shrink` to compensate for mesh scale (since labels are children of the mesh)
3. **Leader lines**: Dashed lines from mesh center to label position
   - Added to `world` group (NOT as mesh children) so they're immune to mesh scale changes
   - Use uncompensated world-space offsets for correct positioning
   - Color-matched to particle category with 50% opacity
4. **Multi-color spheres**: When overlapping particles have different category colors (e.g., γ/g are red, G is grey), a single vertex-colored sphere replaces the individual meshes

### Multi-Color Sphere System

When an overlap group contains particles with different category colors:

1. A new `SphereGeometry` is created with per-vertex colors
2. Each vertex is assigned to the nearest particle's sector based on its angle in the fan plane
3. The vertex color is set to that particle's category color
4. Individual particle meshes have `material.visible = false` (not `mesh.visible`, which would also hide child labels and rings)
5. The multi-color sphere is added to `world` at the shared position with the overlap shrink scale

Cleanup: multi-color spheres are tracked in `multiColorSpheres[]` and removed/restored on mode switch via `resolveOverlaps()`.

### Overlap Half-Ring System

When an overlap group contains both particles and anti-particles (e.g., neutrinos + anti-neutrinos in spin mode), individual anti-particle rings are hidden and replaced by a single **partial torus arc** covering only the anti-particle region of the shared sphere.

1. **Arc computation**: The angular range of anti-particle sectors is calculated from their fan angles, with π/3 padding
2. **Half-ring geometry**: `TorusGeometry` with arc length matching the anti-particle angular span
3. **Billboarding**: `updateAntiRings()` billboards the half-ring toward the camera, then applies a local z-rotation so the arc aligns with the anti-particle sectors
4. **Ring hiding**: Individual anti-particle rings on overlapping meshes are set to `child.visible = false`
5. **Cleanup**: Tracked in `overlapRings[]`, removed and individual rings restored on mode switch

This preserves the visual distinction between particles and anti-particles even when they share a single overlap sphere — only the anti-particle side shows the bright outline ring.

### Raycaster Exclusion

Overlapping particle meshes are completely excluded from the raycaster:
```javascript
const nonOverlapMeshes = particleMeshes.filter((_, i) => !overlapScales.has(i));
const intersects = raycaster.intersectObjects(nonOverlapMeshes);
```
This prevents false hover triggers on tiny shrunk spheres. Only the spread-out labels handle hover for overlap groups.

### Hover for Overlapping Particles

Overlapping particle labels get `pointer-events: auto` via the `.overlap-interactive` CSS class:

- `onmouseenter` → show tooltip with particle info (no mesh scale change)
- `onmousemove` → update tooltip position
- `onmouseleave` → hide tooltip

The window-level `onMouseMove` handler has an early return for events targeting `.overlap-interactive` elements, preventing raycaster interference.

For non-overlapping particles, raycaster-based hover scales the mesh to 1.4× on hover and shows the tooltip.

### Scale Restoration

`resetHover()` restores the previously hovered mesh's scale:
- Overlap particles: restored to their `overlapScales` value (shrunk)
- Normal particles: restored to 1.0

---

## Category Visibility

`toggleCategory(category, visible)` handles checkbox toggles:

1. **Particle meshes**: sets `mesh.visible` for matching category
2. **Leader lines**: hides/shows lines whose `meshIdx` belongs to the toggled category
3. **Multi-color spheres**: visible only if ALL member particles' categories are currently visible
4. **Overlap half-rings**: visible if at least one anti-particle in the group is visible

This ensures leader lines, multi-color spheres, and overlap rings respect the category filter checkboxes.

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

1. **Category Filters** — Checkboxes to show/hide particle categories. Toggles mesh visibility, leader lines, and multi-color spheres.
2. **View Controls**
   - Rotate buttons (Mass/Charge/Isospin axis) — auto-rotates the `world` group at `ROTATE_SPEED = 0.008` rad/frame
   - Reset View — restores camera position `(8, 5, 8)`, orbit target `(2, 0, 0)`, and world rotation to identity
3. **Interaction Toggles** — Checkboxes for each force type

---

## Mode Switching

`switchMode(mode)`:
1. Updates `currentMode` (affects z-axis mapping and mass scale)
2. Repositions all particles via `positionParticle()` using `currentMassToX()` and `zProp`
3. Re-runs `resolveOverlaps()` (different mode = different overlap groups, fan directions, and multi-color spheres)
4. Updates the z-axis label sprite texture
5. Updates the mass axis label ("log-scale" vs "linear")
6. Toggles log/linear tick mark and kink marker visibility
7. Updates mode button active states

---

## Animation Loop

`animate()` runs every frame via `requestAnimationFrame`:
1. `applyAutoRotate()` — rotates world group if auto-rotate is active
2. `updateLabels()` — reposition/resize all labels based on camera
3. `updateAntiRings()` — billboard all anti-particle rings + overlap half-rings
4. `controls.update()` — OrbitControls damping
5. `renderer.render()` — WebGL pass
6. `labelRenderer.render()` — CSS2D pass

---

## Initialization Order

```
createAxes()        → axis lines, sprites, cone arrowheads
createGrid()        → grid lines on two planes
createParticles()   → spheres, rings, CSS2D labels
resolveOverlaps()   → shrink/spread overlapping particles, create multi-color spheres
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
Both `massToXLog()` and `massToXLinear()` map mass to the range `[0, AXIS_LENGTH]`. The linear segments' x-ranges are pre-computed from `AXIS_LENGTH` at module load. Changing it stretches/compresses the mass distribution and breaks tick mark alignment. To extend the axis visually, extend grid/axis lines beyond `AXIS_LENGTH` instead.

### CSS2D vs Sprite for labels
- **Particle labels** use CSS2D (`CSS2DRenderer`) for sharp DOM text at any zoom level
- **Axis labels** use `THREE.Sprite` with `CanvasTexture` so they participate in the depth buffer and can be occluded by particles. CSS2D elements always render on top of WebGL content.

### Leader lines in world space
Leader lines are added to the `world` group (not as children of particle meshes) so that mesh scale changes during hover don't affect their length. The label CSS2DObject remains a mesh child with scale-compensated offsets.

### `material.visible` vs `mesh.visible`
When hiding overlapping particles for multi-color sphere replacement, use `material.visible = false` instead of `mesh.visible = false`. The latter would also hide child objects (CSS2D labels, anti-particle rings), making labels disappear.

### Render ordering
- Particles use `renderOrder: 1` to render on top of grid/axis lines
- Grid and axis lines use `depthTest: false` so they don't occlude particles
- Axis label sprites use `depthTest: true, depthWrite: false` for correct occlusion without blocking other objects

### Event handling for overlapping particles
The CSS2D renderer container has `pointer-events: none`. Overlap labels opt in with `pointer-events: auto` via `.overlap-interactive` class. The window-level `mousemove` handler checks `event.target.closest(".overlap-interactive")` to avoid raycaster interference when hovering labels. Overlap meshes are fully excluded from the raycaster to prevent false triggers.

### Multi-color sphere vertex coloring
Each vertex of the replacement sphere is assigned to the nearest particle's sector by comparing the vertex's angle in the fan plane to each particle's fan angle. The "nearest angle" approach (with proper [-π, π] wrapping) produces clean sector boundaries.

---

## CSS Highlights

| Selector | Purpose |
|----------|---------|
| `.particle-label` | Base label style: small, semi-transparent, `pointer-events: none` |
| `.particle-label.overlap-interactive` | Tight hit area for overlap labels: `padding: 0 1px`, `line-height: 1` |
| `.particle-label .overbar` | Overline decoration for anti-particle symbols (ν̄, ū, etc.) |
| `#tooltip` | Fixed-position hover card with blur backdrop |
| `#nav-hint` | Bottom-center navigation instructions, non-interactive |
