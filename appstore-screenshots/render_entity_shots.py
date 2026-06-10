#!/usr/bin/env python3
"""
Entity hero / gameplay screenshots for "Big Bang / Cosmic Coalescence".
Reuses render_shots.py for identical chrome (status bar, header, headline, panel)
and adds faithful entity renderers (Earth, gas/rock planets, spiral galaxy,
Interstellar-style black hole) using the game's real stage palettes from stages.ts.

Output: appstore_08..11_*.png at 1290x2796 (default) — run alongside render_shots.py.
"""
import os, sys, math, random
import numpy as np
from PIL import Image
import render_shots as RS  # chrome + scene primitives (no render at import)

W, H, CX, SS, M = RS.W, RS.H, RS.CX, RS.SS, RS.M
hx, f01, mix = RS.hx, RS.f01, RS.mix
add_radial, add_ring = RS.add_radial, RS.add_ring
F_MONO, F_MONO_B = RS.F_MONO, RS.F_MONO_B
F_SER_I, F_SER_BI = RS.F_SER_I, RS.F_SER_BI
MUTED, FG, WHITE = RS.MUTED, RS.FG, RS.WHITE
OUT = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ compositing
def blit(scene, cx, cy, rgb, alpha):
    """Alpha-composite an opaque body tile (occludes background)."""
    N = rgb.shape[0]
    x0 = int(round(cx - N/2)); y0 = int(round(cy - N/2))
    sx0 = max(0, x0); sy0 = max(0, y0)
    sx1 = min(W, x0 + N); sy1 = min(H, y0 + N)
    if sx1 <= sx0 or sy1 <= sy0: return
    tx0 = sx0 - x0; ty0 = sy0 - y0
    tx1 = tx0 + (sx1 - sx0); ty1 = ty0 + (sy1 - sy0)
    a = alpha[ty0:ty1, tx0:tx1][..., None]
    scene[sy0:sy1, sx0:sx1, :] = scene[sy0:sy1, sx0:sx1, :]*(1-a) + rgb[ty0:ty1, tx0:tx1, :]*a

def _sphere_geom(R, light):
    N = int(round(2*R))
    u = np.linspace(-1, 1, N, dtype=np.float32)
    uu, vv = np.meshgrid(u, u)
    r2 = uu*uu + vv*vv
    inside = r2 <= 1.0
    nz = np.sqrt(np.clip(1-r2, 0, 1))
    Lx, Ly, Lz = light; Ln = math.sqrt(Lx*Lx+Ly*Ly+Lz*Lz)
    Lx, Ly, Lz = Lx/Ln, Ly/Ln, Lz/Ln
    shade = np.clip(uu*Lx + vv*Ly + nz*Lz, 0, 1).astype(np.float32)
    aa = max(1.0/R, 0.004)
    alpha = np.clip(1.0 - (np.sqrt(r2) - (1-aa))/aa, 0, 1).astype(np.float32)
    alpha[~inside] = 0.0
    return N, uu, vv, r2, inside, shade, alpha

def draw_planet(scene, cx, cy, R, base_lit, base_shadow, light=(-0.55,-0.5,0.68),
                ambient=0.12, bands=0, atmo=None, spec=0.35, ring=None):
    N, uu, vv, r2, inside, shade, alpha = _sphere_geom(R, light)
    sh = ambient + (1-ambient)*shade
    bl = f01(base_lit); bs = f01(base_shadow)
    rgb = bs[None,None,:] + (bl-bs)[None,None,:]*sh[...,None]
    if bands:
        rgb *= (1 + 0.10*np.sin(vv*bands + 0.5*np.sin(vv*bands*0.5)))[...,None]
    rgb += (np.clip(shade,0,1)**18 * spec)[...,None]
    rgb *= inside[...,None]
    blit(scene, cx, cy, np.clip(rgb,0,1).astype(np.float32), alpha)
    if atmo:
        add_radial(scene, cx, cy, R*1.6, atmo, falloff=2.4, strength=0.30)
        add_ring(scene, cx, cy, R*1.01, max(2,R*0.05), atmo, strength=0.5)
    if ring:  # simple planetary ring (e.g., Saturn)
        rc, rin, rout = ring
        add_ring(scene, cx, cy, R*rin, R*0.05, rc, strength=0.0)  # noop guard

