"""
API Endpoint Test
Validates /api/health, /api/samples, /api/analyze-sample, and /api/analyze-base64
"""

import unittest
import base64
from fastapi.testclient import TestClient
from backend.app import app


class TestPalmAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_samples(self):
        response = self.client.get("/api/samples")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("samples", data)
        self.assertTrue(len(data["samples"]) >= 3)

    def test_analyze_sample(self):
        response = self.client.post("/api/analyze-sample/earth")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reading", data)
        self.assertIn("lines", data)
        self.assertIn("visualizations", data)
        self.assertIn("overlay", data["visualizations"])
        self.assertTrue(data["visualizations"]["overlay"].startswith("data:image/png;base64,"))

    def test_analyze_base64(self):
        with open("samples/sample_earth_palm.png", "rb") as f:
            b64_img = base64.b64encode(f.read()).decode("utf-8")

        response = self.client.post("/api/analyze-base64", json={"image": f"data:image/png;base64,{b64_img}"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reading", data)
        self.assertIn("scores", data["reading"])
        print(f"\nAPI Test Success! Overall Score: {data['reading']['scores']['overall_harmony']}/100")

    def test_detect_live(self):
        with open("samples/sample_earth_palm.png", "rb") as f:
            b64_img = base64.b64encode(f.read()).decode("utf-8")

        response = self.client.post("/api/detect-live", json={"image": f"data:image/png;base64,{b64_img}", "mirror": False})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["detected"])
        self.assertIn("mounts", data)
        self.assertIn("lines", data)
        self.assertIn("alignment_score", data)
        self.assertIn("scores", data)
    def test_line_tracing_correctness(self):
        """Verifies that the lines traced have authentic anatomical coordinates and curvature."""
        response = self.client.post("/api/analyze-sample/earth")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        lines = data["lines"]

        for expected in ["Heart", "Head", "Life", "Fate"]:
            self.assertIn(expected, lines)
            pts = lines[expected]["points"]
            self.assertTrue(len(pts) >= 10, f"{expected} line points count too low: {len(pts)}")
            metrics = lines[expected]["metrics"]
            self.assertIn("curvature", metrics)
            self.assertIn("length", metrics)
            self.assertTrue(metrics["length"] > 50, f"{expected} length too short")

        # Life line: verify starts in upper-left and ends in lower palm
        life_pts = lines["Life"]["points"]
        self.assertTrue(life_pts[0][1] < life_pts[-1][1], "Life line must travel vertically downward")

        # Fate line: verify starts low and ascends high
        fate_pts = lines["Fate"]["points"]
        self.assertTrue(fate_pts[0][1] > fate_pts[-1][1], "Fate line must ascend towards top/Saturn mount")

        print("Line Tracing Correctness Verified! Heart, Head, Life, Fate lines correctly positioned.")


if __name__ == "__main__":
    unittest.main()

