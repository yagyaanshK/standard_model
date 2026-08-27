import json
import os
import shutil
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


LIVE_URL = os.environ.get(
    "PARTICLE_ATLAS_NATIVE_URL",
    "https://yagyaanshk.github.io/standard_model/web/",
)
EXPECTED_TOOLS = {
    "add_investigation_step",
    "compare_particles",
    "configure_plot",
    "focus_particle",
    "get_investigation",
    "get_particle_catalog",
    "get_scene_state",
    "highlight_particles",
    "reset_explorer",
    "set_investigation_brief",
    "show_force_network",
}


def find_chrome():
    configured = os.environ.get("CHROME_PATH")
    candidates = [
        configured,
        shutil.which("google-chrome"),
        shutil.which("chrome"),
        shutil.which("chromium"),
        Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(candidate)
    return None


@unittest.skipUnless(
    os.environ.get("RUN_NATIVE_WEBMCP") == "1",
    "Set RUN_NATIVE_WEBMCP=1 to run against Chrome's experimental WebMCP API.",
)
class ParticleAtlasNativeWebMCPTest(unittest.TestCase):
    def test_deployed_tools_register_and_execute_in_chrome(self):
        chrome_path = find_chrome()
        self.assertIsNotNone(chrome_path, "Chrome was not found; set CHROME_PATH explicitly.")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=chrome_path,
                headless=True,
                args=[
                    "--enable-experimental-web-platform-features",
                    "--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            errors = []
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(LIVE_URL, wait_until="networkidle", timeout=60_000)
            page.wait_for_timeout(1_000)

            availability = page.evaluate(
                """
                () => ({
                    registerTool: typeof document.modelContext?.registerTool === "function",
                    getTools: typeof document.modelContext?.getTools === "function",
                    executeTool: typeof document.modelContext?.executeTool === "function",
                })
                """
            )
            self.assertTrue(all(availability.values()), availability)

            tool_names = set(
                page.evaluate(
                    "async () => (await document.modelContext.getTools()).map((tool) => tool.name)"
                )
            )
            self.assertEqual(tool_names, EXPECTED_TOOLS)

            scene_result = page.evaluate(
                """
                async () => {
                    const tool = (await document.modelContext.getTools())
                        .find((candidate) => candidate.name === "get_scene_state");
                    return document.modelContext.executeTool(tool, "{}");
                }
                """
            )
            scene = json.loads(json.loads(scene_result)["content"][0]["text"])
            self.assertEqual(scene["plotMode"], "spinLinear")

            question = "Which particles reveal the strongest mass hierarchy?"
            page.evaluate(
                """
                async (question) => {
                    const tool = (await document.modelContext.getTools())
                        .find((candidate) => candidate.name === "set_investigation_brief");
                    return document.modelContext.executeTool(tool, JSON.stringify({ question }));
                }
                """,
                question,
            )
            self.assertEqual(page.locator("#investigation-question").input_value(), question)
            self.assertEqual(errors, [])
            browser.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