def _blobs(uu, vv, centers, sized):
    m = np.zeros_like(uu)
    for (bx, by), s in zip(centers, sized):
        m += np.exp(-(((uu-bx)**2 + (vv-by)**2)/(2*s*s)))
    return m

def draw_earth(scene, cx, cy, R, light=(-0.5,-0.5,0.70), seed=7, life=True):
    rnd = random.Random(seed)
    N, uu, vv, r2, inside, shade, alpha = _sphere_geom(R, light)
    sh = 0.07 + 0.93*shade  # low ambient -> dark night side
    # --- ocean base ---
    ocean_lit = f01((46,140,214)); ocean_sh = f01((9,32,74))
    rgb = ocean_sh[None,None,:] + (ocean_lit-ocean_sh)[None,None,:]*sh[...,None]
    # --- continents (Pangaea-ish blobs) ---
    centers = [(-0.30,-0.18),(0.10,0.05),(0.42,-0.30),(-0.05,0.45),
               (0.34,0.40),(-0.55,0.22),(0.62,0.18)]
    sizes   = [0.22,0.25,0.15,0.17,0.14,0.13,0.11]
    land = _blobs(uu, vv, centers, sizes)
    land = np.clip((land-0.42)/0.5, 0, 1) * inside
    land = land**0.8
    green_lit = f01((74,170,96)); green_sh = f01((18,58,30))
    brown = f01((120,104,60))
    landcol = green_sh[None,None,:] + (green_lit-green_sh)[None,None,:]*sh[...,None]
    landcol = landcol*(1-0.18) + brown[None,None,:]*0.18*sh[...,None]
    rgb = rgb*(1-land[...,None]) + landcol*land[...,None]
    # --- ice caps ---
    cap = (np.clip((vv-0.80)/0.18,0,1) + np.clip((-vv-0.78)/0.18,0,1)) * inside
    ice = f01((235,242,250))[None,None,:]*sh[...,None]
    rgb = rgb*(1-cap[...,None]*0.9) + ice*cap[...,None]*0.9
    # --- clouds (swirled streaks) ---
    ccenters = [(rnd.uniform(-0.6,0.6), rnd.uniform(-0.6,0.6)) for _ in range(7)]
    csizes   = [rnd.uniform(0.10,0.22) for _ in range(7)]
    cl = np.zeros_like(uu)
    for (bx,by),s in zip(ccenters,csizes):
        cl += np.exp(-(((uu-bx)**2/(2*(s*1.7)**2) + (vv-by)**2/(2*(s*0.6)**2))))
    cl = np.clip((cl-0.55)/0.6,0,1)*inside
    white = f01((250,252,255))[None,None,:]*sh[...,None]
    rgb = rgb*(1-cl[...,None]*0.7) + white*cl[...,None]*0.7
    # --- specular ocean glint on day side, only over water ---
    glint = (np.clip(shade,0,1)**44)*(1-land)*0.5
    rgb += glint[...,None]*f01((255,255,245))[None,None,:]
    # --- city lights on night-side land ---
    night = (shade < 0.16) & (land > 0.4) & inside
    ys, xs = np.where(night)
    if len(xs) > 0:
        pick = rnd.sample(range(len(xs)), min(90, len(xs)))
        for i in pick:
            rgb[ys[i], xs[i], :] = np.clip(rgb[ys[i], xs[i], :] + f01((255,200,120))*0.9, 0, 1)
    rgb *= inside[...,None]
    # --- atmosphere limb (cyan rim, brighter on day side) ---
    limb = np.clip((np.sqrt(r2)-0.88)/0.12,0,1)*inside
    rim = (limb * (0.20+0.80*shade))[...,None] * f01((130,205,255))[None,None,:]
    rgb = np.clip(rgb + rim*0.45, 0, 1)
    blit(scene, cx, cy, rgb.astype(np.float32), alpha)
    # outer atmosphere glow (thin, crisp)
    add_radial(scene, cx, cy, R*1.5, (90,170,255), falloff=3.2, strength=0.16)
    add_ring(scene, cx, cy, R*1.02, max(2,R*0.035), (160,215,255), strength=0.32)
    if life:  # faint green biosphere aura
        add_radial(scene, cx, cy, R*1.26, (90,230,160), falloff=3.1, strength=0.11)

