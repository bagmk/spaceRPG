```text
The game is already implemented. Do not rebuild the game loop, UI, economy, clicking system, stage progression, resource system, or save system.

Your task is ONLY to improve the central stage animation visuals.

This is an incremental clicker game about the evolution of the universe. The player clicks to create particles. The particles fly inward and feed the central object. As the stage progress increases from 0% to 100%, the central visual should evolve.

The current game already has:
- stage progression
- click particles
- mass/quanta accumulation
- UI panels
- next stage logic
- stage targets
- central animation area

Do not replace the game architecture. Inspect the existing rendering code and enhance the existing central animation system.

Main goal:
Make the center animation more detailed, more staged, and less repetitive. Each stage should have visible milestone changes at progress percentages such as 10%, 25%, 50%, 75%, 90%, and 100%.

Important:
The animation does not need to be physically perfect. It should be scientifically inspired, visually clear, and satisfying for a clicker/incremental game.

Keep the current visual style:
- dark amber / brown / orange cosmic palette
- minimalist sci-fi UI
- soft glow
- sparse particles
- subtle bloom
- elegant stylized science look
- not photorealistic
- not cartoonish

Do not make the game heavy. Prefer procedural shapes, gradients, masks, particles, simple arcs, rings, glows, and layered drawing over large assets.

```

---

# 핵심 구현 지시

```text
Find the existing central animation renderer.

Add a progress-driven visual milestone system.

For each stage, compute:

progressPercent = currentStageProgress * 100

Define the progress as (current quanta*current time)/(Total Qunata*Total time)

Use helper functions:

rangeT(progress, start, end)
easeInOut(t)
fadeIn(progress, start, end)
fadeOut(progress, start, end)

Use these values to gradually reveal, hide, scale, rotate, brighten, dim, or transform visual layers.

The center animation should be layered:

1. background haze
2. ambient particles
3. central object
4. secondary objects
5. orbit lines / rings / clouds / debris
6. click absorption effects
7. milestone transition effects

Click particles should continue to work as they already do. Improve only their visual response when they reach the center:
- small pulse
- tiny ring shockwave
- glow increase
- short-lived sparkle
- stage-specific color variation

Do not make clicking mechanically stronger or weaker unless required by existing code.
```

---

# Animation Helper 요구사항

```text
Add or reuse helper functions like:

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function rangeT(progress, start, end) {
  return clamp01((progress - start) / (end - start));
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function pulse(time, speed = 1, amount = 1) {
  return 0.5 + 0.5 * Math.sin(time * speed) * amount;
}

function drawGlowCircle(ctx, x, y, radius, color, alpha) {
  // radial gradient glow
}

function drawOrbitRing(ctx, x, y, radiusX, radiusY, alpha) {
  // thin ellipse orbit line
}

function drawParticleCluster(ctx, centerX, centerY, count, radius, progress, seed) {
  // deterministic pseudo-random cluster
}

function drawMilestoneFlash(ctx, x, y, progress, milestone) {
  // short flash near specific stage progress thresholds
}
```

Use deterministic seeded randomness where possible so the scene does not completely change every frame.

---

# 전체 스테이지별 애니메이션 디테일

## Stage 1 — Inflation

목표: 짧고 심플하게. 중앙 밝은 점과 급팽창 느낌.

```text
0–20%
- tiny white-orange singular glow at center
- very small radius
- minimal particles

20–50%
- radial streaks expand outward
- center glow grows quickly
- background lines stretch away from center

50–80%
- expansion slows visually
- more quanta specks appear
- center glow becomes less sharp

80–100%
- particle soup hint appears
- prepare transition to baryogenesis
```

Visual implementation:

* central bright glow
* radial lines
* outward-moving tiny particles
* expanding circular shockwaves

---

## Stage 2 — Baryogenesis

목표: matter/antimatter pair와 annihilation 느낌.

```text
0–25%
- paired particles appear around center
- use two related colors, for example pale gold and red-orange

25–55%
- some pairs collide and disappear with small flashes
- random tiny annihilation spark effects

55–80%
- fewer particles remain
- surviving particles cluster closer to center

80–100%
- residual matter cluster stabilizes
- warm amber cluster remains
```

Visual implementation:

* paired dots
* small connecting lines
* flash when pairs overlap
* residual cluster density increases

---

## Stage 3 — Quark-Gluon Plasma

목표: 뜨겁고 들끓는 particle soup.

