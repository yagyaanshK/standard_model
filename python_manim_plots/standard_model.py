from manim import *
import numpy as np

class StandardModelScene(ThreeDScene):
    def construct(self):
        # Define custom colors
        LIGHT_PURPLE = "#E6E6FA"
        PINK_E = "#FFB6C1"
        PINK_D = "#FF69B4"
        ORANGE_E = "#FFA07A"
        
        # Create axes (using log scale for mass)
        axes = ThreeDAxes(
            x_range=[-3, 5],  # log scale from 10^-3 to 10^5 MeV
            y_range=[-2, 2],  # charge from -2e to +2e
            z_range=[-1, 1],  # isospin from -1 to +1
        ).scale(0.8)
        
        # Add labels
        # Add axis labels with 3D orientation
        x_label = Text("Log₁₀(Mass/MeV)").scale(0.5)
        y_label = Text("Charge (e)").scale(0.5)
        z_label = Text("Isospin (I₃)").scale(0.5)
        
        # Position labels with proper 3D orientation
        x_label.next_to(axes.x_axis, DOWN + OUT, buff=0.5)
        y_label.next_to(axes.y_axis, RIGHT + OUT, buff=0.5)
        z_label.next_to(axes.z_axis, OUT + RIGHT, buff=0.5)
        
        # Make labels maintain orientation during rotation
        self.add_fixed_orientation_mobjects(x_label, y_label, z_label)
        labels = VGroup(x_label, y_label, z_label)

        # Create title
        title = Text("Standard Model - Particles").scale(0.8)
        title.to_corner(DOWN)
        
        # Set up camera
        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)
        self.begin_ambient_camera_rotation(rate=0.2)
        
        # Add lighting to make 3D objects more visible
        self.camera.light_source.move_to(3*IN + 7*OUT + 10*RIGHT)
        self.add(self.camera.light_source)
        
        # Create particles
        particles = VGroup()
        
        # Define particle colors using Manim's color system
        lepton_colors = [RED, RED_C, RED_E]
        neutrino_colors = [PURPLE, PURPLE_C, PURPLE_E]
        quark_colors = [BLUE, BLUE_C, BLUE_E, TEAL, TEAL_E]
        anti_lepton_colors = [PINK, "#FFB6C1", "#FF69B4"]  # Light pink to hot pink
        anti_neutrino_colors = ["#E6E6FA", "#E6E6FA", "#E6E6FA"]  # Light purple
        anti_quark_colors = [GREEN, GREEN_C, GREEN_E, YELLOW, YELLOW_E]
        force_carrier_colors = [YELLOW_A, ORANGE, "#FFA07A", MAROON, WHITE]
        
        # Define all particle data by type
        # (name, mass, charge, isospin, color)
        particle_data = [
            # Leptons
            ("e-", 0.511, -1, -0.5, lepton_colors[0]),
            ("μ-", 105.66, -1, -0.5, lepton_colors[1]),
            ("τ-", 1776.86, -1, -0.5, lepton_colors[2]),
            ("νe", 1e-3, 0, 0.5, neutrino_colors[0]),
            ("νμ", 1e-3, 0, 0.5, neutrino_colors[1]),
            ("ντ", 1e-3, 0, 0.5, neutrino_colors[2]),
            
            # Anti-leptons
            ("e+", 0.511, 1, 0.5, anti_lepton_colors[0]),
            ("μ+", 105.66, 1, 0.5, anti_lepton_colors[1]),
            ("τ+", 1776.86, 1, 0.5, anti_lepton_colors[2]),
            ("ν̄e", 1e-3, 0, -0.5, anti_neutrino_colors[0]),
            ("ν̄μ", 1e-3, 0, -0.5, anti_neutrino_colors[1]),
            ("ν̄τ", 1e-3, 0, -0.5, anti_neutrino_colors[2]),
            
            # Quarks
            ("u", 2.2, 2/3, 0.5, quark_colors[0]),
            ("d", 4.7, -1/3, -0.5, quark_colors[1]),
            ("s", 95, -1/3, 0, quark_colors[2]),
            ("c", 1275, 2/3, 0, quark_colors[3]),
            ("b", 4180, -1/3, 0, quark_colors[4]),
            
            # Anti-quarks
            ("ū", 2.2, -2/3, -0.5, anti_quark_colors[0]),
            ("d̄", 4.7, 1/3, 0.5, anti_quark_colors[1]),
            ("s̄", 95, 1/3, 0, anti_quark_colors[2]),
            ("c̄", 1275, -2/3, 0, anti_quark_colors[3]),
            ("b̄", 4180, 1/3, 0, anti_quark_colors[4]),
            
            # Force carriers
            ("γ", 1e-3, 0, 0, force_carrier_colors[0]),    # photon
            ("W+", 80.4e3, 1, 1, force_carrier_colors[1]),  # W+
            ("W-", 80.4e3, -1, -1, force_carrier_colors[2]), # W-
            ("Z0", 91.2e3, 0, 0, force_carrier_colors[3]),   # Z0
            ("g", 1e-3, 0, 0, force_carrier_colors[4])      # gluon
        ]
        
        # Create particles with proper log scaling for mass
        for name, mass, charge, isospin, color in particle_data:
            log_mass = np.log10(mass)
            point = axes.c2p(log_mass, charge, isospin)
            dot = Sphere(radius=0.08, color=color).move_to(point)
            # Add surface material and lighting to make the sphere more visible
            dot.set_color(color)
            dot.set_opacity(0.9)
            dot.set_sheen(0.8)
            
            # Create label and position it in 3D space
            label = Text(name, font_size=16)
            
            # Calculate label position based on particle position
            # This will place labels in a way that they're more visible
            label_direction = np.array([0.2, 0.2, 0.1])  # Offset in x, y, z
            label_point = point + label_direction
            
            # Move label to position and rotate to face camera
            label.move_to(label_point)
            
            # Make label a 3D object that will rotate with the scene
            label_3d = label.copy()
            self.add_fixed_orientation_mobjects(label_3d)
            
            particles.add(VGroup(dot, label_3d))

        # Add all objects to scene with animations
        self.add_fixed_in_frame_mobjects(title)
        self.play(Create(axes))
        self.play(Write(labels))
        self.play(
            AnimationGroup(
                *[Create(particle) for particle in particles],
                lag_ratio=0.05
            )
        )
        
        # Add legend with particle categories
        legend = VGroup()
        legend_data = [
            ("Leptons", lepton_colors[0]),
            ("Anti-leptons", anti_lepton_colors[0]),
            ("Quarks", quark_colors[0]),
            ("Anti-quarks", anti_quark_colors[0]),
            ("Force Carriers", force_carrier_colors[0]),
            ("Neutrinos", neutrino_colors[0]),
        ]
        
        for name, color in legend_data:
            dot = Dot(color=color)
            text = Text(name, font_size=20)
            item = VGroup(dot, text).arrange(RIGHT, buff=0.2)
            legend.add(item)
        
        legend.arrange(DOWN, aligned_edge=LEFT)
        legend.scale(0.5)
        legend.to_corner(RIGHT+UP)
        self.add_fixed_in_frame_mobjects(legend)
        
        # Wait for a while with rotation
        self.wait(8)


        # Rotate camera
        self.stop_ambient_camera_rotation()
        self.begin_ambient_camera_rotation(rate=0.2, about="phi")

        self.wait(8)

        # Rotate camera
        self.stop_ambient_camera_rotation()
        self.begin_ambient_camera_rotation(rate=0.2, about="gamma")

        self.wait(8)

if __name__ == "__main__":
    with tempconfig({
        "quality": "medium_quality",
        "preview": True,
        "disable_caching": True,
        "pixel_height": 720,
        "pixel_width": 1280,
    }):
        scene = StandardModelScene()