def draw_sun(scene, cx, cy, R, accent=(255,210,120), core_c=(255,247,230)):
    add_radial(scene, cx, cy, R*7.0, accent, falloff=2.3, strength=0.16)
    add_radial(scene, cx, cy, R*3.4, mix(accent, core_c, 0.5), falloff=2.0, strength=0.9)
    add_radial(scene, cx, cy, R*1.7, core_c, falloff=1.7, strength=1.15)
    add_radial(scene, cx, cy, R*0.95, (255,255,255), falloff=1.5, strength=1.3)

def draw_galaxy(scene, cx, cy, R, seed=3, tilt=0.42, rot=-0.5,
                core_c=(255,232,180), arm_c=(150,180,255), hii=(255,150,210)):
    rnd = random.Random(seed)
    ct, st = math.cos(rot), math.sin(rot)
    def place(px, py, col, pr, a):
        # incline (squash y) then rotate into screen space
        x = px; y = py*tilt
        rx = x*ct - y*st; ry = x*st + y*ct
        add_radial(scene, cx+rx, cy+ry, pr, col, falloff=2.0, strength=a)
    # diffuse inclined disk haze — many faint stars fill the disk between arms
    for _ in range(900):
        rr = R*math.sqrt(rnd.random())
        ang = rnd.uniform(0, 2*math.pi)
        fade = max(0.0, 1 - rr/R)
        place(rr*math.cos(ang), rr*math.sin(ang), (130,155,210),
              rnd.uniform(0.7,1.5), 0.06*fade + 0.02)
    # subtle warm bulge — kept dim so the arms read as a galaxy, not a star
    add_radial(scene, cx, cy, R*0.34, core_c, falloff=2.3, strength=0.42)
    add_radial(scene, cx, cy, R*0.15, (255,244,212), falloff=1.9, strength=0.60)
    add_radial(scene, cx, cy, R*0.055, (255,252,238), falloff=1.6, strength=0.75)
    # spiral arms with real width (a band of stars + pink HII nurseries)
    for arm in range(2):
        th0 = arm*math.pi
        n = 620
        for i in range(n):
            t = i/n
            r = R*0.13 + R*0.90*t
            theta = th0 + 2.5*math.log(1+3.6*t)
            ax, ay = math.cos(theta), math.sin(theta)
            nx, ny = -ay, ax
            for _k in range(2):
                perp = rnd.gauss(0, R*0.05*(1-t*0.30))
                px = r*ax + perp*nx; py = r*ay + perp*ny
                roll = rnd.random()
                if roll < 0.12:
                    col = hii; pr = rnd.uniform(2.4,4.2); a = 0.50*(1-t*0.4)
                elif roll < 0.55:
                    col = (236,242,255); pr = rnd.uniform(1.0,2.2); a = 0.50*(1-t*0.4)
                else:
                    col = arm_c; pr = rnd.uniform(1.0,2.5); a = 0.44*(1-t*0.4)
                place(px, py, col, pr, a)
    # a few brighter field stars (not inclined) for depth
    for _ in range(60):
        add_radial(scene, cx+rnd.uniform(-R,R), cy+rnd.uniform(-R*0.7,R*0.7),
                   rnd.uniform(0.6,1.3), (220,225,245), falloff=2.0, strength=0.16)

def add_disk(scene, cx, cy, Rin, Rout, squash, hot, cool, dop_dir=-1.0,
             strength=1.0, front_only=False, back_only=False):
    Rb = Rout
    x0=max(0,int(cx-Rb-2)); x1=min(W,int(cx+Rb+2))
    yext = Rb*squash+2
    y0=max(0,int(cy-yext)); y1=min(H,int(cy+yext))
    if x1<=x0 or y1<=y0: return
    xs=np.arange(x0,x1,dtype=np.float32)[None,:]; ys=np.arange(y0,y1,dtype=np.float32)[:,None]
    dx=xs-cx; dy=(ys-cy)/squash
    rd=np.sqrt(dx*dx+dy*dy)
    band=(rd>=Rin)&(rd<=Rout)
    t=np.clip((rd-Rin)/max(1.0,(Rout-Rin)),0,1)
    prof=np.exp(-((t-0.03)/0.40)**2)
    ang=np.arctan2(dy,dx)
    dop=np.clip(1.0+0.65*(dop_dir*np.cos(ang)),0.22,1.85)
    hotc=f01(hot); coolc=f01(cool)
    col=hotc[None,None,:]+(coolc-hotc)[None,None,:]*t[...,None]
    m=(prof*dop*strength)*band
    if front_only: m=m*(dy>0)
    if back_only:  m=m*(dy<=0)
    scene[y0:y1,x0:x1,:]+=col*m[...,None]