```text
0–25%
- dense hot center
- many small particles orbiting chaotically

25–60%
- turbulence increases
- circular wave ripples around center
- orange/red/white particles swirl

60–85%
- particles begin forming slightly larger clusters

85–100%
- clusters become more stable
- prepare for nucleosynthesis
```

Visual implementation:

* noisy swarm
* short curved trails
* heat shimmer rings
* center glow breathing

---

## Stage 4 — Nucleosynthesis

목표: 작은 입자들이 원자핵처럼 뭉치는 느낌.

```text
0–25%
- particles start clustering into small groups

25–60%
- hydrogen-like and helium-like clusters appear
- draw small grouped circles connected by faint bonds

60–85%
- clusters stabilize
- background heat glow decreases slightly

85–100%
- fewer free particles
- stable light nuclei dominate
```

Visual implementation:

* cluster nodes
* tiny bond lines
* gentle orbital wobble
* less chaotic than stage 3

---

## Stage 5 — Recombination

목표: 우주가 투명해지는 느낌.

```text
0–25%
- opaque glowing fog
- center is hazy and hard to see

25–55%
- fog slowly clears
- particles become more distinct

55–80%
- transparency increases
- background stars/faint specks become visible

80–100%
- faint CMB-like amber haze remains
- transition into darker cosmic age
```

Visual implementation:

* large semi-transparent fog gradient
* fade opacity down with progress
* faint background specks appear

---

# Stage 6부터는 더 디테일하게

## Stage 6 — Cosmic Dark Age

목표: 별은 없지만, 밀도 요동이 자라나는 시대.

```text
0–10%
- almost empty dark field
- faint residual amber haze

10–25%
- 2–4 diffuse gas patches appear
- very soft, blurry, low-contrast shapes

25–45%
- patches slowly contract
- density increases at their centers

45–65%
- proto-halo clumps form
- draw faint cloud knots connected by barely visible filaments

65–85%
- densest clumps begin to warm slightly
- tiny orange cores appear inside clouds

85–100%
- first star seeds appear
- very small bright points flicker but do not fully ignite yet
```

Visual implementation:

* soft gas clouds
* opacity and scale change with progress
* faint gravitational collapse motion
* no bright stars until very late

Click feedback:

* particles should look like dim dusty motes
* absorption creates a weak warm pulse

---

## Stage 7 — First Stars

목표: 우주의 첫 불빛.

```text
0–12%
- carry over dark gas clumps
- no strong light yet

12–25%
- first star ignites
- one strong white-blue flash at center or near dense core

25–40%
- 2–5 additional stars ignite
- each has small glow halo

40–60%
- small star cluster forms
- surrounding gas starts glowing

60–80%
- proto-galactic grouping appears
- stars form a loose gravitational cluster

80–100%
- ionization bubbles start forming around stars
- prepare reionization stage
```

Visual implementation:

* bright star ignition flash
* star halos
* gas glow responding to star light
* small cluster rotation

Click feedback:

* absorbed particles cause stars to pulse
* at high progress, each click slightly brightens nearby stars

---

## Stage 8 — Reionization

목표: 별빛 주변으로 ionized bubble이 퍼짐.

```text
0–20%
- small transparent bubbles around first stars

20–40%
- bubbles expand outward

40–60%
- bubbles overlap
- dark neutral regions shrink

60–80%
- background becomes clearer
- more stars become visible

80–100%
- mostly transparent universe
- faint galaxy seeds visible
```

Visual implementation:

* expanding circular/elliptical translucent bubbles
* bubble edges glow faintly
* dark haze fades out
* stars become sharper

---

## Stage 9 — Galaxy Formation

목표: 별/가스 덩어리가 은하 구조로 정리됨.

```text
0–15%
- scattered star clusters and gas patches

15–35%
- proto-galaxy clumps form
- 2–3 rotating luminous clumps

35–55%
- spiral or elliptical structure begins
- draw faint spiral arms or elongated galaxy core

55–75%
- faint cosmic web filaments in background
- stars gather toward galaxy center

75–90%
- choose one main galaxy as camera focus
- increase size and clarity

90–100%
- zoom toward local star-forming region
- prepare solar system stage
```

Visual implementation:

* spiral arms using curved particle bands
* soft central bulge
* faint cosmic web lines
* slow rotation

---

# Stage 10 — Solar System

이 스테이지는 특히 중요.
“행성들이 갑자기 생기는 문제”를 반드시 고쳐야 함.

## 핵심 요구

```text
Do not spawn all planets at once.

The solar system must form gradually:
cloud → proto-Sun → disk → planetesimals → individual planets → stable system.
```

