const MAX_STEPS = 6;
const MAX_QUESTION_LENGTH = 240;
const MAX_CONCLUSION_LENGTH = 700;
const MAX_TITLE_LENGTH = 100;
const MAX_FINDING_LENGTH = 700;

function clampText(value, maxLength) {
    return String(value ?? "").trim().slice(0, maxLength);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeState(value = {}) {
    const steps = Array.isArray(value.steps) ? value.steps.slice(0, MAX_STEPS) : [];
    return {
        question: clampText(value.question, MAX_QUESTION_LENGTH),
        conclusion: clampText(value.conclusion, MAX_CONCLUSION_LENGTH),
        steps: steps.map((step, index) => ({
            id: clampText(step.id, 80) || `step-${index + 1}`,
            title: clampText(step.title, MAX_TITLE_LENGTH) || `Finding ${index + 1}`,
            finding: clampText(step.finding, MAX_FINDING_LENGTH),
            particles: Array.isArray(step.particles)
                ? [...new Set(step.particles.map((name) => clampText(name, 80)).filter(Boolean))].slice(0, 6)
                : [],
            scene: step.scene && typeof step.scene === "object" ? clone(step.scene) : null,
        })),
    };
}

export function createInvestigationWorkspace({ onChange, onOpenScene } = {}) {
    const panel = document.getElementById("investigation-panel");
    const toggle = document.getElementById("investigation-toggle");
    const close = document.getElementById("investigation-close");
    const clear = document.getElementById("investigation-clear");
    const question = document.getElementById("investigation-question");
    const conclusion = document.getElementById("investigation-conclusion");
    const steps = document.getElementById("investigation-steps");
    const count = document.getElementById("investigation-count");
    const empty = document.getElementById("investigation-empty");
    let state = normalizeState();
    let sequence = 0;

    function notify() {
        onChange?.(clone(state));
    }

    function setOpen(open) {
        panel.hidden = !open;
        document.body.classList.toggle("investigation-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        if (open) question.focus({ preventScroll: true });
    }

    function renderSteps() {
        steps.replaceChildren();
        count.textContent = String(state.steps.length);
        toggle.dataset.count = String(state.steps.length);
        empty.hidden = state.steps.length !== 0;

        for (const [index, step] of state.steps.entries()) {
            const item = document.createElement("li");
            item.className = "investigation-step";
            item.dataset.stepId = step.id;

            const heading = document.createElement("div");
            heading.className = "investigation-step-heading";
            const number = document.createElement("span");
            number.className = "investigation-step-number";
            number.textContent = String(index + 1).padStart(2, "0");
            const title = document.createElement("input");
            title.className = "investigation-step-title";
            title.value = step.title;
            title.maxLength = MAX_TITLE_LENGTH;
            title.setAttribute("aria-label", `Finding ${index + 1} title`);
            title.addEventListener("input", () => {
                step.title = title.value.slice(0, MAX_TITLE_LENGTH);
                notify();
            });
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "investigation-step-remove";
            remove.textContent = "\u00d7";
            remove.title = `Remove finding ${index + 1}`;
            remove.setAttribute("aria-label", `Remove finding ${index + 1}`);
            remove.addEventListener("click", () => {
                state.steps = state.steps.filter((candidate) => candidate.id !== step.id);
                renderSteps();
                notify();
            });
            heading.append(number, title, remove);

            const finding = document.createElement("textarea");
            finding.className = "investigation-step-finding";
            finding.value = step.finding;
            finding.maxLength = MAX_FINDING_LENGTH;
            finding.rows = 3;
            finding.setAttribute("aria-label", `Finding ${index + 1} explanation`);
            finding.addEventListener("input", () => {
                step.finding = finding.value.slice(0, MAX_FINDING_LENGTH);
                notify();
            });

            const footer = document.createElement("div");
            footer.className = "investigation-step-footer";
            const particleList = document.createElement("span");
            particleList.className = "investigation-step-particles";
            particleList.textContent = step.particles.join("  /  ") || "Scene finding";
            const openScene = document.createElement("button");
            openScene.type = "button";
            openScene.className = "investigation-open-scene";
            openScene.textContent = "Open scene";
            openScene.disabled = !step.scene;
            openScene.addEventListener("click", () => {
                if (step.scene) onOpenScene?.(clone(step.scene));
            });
            footer.append(particleList, openScene);
            item.append(heading, finding, footer);
            steps.appendChild(item);
        }
    }

    function render() {
        question.value = state.question;
        conclusion.value = state.conclusion;
        renderSteps();
    }

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    close.addEventListener("click", () => setOpen(false));
    clear.addEventListener("click", () => {
        state = normalizeState();
        render();
        notify();
    });
    question.addEventListener("input", () => {
        state.question = question.value.slice(0, MAX_QUESTION_LENGTH);
        notify();
    });
    conclusion.addEventListener("input", () => {
        state.conclusion = conclusion.value.slice(0, MAX_CONCLUSION_LENGTH);
        notify();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });

    render();

    return {
        getState() {
            return clone(state);
        },
        setState(value, { notify: shouldNotify = true } = {}) {
            state = normalizeState(value);
            sequence = state.steps.length;
            render();
            if (shouldNotify) notify();
            return this.getState();
        },
        setBrief({ question: nextQuestion, conclusion: nextConclusion } = {}) {
            if (nextQuestion !== undefined) state.question = clampText(nextQuestion, MAX_QUESTION_LENGTH);
            if (nextConclusion !== undefined) state.conclusion = clampText(nextConclusion, MAX_CONCLUSION_LENGTH);
            render();
            setOpen(true);
            notify();
            return this.getState();
        },
        addStep({ title, finding, particles = [], scene = null } = {}) {
            if (state.steps.length >= MAX_STEPS) throw new Error(`An investigation can contain at most ${MAX_STEPS} findings.`);
            const normalizedTitle = clampText(title, MAX_TITLE_LENGTH);
            const normalizedFinding = clampText(finding, MAX_FINDING_LENGTH);
            if (!normalizedTitle || !normalizedFinding) throw new Error("A finding needs both a title and an explanation.");
            const step = {
                id: `step-${Date.now().toString(36)}-${(++sequence).toString(36)}`,
                title: normalizedTitle,
                finding: normalizedFinding,
                particles: [...new Set(particles.map((name) => clampText(name, 80)).filter(Boolean))].slice(0, 6),
                scene: scene ? clone(scene) : null,
            };
            state.steps.push(step);
            renderSteps();
            setOpen(true);
            notify();
            return clone(step);
        },
        open() {
            setOpen(true);
        },
    };
}
