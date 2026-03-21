from mpl_toolkits import mplot3d
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D  # Import Line2D for custom legend lines

# Modify the figure and axes creation
fig = plt.figure(figsize=(24, 12))

# Create two subplots
ax1 = fig.add_subplot(121, projection='3d')  # Fundamental particles
ax2 = fig.add_subplot(122, projection='3d')  # Composite particles

# Define particle names with antiparticles
names_fund = ['νe', 'νμ', 'ντ', 'ν̄e', 'ν̄μ', 'ν̄τ',    # neutrinos and antineutrinos
             'e-', 'μ-', 'τ-', 'e+', 'μ+', 'τ+',       # leptons and antileptons
             'u', 'd', 's', 'c', 'b', 'ū', 'd̄', 's̄', 'c̄', 'b̄',  # quarks and antiquarks
             'γ'                                        # photon (self-antiparticle)
             ]

names_comp = ['Ξ*', 'Ξ-', 'Ξ0', 'Σ*', 'Σ0', 'Σ+', 'Λ', 'n', 'p',
              'Ξ̄*', 'Ξ̄+', 'Ξ̄0', 'Σ̄*', 'Σ̄0', 'Σ̄-', 'Λ̄', 'n̄', 'p̄',
              'K-', 'K0', 'K+', 'K̄+', 'K̄0', 'K̄-',
              'π-', 'π0', 'π+']  # π0 is self-antiparticle

# Define arrays with numpy - now including antiparticles
masses_fund = np.array([1e-3, 1e-3, 1e-3, 1e-3, 1e-3, 1e-3,              # (anti)neutrinos
                       0.51, 105.66, 1776.86, 0.51, 105.66, 1776.86,     # (anti)leptons
                       2.2, 4.7, 95, 1275, 4180,                          # quarks
                       2.2, 4.7, 95, 1275, 4180,                          # antiquarks
                       1e-3                                               # photon
                       ], dtype=float)

charges_fund = np.array([0, 0, 0, 0, 0, 0,                    # (anti)neutrinos
                        -1, -1, -1, 1, 1, 1,                  # (anti)leptons
                        2/3, -1/3, -1/3, 2/3, -1/3,          # quarks
                        -2/3, 1/3, 1/3, -2/3, 1/3,           # antiquarks
                        0                                      # photon
                        ], dtype=float)

spins_fund = np.array([0.5]*21 + [1.0], dtype=float)  # All spin-1/2 except photon (spin-1)

# Add generation numbers after the spin array definition
generations_fund = np.array([1, 2, 3, 1, 2, 3,              # (anti)neutrinos
                           1, 2, 3, 1, 2, 3,                # (anti)leptons
                           1, 1, 2, 2, 3,                   # quarks (u,d, s,c, b)
                           1, 1, 2, 2, 3,                   # antiquarks
                           0                                # photon (generation-less)
                           ], dtype=float)

# Define composite particle data (before antiparticles)
masses_comp = np.array([1320, 1321, 1315, 1385, 1193, 1189, 1116, 939.6, 938.3,  # baryons
                       494, 498, 494,  # kaons
                       139.6, 135.0, 139.6], dtype=float)  # pions

charges_comp = np.array([0, -1, 0, 0, 0, 1, 0, 0, 1,  # baryons
                        -1, 0, 1,  # kaons
                        -1, 0, 1], dtype=float)  # pions

strangeness_comp = np.array([-2, -2, -2, -1, -1, -1, -1, 0, 0,  # baryons
                            -1, -1, -1,  # kaons
                            0, 0, 0], dtype=float)  # pions

# Now concatenate to include antiparticles
masses_comp = np.concatenate([masses_comp, masses_comp[:-3], masses_comp[-3:]], axis=0)
charges_comp = np.concatenate([charges_comp, -charges_comp[:-3], charges_comp[-3:]], axis=0)
strangeness_comp = np.concatenate([strangeness_comp, -strangeness_comp[:-3], strangeness_comp[-3:]], axis=0)

# Plot fundamental particles on ax1
scatter_fund = ax1.scatter(masses_fund[6:9], charges_fund[6:9], generations_fund[6:9],
                         c='darkred', marker='o', s=100, label='Fundamental')