## 퍼센트별 디테일

```text
0–8%
- show a local molecular cloud
- soft dusty gas field
- no Sun yet

8–16%
- central collapse
- proto-Sun glow appears
- gas begins rotating inward

16–24%
- accretion disk forms
- flat rotating disk around proto-Sun
- faint orbit lanes appear

24–32%
- planetesimal swarm
- small rocky/gas clumps orbit in the disk
- tiny collision sparks

32–40%
- Mercury forms
- small gray rocky body
- appears from dust cluster, then rounds out

40–48%
- Venus forms
- yellowish dense atmosphere
- slightly larger than Mercury

48–58%
- Earth proto-forms
- molten rocky sphere
- black crust and lava cracks
- do not make it blue yet

58–66%
- Mars forms
- red rocky sphere
- small and dry-looking

66–74%
- Jupiter forms
- much larger gas giant
- show subtle bands
- strongest gravity presence

74–80%
- Saturn forms
- gas giant with ring
- ring fades in gradually

80–86%
- Uranus forms
- pale cyan/blue-green small gas giant

86–91%
- Neptune forms
- deeper blue

91–95%
- Pluto / Kuiper belt hint
- small distant object plus faint outer debris belt

95–100%
- stabilize full solar system
- show Sun and all orbit rings
- camera subtly begins focusing toward Earth
```

## 행성 생성 애니메이션 공통 함수

```text
Each planet should form using the same visual sequence:

1. dust particles gather
2. clumps collide
3. rough irregular proto-planet appears
4. sphere becomes smoother
5. final color/texture fades in
6. orbit stabilizes
```

Claude에게 이렇게 구현하라고 시켜:

```text
Create a helper function:

drawFormingPlanet(ctx, planetSpec, localT, time)

where localT is 0..1 for that planet's formation window.

localT behavior:
0.0–0.25: dust cluster
0.25–0.50: collision sparks and irregular body
0.50–0.75: spherical body grows
0.75–1.00: final color, glow, orbit stabilization
```

Planet specs:

```text
Mercury:
- small
- gray
- rocky
- minimal atmosphere

Venus:
- yellow/cream
- cloudy
- dense atmosphere glow

Earth:
- molten at this stage
- black rock with lava cracks
- no ocean yet

Mars:
- red/orange rocky body

Jupiter:
- large
- cream/orange bands
- strong scale contrast

Saturn:
- pale gold
- ring fades in

Uranus:
- pale cyan

Neptune:
- deep blue

Pluto:
- tiny distant icy dot
```

Click feedback:

```text
- Click particles should look like dust/rock fragments.
- When absorbed, add tiny collision sparks inside the disk.
- At high progress, the accretion disk becomes more organized.
```

---

# Stage 11 — Life on Earth

이 스테이지는 가장 공들여야 함.
지구가 texture swap처럼 보이면 안 됨.

## 핵심 요구

```text
Earth must evolve through visible layered states:
molten rock → steam/clouds → oceans → continents → vegetation → civilization → satellites/orbital megastructures.
```

## Earth rendering layers

Claude에게 이렇게 만들라고 해:

```text
Implement Earth as layered procedural rendering:

1. base sphere
2. lava crack layer
3. steam/cloud layer
4. ocean layer
5. continent layer
6. vegetation layer
7. night-side city light layer
8. satellite/orbital object layer
9. optional future megastructure layer
```

## 퍼센트별 디테일

```text
0–10%: Molten Earth
- black/dark rock sphere
- red/orange lava cracks
- occasional meteor sparks
- no blue ocean
- thick heat glow

10–20%: Steam Earth
- steam begins rising
- gray/white cloud layer forms
- lava still visible underneath
- cloud opacity increases

20–32%: Ocean Formation
- surface cools
- blue ocean patches fade in
- lava cracks fade down
- cloud layer becomes more dynamic
- rain-like vertical streaks optional

32–45%: Continents
- brown/gray land masses emerge
- ocean/land contrast becomes clear
- cloud layer thins slightly
- planet rotation becomes more elegant

45–58%: Biosphere
- green slowly spreads over land
- start at coastlines or random patches
- continents shift from brown to green-brown
- Earth begins looking alive

58–72%: Mature Earth
- balanced blue ocean, white clouds, green/brown continents
- day/night terminator visible
- slow beautiful rotation
- subtle atmosphere rim glow

72–82%: Civilization
- city lights appear only on night side
- small warm light clusters on continents
- daylight side can show faint gray urban texture
- city lights should not cover everything

82–90%: Space Age
- satellites appear around Earth
- thin orbital trails
- a few small blinking points
- maybe one moon base / station hint if easy

90–97%: Megastructures
- orbital ring segments
- solar collector panels
- Dyson-swarm-like structures near Earth/Sun direction
- keep elegant, not too crowded

97–100%: Peak Civilization
- beautiful rotating Earth
- visible clouds, ocean, continents, night lights
- satellites and orbital infrastructure
- slight warning: Sun glow subtly increases for next stage
```

