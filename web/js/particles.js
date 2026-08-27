// All Standard Model particle data
// Each particle: name, mass (MeV), charge (e), isospin (I₃), spin, category

export const CATEGORIES = {
    leptons:        { label: "Leptons",         color: 0x88dd55 },  // SVG lepton green (#AAEE77→#66CC33)
    neutrinos:      { label: "Neutrinos",       color: 0x88dd55 },  // same lepton green
    antiLeptons:    { label: "Anti-leptons",     color: 0x88dd55 },  // same lepton green
    antiNeutrinos:  { label: "Anti-neutrinos",  color: 0x88dd55 },  // same lepton green
    quarks:         { label: "Quarks",          color: 0xcc99ee },  // SVG quark purple (#EEBBFF→#AA77DD)
    antiQuarks:     { label: "Anti-quarks",     color: 0xcc99ee },  // same quark purple
    gaugeBosons:    { label: "Gauge Bosons",    color: 0xee775e },  // SVG gauge red (#FF9977→#DD5544)
    scalarBosons:   { label: "Scalar Bosons",   color: 0xeed055 },  // SVG scalar yellow (#EEE677→#EEBB33)
    tensorBosons:   { label: "Hypothetical extensions", color: 0x888899 },
};

// Plot modes define which property maps to the z-axis
export const PLOT_MODES = {
    spinLinear:    { key: "spinLinear",    zProp: "spin",    label: "Mass / Charge / Spin",          axisLabel: "Spin",        massScale: "linear" },
    spin:          { key: "spin",          zProp: "spin",    label: "Mass (log) / Charge / Spin",    axisLabel: "Spin",        massScale: "log" },
    isospinLinear: { key: "isospinLinear", zProp: "isospin", label: "Mass / Charge / Isospin",       axisLabel: "Isospin (I₃)", massScale: "linear" },
    isospin:       { key: "isospin",       zProp: "isospin", label: "Mass (log) / Charge / Isospin", axisLabel: "Isospin (I₃)", massScale: "log" },
};

