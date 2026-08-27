# OpenAI WebMCP Challenge

Particle Atlas is an agent-native extension of the existing Standard Model 3D explorer. It lets a person and a browser agent inspect and manipulate the same live Three.js scene instead of maintaining separate human and agent interfaces.

## Challenge work boundary

The pre-challenge project is preserved at commit:

`1b71836df854f40117224b79856f1e012172e250`

That commit predates the challenge and contains the particle data, Three.js scene, four plot modes, manual particle filters, force-network overlays, hover/focus UI, and overlap handling.

Work added after the challenge began on August 25, 2026:

- a shared scene command layer used by WebMCP tools
- eight imperative WebMCP tools with JSON schemas
- structured particle and scene-state responses for agents
- visible agent action history and WebMCP status
- reversible agent highlighting, isolation, comparison, and focus actions
- synchronized manual controls and agent actions
- challenge documentation, verification, and an MIT license

## WebMCP tools

| Tool | Reads or changes |
| --- | --- |
| `get_particle_catalog` | Reads particle data with optional name, category, mass, and charge filters |
| `get_scene_state` | Reads the current plot, filters, forces, focus, and highlights |
| `focus_particle` | Focuses the camera and opens the visible property panel |
| `compare_particles` | Returns comparable data and highlights two to six particles |
| `configure_plot` | Selects a curated scene preset, axes, display theme, and visible particle categories |
| `show_force_network` | Shows or hides strong, electromagnetic, or weak interaction lines |
| `highlight_particles` | Highlights or isolates a named particle set |
| `reset_explorer` | Restores the initial scene and closes focused state |

All tools register through `document.modelContext.registerTool()` in `web/js/webmcp.js`. Their handlers call the same scene functions that drive the manual controls in `web/js/main.js`.

## Human-agent workflow

A browser agent can answer a question by combining read and action tools. For example:

1. Read the catalog for charged leptons.
2. Change the plot to logarithmic mass versus charge versus isospin.
3. Compare the electron, muon, and tau and isolate them in the scene.
4. Add the weak interaction network.
5. Return the explorer to its default state.

Every scene-changing tool updates the visible browser UI. The action panel records the latest tool calls, and `reset_explorer` provides a single-step way back to the default view.

## Local verification

Serve the repository over HTTP because the web app uses browser modules:

```bash
python -m http.server 8765 --directory web
```

Then open `http://localhost:8765` in a browser with WebMCP support. In browsers without the experimental API, the full manual explorer remains usable and the status panel reports that WebMCP is unavailable.

## Data scope

This is an educational visualization. Values in `web/js/particles.js` are approximate and should be checked against an authoritative particle-data source before scientific use. The graviton entry is explicitly hypothetical and is not part of the Standard Model.