def occlude(scene, cx, cy, R, color=(0,0,0)):
    x0=max(0,int(cx-R-2)); x1=min(W,int(cx+R+2))
    y0=max(0,int(cy-R-2)); y1=min(H,int(cy+R+2))
    if x1<=x0 or y1<=y0: return
    xs=np.arange(x0,x1,dtype=np.float32)[None,:]; ys=np.arange(y0,y1,dtype=np.float32)[:,None]
    d=np.sqrt((xs-cx)**2+(ys-cy)**2)
    a=np.clip(1.0-(d-(R-1.5))/1.5,0,1)
    col=f01(color)
    scene[y0:y1,x0:x1,:]=scene[y0:y1,x0:x1,:]*(1-a[...,None])+col[None,None,:]*a[...,None]

def draw_blackhole(scene, cx, cy, Rh, seed=5):
    # era glow
    add_radial(scene, cx, cy, Rh*9, (110,80,150), falloff=2.4, strength=0.14)
    # relativistic jets (soft cones from the poles, starting clear of the disk)
    for s in (-1, 1):
        for i in range(22):
            d = Rh*1.7 + i*Rh*0.24
            w = Rh*(0.18+0.022*i)
            add_radial(scene, cx, cy + s*d, w, (150,180,255), falloff=2.5,
                       strength=0.15*math.exp(-i/10))
    # main accretion disk (full), Doppler-bright on left
    add_disk(scene, cx, cy, Rh*1.06, Rh*3.0, squash=0.30,
             hot=(255,248,232), cool=(255,95,28), dop_dir=-1.0, strength=1.05)
    # lensed top arc (the far side of the disk bent over the top) — less squashed
    add_disk(scene, cx, cy, Rh*1.04, Rh*1.9, squash=0.62,
             hot=(255,247,228), cool=(255,130,55), dop_dir=-1.0, strength=0.55, back_only=True)
    # event horizon (occlude)
    occlude(scene, cx, cy, Rh, (0,0,0))
    # photon ring around the horizon
    add_ring(scene, cx, cy, Rh*1.04, max(2.5,Rh*0.05), (255,225,180), strength=1.4)
    add_ring(scene, cx, cy, Rh*1.04, max(1.2,Rh*0.02), (255,255,255), strength=0.9)
    # near (front) side of disk over the lower horizon edge
    add_disk(scene, cx, cy, Rh*1.0, Rh*3.0, squash=0.30,
             hot=(255,248,232), cool=(255,95,28), dop_dir=-1.0, strength=0.85, front_only=True)

# ------------------------------------------------------------------ orbiters
def orbiters(scene, cx, cy, items, tilt=0.40, rot=0.2):
    ct, st = math.cos(rot), math.sin(rot)
    for it in items:
        ang = it["ang"]; orad = it["orad"]
        x = orad*math.cos(ang); y = orad*math.sin(ang)*tilt
        rx = x*ct - y*st; ry = x*st + y*ct
        ox, oy = cx+rx, cy+ry
        # faint orbit trail
        trail_col = it.get("base_lit", (120,160,210))
        add_radial(scene, ox - math.cos(ang)*it["r"]*2, oy - math.sin(ang)*it["r"]*tilt*2,
                   it["r"]*2.4, trail_col, falloff=2.4, strength=0.18)
        if it.get("earth"):
            draw_earth(scene, ox, oy, it["r"], seed=it.get("seed",1), life=False)
        else:
            draw_planet(scene, ox, oy, it["r"], it["base_lit"], it["base_shadow"],
                        bands=it.get("bands",0), atmo=it.get("atmo"))

