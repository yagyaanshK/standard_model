# Scientific data sources

Particle Atlas uses the Particle Data Group (PDG) as its primary source for particle masses, limits, and uncertainty labels.

## Primary references

- [2025 Particle Properties](https://pdg.lbl.gov/2025/listings/particle_properties.html)
- [2025 Summary Tables](https://pdg.lbl.gov/2025/tables/contents_tables.html)
- [2025 Particle Listings](https://pdg.lbl.gov/2025/listings/contents_listings.html)
- S. Navas et al. (Particle Data Group), *Phys. Rev. D* **110**, 030001 (2024), and 2025 update

The 2025 listings have a January 15, 2025 cutoff. Values in `web/js/particles.js` are rounded only where the 3D plot cannot meaningfully display the full precision; the property UI and WebMCP catalog preserve an explicit display value and uncertainty/status string.

## Interpretation rules

- `reportedMassMeV` is a measured or evaluated central value when one exists. It is `null` for upper limits, flavor neutrinos, and hypothetical particles.
- `massDisplay` is the human-readable PDG value, limit, or scientific qualification.
- `massUncertainty` records a symmetric/asymmetric uncertainty or explains why a conventional uncertainty is not available.
- `massStatus` distinguishes measurements, limits, model-dependent quark masses, theoretical masslessness, and hypothetical entries.
- `plotMassMeV` is only a coordinate for the visualization. Massless, constrained, and hypothetical entries use the lowest plotting bin so they remain selectable; this is not a physical mass claim.

## Scope boundary

The graviton is retained as an optional historical extension of the original visualization, but it is labeled hypothetical, placed in `Hypothetical extensions`, and hidden from the default Standard Model overview.
