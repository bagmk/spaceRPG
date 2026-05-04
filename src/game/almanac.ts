export interface AlmanacEntry {
  title: string;
  short: string;
  body: string;
  funFact: string;
  uncertaintyNote?: string;
  cosmicEra: {
    timeRange: string;
    temperature: string;
    keyParticles: string[];
    keyEvents: string[];
    realWorldScale: string;
  };
}

export const ALMANAC: Record<number, AlmanacEntry> = {
  1: {
    title: 'Inflation',
    short: 'Space balloons outward faster than light can cross it.',
    body: 'Right after the Big Bang, space swelled so wildly that tiny quantum ripples were stretched into the seeds of everything that came later. It was a very short moment, but it set the shape of the whole universe.',
    funFact: 'During inflation, the universe may have grown by a factor bigger than 10^26.',
    uncertaintyNote: 'Inflation is theoretical, and estimates for this era span roughly 1e-36 to 1e-32 seconds.',
    cosmicEra: {
      timeRange: 'about 10^-36 s to 10^-32 s',
      temperature: 'near 10^28 K, model-dependent',
      keyParticles: ['Inflaton field', 'Quantum fluctuations', 'Spacetime'],
      keyEvents: ['Rapid expansion', 'Quantum ripples stretched', 'Reheating begins'],
      realWorldScale: 'A tiny patch may have expanded by more than 10^26 in a fraction of a second.',
    },
  },
  2: {
    title: 'Baryogenesis',
    short: 'Matter survives by the smallest possible margin.',
    body: 'Matter and antimatter should have canceled each other almost perfectly. For reasons we still do not fully understand, matter won by a tiny sliver. That tiny survival is why stars, planets, and people can exist.',
    funFact: 'If matter and antimatter had balanced perfectly, the universe would be almost pure light.',
    cosmicEra: {
      timeRange: 'roughly 10^-32 s to 10^-12 s',
      temperature: 'about 10^27 K down to 10^15 K',
      keyParticles: ['Quarks', 'Antiquarks', 'Leptons', 'Gauge bosons'],
      keyEvents: ['Matter-antimatter imbalance', 'CP violation candidates', 'Baryon number excess'],
      realWorldScale: 'Only about one extra matter particle per billion pairs is enough to make the visible universe.',
    },
  },
  3: {
    title: 'Quark-Gluon Plasma',
    short: 'The early cosmos is a particle soup too hot for atoms.',
    body: 'At this stage the universe is so hot that quarks cannot stay locked inside protons or neutrons. Everything behaves more like a fluid than a set of stable particles.',
    funFact: 'Particle colliders can recreate tiny flashes of quark-gluon plasma for an instant.',
    cosmicEra: {
      timeRange: 'about 10^-12 s to 10^-6 s',
      temperature: 'around 10^15 K to 10^13 K',
      keyParticles: ['Quarks', 'Gluons', 'Leptons', 'Photons'],
      keyEvents: ['Quark-gluon plasma', 'Strong-force confinement approaching', 'Hadronization begins'],
      realWorldScale: 'CERN heavy-ion collisions briefly recreate droplets of this early-universe plasma.',
    },
  },
  4: {
    title: 'Nucleosynthesis',
    short: 'The first light nuclei lock into place.',
    body: 'In the first few minutes, protons and neutrons combine into hydrogen, helium, and trace amounts of lithium. This is the first real chemistry of the universe.',
    funFact: 'Most of the ordinary matter in your body was chemically prepared by stages like this and later stars.',
    cosmicEra: {
      timeRange: 'about 1 s to 20 min',
      temperature: '10^10 K to 10^8 K',
      keyParticles: ['Protons', 'Neutrons', 'Deuterium', 'Helium-4', 'Lithium-7'],
      keyEvents: ['Neutron decay', 'Deuterium bottleneck breaks', 'Light nuclei form'],
      realWorldScale: 'The early mix settles near 75 % hydrogen and 25 % helium by mass, with trace lithium.',
    },
  },
  5: {
    title: 'Recombination',
    short: 'Electrons settle down and the fog lifts.',
    body: 'Electrons finally slow enough to bind with nuclei. Once atoms form, light can travel freely, and the universe becomes transparent for the first time.',
    funFact: 'The glow from recombination still exists today as the cosmic microwave background.',
    cosmicEra: {
      timeRange: 'about 380,000 yr',
      temperature: 'about 3000 K',
      keyParticles: ['Electrons', 'Protons', 'Hydrogen atoms', 'CMB photons'],
      keyEvents: ['Atoms form', 'Photons decouple', 'Cosmic microwave background released'],
      realWorldScale: 'The CMB is a snapshot from when the universe first became transparent to light.',
    },
  },
  6: {
    title: 'Cosmic Dark Age',
    short: 'The universe is full of gas but has no stars yet.',
    body: 'After the first light escapes, space becomes dark again. Hydrogen drifts through a quiet universe while gravity slowly deepens tiny differences.',
    funFact: 'This dark age lasted far longer than all of recorded human history.',
    cosmicEra: {
      timeRange: 'about 380,000 yr to 100-200 Myr',
      temperature: '3000 K falling toward tens of K',
      keyParticles: ['Neutral hydrogen', 'Helium', 'Dark matter halos', 'CMB photons'],
      keyEvents: ['No stars yet', 'Gas cools', 'Density ripples grow'],
      realWorldScale: 'The universe is transparent but mostly unlit, waiting for gravity to gather the first stars.',
    },
  },
  7: {
    title: 'First Stars',
    short: 'Hydrogen clouds collapse into the first blazing suns.',
    body: 'Gravity pulls huge clouds of hydrogen together until fusion turns on. These first stars are big, hot, and short-lived, but they begin making heavier elements.',
    funFact: 'The first stars likely contained almost no metals at all.',
    cosmicEra: {
      timeRange: 'about 100-200 Myr',
      temperature: 'gas clouds cool to hundreds of K before collapse',
      keyParticles: ['Hydrogen', 'Helium', 'Molecular hydrogen', 'Population III stars'],
      keyEvents: ['First fusion ignition', 'UV light appears', 'First heavy elements seeded'],
      realWorldScale: 'The first stars likely formed in small dark-matter halos and burned hotter than later stars.',
    },
  },
  8: {
    title: 'Reionization',
    short: 'Young stars carve clear windows through cosmic gas.',
    body: 'Ultraviolet light from the first stars and galaxies strips electrons away from neutral hydrogen. The universe becomes easier for light to cross and easier for structure to reveal itself.',
    funFact: 'Astronomers still study exactly how patchy and fast reionization was.',
    uncertaintyNote: 'The end of reionization is usually placed around 0.5 to 1 billion years after the Big Bang, with active debate around the details.',
    cosmicEra: {
      timeRange: 'about 400 Myr to 1 Gyr',
      temperature: 'intergalactic gas reheated to around 10^4 K',
      keyParticles: ['Ionized hydrogen', 'Free electrons', 'UV photons', 'Young galaxies'],
      keyEvents: ['Ionization bubbles grow', 'Dark Ages end', 'Early galaxies become visible'],
      realWorldScale: 'Reionization is patchy: bubbles around young stars overlap over hundreds of millions of years.',
    },
  },
  9: {
    title: 'Galaxy Formation',
    short: 'Matter settles into webs, halos, and spirals.',
    body: 'Gravity builds large-scale structure from countless small clumps. Filaments stretch across space, galaxies grow in halos, and the cosmic web becomes visible.',
    funFact: 'On the largest scales, the universe looks a little like glowing foam or neural tissue.',
    cosmicEra: {
      timeRange: 'about 1 Gyr onward',
      temperature: 'galaxy gas spans about 10^4 K to millions K',
      keyParticles: ['Stars', 'Gas', 'Dark matter', 'Black holes'],
      keyEvents: ['Galaxies merge', 'Cosmic web matures', 'Quasars and disks grow'],
      realWorldScale: 'Modern estimates allow hundreds of billions of galaxies in the observable universe.',
    },
  },
  10: {
    title: 'Solar System',
    short: 'Dust, rock, and ice negotiate the shapes of worlds.',
    body: 'Around a young star, grains collide, stick, melt, and crash again. Over time, this messy disk sorts itself into planets, moons, asteroids, and leftovers.',
    funFact: 'Earth likely formed through many giant impacts, including one that helped create the Moon.',
    cosmicEra: {
      timeRange: 'about 9.2 Gyr after Big Bang; 4.6 Gyr ago locally',
      temperature: 'disk dust ranges from icy tens K to rocky thousands K near the Sun',
      keyParticles: ['Dust grains', 'Planetesimals', 'Ices', 'Silicates', 'Metals'],
      keyEvents: ['Solar nebula collapses', 'Protoplanetary disk forms', 'Planet embryos accrete'],
      realWorldScale: 'NASA summarizes Solar System formation as a 4.6-billion-year-old disk of gas and dust becoming worlds.',
    },
  },
  11: {
    title: 'Life on Earth',
    short: 'Chemistry learns to copy itself and remember.',
    body: 'On one small planet, molecules begin making more of themselves. Evolution then turns simple chemistry into ecosystems, minds, stories, and civilizations.',
    funFact: 'For most of Earth’s history, life was microscopic.',
    cosmicEra: {
      timeRange: 'about 9.8 Gyr after Big Bang to now',
      temperature: 'Earth surface mostly hundreds K',
      keyParticles: ['Water', 'Carbon compounds', 'RNA/DNA', 'Cells', 'Oxygen'],
      keyEvents: ['Abiogenesis candidates', 'Photosynthesis', 'Multicellularity', 'Cambrian diversification'],
      realWorldScale: 'Most Earth history is microbial; complex multicellular life is a late chapter.',
    },
  },
  12: {
    title: 'Death of Star',
    short: 'A familiar star grows into a red giant and consumes its neighbors.',
    body: 'When a star like the Sun runs low on core hydrogen, it swells enormously. Inner planets lose their safe orbits, and once-stable worlds are swallowed or scorched away.',
    funFact: 'Mercury and Venus are expected to be lost first if the Sun follows the standard script.',
    cosmicEra: {
      timeRange: 'about 5 Gyr in Earth’s future',
      temperature: 'red-giant envelope thousands K; core much hotter',
      keyParticles: ['Helium core', 'Hydrogen shell', 'Stellar wind', 'Planetary debris'],
      keyEvents: ['Sun leaves main sequence', 'Red giant expansion', 'Inner planets engulfed or scorched'],
      realWorldScale: 'NASA notes the Sun may expand to about 100 times its current diameter as a red giant.',
    },
  },
  13: {
    title: 'Stelliferous End',
    short: 'The age of ordinary starlight fades out.',
    body: 'Star formation slows and then mostly stops. What remains is a universe filled with cooling remnants, dim leftovers, and less fresh light with each passing era.',
    funFact: 'Even after bright stars are gone, the universe can keep changing for absurdly long times.',
    cosmicEra: {
      timeRange: 'about 10^14 yr',
      temperature: 'stellar remnants cool toward background temperature',
      keyParticles: ['White dwarfs', 'Neutron stars', 'Brown dwarfs', 'Black dwarfs'],
      keyEvents: ['Star formation ends', 'Last red dwarfs fade', 'Remnants dominate'],
      realWorldScale: 'The bright-star era is finite; low-mass stars stretch it far beyond the current age.',
    },
  },
  14: {
    title: 'Degenerate Era',
    short: 'Matter itself begins to feel temporary.',
    body: 'White dwarfs, neutron stars, and cold leftovers dominate. If proton decay is real, even matter that seems solid and permanent will eventually come apart.',
    funFact: 'Some versions of physics predict that proton decay is so slow we have never directly seen it.',
    uncertaintyNote: 'Proton decay timing depends on GUT models; estimates can range from about 1e34 to 1e45 years.',
    cosmicEra: {
      timeRange: 'about 10^40 yr, model-dependent',
      temperature: 'near-background; rare decay events dominate',
      keyParticles: ['Protons', 'Leptons', 'Photons', 'Degenerate remnants'],
      keyEvents: ['Possible proton decay', 'Remnants dissolve', 'Matter becomes radiation'],
      realWorldScale: 'This era depends on physics not yet observed; proton decay remains an open experimental question.',
    },
  },
  15: {
    title: 'Black Hole Era',
    short: 'Black holes inherit the future, then slowly evaporate.',
    body: 'After almost everything else has faded, black holes remain as the biggest structures left. Hawking radiation leaks them away over unbelievable stretches of time.',
    funFact: 'A supermassive black hole can outlive ordinary stars by many, many orders of magnitude.',
    uncertaintyNote: 'Evaporation time varies enormously by mass, from around 1e67 years for stellar black holes to about 1e100 years for supermassive ones.',
    cosmicEra: {
      timeRange: 'about 10^67 yr to 10^100 yr and beyond',
      temperature: 'black holes grow colder with mass; final evaporation heats sharply',
      keyParticles: ['Black holes', 'Hawking photons', 'Gravitons', 'Leptons'],
      keyEvents: ['Black holes dominate', 'Slow evaporation', 'Final bursts for small holes'],
      realWorldScale: 'Theoretical Hawking evaporation makes black holes the longest-lived major structures.',
    },
  },
  16: {
    title: 'The End',
    short: 'The universe reaches the point where endings compete.',
    body: 'At the far future, the story can branch. The cosmos may coast into equilibrium, collapse inward, tear apart, or be replaced by a deeper vacuum state.',
    funFact: 'Different cosmic endings depend on the long-term behavior of expansion, matter, and quantum fields.',
    uncertaintyNote: 'Heat death is asymptotic, while Big Rip, Big Crunch, vacuum decay, and bounce scenarios remain model-dependent alternatives.',
    cosmicEra: {
      timeRange: '10^100 yr to open-ended futures',
      temperature: 'approaches the lowest available background temperature',
      keyParticles: ['Photons', 'Leptons', 'Gravitons', 'Vacuum fluctuations'],
      keyEvents: ['Heat death', 'Possible vacuum decay', 'Possible rip/crunch/bounce alternatives'],
      realWorldScale: 'The far future is dominated by model choice: expansion history and quantum vacuum stability decide the ending.',
    },
  },
};
