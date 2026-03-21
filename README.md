# standard_model

I INVITE ALL OF YOU TO MAKE IMPROVEMENTS AND SUGGESTIONS. FEEL FREE TO MAKE ANY COSMETIC CHANGES AND EVEN ADD OTHER TOOLS TO GENERATE beautiful 3D PLOTS!
---------------------------------------------------------------------------------------------------------------------
Using the standard model of particle physics, trying to visualize all the particles (fundamental and composite) in a "3D" plot, bringing to life all the symmetries present in nature!

## Python Matplotlib Plots (`python_matplotlib_plots/`)

Static 3D scatter plots using Matplotlib.

This code:

1. Creates two distinct 3D plots for fundamental and composite particles
2. Shows particle interactions with color-coded lines:
   ~ Red for strong force
   ~ Blue for electromagnetic force
   ~ Green for weak force (fundamental particles only)
4. Uses different colors for particles and antiparticles
5. Includes proper legends and labels
6. Adds analysis functions (in terminal) to understand mass groupings and charge symmetries

The file *standard_model_3D_fundamental-generation.py* uses -
- (x,y,z) axes as (mass, charge, generation) for fundamental particles
- (x,y,z) axes as (mass, charge, strangeness) for composite particles

The file *standard_model_3D_fundamental-isospin.py* uses -
- (x,y,z) axes as (mass, charge, isospin) for fundamental particles
- (x,y,z) axes as (mass, charge, strangeness) for composite particles

P.S. (May 2025) After writing some initial code to plot composite particles, rest of the code was "vibe-coded" with the help of Claude 3.5 Sonnet in VS Code!

## Manim Animation (`python_manim_plots/`)

An animated 3D visualization using [Manim](https://www.manim.community/) (the math animation engine).

- Axes: log₁₀(Mass/MeV) vs Charge (e) vs Isospin (I₃)
- Particles appear one by one with smooth animations
- Camera rotates automatically around all three axes (theta, phi, gamma)
- Color-coded by category: leptons, anti-leptons, quarks, anti-quarks, neutrinos, force carriers
- Labels stay fixed in orientation as the camera moves
- Includes a legend and title overlay
- Outputs a video file (`standard_model_dope.mp4`)

Run with:
```bash
manim -qm python_manim_plots/standard_model.py StandardModelScene
```

## Interactive 3D Explorer (`web/`)

A browser-based interactive 3D visualization built with [Three.js](https://threejs.org/). Open `web/index.html` in a browser — no build step needed (uses ES module imports via CDN).

Features:
- **4 plot modes**: Mass (log) or Mass (piecewise linear) vs Charge vs Spin or Isospin
- **Orbit controls**: left-click rotate, right-click pan, scroll zoom, auto-rotate toggle
- **Hover tooltips**: hover any particle to see its name, mass, charge, spin, and isospin
- **Category toggles**: show/hide leptons, quarks, bosons, etc. via checkboxes
- **Interaction lines**: toggle strong (red), electromagnetic (blue), and weak (green) force connections
- **Overlap resolution**: overlapping particles fan out with leader lines and multi-color spheres
- **Anti-particle rings**: bright torus rings distinguish anti-particles from particles
- **Point-like spheres**: small radius (0.06) to reflect the point-like nature of fundamental particles
- **Piecewise linear scale**: 5 segments with kink markers showing scale changes across mass ranges

See [web/walkthrough.md](web/walkthrough.md) for full implementation details.
