# OpenAI WebMCP Challenge implementation

Particle Atlas is a shared visual investigation workspace for particle physics. A learner and a browser agent use the same live Three.js scene, comparison table, and editable investigation notebook.

## Challenge work boundary

The pre-challenge project is preserved at commit:

`1b71836df854f40117224b79856f1e012172e250`

That baseline predates August 25, 2026 and contains the particle dataset, Three.js scene, four plot modes, manual category filters, force overlays, hover/focus UI, and overlap handling.

Work added during the challenge includes:

- a shared scene command layer used by manual controls and WebMCP
- eleven structured WebMCP tools
- catalog and scene-state responses designed for agent reasoning
- an editable investigation notebook shared by human and agent
- replayable findings that capture exact visual scene states
- inspectable agent inputs/results and full-state undo
- shareable URLs for scene, camera, comparisons, findings, and notebook content
- curated scientific presets and bulk category operations
- PDG-linked provenance, uncertainty, status, and plotting semantics
- synchronized 3D and accessible table representations
- keyboard navigation, reduced motion, high contrast, and responsive mobile controls
- persistent light and dark themes
- automated end-to-end WebMCP regression coverage

## Human-agent workflow

The strongest workflow is a guided investigation:

1. The agent frames a scientific question with `set_investigation_brief`.
2. It queries evidence with `get_particle_catalog`.
3. It configures a relevant scene and comparison.
4. It calls `add_investigation_step` to save the exact view and explain the finding.
5. It repeats the process for another perspective or force network.
6. It writes a concise conclusion grounded in the saved findings.
7. The learner edits, replays, undoes, or shares the resulting investigation.

This workflow was difficult before WebMCP because a browser agent had to infer controls from a dense 3D interface and could not create a durable visual explanation inside the application.

## Tool inventory

| Tool | Read or change |
| --- | --- |
| `get_particle_catalog` | Read filtered particle data |
| `get_scene_state` | Read the current visual state |
| `focus_particle` | Focus one particle and open its data panel |
| `compare_particles` | Compare and optionally isolate two to six particles |
| `configure_plot` | Change plot, preset, categories, representation, theme, or contrast |
| `show_force_network` | Change strong, electromagnetic, or weak overlays |
| `highlight_particles` | Highlight or isolate a named set |
| `get_investigation` | Read the shared notebook |
| `set_investigation_brief` | Set its question or conclusion |
| `add_investigation_step` | Save the current scene as a finding |
| `reset_explorer` | Restore the default visual scene |

All tools register in `web/js/webmcp.js` through `document.modelContext.registerTool()` and call the shared API in `web/js/main.js`.

## Evidence and verification

- Initial WebMCP implementation: `847d8403a780e9913793381d0e19ff7744266adb`
- Collaborative investigation notebook: `5e68b6d`
- End-to-end regression suite: `d48ec59`
- Automated test: `tests/test_webmcp.py`
- Native Chrome test: `tests/test_webmcp_native.py`
- Public application: https://yagyaanshk.github.io/standard_model/web/

Run the test suite:

```bash
python -m pip install -r requirements-test.txt
python -m playwright install chromium
python -m unittest discover -s tests -v
```

The suite executes all eleven tools and verifies notebook creation, editing, undo, replay, URL sharing, desktop/mobile geometry, and unsupported-browser fallback.

The opt-in native lane launches Chrome with its experimental WebMCP testing features, discovers the deployed tools through `document.modelContext.getTools()`, and executes them through `document.modelContext.executeTool()` without injecting a compatibility host.

## Data and ownership

Scientific references and interpretation rules are documented in [DATA_SOURCES.md](DATA_SOURCES.md). The project uses Three.js under its open-source license and is released under the MIT license.
