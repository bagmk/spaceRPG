export interface AlmanacEntry {
  title: string;
  short: string;
  body: string;
  funFact: string;
}

export const ALMANAC: Record<number, AlmanacEntry> = {
  1: {
    title: 'Inflation',
    short: 'Space balloons outward faster than light can cross it.',
    body: 'Right after the Big Bang, space swelled so wildly that tiny quantum ripples were stretched into the seeds of everything that came later. It was a very short moment, but it set the shape of the whole universe.',
    funFact: 'During inflation, the universe may have grown by a factor bigger than 10^26.',
  },
  2: {
    title: 'Baryogenesis',
    short: 'Matter survives by the smallest possible margin.',
    body: 'Matter and antimatter should have canceled each other almost perfectly. For reasons we still do not fully understand, matter won by a tiny sliver. That tiny survival is why stars, planets, and people can exist.',
    funFact: 'If matter and antimatter had balanced perfectly, the universe would be almost pure light.',
  },
  3: {
    title: 'Quark-Gluon Plasma',
    short: 'The early cosmos is a particle soup too hot for atoms.',
    body: 'At this stage the universe is so hot that quarks cannot stay locked inside protons or neutrons. Everything behaves more like a fluid than a set of stable particles.',
    funFact: 'Particle colliders can recreate tiny flashes of quark-gluon plasma for an instant.',
  },
  4: {
    title: 'Nucleosynthesis',
    short: 'The first light nuclei lock into place.',
    body: 'In the first few minutes, protons and neutrons combine into hydrogen, helium, and trace amounts of lithium. This is the first real chemistry of the universe.',
    funFact: 'Most of the ordinary matter in your body was chemically prepared by stages like this and later stars.',
  },
  5: {
    title: 'Recombination',
    short: 'Electrons settle down and the fog lifts.',
    body: 'Electrons finally slow enough to bind with nuclei. Once atoms form, light can travel freely, and the universe becomes transparent for the first time.',
    funFact: 'The glow from recombination still exists today as the cosmic microwave background.',
  },
  6: {
    title: 'Cosmic Dark Age',
    short: 'The universe is full of gas but has no stars yet.',
    body: 'After the first light escapes, space becomes dark again. Hydrogen drifts through a quiet universe while gravity slowly deepens tiny differences.',
    funFact: 'This dark age lasted far longer than all of recorded human history.',
  },
  7: {
    title: 'First Stars',
    short: 'Hydrogen clouds collapse into the first blazing suns.',
    body: 'Gravity pulls huge clouds of hydrogen together until fusion turns on. These first stars are big, hot, and short-lived, but they begin making heavier elements.',
    funFact: 'The first stars likely contained almost no metals at all.',
  },
  8: {
    title: 'Reionization',
    short: 'Young stars carve clear windows through cosmic gas.',
    body: 'Ultraviolet light from the first stars and galaxies strips electrons away from neutral hydrogen. The universe becomes easier for light to cross and easier for structure to reveal itself.',
    funFact: 'Astronomers still study exactly how patchy and fast reionization was.',
  },
  9: {
    title: 'Galaxy Formation',
    short: 'Matter settles into webs, halos, and spirals.',
    body: 'Gravity builds large-scale structure from countless small clumps. Filaments stretch across space, galaxies grow in halos, and the cosmic web becomes visible.',
    funFact: 'On the largest scales, the universe looks a little like glowing foam or neural tissue.',
  },
  10: {
    title: 'Solar System',
    short: 'Dust, rock, and ice negotiate the shapes of worlds.',
    body: 'Around a young star, grains collide, stick, melt, and crash again. Over time, this messy disk sorts itself into planets, moons, asteroids, and leftovers.',
    funFact: 'Earth likely formed through many giant impacts, including one that helped create the Moon.',
  },
  11: {
    title: 'Life on Earth',
    short: 'Chemistry learns to copy itself and remember.',
    body: 'On one small planet, molecules begin making more of themselves. Evolution then turns simple chemistry into ecosystems, minds, stories, and civilizations.',
    funFact: 'For most of Earth’s history, life was microscopic.',
  },
  12: {
    title: 'Death of Star',
    short: 'A familiar star grows into a red giant and consumes its neighbors.',
    body: 'When a star like the Sun runs low on core hydrogen, it swells enormously. Inner planets lose their safe orbits, and once-stable worlds are swallowed or scorched away.',
    funFact: 'Mercury and Venus are expected to be lost first if the Sun follows the standard script.',
  },
  13: {
    title: 'Stelliferous End',
    short: 'The age of ordinary starlight fades out.',
    body: 'Star formation slows and then mostly stops. What remains is a universe filled with cooling remnants, dim leftovers, and less fresh light with each passing era.',
    funFact: 'Even after bright stars are gone, the universe can keep changing for absurdly long times.',
  },
  14: {
    title: 'Degenerate Era',
    short: 'Matter itself begins to feel temporary.',
    body: 'White dwarfs, neutron stars, and cold leftovers dominate. If proton decay is real, even matter that seems solid and permanent will eventually come apart.',
    funFact: 'Some versions of physics predict that proton decay is so slow we have never directly seen it.',
  },
  15: {
    title: 'Black Hole Era',
    short: 'Black holes inherit the future, then slowly evaporate.',
    body: 'After almost everything else has faded, black holes remain as the biggest structures left. Hawking radiation leaks them away over unbelievable stretches of time.',
    funFact: 'A supermassive black hole can outlive ordinary stars by many, many orders of magnitude.',
  },
  16: {
    title: 'The End',
    short: 'The universe reaches the point where endings compete.',
    body: 'At the far future, the story can branch. The cosmos may coast into equilibrium, collapse inward, tear apart, or be replaced by a deeper vacuum state.',
    funFact: 'Different cosmic endings depend on the long-term behavior of expansion, matter, and quantum fields.',
  },
};