# ------------------------------------------------------------------ render
def render_entity(cfg):
    random.seed(cfg["seed"])
    scene = RS.new_scene(cfg.get("bg_top",(8,9,18)), cfg.get("bg_bot",(2,2,5)))
    RS.starfield(scene, n=cfg.get("stars",430), seed=cfg["seed"])
    cx = CX; cy = cfg.get("cy", 1500)
    accent = cfg["accent"]; coreColor = cfg["core"]
    # infalling streaks (gameplay: matter being pulled in)
    for s in cfg.get("streaks", []):
        ang, r0, r1, col = s
        steps = 10
        for i in range(steps):
            t = i/steps
            rr = r0 + (r1-r0)*t
            a = ang + t*cfg.get("streak_curl", 0.9)
            sx = cx + math.cos(a)*rr; sy = cy + math.sin(a)*rr*cfg.get("streak_tilt",1.0)
            add_radial(scene, sx, sy, 4+6*(1-t), col, falloff=2.2, strength=0.5*(1-t)+0.1)
    hero = cfg["hero"]
    if hero == "solar":
        draw_sun(scene, cx, cy, cfg.get("sunR",120), accent=accent, core_c=coreColor)
        orbiters(scene, cx, cy, cfg["orbiters"], tilt=cfg.get("tilt",0.40), rot=cfg.get("rot",0.2))
    elif hero == "earth":
        draw_earth(scene, cx, cy, cfg.get("R",300), seed=cfg["seed"])
        for mo in cfg.get("moons", []):
            draw_planet(scene, cx+mo[0], cy+mo[1], mo[2], (180,180,188),(40,40,48), spec=0.15)
    elif hero == "galaxy":
        draw_galaxy(scene, cx, cy, cfg.get("R",430), seed=cfg["seed"],
                    tilt=cfg.get("tilt",0.42), rot=cfg.get("rot",-0.5))
    elif hero == "blackhole":
        draw_blackhole(scene, cx, cy, cfg.get("Rh",150), seed=cfg["seed"])
    RS.vignette(scene, cfg.get("vig",0.22))
    img = RS.scene_to_img(scene)

    ui = RS.UI()
    ui.vscrim(96, 640, 158, 0)
    ui.vscrim(H-700, H, 0, 205)
    RS.status_bar(ui)
    RS.header(ui, scene, accent, coreColor, cfg["time"], cfg["stage_kicker"],
              cfg["entropy"], cfg["pct_tl"], cfg.get("entropy_unit", True))
    RS.marketing(ui, accent, cfg["kicker"], cfg["lines"], cfg.get("accent_words", []),
                 y_kick=cfg.get("y_kick", 486))
    RS.floats(ui, cfg.get("floats", []))
    # entity name caption near hero
    if cfg.get("caption"):
        cxp, cyp, txt = cfg["caption"]
        ui.text(cxp, cyp, txt, F_SER_I, 58, coreColor, anchor="mm", tracking=1)
        ui.text(cxp, cyp-52, cfg.get("caption_kick","— ABSORBED —"), F_MONO, 22, MUTED,
                anchor="mm", tracking=7)
    # bottom panel
    ptop = cfg.get("panel_top", H-590)
    ui.line(M, ptop, W-M, ptop, (255,255,255), 2, alpha=22)
    res = cfg.get("resource")
    if res:
        RS.panel_resource(ui, accent, coreColor, res["label"], res["value"], res.get("total"),
                          res["rate"], res["pct"], ptop+58)
    uy = ptop+260
    for i, u in enumerate(cfg.get("ups", [])):
        RS.upgrade_row(ui, accent, M, W-M, uy+i*112, 96, u[0], u[1], u[2], u[3],
                       enabled=u[4] if len(u) > 4 else True)

    overlay = ui.finish()
    img = img.convert("RGBA"); img.alpha_composite(overlay)
    out = img.convert("RGB")
    path = os.path.join(OUT, cfg["file"]); out.save(path, "PNG")
    print("saved", path, out.size)
    return path