## 지구 렌더링 팁

```text
Use clipping/masking so city lights only appear on the night side.

Use a terminator line:
- day side: normal Earth colors
- night side: darkened Earth + city lights
- cloud layer visible on both sides but dimmer on night side

Clouds should rotate slightly faster or offset from the ground layer.

Lava cracks fade out as ocean/continent layers fade in.

Vegetation should not instantly fill the land; use progress-based opacity/mask expansion.

Satellites should orbit at different radii and speeds.
```

Click feedback:

```text
0–32%: absorbed particles are orange/red molten sparks
32–58%: blue/white water/cloud particles
58–72%: green biosphere particles
72–100%: golden civilization sparks, city lights pulse subtly
```

---

# Stage 12 — Death of Star

이 스테이지는 드라마틱해야 함.

## 핵심 요구

```text
Show the full solar system first.
Then gradually enlarge and redden the Sun.
Planets and human/future structures should fail one by one.
End with envelope ejection and a white dwarf, not a true supernova.
```

## 퍼센트별 디테일

```text
0–10%: Stable late solar system
- Sun centered
- Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto visible
- Earth has satellites / megastructures
- Dyson-like solar collectors or orbital infrastructure visible

10–20%: Solar brightening
- Sun grows brighter
- yellow shifts to orange
- solar glow radius increases
- Earth structures still present but under intense light

20–32%: Red giant onset
- Sun begins expanding noticeably
- Mercury orbit is reached
- Mercury heats, glows, then disappears into Sun

32–44%: Venus lost
- Venus surface/atmosphere glows intensely
- Venus disappears
- inner solar system gets unstable
- orbit lines distort slightly

44–56%: Earth collapse
- Earth oceans evaporate
- Earth turns from blue/green to brown/red scorched sphere
- city lights go out
- satellites fall or vanish
- orbital megastructures break apart

56–66%: Earth consumed
- Earth is destroyed, swallowed, or reduced to debris
- Earth orbital ring collapses
- Mars begins to burn

66–78%: Giant expansion
- Mars disappears
- Jupiter atmosphere stripping effect
- Saturn rings break apart
- outer planets become unstable
- remaining megastructures fail

78–88%: Maximum red giant
- Sun dominates the screen
- few or no planets remain
- red/orange glow fills most central area
- debris spirals inward

88–96%: Envelope ejection
- Sun ejects outer layers
- draw expanding shell/ring
- create planetary-nebula-like glow
- this can feel explosive but should not look like a massive star supernova

96–100%: White dwarf
- central small white-hot remnant
- surrounding faint nebula
- quiet aftermath
```

## 중요 과학 보정

```text
Do not label this as supernova.
The Sun-like star should end as:
red giant → envelope ejection → planetary nebula → white dwarf.
```

Click feedback:

```text
- particles are red/orange solar flare fragments
- absorption increases solar flare activity
- during 44–88%, clicks can trigger small surface eruptions
- during 88–96%, clicks enhance shell ejection ripples
```

---

# Stage 13 — Stelliferous End

목표: 별의 시대가 끝나는 느낌.

```text
0–15%
- many stars still visible
- galaxy still recognizable

15–35%
- bright blue stars fade out first
- star formation regions disappear

35–55%
- galaxy becomes older and dimmer
- yellow/red stars dominate

55–72%
- mostly red dwarfs
- fewer visible stars
- background becomes emptier

72–85%
- last small stars flicker
- random fading events

85–100%
- stellar remnants dominate
- white dwarfs, neutron stars, black holes
- galaxy structure is dim and loose
```

Visual implementation:

* star count decreases
* blue stars fade first
* red/orange dim points remain longer
* remnant dots replace stars

---

# Stage 14 — Degenerate Era

목표: 별이 아니라 잔해들의 시대.

