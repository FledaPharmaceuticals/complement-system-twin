const RETINA_IDS = new Set([
  "retina",
  "rpe",
  "choroid",
  "drusen",
  "retinal-complement",
  "geographic-atrophy",
  "neovascular-signal"
]);

export const tissueImageCatalog = {
  brain: {
    label: "Brain / CNS",
    image: "../assets/tissue-models/brain-complement-diptych.jpg",
    normal: "Ordered neurons and synapses with ramified resting microglia and preserved microvasculature.",
    impact: "C1q/C3-opsonized synaptic puncta, activated microglia, synaptic engulfment and a restrained perivascular inflammatory signal.",
    evidence: [{ label: "Complement-mediated synapse elimination", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8115878/" }],
    evidenceLevel: "Mechanism-informed preclinical evidence",
    uncertainty: "The organ score does not predict patient-specific neurodegeneration."
  },
  retina: {
    label: "Retina / Macula",
    image: "../assets/tissue-models/retina-complement-diptych.jpg",
    normal: "Ordered photoreceptors, intact RPE monolayer, thin Bruch membrane and patent choriocapillaris.",
    impact: "Sub-RPE drusen-like deposits, RPE stress, Bruch membrane thickening, local complement deposition and choriocapillaris attenuation.",
    evidence: [{ label: "Complement, RPE and choriocapillaris in AMD", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4339497/" }],
    evidenceLevel: "Human tissue and mechanism-informed evidence",
    uncertainty: "Dry and neovascular AMD are distinct phenotypes; this image is a pathway composite."
  },
  kidney: {
    label: "Kidney",
    image: "../assets/tissue-models/kidney-complement-diptych.jpg",
    normal: "Open glomerular capillary loops, intact podocyte-endothelial barrier and nonexpanded mesangium.",
    impact: "Dominant C3 deposition, mesangial/endocapillary hypercellularity, endothelial swelling and early capillary-wall remodeling.",
    evidence: [{ label: "C3 glomerulopathy morphology", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4438675/" }],
    evidenceLevel: "Human biopsy and disease-mechanism evidence",
    uncertainty: "C3 glomerulopathy and complement-mediated TMA have overlapping but nonidentical patterns."
  },
  lung: {
    label: "Lung",
    image: "../assets/tissue-models/lung-complement-diptych.jpg",
    normal: "Thin alveolar septa, open airspaces and intact alveolar-capillary interfaces.",
    impact: "C5a-associated neutrophil recruitment, septal edema, patchy fibrin and limited intra-alveolar hemorrhage-like signal.",
    evidence: [{ label: "C5a-driven acute lung injury", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4763927/" }],
    evidenceLevel: "Mechanism-informed experimental evidence",
    uncertainty: "The image is not an ARDS diagnosis and does not represent a patient biopsy."
  },
  blood: {
    label: "Blood / RBC",
    image: "../assets/tissue-models/blood-complement-diptych.jpg",
    normal: "Uniform biconcave erythrocytes with smooth, intact membranes.",
    impact: "A PNH-like subset with terminal-complement puncta, pore-like membrane injury, spherocytic distortion and early hemolysis fragments.",
    evidence: [{ label: "Complement membrane defects in PNH erythrocytes", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2138177/" }],
    evidenceLevel: "Human erythrocyte ultrastructure evidence",
    uncertainty: "Visible membrane features are illustrative and are not a quantitative hemolysis assay."
  },
  liver: {
    label: "Liver",
    image: "../assets/tissue-models/liver-complement-diptych.jpg",
    normal: "Radial hepatocyte plates, open sinusoids and sparse resting Kupffer cells around a central vein.",
    impact: "Patchy C3/C5b-9 deposition, Kupffer-cell activation, sinusoidal inflammatory recruitment and hepatocyte stress proxy.",
    evidence: [{ label: "Complement activation in liver injury", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3206060/" }],
    evidenceLevel: "Mechanism-informed clinical and experimental evidence",
    uncertainty: "This represents complement-production burden and inflammatory association, not deterministic liver damage."
  },
  vessels: {
    label: "Vessels",
    image: "../assets/tissue-models/vessels-complement-diptych.jpg",
    normal: "Continuous glycocalyx, flat endothelial cells, open lumen and nonadherent circulating cells.",
    impact: "Glycocalyx loss, endothelial swelling, surface C3/C5b-9, platelet-leukocyte adhesion and a small microthrombus-like focus.",
    evidence: [{ label: "Glycocalyx loss and endothelial complement injury", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9968885/" }],
    evidenceLevel: "Human endothelial and mechanism-informed evidence",
    uncertainty: "The vascular score is a pathway-risk proxy, not proof of thrombotic microangiopathy."
  },
  skin: {
    label: "Skin / Joint",
    image: "../assets/tissue-models/skin-joint-complement-diptych.jpg",
    normal: "Thin synovial lining, smooth cartilage surface and orderly chondrocytes.",
    impact: "Synovial hyperplasia, inflammatory recruitment, C3 deposition at synovium/cartilage and focal terminal-complement signal.",
    evidence: [
      { label: "C3 deposition in cartilage and synovium", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2828354/" },
      { label: "Multiplex complement imaging in synovium", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9133225/" }
    ],
    evidenceLevel: "Human tissue and preclinical joint evidence",
    uncertainty: "The combined Skin / Joint model currently visualizes the better-supported synovial-joint mechanism."
  }
};

export function getTissueImageRecord(organId) {
  if (RETINA_IDS.has(organId)) return tissueImageCatalog.retina;
  if (organId === "complement-dysregulation") return tissueImageCatalog.vessels;
  return tissueImageCatalog[organId] ?? tissueImageCatalog.skin;
}