scatter_antifund = ax1.scatter(masses_fund[9:17], charges_fund[9:17], generations_fund[9:17],
                            c='lightcoral', marker='o', s=100, label='Anti-Fundamental')

scatter_antiquarks = ax1.scatter(masses_fund[17:22], charges_fund[17:22], generations_fund[17:22],
                               c='lightcoral', marker='o', s=100, label='Anti-Quarks')

scatter_photon = ax1.scatter(masses_fund[-1], charges_fund[-1], generations_fund[-1],
                          c='gold', marker='*', s=150, label='Photon')

# Plot composite particles on ax2
scatter_comp = ax2.scatter(masses_comp[:9], charges_comp[:9], strangeness_comp[:9],
                         c='darkblue', marker='o', s=100, label='Composite')

scatter_anticomp = ax2.scatter(masses_comp[9:], charges_comp[9:], strangeness_comp[9:],
                            c='lightskyblue', marker='o', s=100, label='Anti-Composite')

# Add labels for fundamental particles on ax1
for i in range(6):  # Neutrinos
    ax1.text(masses_fund[i], charges_fund[i], generations_fund[i], 
            names_fund[i], fontsize=9)
for i in range(6, 12):  # Leptons
    ax1.text(masses_fund[i], charges_fund[i], generations_fund[i], 
            names_fund[i], fontsize=9)
for i in range(12, 22):  # Quarks
    ax1.text(masses_fund[i], charges_fund[i], generations_fund[i], 
            names_fund[i], fontsize=9)
ax1.text(masses_fund[-1], charges_fund[-1], generations_fund[-1], 
        names_fund[-1], fontsize=9)

# Add labels for composite particles on ax2
for i in range(len(names_comp)):
    ax2.text(masses_comp[i], charges_comp[i], strangeness_comp[i],
            names_comp[i], fontsize=9)

# Set limits and scales for plot1
ax1.set_xlim(1e-3, 2e3)
ax1.set_ylim(-1.5, 1.5)
ax1.set_zlim(0, 3.5)  # Adjust limits to show all generations clearly
ax1.set_xscale('linear')
ax1.set_yscale('linear')
ax1.set_zscale('linear')
ax1.view_init(elev=25, azim=60)
ax1.set_box_aspect([1.5, 1, 1])

# Customize titles and labels plot1
ax1.set_title('Fundamental Particles')

ax1.set_xlabel('Mass (MeV)')
ax1.set_ylabel('Charge (e)')
ax1.set_zlabel('Generation')

# Customize titles and labels plot2
ax2.set_title('Composite Particles')

ax1.set_xlabel('Mass (MeV)')
ax1.set_ylabel('Charge (e)')
ax2.set_zlabel('Strangeness')

# Set limits and scales for plot2
ax2.set_xlim(1e-3, 2e3)
ax2.set_ylim(-2, 2)
ax2.set_zlim(-2, 2)
ax2.set_xscale('linear')
ax2.set_yscale('linear')
ax2.set_zscale('linear')
ax2.view_init(elev=25, azim=60)
ax2.set_box_aspect([1.5, 1, 1])

# Move the draw_interaction function and interaction plotting code before plt.show()

# After all scatter plots but before plt.show(), add:
def draw_interaction(ax, p1_idx, p2_idx, color, alpha=0.3, linestyle='--'):
    """Draw interaction line between two particles"""
    x = [masses_fund[p1_idx], masses_fund[p2_idx]]
    y = [charges_fund[p1_idx], charges_fund[p2_idx]]
    z = [generations_fund[p1_idx], generations_fund[p2_idx]]
    ax.plot(x, y, z, color=color, alpha=alpha, linestyle=linestyle)

# Draw Strong interactions
print("Drawing strong interactions...")
for i in range(12, 17):  # quarks
    for j in range(17, 22):  # antiquarks
        draw_interaction(ax1, i, j, 'red', alpha=0.2)

# Draw Electromagnetic interactions
print("Drawing electromagnetic interactions...")
charged_indices = [i for i, q in enumerate(charges_fund) if abs(q) > 0]
for i in charged_indices:
    for j in charged_indices[charged_indices.index(i)+1:]:
        draw_interaction(ax1, i, j, 'blue', alpha=0.1)