```text
0–18%
- white dwarfs, neutron stars, cold planets/remnants

18–36%
- white dwarfs cool:
  white → pale yellow → orange → dull red

36–55%
- remnants scatter
- galaxy shape loosens
- empty space increases

55–72%
- ordinary matter structures erode/disperse
- if proton decay mode exists, show faint decay particles

72–88%
- black dwarf-like dark remnants dominate
- almost no bright light

88–100%
- black holes become main surviving objects
- prepare black hole era
```

Visual implementation:

* dimming curves
* drifting remnants
* low activity
* subtle cold glows

Click feedback:

```text
- very dim particles
- weak absorption pulse
- no dramatic bright effect except rare remnant flicker
```

---

# Stage 15 — Black Hole Era

목표: 블랙홀만 남는 시대.

```text
0–20%
- multiple black holes visible
- use dark circles with faint lensing rings

20–40%
- small black holes drift slowly inward
- some spiral motion

40–58%
- black hole merger event
- two black holes spiral together
- merge into one
- circular gravitational ripple expands

58–74%
- fewer but larger black holes
- background emptier

74–88%
- isolated massive black holes
- almost no particles
- very quiet scene

88–96%
- Hawking radiation becomes visible
- small black holes shrink and flash

96–100%
- final black hole evaporation transition
```

Visual implementation:

* black disk
* faint accretion/lensing ring
* ripple lines on merger
* small white flash for evaporation

Click feedback:

```text
- particles bend around event horizon before absorption
- use curved paths
- absorption creates lensing pulse, not normal explosion
```

---

# Stage 16 — The End

목표: 거의 아무것도 없음. 하지만 끝의 감정이 있어야 함.

```text
0–10%
- final black hole evaporates
- tiny white flash

10–28%
- rapid fade into darkness
- remove remaining structure

28–50%
- rare photon-like particles drift slowly
- extremely sparse

50–72%
- almost no motion
- background becomes colder and darker

72–88%
- optional memory echo:
  very faint silhouettes of:
  - galaxy
  - Earth
  - city lights
  - orbital ring
  - Dyson-like structures
  These should appear briefly and dissolve.
  This is poetic, not physical.

88–100%
- complete darkness
- no bound structures remain
- UI can remain, but central scene is nearly empty
```

Click feedback:

```text
- clicking creates tiny photon specks only
- very weak pulse
- almost silent visual language
```

---

# Milestone Flash System

추가로 Claude에게 이걸 넣으라고 해.

```text
Add subtle milestone flashes when progress crosses:
10%, 25%, 50%, 75%, 90%, 100%.

Do not make them huge.
Each milestone should:
- briefly brighten the central object
- create a thin expanding ring
- unlock or fade in a new visual layer
- optionally create a small UI toast if that system already exists

Do not add new UI if not already present.
```

---

# Claude에게 마지막으로 강조할 제한사항

```text
Important constraints:
- Do not rewrite the whole game.
- Do not change progression balance.
- Do not change click value, target values, auto generation, or stage unlock rules.
- Do not redesign the UI.
- Do not introduce heavy dependencies unless necessary.
- Focus only on central visual animation and progress-based visual states.
- Keep performance smooth.
- Prefer procedural drawing and layered effects.
- Make the code easy to tune.
```

---

# 아주 짧은 작업 지시 버전

Claude가 너무 크게 바꾸려고 하면, 이 짧은 버전을 먼저 넣어도 좋아.

```text
The game already works. Do not rebuild it.

Only improve the central animation renderer.

Use current stage progress percentage to reveal visual layers at milestones.

Focus especially on:
Stage 10 Solar System:
- planets must form one by one from dust clusters
- no instant full solar system

Stage 11 Life on Earth:
- Earth evolves through molten rock → steam/clouds → oceans → continents → vegetation → civilization → satellites → megastructures

Stage 12 Death of Star:
- show full solar system
- Sun expands into red giant
- Mercury, Venus, Earth, Mars, and structures are destroyed progressively
- end with envelope ejection and white dwarf, not supernova

Stage 14–16:
- make them visually sparse but not static
- use fading remnants, black hole mergers, Hawking flashes, and final darkness

Keep the existing dark amber minimalist style.
Do not change mechanics or UI.
```

---

# 내가 보기엔 제일 중요한 요구 문장

클로드에게 꼭 이 문장을 넣어야 해:

```text
This is not a physics simulator. It is a progress-driven visual evolution scene for an incremental clicker game. The visuals should be scientifically inspired, emotionally satisfying, and easy to read at a glance.
```

이 문장이 있어야 Claude가 과학 시뮬레이터처럼 과하게 복잡하게 안 가고, 게임 애니메이션으로 잘 잡아줄 가능성이 높아.
