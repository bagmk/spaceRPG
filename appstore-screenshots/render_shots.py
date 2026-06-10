#!/usr/bin/env python3
"""
App Store screenshot renderer for "Big Bang / Cosmic Coalescence".
Faithfully recreates the game's cosmic look (starfield, glowing core via additive
radial gradients, orbiting particles, in-game UI chrome) and overlays marketing
headlines. Output: 6 opaque-RGB PNGs. Size via argv[1]: iphone69=1290x2796 (App Store 6.9", default), iphone65=1284x2778.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import math, random, os, sys

# Target canvas. App Store Connect requires the 6.9" iPhone set (1290x2796);
# it auto-scales that down to 6.7"/6.5". Pass a preset as argv[1] to switch.
PRESETS = {
    "iphone69": (1290, 2796),  # 6.9"  iPhone 16/15 Pro Max — App Store required
    "iphone65": (1284, 2778),  # 6.5"  legacy iPhone Plus
}
_PRESET = sys.argv[1] if len(sys.argv) > 1 else "iphone69"
if _PRESET not in PRESETS:
    raise SystemExit(f"unknown size preset {_PRESET!r}; choose: {list(PRESETS)}")
W, H = PRESETS[_PRESET]
SS = 2  # supersample factor for the UI/text overlay
OUT = os.path.dirname(os.path.abspath(__file__))

FP = "/usr/share/fonts/truetype/dejavu/"
F_MONO   = FP + "DejaVuSansMono.ttf"
F_MONO_B = FP + "DejaVuSansMono-Bold.ttf"
F_SER_I  = FP + "DejaVuSerif-Italic.ttf"
F_SER_BI = FP + "DejaVuSerif-BoldItalic.ttf"
F_SANS_B = FP + "DejaVuSans-Bold.ttf"

_fc = {}
def font(path, size):
    k = (path, int(size))
    if k not in _fc:
        _fc[k] = ImageFont.truetype(path, int(size))
    return _fc[k]

def hx(h):
    h = h.lstrip('#')
    return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16))
def f01(rgb):
    return np.array([rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0], dtype=np.float32)
def mix(a, b, t):
    return tuple(int(round(a[i]*(1-t)+b[i]*t)) for i in range(3))

# ---------------------------------------------------------------- numpy scene
def new_scene(top=(10,10,20), bot=(2,2,5)):
    y = np.linspace(0,1,H, dtype=np.float32)[:,None]
    t = f01(top); b = f01(bot)
    col = t[None,:]*(1-y) + b[None,:]*y          # (H,3)
    scene = np.repeat(col[:,None,:], W, axis=1)  # (H,W,3)
    return scene.astype(np.float32)

def add_radial(scene, cx, cy, radius, color, falloff=2.0, strength=1.0):
    if radius <= 0: return
    x0=max(0,int(cx-radius)); x1=min(W,int(cx+radius)+1)
    y0=max(0,int(cy-radius)); y1=min(H,int(cy+radius)+1)
    if x1<=x0 or y1<=y0: return
    xs=np.arange(x0,x1,dtype=np.float32)[None,:]
    ys=np.arange(y0,y1,dtype=np.float32)[:,None]
    d=np.sqrt((xs-cx)**2+(ys-cy)**2)/radius
    m=np.clip(1.0-d,0,1)**falloff
    col=f01(color)*float(strength)
    scene[y0:y1,x0:x1,:]+=m[...,None]*col[None,None,:]

def add_ring(scene, cx, cy, radius, width, color, strength=1.0):
    rad_out = radius+width*3
    x0=max(0,int(cx-rad_out)); x1=min(W,int(cx+rad_out)+1)
    y0=max(0,int(cy-rad_out)); y1=min(H,int(cy+rad_out)+1)
    if x1<=x0 or y1<=y0: return
    xs=np.arange(x0,x1,dtype=np.float32)[None,:]
    ys=np.arange(y0,y1,dtype=np.float32)[:,None]
    d=np.abs(np.sqrt((xs-cx)**2+(ys-cy)**2)-radius)
    m=np.exp(-(d/max(1.0,width))**2)*float(strength)
    col=f01(color)
    scene[y0:y1,x0:x1,:]+=m[...,None]*col[None,None,:]

def starfield(scene, n=420, seed=1):
    rnd=random.Random(seed)
    for _ in range(n):
        x=rnd.uniform(0,W); y=rnd.uniform(0,H*0.92)
        a=rnd.uniform(0.10,0.55)
        if rnd.random()<0.08:
            add_radial(scene, x, y, rnd.uniform(6,12), (255,255,255), falloff=2.2, strength=a*0.9)
        else:
            xi=int(x); yi=int(y)
            if 0<=xi<W and 0<=yi<H:
                scene[yi,xi,:]=np.clip(scene[yi,xi,:]+a, 0, 4)

def core(scene, cx, cy, coreR, accent, coreColor, progress, halo=0.20):
    add_radial(scene, cx, cy, W*0.66, accent, falloff=2.2, strength=halo*(0.55+progress))
    add_radial(scene, cx, cy, coreR*4.6, mix(accent, coreColor, 0.5), falloff=2.0, strength=0.85)
    add_radial(scene, cx, cy, coreR*2.3, coreColor, falloff=1.8, strength=1.05)
    add_radial(scene, cx, cy, max(8,coreR*0.95), (255,255,255), falloff=1.5, strength=1.25)
    if progress>0.3:
        for i in range(1,4):
            add_ring(scene, cx, cy, coreR*1.1+i*46, 1.6, accent, strength=0.05*progress)

def particles(scene, cx, cy, coreR, colors, n=85, seed=2, spread=0.62):
    rnd=random.Random(seed)
    for _ in range(n):
        ang=rnd.uniform(0,2*math.pi)
        rad=coreR*1.4 + rnd.uniform(0, max(W,H)*spread)
        x=cx+math.cos(ang)*rad; y=cy+math.sin(ang)*rad*0.92
        c=colors[rnd.randrange(len(colors))]
        pr=rnd.uniform(1.2,3.0)
        a=rnd.uniform(0.4,0.95)
        add_radial(scene, x, y, pr*3.2, c, falloff=2.0, strength=a*0.7)
        if rnd.random()<0.18:  # streak
            sx=x-math.cos(ang)*pr*6; sy=y-math.sin(ang)*pr*6
            add_radial(scene, (x+sx)/2,(y+sy)/2, pr*2.4, c, falloff=2.2, strength=a*0.3)

def vignette(scene, strength=0.20):
    yy,xx=np.mgrid[0:H,0:W]
    d=np.sqrt(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2)
    m=1.0-strength*np.clip(d-0.4,0,1.2)**2
    scene*=m[...,None].astype(np.float32)

def scene_to_img(scene):
    arr=np.clip(scene,0,1)
    arr=arr**(1/1.04)  # gentle lift
    return Image.fromarray((arr*255).astype(np.uint8), "RGB")

# ---------------------------------------------------------------- UI overlay
class UI:
    def __init__(self):
        self.img=Image.new("RGBA",(W*SS,H*SS),(0,0,0,0))
        self.d=ImageDraw.Draw(self.img)
    def f(self,path,size): return font(path,size*SS)
    def vscrim(self, y0, y1, a0, a1):
        h=int((y1-y0)*SS)
        if h<=0: return
        grad=np.linspace(a0,a1,h)
        strip=np.zeros((h, W*SS, 4), dtype=np.uint8)
        strip[...,3]=grad[:,None].astype(np.uint8)
        self.img.alpha_composite(Image.fromarray(strip,"RGBA"),(0,int(y0*SS)))
    def text(self, x, y, s, path, size, fill, anchor="la", tracking=0.0, alpha=255):
        fnt=self.f(path,size)
        fill=(fill[0],fill[1],fill[2],alpha)
        if tracking==0:
            self.d.text((x*SS,y*SS), s, font=fnt, fill=fill, anchor=anchor)
            return self.d.textlength(s,font=fnt)/SS
        adv=[self.d.textlength(ch,font=fnt) for ch in s]
        total=sum(adv)+tracking*SS*(len(s)-1)
        if anchor[0]=="m": cx=x*SS-total/2
        elif anchor[0]=="r": cx=x*SS-total
        else: cx=x*SS
        ay=anchor[1] if len(anchor)>1 else "a"
        for ch,a in zip(s,adv):
            self.d.text((cx,y*SS), ch, font=fnt, fill=fill, anchor="l"+ay)
            cx+=a+tracking*SS
        return total/SS
    def entropy(self, x_right, y, val, has_unit=True, color=(122,116,104), vcolor=(196,192,180)):
        f=self.f(F_MONO,22); fb=self.f(F_MONO,15)
        tr=2*SS
        label="ENTROPY  "
        wl=sum(self.d.textlength(c,font=f) for c in label)+tr*(len(label)-1)
        wv=self.d.textlength(val,font=f)
        wk=self.d.textlength(" k",font=f) if has_unit else 0
        wb=self.d.textlength("B",font=fb) if has_unit else 0
        x=x_right*SS-(wl+wv+wk+wb); yy=y*SS
        for c in label:
            self.d.text((x,yy),c,font=f,fill=color+(255,),anchor="lm"); x+=self.d.textlength(c,font=f)+tr
        self.d.text((x,yy),val,font=f,fill=vcolor+(255,),anchor="lm"); x+=wv
        if has_unit:
            self.d.text((x,yy)," k",font=f,fill=color+(255,),anchor="lm"); x+=wk
            self.d.text((x,yy+7*SS),"B",font=fb,fill=color+(255,),anchor="lm")
    def line(self,x0,y0,x1,y1,fill,width,alpha=255):
        self.d.line((x0*SS,y0*SS,x1*SS,y1*SS),fill=(fill[0],fill[1],fill[2],alpha),width=int(width*SS))
    def rrect(self,x0,y0,x1,y1,r,fill=None,outline=None,ow=1,falpha=255,oalpha=255):
        fc=(fill[0],fill[1],fill[2],falpha) if fill else None
        oc=(outline[0],outline[1],outline[2],oalpha) if outline else None
        self.d.rounded_rectangle((x0*SS,y0*SS,x1*SS,y1*SS),radius=r*SS,fill=fc,outline=oc,width=int(ow*SS))
    def ellipse(self,cx,cy,r,fill=None,outline=None,ow=1,falpha=255,oalpha=255):
        fc=(fill[0],fill[1],fill[2],falpha) if fill else None
        oc=(outline[0],outline[1],outline[2],oalpha) if outline else None
        self.d.ellipse(((cx-r)*SS,(cy-r)*SS,(cx+r)*SS,(cy+r)*SS),fill=fc,outline=oc,width=int(ow*SS))
    def tri(self,cx,cy,r,ang,fill,alpha=255):
        pts=[]
        for a in (0, 2.5, -2.5):
            pts.append(((cx+math.cos(ang+a)*r)*SS,(cy+math.sin(ang+a)*r)*SS))
        self.d.polygon(pts,fill=(fill[0],fill[1],fill[2],alpha))
    def finish(self):
        return self.img.resize((W,H), Image.LANCZOS)

MUTED=(122,116,104)
FG=(236,232,217)
WHITE=(245,245,250)

# layout constants
M=72
CX=W//2

def status_bar(ui):
    ui.text(M, 60, "9:41", F_SANS_B, 32, WHITE, anchor="lm", alpha=235)
    # right cluster: 5G + battery
    bx=W-M
    # battery
    ui.rrect(bx-46, 50, bx-6, 74, 6, outline=WHITE, ow=2, oalpha=180)
    ui.rrect(bx-44, 53, bx-14, 71, 3, fill=WHITE, falpha=210)
    ui.d.rectangle(((bx-4)*SS,58*SS,(bx-1)*SS,66*SS), fill=(245,245,250,180))
    ui.text(bx-66, 60, "5G", F_SANS_B, 26, WHITE, anchor="rm", alpha=200)
    # signal dots
    for i in range(4):
        h=8+i*5
        x=bx-150+i*12
        ui.d.rectangle((x*SS,(70-h)*SS,(x+7)*SS,70*SS), fill=(245,245,250,200))

def header(ui, scene_glow, accent, coreColor, time_s, stage_kicker, entropy_val, pct, entropy_unit=True):
    y0=150
    ui.text(M, y0, "COSMIC TIME", F_MONO, 22, MUTED, anchor="lm", tracking=5)
    ui.text(W-M, y0, time_s, F_MONO, 27, accent, anchor="rm", tracking=1)
    ty=210
    ui.line(M, ty, W-M, ty, (255,255,255), 2, alpha=34)
    fillx=M+(W-2*M)*max(0.02,min(1,pct))
    ui.line(M, ty, fillx, ty, accent, 3, alpha=230)
    # marker
    ui.ellipse(fillx, ty, 9, fill=FG, outline=accent, ow=3)
    y1=262
    ui.text(M, y1, stage_kicker, F_MONO, 22, mix(MUTED,coreColor,0.6), anchor="lm", tracking=4)
    ui.entropy(W-M, y1, entropy_val, has_unit=entropy_unit)

def marketing(ui, accent, kicker, lines, accent_words, y_kick=486):
    ui.text(CX, y_kick, kicker, F_MONO, 30, accent, anchor="mm", tracking=9)
    fy=y_kick+92
    fs=120
    aw=set(w.lower() for w in accent_words)
    for ln in lines:
        words=ln.split(" ")
        fnt=ui.f(F_SER_I, fs)
        sp=ui.d.textlength(" ",font=fnt)
        widths=[ui.d.textlength(w,font=fnt) for w in words]
        total=sum(widths)+sp*(len(words)-1)
        cx=CX*SS-total/2
        for w,wd in zip(words,widths):
            col=accent if w.strip(",.").lower() in aw else WHITE
            ui.d.text((cx, fy*SS), w, font=fnt, fill=(col[0],col[1],col[2],255), anchor="la")
            cx+=wd+sp
        fy+=fs*1.16

def floats(ui, items):
    for (x,y,txt,kind) in items:
        if kind=="crit":
            ui.text(x,y,txt,F_SER_BI,58,(255,238,204),anchor="mm",tracking=1)
        elif kind=="collision":
            ui.text(x,y,txt,F_SER_BI,44,WHITE,anchor="mm",tracking=1)
        else:
            ui.text(x,y,txt,F_MONO_B,30,(255,210,170),anchor="mm",tracking=1)

def panel_resource(ui, accent, coreColor, label, value, total, rate, pct, y):
    ui.text(M, y, label, F_MONO, 26, MUTED, anchor="lm", tracking=5)
    ui.text(M+ui.d.textlength(label,font=ui.f(F_MONO,26))/SS+34, y, rate, F_MONO, 22, accent, anchor="lm")
    vy=y+58
    vfnt=ui.f(F_SER_BI,78)
    ui.d.text((M*SS,vy*SS), value, font=vfnt, fill=(FG[0],FG[1],FG[2],255), anchor="lm")
    vw=ui.d.textlength(value,font=vfnt)/SS
    if total:
        ui.text(M+vw+18, vy+8, " / "+total, F_SER_I, 46, MUTED, anchor="lm")
    by=y+118
    ui.line(M,by,W-M,by,(255,255,255),5,alpha=26)
    fx=M+(W-2*M)*max(0.0,min(1,pct))
    ui.line(M,by,fx,by,accent,6,alpha=235)

def upgrade_row(ui, accent, x0,x1,y,h, name, lvl, cost, eff, enabled=True):
    a=255 if enabled else 110
    ui.rrect(x0,y,x1,y+h, 10, fill=(255,255,255), outline=(255,255,255), ow=2, falpha=8, oalpha=int(30*a/255))
    ui.text(x0+26, y+h*0.40, name, F_MONO, 27, FG, anchor="lm", alpha=a)
    nw=ui.d.textlength(name,font=ui.f(F_MONO,27))/SS
    if lvl:
        ui.text(x0+26+nw+16, y+h*0.40, lvl, F_MONO, 22, MUTED, anchor="lm", alpha=a)
    ui.text(x1-26, y+h*0.40, cost, F_MONO_B, 30, accent, anchor="rm", alpha=a)
    ui.text(x0+26, y+h*0.74, eff, F_MONO, 19, MUTED, anchor="lm", tracking=1, alpha=a)

def condense_btn(ui, accent, x0,x1,y,h, label="◆  CONDENSE  →  NEXT STAGE"):
    ui.rrect(x0,y,x1,y+h, 12, fill=accent)
    ui.text((x0+x1)/2, y+h/2, label, F_MONO_B, 30, (8,6,10), anchor="mm", tracking=4)

# ---------------------------------------------------------------- screens
def render(cfg):
    random.seed(cfg["seed"])
    scene=new_scene(cfg.get("bg_top",(10,10,20)), cfg.get("bg_bot",(2,2,5)))
    starfield(scene, n=cfg.get("stars",420), seed=cfg["seed"])
    cx=CX; cy=cfg.get("core_cy",1500)
    accent=cfg["accent"]; coreColor=cfg["core"]
    coreR=cfg.get("coreR",120); progress=cfg.get("progress",0.4)
    particles(scene, cx, cy, coreR, cfg["pcolors"], n=cfg.get("npart",85), seed=cfg["seed"]+7, spread=cfg.get("spread",0.62))
    core(scene, cx, cy, coreR, accent, coreColor, progress, halo=cfg.get("halo",0.20))
    # threshold ring when full
    if cfg.get("threshold_ring"):
        add_ring(scene, cx, cy, coreR*1.5, 3.0, accent, strength=0.8)
    # condense shock waves
    for (rr,st) in cfg.get("waves",[]):
        add_ring(scene, cx, cy, rr, 9, accent, strength=st)
        add_ring(scene, cx, cy, rr*0.6, 4, (255,255,255), strength=st*0.5)
    # rogue object
    rg=cfg.get("rogue")
    if rg:
        rx,ry,rr=rg["x"],rg["y"],rg["r"]
        add_radial(scene, rx,ry, rr*3.6, rg["glow"], falloff=2.0, strength=0.6)
        add_radial(scene, rx,ry, rr*1.1, rg["color"], falloff=1.6, strength=1.1)
        add_radial(scene, rx,ry, rr*0.4, (255,255,255), falloff=1.5, strength=1.2)
    # glow behind condense button / headline
    if cfg.get("btn_glow"):
        bx,by=cfg["btn_glow"]
        add_radial(scene, bx,by, 420, accent, falloff=2.2, strength=0.22)
    vignette(scene, cfg.get("vig",0.20))
    img=scene_to_img(scene)

    ui=UI()
    # scrims for legibility
    ui.vscrim(96, 620, 150, 0)         # top
    ui.vscrim(H-700, H, 0, 205)        # bottom
    status_bar(ui)
    header(ui, scene, accent, coreColor, cfg["time"], cfg["stage_kicker"], cfg["entropy"], cfg["pct_tl"], cfg.get("entropy_unit",True))
    marketing(ui, accent, cfg["kicker"], cfg["lines"], cfg.get("accent_words",[]), y_kick=cfg.get("y_kick",486))

    # rogue satellites + encounter alert
    if rg:
        for i in range(2):
            a=i*math.pi+0.6
            ui.ellipse(rg["x"]+math.cos(a)*rg["r"]*1.8, rg["y"]+math.sin(a)*rg["r"]*1.8, 5, fill=WHITE, falpha=220)
        if cfg.get("encounter"):
            ex,ey=cfg["enc_pos"]
            ui.text(ex,ey,"—  ENCOUNTER  —",F_MONO,24,MUTED,anchor="mm",tracking=8)
            ui.text(ex,ey+58,cfg["encounter"],F_SER_I,66,rg["color"],anchor="mm",tracking=1)
        # off-screen indicator
        if cfg.get("indicator"):
            ix,iy,ia=cfg["indicator"]
            ui.tri(ix,iy,20,ia,accent,alpha=230)

    floats(ui, cfg.get("floats",[]))

    if cfg.get("combo"):
        ui.text(W-M, 360, cfg["combo"], F_SER_BI, 40, accent, anchor="rm")
        ui.text(W-M, 322, "COMBO", F_MONO, 20, MUTED, anchor="rm", tracking=6)

    # ----- bottom content -----
    if cfg.get("ending"):
        # quote-style end screen
        qx=CX; qy=cfg.get("quote_y",1640)
        ui.text(qx, qy-150, cfg["end_time"], F_MONO, 28, accent, anchor="mm", tracking=2)
        for i,ln in enumerate(cfg["quote"]):
            ui.text(qx, qy+i*86, ln, F_SER_I, 62, (236,232,217), anchor="mm")
        # continue button
        bw=300; bh=92
        ui.rrect(qx-bw/2, qy+260, qx+bw/2, qy+260+bh, 8, outline=(255,255,255), ow=2, oalpha=70)
        ui.text(qx, qy+260+bh/2, "CONTINUE  →", F_MONO, 26, FG, anchor="mm", tracking=6)
    else:
        ptop=cfg.get("panel_top", H-590)
        ui.line(M, ptop, W-M, ptop, (255,255,255), 2, alpha=22)
        res=cfg.get("resource")
        ry=ptop+58
        if res:
            panel_resource(ui, accent, coreColor, res["label"], res["value"], res.get("total"), res["rate"], res["pct"], ry)
        # condense button or upgrades
        uy=ptop+260
        if cfg.get("show_condense"):
            condense_btn(ui, accent, M, W-M, ptop+250, 100)
            upgrade_row(ui, accent, M, W-M, ptop+372, 96,
                        cfg["ups"][0][0], cfg["ups"][0][1], cfg["ups"][0][2], cfg["ups"][0][3], enabled=False)
        else:
            for i,u in enumerate(cfg.get("ups",[])):
                yy=uy+i*112
                upgrade_row(ui, accent, M, W-M, yy, 96, u[0],u[1],u[2],u[3], enabled=u[4] if len(u)>4 else True)

    overlay=ui.finish()
    img=img.convert("RGBA")
    img.alpha_composite(overlay)
    out=img.convert("RGB")
    path=os.path.join(OUT, cfg["file"])
    out.save(path, "PNG")
    print("saved", path, out.size)
    return path

# ---------------------------------------------------------------- configs
WARM_P=[hx("ff4422"),hx("ffaa00"),hx("ffeebb")]
GOLD_P=[hx("ff8800"),hx("ffcc44"),hx("ffeeaa")]
BLUE_P=[hx("1166aa"),hx("44aaee"),hx("aaddff")]
EMBER_P=[hx("ff7a3c"),hx("ffb060"),hx("ffe0b0")]
VIOLET_P=[hx("7a5cff"),hx("a98cff"),hx("d8c8ff")]
COLD_P=[hx("3a4a6a"),hx("5a6a8a"),hx("8a9ab0")]

SCREENS=[
 { # 1 intro hook
  "file":"appstore_01_intro.png","seed":11,
  "accent":hx("ff6644"),"core":hx("ffaa66"),"pcolors":WARM_P,
  "coreR":118,"progress":0.32,"core_cy":1520,"halo":0.22,"stars":440,
  "time":"t = 10⁻¹² s","stage_kicker":"STAGE 01 / 12  ·  QUARK–GLUON PLASMA",
  "entropy":"0","pct_tl":0.02,
  "kicker":"AN IDLE COSMIC JOURNEY","lines":["From the first spark","to the last star"],
  "accent_words":["spark","star"],
  "resource":{"label":"QUARKS","value":"18","total":"40","rate":"+2.5 /s","pct":0.45},
  "ups":[["Gluon Bond","×1","6","+0.5 /s  ·  per level"],
         ["Plasma Pump","×0","30","+1.5 /s  ·  per level",False]],
  "floats":[(CX-150,1380,"+1","n"),(CX+170,1300,"+1","n")],
 },
 { # 2 core loop
  "file":"appstore_02_tap.png","seed":23,
  "accent":hx("ffb84d"),"core":hx("ffdd88"),"pcolors":GOLD_P,
  "coreR":150,"progress":0.55,"core_cy":1520,"halo":0.24,"stars":420,
  "time":"t = 3 min","stage_kicker":"STAGE 02 / 12  ·  NUCLEOSYNTHESIS",
  "entropy":"12","pct_tl":0.10,
  "kicker":"ONE TAP AT A TIME","lines":["Forge matter from","raw energy"],
  "accent_words":["energy"],
  "combo":"×1.50",
  "resource":{"label":"NUCLEI","value":"86","total":"120","rate":"+8.0 /s","pct":0.72},
  "ups":[["Fusion Cycle","×3","34","+0.6 /s  ·  per level"],
         ["Helium Forge","×0","200","+8.0 /s  ·  per level",False]],
  "floats":[(CX+40,1300,"CRIT +25","crit"),(CX-190,1430,"+3 ×1.50","n"),(CX+200,1470,"+3","n")],
 },
 { # 3 deep time / condense available
  "file":"appstore_03_deeptime.png","seed":31,
  "accent":hx("5fb4ff"),"core":hx("88ccff"),"pcolors":BLUE_P,
  "coreR":176,"progress":0.92,"core_cy":1500,"halo":0.26,"stars":430,
  "threshold_ring":True,"btn_glow":(CX, H-300),
  "time":"t = 380,000 yr","stage_kicker":"STAGE 03 / 12  ·  RECOMBINATION",
  "entropy":"30","pct_tl":0.22,
  "kicker":"12 EPOCHS · 13.8 BILLION YEARS","lines":["Guide a universe","through deep time"],
  "accent_words":["deep","time"],
  "resource":{"label":"ATOMS","value":"300","total":"300","rate":"+14.0 /s","pct":1.0},
  "show_condense":True,
  "ups":[["Recombiner Array","×2","612","+14.0 /s  ·  per level",False]],
  "panel_top":H-650,
 },
 { # 4 encounters
  "file":"appstore_04_encounters.png","seed":47,
  "accent":hx("ff8c5a"),"core":hx("ffc196"),"pcolors":EMBER_P,
  "coreR":140,"progress":0.5,"core_cy":1560,"halo":0.2,"stars":410,
  "time":"t = 100 Myr","stage_kicker":"STAGE 04 / 12  ·  FIRST STARS",
  "entropy":"48","pct_tl":0.30,
  "kicker":"COSMIC ENCOUNTERS","lines":["Catch rogue masses","adrift in the void"],
  "accent_words":["rogue","masses"],
  "rogue":{"x":CX+300,"y":1250,"r":46,"color":hx("ffcc66"),"glow":hx("ffee99")},
  "encounter":"Stellar Fragment","enc_pos":(CX,1010),
  "indicator":(W-110, 1700, 0.5),
  "floats":[(CX+300,1150,"+120 · STELLAR FRAGMENT","collision")],
  "resource":{"label":"STARLIGHT","value":"210","total":"600","rate":"+22 /s","pct":0.35},
  "ups":[["Stellar Nursery","×4","180","+3.0 /s  ·  per level"],
         ["Supernova Seed","×1","540","+18 /s  ·  per level",False]],
 },
 { # 5 condense / ascend (prestige)
  "file":"appstore_05_ascend.png","seed":59,
  "accent":hx("9b7bff"),"core":hx("c9b6ff"),"pcolors":VIOLET_P,
  "bg_top":(12,8,26),"bg_bot":(3,2,8),
  "coreR":110,"progress":0.85,"core_cy":1520,"halo":0.3,"stars":460,
  "waves":[(360,0.55),(560,0.32),(760,0.16)],
  "time":"t = 1.0 Byr","stage_kicker":"CONDENSE  ·  SINGULARITY",
  "entropy":"142","pct_tl":0.42,
  "kicker":"CONDENSE · ASCEND","lines":["Collapse an era","to ignite the next"],
  "accent_words":["ignite"],
  "panel_top":H-600,
  "resource":{"label":"ENTROPY BANKED","value":"142","total":None,"rate":"×2.4 yield","pct":0.62},
  "ups":[["Entropic Lens","×2","⧈ 40","permanent +12% gather"],
         ["Vacuum Seed","×0","⧈ 120","start each run with auto",False]],
  "floats":[(CX,1230,"+58 ENTROPY","collision")],
 },
 { # 6 endings / heat death
  "file":"appstore_06_endings.png","seed":71,
  "accent":hx("8fa6c8"),"core":hx("70809e"),"pcolors":COLD_P,
  "bg_top":(6,7,12),"bg_bot":(1,1,3),
  "coreR":70,"progress":0.18,"core_cy":1180,"halo":0.12,"stars":300,"spread":0.7,"npart":40,
  "vig":0.34,
  "time":"t = 10¹⁰⁰ yr","stage_kicker":"STAGE 12 / 12  ·  HEAT DEATH",
  "entropy":"∞","entropy_unit":False,"pct_tl":1.0,
  "kicker":"MULTIPLE ENDINGS","lines":["Decide how it","all ends"],
  "accent_words":["ends"],
  "ending":True,"quote_y":1660,"end_time":"t = 10¹⁰⁰ yr",
  "quote":["The last black hole evaporates.","What remains is silence — and time."],
 },
]

if __name__=="__main__":
    for c in SCREENS:
        render(c)
    print("done")