# Draw Weak interactions
print("Drawing weak interactions...")
lepton_indices = list(range(6, 12))  # leptons and antileptons
quark_indices = list(range(12, 22))  # quarks and antiquarks
for i in lepton_indices:
    for j in quark_indices:
        draw_interaction(ax1, i, j, 'green', alpha=0.05, linestyle=':')

# Add legend entries for interactions and particles
scatter_handles = [scatter_fund, scatter_antifund, scatter_antiquarks, scatter_photon]
scatter_labels = [h.get_label() for h in scatter_handles]

custom_lines = [Line2D([0], [0], color='red', linestyle='--', label='Strong'),
               Line2D([0], [0], color='blue', linestyle='--', label='EM'),
               Line2D([0], [0], color='green', linestyle=':', label='Weak')]

# Combine scatter plots and interaction lines in legend
all_handles = scatter_handles + custom_lines
all_labels = scatter_labels + ['Strong', 'EM', 'Weak']

# Create legend with all elements
ax1.legend(handles=all_handles, labels=all_labels)

# Create similar legend for composite particles
scatter_comp_handles = [scatter_comp, scatter_anticomp]
scatter_comp_labels = [h.get_label() for h in scatter_comp_handles]

custom_comp_lines = [Line2D([0], [0], color='red', linestyle='--', label='Strong'),
                    Line2D([0], [0], color='blue', linestyle='--', label='EM')]

all_comp_handles = scatter_comp_handles + custom_comp_lines
all_comp_labels = scatter_comp_labels + ['Strong', 'EM']

ax2.legend(handles=all_comp_handles, labels=all_comp_labels)

# Add a new function for composite particle interactions
def draw_comp_interaction(ax, p1_idx, p2_idx, color, alpha=0.3, linestyle='--'):
    """Draw interaction line between two composite particles"""
    x = [masses_comp[p1_idx], masses_comp[p2_idx]]
    y = [charges_comp[p1_idx], charges_comp[p2_idx]]
    z = [strangeness_comp[p1_idx], strangeness_comp[p2_idx]]
    ax.plot(x, y, z, color=color, alpha=alpha, linestyle=linestyle)

# After existing interaction code but before plt.show(), add:
# Draw Strong interactions between baryons
print("Drawing baryon-baryon interactions...")
for i in range(9):  # first 9 are baryons
    for j in range(i+1, 9):
        draw_comp_interaction(ax2, i, j, 'red', alpha=0.2)

# Draw Strong interactions between mesons (kaons and pions)
print("Drawing meson-meson interactions...")
for i in range(-6, 0):  # last 6 are mesons
    for j in range(i+1, 0):
        draw_comp_interaction(ax2, i, j, 'red', alpha=0.2)

# Draw Electromagnetic interactions between charged composite particles
print("Drawing composite EM interactions...")
charged_comp_indices = [i for i, q in enumerate(charges_comp) if abs(q) > 0]
for i in charged_comp_indices:
    for j in charged_comp_indices[charged_comp_indices.index(i)+1:]:
        draw_comp_interaction(ax2, i, j, 'blue', alpha=0.1)

plt.tight_layout()
plt.show()

# Group particles by mass range
def analyze_mass_groups(masses, names):
    light = [n for m,n in zip(masses, names) if m < 1]
    medium = [n for m,n in zip(masses, names) if 1 <= m < 500]
    heavy = [n for m,n in zip(masses, names) if m >= 500]
    print("Mass groupings:")
    print(f"Light (<1 MeV): {', '.join(light)}")
    print(f"Medium (1-500 MeV): {', '.join(medium)}")
    print(f"Heavy (>500 MeV): {', '.join(heavy)}")

# Analyze charge symmetries
def analyze_charge_pairs(charges, names):
    pairs = []
    for i, (q1, n1) in enumerate(zip(charges, names)):
        for q2, n2 in zip(charges[i+1:], names[i+1:]):
            if abs(q1 + q2) < 1e-10:  # Check if charges sum to zero
                pairs.append((n1, n2))
    print("\nCharge-conjugate pairs:")
    for p1, p2 in pairs:
        print(f"{p1} ↔ {p2}")

# Call the analysis functions
analyze_mass_groups(masses_fund, names_fund)
analyze_charge_pairs(charges_fund, names_fund)