import json
import os
import threading
import unittest
from colorsys import rgb_to_hls
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = REPOSITORY_ROOT / "web"
EXPECTED_TOOLS = {
    "get_particle_catalog",
    "get_scene_state",
    "focus_particle",
    "compare_particles",
    "configure_plot",
    "show_force_network",
    "highlight_particles",
    "get_investigation",
    "set_investigation_brief",
    "add_investigation_step",
    "reset_explorer",
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


class ParticleAtlasWebMCPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = partial(QuietHandler, directory=str(WEB_ROOT))
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}/"

        cls.playwright = sync_playwright().start()
        launch_options = {"headless": True}
        chrome_path = os.environ.get("CHROME_PATH")
        if chrome_path:
            launch_options["executable_path"] = chrome_path
        cls.browser = cls.playwright.chromium.launch(**launch_options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def new_page(self, viewport=None, webmcp=True):
        page = self.browser.new_page(viewport=viewport or {"width": 1440, "height": 900})
        if webmcp:
            page.add_init_script(
                """
                window.__registeredTools = {};
                Object.defineProperty(document, "modelContext", {
                    configurable: true,
                    value: {
                        async registerTool(definition) {
                            window.__registeredTools[definition.name] = definition;
                            return { unregister() {} };
                        }
                    }
                });
                """
            )
        page.goto(self.base_url, wait_until="networkidle")
        if webmcp:
            page.wait_for_function(
                f"Object.keys(window.__registeredTools).length === {len(EXPECTED_TOOLS)}"
            )
        return page

    @staticmethod
    def call_tool(page, name, arguments=None):
        result = page.evaluate(
            "async ([name, args]) => window.__registeredTools[name].execute(args)",
            [name, arguments or {}],
        )
        return json.loads(result["content"][0]["text"])

    def test_all_tools_register_and_execute(self):
        page = self.new_page()
        self.assertEqual(set(page.evaluate("Object.keys(window.__registeredTools)")), EXPECTED_TOOLS)
        self.assertEqual(page.locator("#webmcp-status").inner_text(), "11 tools ready")

        catalog = self.call_tool(page, "get_particle_catalog", {"name": "electron"})
        self.assertGreaterEqual(catalog["count"], 1)
        self.call_tool(page, "get_scene_state")
        self.call_tool(page, "focus_particle", {"particle": "electron"})
        compared = self.call_tool(
            page,
            "compare_particles",
            {"particles": ["electron", "muon", "tau"], "isolate": True},
        )
        self.assertEqual(len(compared["compared"]), 3)
        self.call_tool(page, "configure_plot", {"preset": "weakNetwork", "theme": "light"})
        self.call_tool(
            page,
            "show_force_network",
            {"force": "weak", "visible": True, "exclusive": True},
        )
        self.call_tool(
            page,
            "highlight_particles",
            {"particles": ["electron", "electron neutrino"]},
        )
        self.call_tool(
            page,
            "set_investigation_brief",
            {"question": "How does weak isospin organize one lepton family?"},
        )
        added = self.call_tool(
            page,
            "add_investigation_step",
            {
                "title": "A weak doublet",
                "finding": "The electron and electron neutrino occupy related weak-isospin positions.",
                "particles": ["electron", "electron neutrino"],
            },
        )
        self.assertEqual(added["added"]["title"], "A weak doublet")
        investigation = self.call_tool(page, "get_investigation")
        self.assertEqual(len(investigation["findings"]), 1)
        reset = self.call_tool(page, "reset_explorer")
        self.assertEqual(reset["preset"], "overview")
        self.assertEqual(page.locator("#agent-activity li:not(.empty)").count(), 8)
        page.close()

    def test_investigation_undo_replay_and_url_round_trip(self):
        page = self.new_page()
        self.call_tool(page, "set_investigation_brief", {"question": "Why are lepton masses different?"})
        self.call_tool(
            page,
            "compare_particles",
            {"particles": ["electron", "muon", "tau"], "isolate": True},
        )
        self.call_tool(
            page,
            "add_investigation_step",
            {
                "title": "Lepton mass hierarchy",
                "finding": "The three charged leptons share charge and spin but have widely separated masses.",
                "particles": ["electron", "muon", "tau"],
            },
        )
        self.call_tool(
            page,
            "add_investigation_step",
            {"title": "Temporary finding", "finding": "This finding should be undone."},
        )
        self.assertEqual(len(page.evaluate("window.particleAtlas.getInvestigation().findings")), 2)

        latest_add = page.locator("#agent-activity li").filter(
            has=page.locator("strong", has_text="add_investigation_step")
        ).first
        latest_add.locator(".agent-undo").click()
        self.assertEqual(len(page.evaluate("window.particleAtlas.getInvestigation().findings")), 1)

        page.locator("#investigation-question").fill("Edited by the learner")
        page.wait_for_timeout(300)
        shared_url = page.url
        self.assertIn("investigation=", shared_url)

        restored = self.browser.new_page(viewport={"width": 390, "height": 844})
        restored.goto(shared_url, wait_until="networkidle")
        restored_state = restored.evaluate("window.particleAtlas.getInvestigation()")
        self.assertEqual(restored_state["question"], "Edited by the learner")
        self.assertEqual(len(restored_state["findings"]), 1)
        restored.locator("#investigation-toggle").click()
        self.assertTrue(restored.locator("#investigation-panel").is_visible())

        restored.locator(".investigation-open-scene").click()
        replayed = restored.evaluate("window.particleAtlas.getSceneState()")
        self.assertEqual(replayed["comparisonParticles"], ["electron", "muon", "tau"])
        restored.close()
        page.close()

    def test_desktop_panels_do_not_overlap(self):
        page = self.new_page()
        self.call_tool(page, "set_investigation_brief", {"question": "Layout test"})
        self.call_tool(
            page,
            "add_investigation_step",
            {"title": "Finding", "finding": "A saved scene for the layout test."},
        )
        investigation = page.locator("#investigation-panel").bounding_box()
        activity = page.locator("#agent-panel").bounding_box()
        overlaps = not (
            investigation["y"] + investigation["height"] <= activity["y"]
            or activity["y"] + activity["height"] <= investigation["y"]
            or investigation["x"] + investigation["width"] <= activity["x"]
            or activity["x"] + activity["width"] <= investigation["x"]
        )
        self.assertFalse(overlaps)
        page.close()

    def test_investigation_findings_remain_visible_at_720p(self):
        page = self.new_page(viewport={"width": 1280, "height": 720})
        self.call_tool(page, "set_investigation_brief", {"question": "720p layout test"})
        self.call_tool(
            page,
            "add_investigation_step",
            {"title": "First finding", "finding": "The first saved scene must remain visible."},
        )
        self.call_tool(
            page,
            "add_investigation_step",
            {"title": "Second finding", "finding": "The notebook must retain a usable findings region."},
        )

        findings = page.locator("#investigation-steps").bounding_box()
        self.assertGreaterEqual(findings["height"], 150)
        self.assertTrue(page.locator(".investigation-open-scene").first.is_visible())

        investigation = page.locator("#investigation-panel").bounding_box()
        activity = page.locator("#agent-panel").bounding_box()
        self.assertLessEqual(investigation["x"] + investigation["width"], activity["x"])
        page.close()

    def test_manual_fallback_remains_available(self):
        page = self.new_page(webmcp=False)
        self.assertEqual(page.locator("#webmcp-status").inner_text(), "Manual mode")
        page.locator("#investigation-toggle").click()
        self.assertTrue(page.locator("#investigation-panel").is_visible())
        page.close()

    def test_light_theme_preserves_hue_with_readable_particle_fills(self):
        page = self.new_page()
        self.call_tool(page, "configure_plot", {"theme": "light"})
        page.wait_for_function(
            """
            [...document.querySelectorAll('.particle-label')].every((label) =>
                label.dataset.particleFill && getComputedStyle(label).color === 'rgb(0, 0, 0)'
            )
            """
        )

        fills = page.locator(".particle-label").evaluate_all(
            """
            labels => [...new Map(labels.map((label) => [
                label.dataset.particleFill,
                { fill: label.dataset.particleFill, base: label.dataset.particleBaseFill },
            ])).values()]
            """
        )
        self.assertGreaterEqual(len(fills), 4)
        for colors in fills:
            fill_rgb = tuple(int(colors["fill"][idx : idx + 2], 16) / 255 for idx in (1, 3, 5))
            base_rgb = tuple(int(colors["base"][idx : idx + 2], 16) / 255 for idx in (1, 3, 5))
            hue, lightness, saturation = rgb_to_hls(*fill_rgb)
            base_hue, base_lightness, base_saturation = rgb_to_hls(*base_rgb)
            hue_delta = min(abs(hue - base_hue), 1 - abs(hue - base_hue))
            linear_rgb = tuple(
                channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
                for channel in fill_rgb
            )
            relative_luminance = 0.2126 * linear_rgb[0] + 0.7152 * linear_rgb[1] + 0.0722 * linear_rgb[2]

            self.assertLessEqual(hue_delta, 0.02)
            self.assertGreaterEqual(lightness, 0.70)
            self.assertGreaterEqual(lightness, base_lightness)
            self.assertLessEqual(saturation, base_saturation + 0.02)
            self.assertGreaterEqual((relative_luminance + 0.05) / 0.05, 7)

        self.call_tool(page, "configure_plot", {"theme": "dark"})
        page.wait_for_function(
            "[...document.querySelectorAll('.particle-label')].every((label) => getComputedStyle(label).color !== 'rgb(0, 0, 0)')"
        )
        page.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
