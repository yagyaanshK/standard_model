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
    tensorBosons:   { label: "Tensor Bosons",  color: 0x888899 },  // grey (hypothetical)
};

// Plot modes define which property maps to the z-axis
export const PLOT_MODES = {
    spin:    { key: "spin",    label: "Mass / Charge / Spin",     axisLabel: "Spin →" },
    isospin: { key: "isospin", label: "Mass / Charge / Isospin",  axisLabel: "Isospin (I₃) →" },
};

export const PARTICLES = [
    // Leptons
    { name: "e⁻",  fullName: "electron",             mass: 0.511,    charge: -1,    isospin: -0.5, spin: 0.5, category: "leptons" },
    { name: "μ⁻",  fullName: "muon",                  mass: 105.66,   charge: -1,    isospin: -0.5, spin: 0.5, category: "leptons" },
    { name: "τ⁻",  fullName: "tau",                    mass: 1776.86,  charge: -1,    isospin: -0.5, spin: 0.5, category: "leptons" },

    // Neutrinos
    { name: "ν<sub>e</sub>",   fullName: "electron neutrino",  mass: 1e-3,     charge: 0,     isospin: 0.5,  spin: 0.5, category: "neutrinos" },
    { name: "ν<sub>μ</sub>",   fullName: "muon neutrino",      mass: 1e-3,     charge: 0,     isospin: 0.5,  spin: 0.5, category: "neutrinos" },
    { name: "ν<sub>τ</sub>",   fullName: "tau neutrino",       mass: 1e-3,     charge: 0,     isospin: 0.5,  spin: 0.5, category: "neutrinos" },

    // Anti-leptons
    { name: "e⁺",  fullName: "positron",              mass: 0.511,    charge: 1,     isospin: 0.5,  spin: 0.5, category: "antiLeptons" },
    { name: "μ⁺",  fullName: "antimuon",               mass: 105.66,   charge: 1,     isospin: 0.5,  spin: 0.5, category: "antiLeptons" },
    { name: "τ⁺",  fullName: "antitau",                mass: 1776.86,  charge: 1,     isospin: 0.5,  spin: 0.5, category: "antiLeptons" },

    // Anti-neutrinos
    { name: "<span class='overbar'>ν</span><sub>e</sub>",  fullName: "electron antineutrino",  mass: 1e-3,     charge: 0,     isospin: -0.5, spin: 0.5, category: "antiNeutrinos" },
    { name: "<span class='overbar'>ν</span><sub>μ</sub>",  fullName: "muon antineutrino",      mass: 1e-3,     charge: 0,     isospin: -0.5, spin: 0.5, category: "antiNeutrinos" },
    { name: "<span class='overbar'>ν</span><sub>τ</sub>",  fullName: "tau antineutrino",       mass: 1e-3,     charge: 0,     isospin: -0.5, spin: 0.5, category: "antiNeutrinos" },

    // Quarks
    { name: "u",   fullName: "up",       mass: 2.2,      charge: 2/3,   isospin: 0.5,  spin: 0.5, category: "quarks" },
    { name: "d",   fullName: "down",     mass: 4.7,      charge: -1/3,  isospin: -0.5, spin: 0.5, category: "quarks" },
    { name: "s",   fullName: "strange",  mass: 95,       charge: -1/3,  isospin: 0,    spin: 0.5, category: "quarks" },
    { name: "c",   fullName: "charm",    mass: 1275,     charge: 2/3,   isospin: 0,    spin: 0.5, category: "quarks" },
    { name: "t",   fullName: "top",      mass: 173.1e3,  charge: 2/3,   isospin: 0.5,  spin: 0.5, category: "quarks" },
    { name: "b",   fullName: "bottom",   mass: 4180,     charge: -1/3,  isospin: 0,    spin: 0.5, category: "quarks" },

    // Anti-quarks
    { name: "<span class='overbar'>u</span>",  fullName: "antiup",        mass: 2.2,      charge: -2/3,  isospin: -0.5, spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>d</span>",  fullName: "antidown",      mass: 4.7,      charge: 1/3,   isospin: 0.5,  spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>s</span>",  fullName: "antistrange",   mass: 95,       charge: 1/3,   isospin: 0,    spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>c</span>",  fullName: "anticharm",     mass: 1275,     charge: -2/3,  isospin: 0,    spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>t</span>",  fullName: "antitop",       mass: 173.1e3,  charge: -2/3,  isospin: -0.5, spin: 0.5, category: "antiQuarks" },
    { name: "<span class='overbar'>b</span>",  fullName: "antibottom",    mass: 4180,     charge: 1/3,   isospin: 0,    spin: 0.5, category: "antiQuarks" },

    // Gauge bosons (vector bosons, spin-1)
    { name: "γ",   fullName: "photon",     mass: 1e-3,     charge: 0,     isospin: 0,    spin: 1,   category: "gaugeBosons" },
    { name: "g",   fullName: "gluon",      mass: 1e-3,     charge: 0,     isospin: 0,    spin: 1,   category: "gaugeBosons" },
    { name: "W⁺",  fullName: "W⁺ boson",   mass: 80.36e3,  charge: 1,     isospin: 1,    spin: 1,   category: "gaugeBosons" },
    { name: "W⁻",  fullName: "W⁻ boson",   mass: 80.36e3,  charge: -1,    isospin: -1,   spin: 1,   category: "gaugeBosons" },
    { name: "Z⁰",  fullName: "Z⁰ boson",   mass: 91.19e3,  charge: 0,     isospin: 0,    spin: 1,   category: "gaugeBosons" },

    // Scalar bosons (spin-0)
    { name: "H",   fullName: "higgs",      mass: 124.97e3, charge: 0,     isospin: -0.5, spin: 0,   category: "scalarBosons" },

    // Tensor bosons (spin-2, hypothetical)
    { name: "G",   fullName: "graviton",   mass: 1e-3,     charge: 0,     isospin: 0,    spin: 2,   category: "tensorBosons" },
];