const PARTICLE_DEFINITIONS = [
    // Leptons
    { name: "e⁻",  fullName: "electron",             mass: 0.510999, charge: -1,    isospin: -0.5, spin: 0.5, category: "leptons" },
    { name: "μ⁻",  fullName: "muon",                  mass: 105.658,  charge: -1,    isospin: -0.5, spin: 0.5, category: "leptons" },
    { name: "τ⁻",  fullName: "tau",                    mass: 1776.93,  charge: -1,    isospin: -0.5, spin: 0.5, category: "leptons" },

    // Neutrinos
    { name: "ν<sub>e</sub>",   fullName: "electron neutrino",  mass: 1e-3,     charge: 0,     isospin: 0.5,  spin: 0.5, category: "neutrinos" },
    { name: "ν<sub>μ</sub>",   fullName: "muon neutrino",      mass: 1e-3,     charge: 0,     isospin: 0.5,  spin: 0.5, category: "neutrinos" },
    { name: "ν<sub>τ</sub>",   fullName: "tau neutrino",       mass: 1e-3,     charge: 0,     isospin: 0.5,  spin: 0.5, category: "neutrinos" },

    // Anti-leptons
    { name: "e⁺",  fullName: "positron",              mass: 0.510999, charge: 1,     isospin: 0.5,  spin: 0.5, category: "antiLeptons" },
    { name: "μ⁺",  fullName: "antimuon",               mass: 105.658,  charge: 1,     isospin: 0.5,  spin: 0.5, category: "antiLeptons" },
    { name: "τ⁺",  fullName: "antitau",                mass: 1776.93,  charge: 1,     isospin: 0.5,  spin: 0.5, category: "antiLeptons" },

    // Anti-neutrinos
    { name: "<span class='overbar'>ν</span><sub>e</sub>",  fullName: "electron antineutrino",  mass: 1e-3,     charge: 0,     isospin: -0.5, spin: 0.5, category: "antiNeutrinos" },
    { name: "<span class='overbar'>ν</span><sub>μ</sub>",  fullName: "muon antineutrino",      mass: 1e-3,     charge: 0,     isospin: -0.5, spin: 0.5, category: "antiNeutrinos" },
    { name: "<span class='overbar'>ν</span><sub>τ</sub>",  fullName: "tau antineutrino",       mass: 1e-3,     charge: 0,     isospin: -0.5, spin: 0.5, category: "antiNeutrinos" },

    // Quarks
    { name: "u",   fullName: "up",       mass: 2.16,     charge: 2/3,   isospin: 0.5,  spin: 0.5, category: "quarks" },
    { name: "d",   fullName: "down",     mass: 4.67,     charge: -1/3,  isospin: -0.5, spin: 0.5, category: "quarks" },
    { name: "s",   fullName: "strange",  mass: 93.4,     charge: -1/3,  isospin: 0,    spin: 0.5, category: "quarks" },
    { name: "c",   fullName: "charm",    mass: 1270,     charge: 2/3,   isospin: 0,    spin: 0.5, category: "quarks" },
    { name: "t",   fullName: "top",      mass: 172.57e3, charge: 2/3,   isospin: 0.5,  spin: 0.5, category: "quarks" },
    { name: "b",   fullName: "bottom",   mass: 4180,     charge: -1/3,  isospin: 0,    spin: 0.5, category: "quarks" },

    // Anti-quarks
    { name: "<span class='overbar'>u</span>",  fullName: "antiup",        mass: 2.16,     charge: -2/3,  isospin: -0.5, spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>d</span>",  fullName: "antidown",      mass: 4.67,     charge: 1/3,   isospin: 0.5,  spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>s</span>",  fullName: "antistrange",   mass: 93.4,     charge: 1/3,   isospin: 0,    spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>c</span>",  fullName: "anticharm",     mass: 1270,     charge: -2/3,  isospin: 0,    spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>t</span>",  fullName: "antitop",       mass: 172.57e3, charge: -2/3,  isospin: -0.5, spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>b</span>",  fullName: "antibottom",    mass: 4180,     charge: 1/3,   isospin: 0,    spin: 0.5, category: "antiQuarks" },

    // Gauge bosons (vector bosons, spin-1)
    { name: "γ",   fullName: "photon",     mass: 1e-3,     charge: 0,     isospin: 0,    spin: 1,   category: "gaugeBosons" },
    { name: "g",   fullName: "gluon",      mass: 1e-3,     charge: 0,     isospin: 0,    spin: 1,   category: "gaugeBosons" },
    { name: "W⁺",  fullName: "W⁺ boson",   mass: 80.3692e3, charge: 1,    isospin: 1,    spin: 1,   category: "gaugeBosons" },
    { name: "W⁻",  fullName: "W⁻ boson",   mass: 80.3692e3, charge: -1,   isospin: -1,   spin: 1,   category: "gaugeBosons" },
    { name: "Z⁰",  fullName: "Z⁰ boson",   mass: 91.188e3,  charge: 0,     isospin: 0,    spin: 1,   category: "gaugeBosons" },

    // Scalar bosons (spin-0)
    { name: "H",   fullName: "higgs",      mass: 125.20e3, charge: 0,     isospin: -0.5, spin: 0,   category: "scalarBosons" },

    // Tensor bosons (spin-2, hypothetical)
    { name: "G",   fullName: "graviton",   mass: 1e-3,     charge: 0,     isospin: 0,    spin: 2,   category: "tensorBosons" },
];

export const PARTICLE_DATA_SOURCE = {
    label: "Particle Data Group 2024 review with 2025 listings update",
    url: "https://pdg.lbl.gov/2025/listings/particle_properties.html",
    citation: "S. Navas et al. (Particle Data Group), Phys. Rev. D 110, 030001 (2024), and 2025 update",
};

const MASS_METADATA = {
    electron: { reportedMassMeV: 0.51099895069, massDisplay: "0.51099895069 ± 0.00000000016 MeV", massUncertainty: "± 0.00000000016 MeV", massStatus: "measured" },
    muon: { reportedMassMeV: 105.6583755, massDisplay: "105.6583755 ± 0.0000023 MeV", massUncertainty: "± 0.0000023 MeV", massStatus: "measured" },
    tau: { reportedMassMeV: 1776.93, massDisplay: "1776.93 ± 0.09 MeV", massUncertainty: "± 0.09 MeV", massStatus: "measured" },
    neutrino: { reportedMassMeV: null, massDisplay: "No single flavor mass; eigenstate masses are sub-eV", massUncertainty: "Constrained by limits and mass-splitting measurements", massStatus: "constrained" },
    up: { reportedMassMeV: 2.16, massDisplay: "2.16 +0.49/−0.26 MeV", massUncertainty: "+0.49/−0.26 MeV", massStatus: "model- and scale-dependent" },
    down: { reportedMassMeV: 4.67, massDisplay: "4.67 +0.48/−0.17 MeV", massUncertainty: "+0.48/−0.17 MeV", massStatus: "model- and scale-dependent" },
    strange: { reportedMassMeV: 93.4, massDisplay: "93.4 +8.6/−3.4 MeV", massUncertainty: "+8.6/−3.4 MeV", massStatus: "model- and scale-dependent" },
    charm: { reportedMassMeV: 1270, massDisplay: "1270 ± 20 MeV", massUncertainty: "± 20 MeV", massStatus: "model- and scale-dependent" },
    bottom: { reportedMassMeV: 4180, massDisplay: "4180 +30/−20 MeV", massUncertainty: "+30/−20 MeV", massStatus: "model- and scale-dependent" },
    top: { reportedMassMeV: 172570, massDisplay: "172.57 ± 0.29 GeV", massUncertainty: "± 0.29 GeV", massStatus: "measured; mass-scheme interpretation applies" },
    photon: { reportedMassMeV: null, massDisplay: "< 1×10⁻¹⁸ eV", massUncertainty: "Experimental upper limit", massStatus: "upper limit; massless in the Standard Model" },
    gluon: { reportedMassMeV: 0, massDisplay: "0 (Standard Model)", massUncertainty: "No free-particle mass measurement", massStatus: "theoretical; confined" },
    w: { reportedMassMeV: 80369.2, massDisplay: "80.3692 ± 0.0133 GeV", massUncertainty: "± 0.0133 GeV", massStatus: "measured" },
    z: { reportedMassMeV: 91188.0, massDisplay: "91.1880 ± 0.0020 GeV", massUncertainty: "± 0.0020 GeV", massStatus: "measured" },
    higgs: { reportedMassMeV: 125200, massDisplay: "125.20 ± 0.11 GeV", massUncertainty: "± 0.11 GeV", massStatus: "measured" },
    graviton: { reportedMassMeV: null, massDisplay: "< 1.76×10⁻²³ eV (search limit)", massUncertainty: "Experimental upper limit", massStatus: "hypothetical; not part of the Standard Model" },
};

function massKey(particle) {
    if (particle.category === "neutrinos" || particle.category === "antiNeutrinos") return "neutrino";
    if (["positron"].includes(particle.fullName)) return "electron";
    if (["antimuon"].includes(particle.fullName)) return "muon";
    if (["antitau"].includes(particle.fullName)) return "tau";
    if (particle.fullName.startsWith("anti")) return particle.fullName.slice(4);
    if (particle.fullName.startsWith("W")) return "w";
    if (particle.fullName.startsWith("Z")) return "z";
    return particle.fullName;
}

export const PARTICLES = PARTICLE_DEFINITIONS.map((particle) => ({
    ...particle,
    ...MASS_METADATA[massKey(particle)],
    plotMassMeV: particle.mass,
    source: PARTICLE_DATA_SOURCE.label,
    sourceUrl: PARTICLE_DATA_SOURCE.url,
}));
