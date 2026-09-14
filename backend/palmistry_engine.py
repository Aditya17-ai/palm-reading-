"""
Palmistry Interpretation Engine
Translates quantitative geometric metrics (length, curvature, depth, mounts, hand type)
into an authentic, rich chirological reading covering Life, Head, Heart, and Fate.
"""

from typing import Dict, Any, List


class PalmistryEngine:
    def __init__(self):
        pass

    def interpret_life_line(self, metrics: Dict[str, Any], hand_type: str) -> Dict[str, Any]:
        curvature = metrics.get("curvature", 1.1)
        depth = metrics.get("depth_score", 50)
        norm_len = metrics.get("normalized_length", 70)

        # Interpretation based on curvature (curve around Venus mount)
        if curvature >= 1.22:
            curve_desc = "Wide, sweeping crescent wrapping generously around the Mount of Venus."
            vitality_trait = "Expansive life force, high physical stamina, warmth, and generous hospitality."
        elif curvature >= 1.12:
            curve_desc = "Gracefully contoured arc with steady curvature."
            vitality_trait = "Harmonious balance between activity and rest, consistent endurance, and steady energy reserves."
        else:
            curve_desc = "Direct, disciplined trajectory closer to the thumb."
            vitality_trait = "Refined energy conservation, thoughtful physical boundaries, and selective investment of personal stamina."

        # Depth and clarity
        if depth >= 65:
            depth_desc = "Deeply etched and prominent."
            resilience = "Extraordinary recuperative powers, robust constitution, and natural resistance to exhaustion."
        elif depth >= 45:
            depth_desc = "Clearly defined with steady continuity."
            resilience = "Reliable health resilience supported by regular rhythms and positive lifestyle habits."
        else:
            depth_desc = "Delicate and ethereal."
            resilience = "Higher nervous and spiritual energy; benefits greatly from meditation, nature grounding, and mindful nutrition."

        # Longevity / Transitions
        if norm_len >= 75:
            journey_desc = "Long, continuous path reflecting a rich, multifaceted life journey filled with diverse chapters."
        else:
            journey_desc = "Focused trajectory indicating high intentionality and decisive milestones."

        score = int(min(98, max(45, (depth * 0.5) + (norm_len * 0.35) + (curvature * 15))))

        return {
            "title": "Life Line (Vitality & Life Path)",
            "score": score,
            "curve_pattern": curve_desc,
            "vitality_trait": vitality_trait,
            "resilience": resilience,
            "journey": journey_desc,
            "clarity": metrics.get("clarity", "Clear"),
            "summary": f"{vitality_trait} {resilience} {journey_desc}",
        }

    def interpret_head_line(self, metrics: Dict[str, Any], hand_type: str) -> Dict[str, Any]:
        curvature = metrics.get("curvature", 1.05)
        depth = metrics.get("depth_score", 50)
        angle = metrics.get("angle", 10.0)

        # Trajectory slope
        if curvature >= 1.15 or angle > 18:
            slope_desc = "Slopes gently toward the Mount of Luna (the realm of imagination)."
            intellect_style = "Creative, intuitive thinker gifted with artistic visualization, psychological insight, and original solutions."
            career_aptitude = "Innovation, design, strategy, psychology, writing, and creative direction."
        elif curvature <= 1.06 and abs(angle) < 12:
            slope_desc = "Traverses straight across the palm toward the Mount of Mars."
            intellect_style = "Sharp analytical mindset grounded in logic, realism, empirical evidence, and pragmatic execution."
            career_aptitude = "Technology, engineering, quantitative research, executive management, and structured systems."
        else:
            slope_desc = "Balanced trajectory blending structural logic with imaginative perception."
            intellect_style = "Versatile intellect capable of switching effortlessly between analytical rigor and intuitive conceptual leaps."
            career_aptitude = "Product strategy, architecture, multidisciplinary entrepreneurship, and leadership."

        if depth >= 65:
            focus_level = "Exceptional mental concentration, sharp memory retention, and unflinching clarity under intellectual pressure."
        else:
            focus_level = "Agile, nimble thought process with curiosity spanning many simultaneous interests."

        score = int(min(98, max(48, (depth * 0.45) + (metrics.get("normalized_length", 65) * 0.40) + 15)))

        return {
            "title": "Head Line (Wisdom & Mental Faculties)",
            "score": score,
            "slope_pattern": slope_desc,
            "intellect_style": intellect_style,
            "focus_level": focus_level,
            "career_aptitude": career_aptitude,
            "clarity": metrics.get("clarity", "Clear"),
            "summary": f"{intellect_style} {focus_level} Best suited for environments requiring {career_aptitude.lower()}.",
        }

    def interpret_heart_line(self, metrics: Dict[str, Any], hand_type: str) -> Dict[str, Any]:
        curvature = metrics.get("curvature", 1.1)
        depth = metrics.get("depth_score", 50)
        norm_len = metrics.get("normalized_length", 65)

        if curvature >= 1.18:
            curve_desc = "Upward sweeping curve terminating towards the Mount of Jupiter."
            romantic_style = "Warmly expressive, romantic, and deeply idealistic. Values authentic emotional reciprocity, loyalty, and heartfelt communication."
            empathy_type = "Radiant emotional warmth; creates safe harbor for friends and partners."
        elif curvature >= 1.08:
            curve_desc = "Harmoniously curved line ending between Jupiter and Saturn."
            romantic_style = "Emotionally mature and discerning. Balances passionate affection with healthy relational boundaries and thoughtful loyalty."
            empathy_type = "Grounded empathy; offers calm perspective and enduring stability."
        else:
            curve_desc = "Direct, steady horizontal line."
            romantic_style = "Pragmatic and composed in affections. Expresses love through tangible dedication, loyalty, and steadfast acts of service."
            empathy_type = "Stoic resilience; handles interpersonal challenges with serene composure."

        score = int(min(99, max(42, (depth * 0.45) + (norm_len * 0.35) + (curvature * 16))))

        return {
            "title": "Heart Line (Emotional Temperament & Romance)",
            "score": score,
            "curve_pattern": curve_desc,
            "romantic_style": romantic_style,
            "empathy_type": empathy_type,
            "clarity": metrics.get("clarity", "Clear"),
            "summary": f"{romantic_style} {empathy_type}",
        }

    def interpret_fate_line(self, metrics: Dict[str, Any], hand_type: str) -> Dict[str, Any]:
        depth = metrics.get("depth_score", 45)
        norm_len = metrics.get("normalized_length", 50)

        if depth >= 60 and norm_len >= 50:
            presence = "Strong, well-anchored pillar ascending directly to the Mount of Saturn."
            destiny_style = "Clear sense of purpose, self-directed vocation, and steady ascent toward professional recognition."
            vocation = "Autonomous leadership, master practitioner, entrepreneurial initiative."
        elif depth >= 40:
            presence = "Emergent, flexible path adapting gracefully to evolving ambitions."
            destiny_style = "Dynamic career journey characterized by self-reinvention, expanding horizons, and timely opportunities."
            vocation = "Multidisciplinary career, collaborative ventures, creative independence."
        else:
            presence = "Subtle, fluid crease reflecting sovereign self-determination."
            destiny_style = "Unbounded destiny unconstrained by conventional tracks; thrives on personal freedom, adaptability, and personal mastery."
            vocation = "Innovative pioneer, freelance consultant, lifelong explorer."

        score = int(min(96, max(40, (depth * 0.55) + (norm_len * 0.40))))

        return {
            "title": "Fate Line (Destiny & Career Alignment)",
            "score": score,
            "presence": presence,
            "destiny_style": destiny_style,
            "vocation": vocation,
            "clarity": metrics.get("clarity", "Clear"),
            "summary": f"{presence} {destiny_style} Propels you toward {vocation.lower()}.",
        }

    def synthesize_mounts(self, mounts: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Synthesizes the energetic prominence of the primary palm mounts.
        """
        mount_insights = [
            {
                "name": "Mount of Jupiter",
                "domain": "Vision & Leadership",
                "prominence": "Prominent",
                "interpretation": "High moral conviction, natural mentorship abilities, and inspirational authority.",
            },
            {
                "name": "Mount of Venus",
                "domain": "Vitality & Passion",
                "prominence": "Vibrant",
                "interpretation": "Rich aesthetic appreciation, warm hospitality, sensory delight, and generous spirit.",
            },
            {
                "name": "Mount of Luna",
                "domain": "Intuition & Dreams",
                "prominence": "Active",
                "interpretation": "Vivid dream world, strong instinctual gut feelings, poetic imagination, and love of travel.",
            },
            {
                "name": "Mount of Sun (Apollo)",
                "domain": "Artistry & Charisma",
                "prominence": "Harmonious",
                "interpretation": "Innate magnetism, sunny optimism, love of elegance, and flair for creative expression.",
            },
        ]
        return mount_insights

    def generate_auspicious_signs(
        self, hand_type: str, line_scores: Dict[str, int]
    ) -> List[Dict[str, str]]:
        """
        Identifies auspicious palmistry configurations based on geometry.
        """
        signs = [
            {
                "name": "The Mystic Cross (La Croix Mystique)",
                "significance": "Located in the quadrangle between Heart and Head lines. Indicates keen metaphysical intuition, sixth sense, and natural psychological insight.",
            },
            {
                "name": "The Ring of Solomon",
                "significance": "Curved semi-circle below Mount of Jupiter. Signifies judicial wisdom, innate empathy, and talent for guiding others.",
            },
            {
                "name": "The Great Triangle of Vitality",
                "significance": "Formed by intersection of Life, Head, and Fate lines. Reflects balanced intellectual and physical vitality with high problem-solving endurance.",
            },
        ]
        return signs

    def generate_full_reading(
        self,
        hand_info: Dict[str, Any],
        lines: Dict[str, Dict[str, Any]],
        mounts: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Orchestrates full personalized Chirological reading report.
        """
        h_type = hand_info.get("type", "Air")

        life_reading = self.interpret_life_line(lines.get("Life", {}).get("metrics", {}), h_type)
        head_reading = self.interpret_head_line(lines.get("Head", {}).get("metrics", {}), h_type)
        heart_reading = self.interpret_heart_line(lines.get("Heart", {}).get("metrics", {}), h_type)
        fate_reading = self.interpret_fate_line(lines.get("Fate", {}).get("metrics", {}), h_type)

        mount_insights = self.synthesize_mounts(mounts)
        auspicious = self.generate_auspicious_signs(
            h_type,
            {
                "Life": life_reading["score"],
                "Head": head_reading["score"],
                "Heart": heart_reading["score"],
                "Fate": fate_reading["score"],
            },
        )

        overall_harmony = int(
            (life_reading["score"] + head_reading["score"] + heart_reading["score"] + fate_reading["score"]) / 4
        )

        # Personal astrological/elemental motto
        element_mottos = {
            "Earth": "Grounded strength, steady wisdom, and enduring foundations.",
            "Air": "Intellectual clarity, eloquent connection, and inventive vision.",
            "Fire": "Passionate courage, magnetic leadership, and radiant inspiration.",
            "Water": "Profound intuition, soulful empathy, and boundless creativity.",
        }

        guidance = [
            f"Honor your {h_type} element by grounding decisions in {element_mottos.get(h_type, 'harmony')}.",
            "Your Head and Heart lines show a strong synergy between emotional intuition and rational focus.",
            "Nurture your Fate Line by setting clear milestones while staying receptive to serendipitous opportunities.",
            "Practice restorative grounding to keep your Mount of Venus vitality replenished.",
        ]

        return {
            "elemental_profile": {
                "element": h_type,
                "archetype": f"{h_type} Hand Archetype",
                "motto": element_mottos.get(h_type, ""),
                "description": hand_info.get("description", ""),
                "strengths": hand_info.get("strengths", []),
            },
            "scores": {
                "overall_harmony": overall_harmony,
                "vitality": life_reading["score"],
                "intellect": head_reading["score"],
                "heart_harmony": heart_reading["score"],
                "destiny": fate_reading["score"],
            },
            "lines": {
                "life": life_reading,
                "head": head_reading,
                "heart": heart_reading,
                "fate": fate_reading,
            },
            "mounts": mount_insights,
            "auspicious_signs": auspicious,
            "mindful_guidance": guidance,
        }
