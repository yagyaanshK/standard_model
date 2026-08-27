const toolResult = (value) => ({
    content: [
        {
            type: "text",
            text: JSON.stringify(value, null, 2),
        },
    ],
});

const TOOL_DEFINITIONS = [
    {
        name: "get_particle_catalog",
        description: "Read Standard Model particle data, optionally filtered by category, name, mass, or charge. This does not change the scene.",
        inputSchema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    description: "Optional particle category key or human-readable category label.",
                },
                name: {
                    type: "string",
                    description: "Optional partial particle name, such as electron, neutrino, quark, photon, or higgs.",
                },
                minMassMeV: { type: "number", description: "Optional minimum mass in MeV." },
                maxMassMeV: { type: "number", description: "Optional maximum mass in MeV." },
                charge: { type: "number", description: "Optional electric charge in units of e." },
            },
            additionalProperties: false,
        },
        execute: (api, args) => api.getParticleCatalog(args),
    },
    {
        name: "get_scene_state",
        description: "Inspect the Particle Atlas scene, including plot mode, visible categories, force networks, focused particle, and highlights.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
        execute: (api) => api.getSceneState(),
    },
    {
        name: "focus_particle",
        description: "Focus the camera on one particle and open its visible data panel. Use a common or full particle name.",
        inputSchema: {
            type: "object",
            properties: {
                particle: { type: "string", description: "Particle name, such as electron, muon, photon, top, or higgs." },
            },
            required: ["particle"],
            additionalProperties: false,
        },
        execute: (api, args) => api.focusParticle(args.particle),
    },
    {
        name: "compare_particles",
        description: "Compare two to six particles, highlight them in the shared 3D scene, and return their physical properties.",
        inputSchema: {
            type: "object",
            properties: {
                particles: {
                    type: "array",
                    description: "Two to six particle names.",
                    items: { type: "string" },
                    minItems: 2,
                    maxItems: 6,
                },
                isolate: {
                    type: "boolean",
                    description: "When true, temporarily hide particles outside the comparison.",
                    default: false,
                },
            },
            required: ["particles"],
            additionalProperties: false,
        },
        execute: (api, args) => api.compareParticles(args.particles, Boolean(args.isolate)),
    },
    {
        name: "configure_plot",
        description: "Apply an educational scene preset or change the plot axes, representation, display settings, and visible particle categories.",
        inputSchema: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    enum: ["spinLinear", "spin", "isospinLinear", "isospin"],
                    description: "Plot mode. Modes without 'Linear' use logarithmic mass.",
                },
                theme: {
                    type: "string",
                    enum: ["light", "dark"],
                    description: "Optional display theme for the shared page and 3D scene.",
                },
                highContrast: {
                    type: "boolean",
                    description: "Enable or disable the higher-contrast display mode.",
                },
                view: {
                    type: "string",
                    enum: ["3d", "table"],
                    description: "Choose the interactive 3D scene or accessible particle-data table.",
                },
                preset: {
                    type: "string",
                    enum: ["overview", "chargedLeptons", "quarkFamilies", "matterAntimatter", "forceCarriers", "weakNetwork"],
                    description: "Optional curated scene preset to apply before any explicit overrides.",
                },
                categorySet: {
                    type: "string",
                    enum: ["standardModel", "all", "matter", "antimatter", "fermions", "bosons", "none"],
                    description: "Optional bulk particle-category selection applied before visibleCategories.",
                },
                visibleCategories: {
                    type: "array",
                    description: "Optional category keys or labels to show; all other categories are hidden.",
                    items: { type: "string" },
                    uniqueItems: true,
                },
            },
            additionalProperties: false,
        },
        execute: (api, args) => api.configurePlot(args),
    },
    {
        name: "show_force_network",
        description: "Show or hide the strong, electromagnetic, or weak interaction network in the current 3D scene.",
        inputSchema: {
            type: "object",
            properties: {
                force: {
                    type: "string",
                    enum: ["strong", "electromagnetic", "weak"],
                    description: "Interaction network to change.",
                },
                visible: { type: "boolean", description: "Whether the selected network should be visible.", default: true },
                exclusive: {
                    type: "boolean",
                    description: "When true, hide the other force networks first.",
                    default: false,
                },
            },
            required: ["force"],
            additionalProperties: false,
        },
        execute: (api, args) => api.showForceNetwork(args.force, args.visible !== false, Boolean(args.exclusive)),
    },
    {
        name: "highlight_particles",
        description: "Highlight named particles in the shared 3D scene, with an option to isolate them from all other particles.",
        inputSchema: {
            type: "object",
            properties: {
                particles: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                    maxItems: 12,
                    description: "One to twelve particle names to highlight.",
                },
                isolate: {
                    type: "boolean",
                    description: "When true, temporarily hide particles outside the selection.",
                    default: false,
                },
            },
            required: ["particles"],
            additionalProperties: false,
        },
        execute: (api, args) => api.highlightParticles(args.particles, Boolean(args.isolate)),
    },
    {
        name: "get_investigation",
        description: "Read the shared investigation question, conclusion, and saved findings. This does not change the scene or notebook.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
        execute: (api) => api.getInvestigation(),
    },
    {
        name: "set_investigation_brief",
        description: "Set the question or conclusion in the shared investigation notebook. Use this to frame the visual inquiry before saving findings and to summarize it afterward.",
        inputSchema: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    maxLength: 240,
                    description: "The focused scientific question being investigated.",
                },
                conclusion: {
                    type: "string",
                    maxLength: 700,
                    description: "A concise conclusion grounded in the saved visual findings.",
                },
            },
            additionalProperties: false,
        },
        execute: (api, args) => api.setInvestigationBrief(args),
    },
    {
        name: "add_investigation_step",
        description: "Save the current visible scene as a replayable finding in the shared investigation notebook. Configure the scene first, then record what the view demonstrates.",
        inputSchema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    maxLength: 100,
                    description: "Short title for this finding.",
                },
                finding: {
                    type: "string",
                    maxLength: 700,
                    description: "What the current scene demonstrates and why it matters to the investigation.",
                },
                particles: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 6,
                    uniqueItems: true,
                    description: "Optional particle names directly supporting this finding.",
                },
            },
            required: ["title", "finding"],
            additionalProperties: false,
        },
        execute: (api, args) => api.addInvestigationStep(args),
    },
    {
        name: "reset_explorer",
        description: "Restore the default plot, camera, particle visibility, force networks, highlights, and focused-particle panel.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
        execute: (api) => api.resetExplorer(),
    },
];

const READ_ONLY_TOOLS = new Set(["get_particle_catalog", "get_scene_state", "get_investigation"]);

export async function registerWebMCPTools(api, { onStatus, onActivity } = {}) {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
        onStatus?.({ state: "unavailable", count: 0 });
        return [];
    }

    const controllers = [];
    onStatus?.({ state: "registering", count: 0 });

    for (const definition of TOOL_DEFINITIONS) {
        const controller = await modelContext.registerTool({
            name: definition.name,
            description: definition.description,
            inputSchema: definition.inputSchema,
            async execute(args = {}) {
                const undoState = READ_ONLY_TOOLS.has(definition.name) ? null : api.captureSceneState?.();
                try {
                    const result = await definition.execute(api, args);
                    onActivity?.({
                        name: definition.name,
                        summary: api.describeToolResult(definition.name, result),
                        ok: true,
                        args,
                        result,
                        undoState,
                    });
                    return toolResult(result);
                } catch (error) {
                    onActivity?.({ name: definition.name, summary: error.message, ok: false, args });
                    throw error;
                }
            },
        });
        controllers.push(controller);
    }

    onStatus?.({ state: "ready", count: controllers.length });
    return controllers;
}