# ------------------------------------------------------------------ configs
SCREENS = [
 { # 08 Solar System — absorb worlds + progress
  "file":"appstore_08_solar.png","seed":101,"hero":"solar",
  "accent":hx("f7c86e"),"core":hx("ffe3a8"),
  "bg_top":(14,11,8),"bg_bot":(3,2,4),"stars":420,
  "cy":1520,"sunR":120,"tilt":0.40,"rot":0.25,
  "orbiters":[
     {"ang":0.4,"orad":300,"r":40,"base_lit":(210,120,80),"base_shadow":(60,28,20)},          # mars-like
     {"ang":2.1,"orad":310,"r":62,"earth":True,"seed":4},                                       # Earth
     {"ang":3.5,"orad":480,"r":88,"base_lit":(214,180,120),"base_shadow":(70,52,28),"bands":26},# gas giant
     {"ang":5.0,"orad":485,"r":48,"base_lit":(150,170,200),"base_shadow":(40,46,60),"bands":14},# ice giant
     {"ang":1.2,"orad":630,"r":28,"base_lit":(170,160,150),"base_shadow":(44,40,38)},           # far rock
  ],
  "streaks":[(0.9,560,150,hx("ffd089")),(2.6,600,160,hx("ffba6e")),(4.4,560,150,hx("ffe0a0")),(5.6,640,170,hx("ffc878"))],
  "streak_curl":1.1,"streak_tilt":0.5,
  "time":"t = 10 Gyr","stage_kicker":"EPOCH 10  ·  SOLAR SYSTEM","entropy":"5.2k","pct_tl":0.62,
  "kicker":"WORLDS IGNITE","lines":["Draw worlds into","a newborn sun"],"accent_words":["worlds"],
  "floats":[(CX-250,1330,"+1 WORLD","collision"),(CX+280,1690,"+1","n")],
  "resource":{"label":"WORLDS","value":"31","total":"40","rate":"+6.0 /s","pct":0.78},
  "ups":[["Planetesimal Pull","×5","240","+1.2 /s  ·  per level"],
         ["Accretion Disk","×2","880","+9.0 /s  ·  per level",False]],
 },
 { # 09 Life on Earth — Earth hero + moon
  "file":"appstore_09_earth.png","seed":4,"hero":"earth",
  "accent":hx("68d8a4"),"core":hx("a9f0d0"),
  "bg_top":(6,12,12),"bg_bot":(2,3,4),"stars":460,
  "cy":1500,"R":300,
  "moons":[(430,-330,46)],
  "time":"t = 2×10¹⁰ yr","stage_kicker":"EPOCH 11  ·  LIFE ON EARTH","entropy":"9.8k","pct_tl":0.70,
  "kicker":"A PALE BLUE WORLD","lines":["Kindle life on","a living world"],"accent_words":["life"],
  "floats":[(CX-330,1230,"+40 MEMORY","collision")],
  "resource":{"label":"MEMORY","value":"812","total":"1,200","rate":"+40 /s","pct":0.68},
  "ups":[["Living Spark","×7","360","+2.0 /s  ·  per level"],
         ["Evolutionary Pressure","×3","1,450","+24 /s  ·  per level",False]],
 },
 { # 10 Galaxy Formation — spiral galaxy
  "file":"appstore_10_galaxy.png","seed":9,"hero":"galaxy",
  "accent":hx("6d8fff"),"core":hx("aab8ff"),
  "bg_top":(7,8,20),"bg_bot":(2,2,7),"stars":520,
  "cy":1500,"R":470,"tilt":0.34,"rot":-0.6,"vig":0.26,
  "time":"t = 1 Gyr","stage_kicker":"EPOCH 09  ·  GALAXY FORMATION","entropy":"3.1k","pct_tl":0.50,
  "kicker":"ISLANDS OF LIGHT","lines":["Spin galaxies out","of the cosmic dark"],"accent_words":["galaxies"],
  "resource":{"label":"GALAXIES","value":"57","total":"90","rate":"+18 /s","pct":0.63},
  "ups":[["Quasar Beam","×4","420","+3.0 /s  ·  per level"],
         ["Web Spinner","×2","1,600","+22 /s  ·  per level",False]],
 },
 { # 11 Black Hole Era — black hole hero
  "file":"appstore_11_blackhole.png","seed":5,"hero":"blackhole",
  "accent":hx("b98cff"),"core":hx("d9c6ff"),
  "bg_top":(9,6,16),"bg_bot":(2,1,5),"stars":360,
  "cy":1480,"Rh":150,"vig":0.30,
  "time":"t = 2×10²⁸ yr","stage_kicker":"EPOCH 15  ·  BLACK HOLE ERA","entropy":"88k","pct_tl":0.92,
  "kicker":"THE LONG TWILIGHT","lines":["Feed the dark at","the end of time"],"accent_words":["dark"],
  "floats":[(CX-360,1250,"+260 HAWKING","collision")],
  "resource":{"label":"HAWKING QUANTA","value":"4.1M","total":None,"rate":"+260 /s","pct":0.5},
  "ups":[["Hawking Radiator","×9","2.0k","+12 /s  ·  per level"],
         ["Event Horizon Drain","×3","9.4k","+180 /s  ·  per level",False]],
 },
]

if __name__ == "__main__":
    for c in SCREENS:
        render_entity(c)
    print("done")
