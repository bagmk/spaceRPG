#!/usr/bin/env python3
"""
App Store screenshot #7 — in-game Cosmic Shop (Boosts + Permanent Upgrades).
Recreates the real shop modal at App Store sizes with a clean 9:41 status bar,
matching appstore_01..06. Output: appstore_07_shop.png (opaque RGB).
Size via argv[1]: iphone69=1290x2796 (default), iphone65=1284x2778.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import math, random, os, sys

PRESETS = {"iphone69": (1290, 2796), "iphone65": (1284, 2778)}
_P = sys.argv[1] if len(sys.argv) > 1 else "iphone69"
if _P not in PRESETS: raise SystemExit(f"unknown preset {_P!r}: {list(PRESETS)}")
W, H = PRESETS[_P]
SS = 2
OUT = os.path.dirname(os.path.abspath(__file__))
FP = "/usr/share/fonts/truetype/dejavu/"
F_MONO=FP+"DejaVuSansMono.ttf"; F_MONO_B=FP+"DejaVuSansMono-Bold.ttf"
F_SANS_B=FP+"DejaVuSans-Bold.ttf"

_fc={}
def font(p,s):
    k=(p,int(s))
    if k not in _fc: _fc[k]=ImageFont.truetype(p,int(s))
    return _fc[k]
def hx(h):
    h=h.lstrip('#'); return (int(h[0:2],16),int(h[2:4],16),int(h[4:6],16))
def f01(c): return np.array([c[0]/255,c[1]/255,c[2]/255],dtype=np.float32)

def new_scene(top,bot):
    y=np.linspace(0,1,H,dtype=np.float32)[:,None]
    col=f01(top)[None,:]*(1-y)+f01(bot)[None,:]*y
    return np.repeat(col[:,None,:],W,axis=1).astype(np.float32)
def add_radial(sc,cx,cy,r,color,falloff=2.0,strength=1.0):
    if r<=0: return
    x0=max(0,int(cx-r));x1=min(W,int(cx+r)+1);y0=max(0,int(cy-r));y1=min(H,int(cy+r)+1)
    if x1<=x0 or y1<=y0: return
    xs=np.arange(x0,x1,dtype=np.float32)[None,:];ys=np.arange(y0,y1,dtype=np.float32)[:,None]
    d=np.sqrt((xs-cx)**2+(ys-cy)**2)/r;m=np.clip(1-d,0,1)**falloff
    sc[y0:y1,x0:x1,:]+=m[...,None]*(f01(color)*strength)[None,None,:]
def starfield(sc,n,seed):
    rnd=random.Random(seed)
    for _ in range(n):
        x=rnd.uniform(0,W);y=rnd.uniform(0,H);a=rnd.uniform(0.06,0.32)
        xi,yi=int(x),int(y)
        if 0<=xi<W and 0<=yi<H: sc[yi,xi,:]=np.clip(sc[yi,xi,:]+a,0,3)
def scene_to_img(sc): return Image.fromarray((np.clip(sc,0,1)**(1/1.04)*255).astype(np.uint8),"RGB")

class UI:
    def __init__(self):
        self.img=Image.new("RGBA",(W*SS,H*SS),(0,0,0,0)); self.d=ImageDraw.Draw(self.img)
    def f(self,p,s): return font(p,s*SS)
    def text(self,x,y,s,p,size,fill,anchor="la",tracking=0.0,alpha=255):
        fnt=self.f(p,size); col=(fill[0],fill[1],fill[2],alpha)
        if tracking==0:
            self.d.text((x*SS,y*SS),s,font=fnt,fill=col,anchor=anchor); return self.d.textlength(s,font=fnt)/SS
        adv=[self.d.textlength(c,font=fnt) for c in s]; total=sum(adv)+tracking*SS*(len(s)-1)
        cx=x*SS-(total/2 if anchor[0]=="m" else total if anchor[0]=="r" else 0)
        ay=anchor[1] if len(anchor)>1 else "a"
        for c,a in zip(s,adv): self.d.text((cx,y*SS),c,font=fnt,fill=col,anchor="l"+ay); cx+=a+tracking*SS
        return total/SS
    def tlen(self,s,p,size): return self.d.textlength(s,font=self.f(p,size))/SS
    def rrect(self,x0,y0,x1,y1,r,fill=None,outline=None,ow=1,falpha=255,oalpha=255):
        fc=(fill[0],fill[1],fill[2],falpha) if fill else None
        oc=(outline[0],outline[1],outline[2],oalpha) if outline else None
        self.d.rounded_rectangle((x0*SS,y0*SS,x1*SS,y1*SS),radius=r*SS,fill=fc,outline=oc,width=int(ow*SS))
    def line(self,x0,y0,x1,y1,fill,w,alpha=255):
        self.d.line((x0*SS,y0*SS,x1*SS,y1*SS),fill=(fill[0],fill[1],fill[2],alpha),width=int(w*SS))
    def rect(self,x0,y0,x1,y1,fill,alpha=255):
        self.d.rectangle((x0*SS,y0*SS,x1*SS,y1*SS),fill=(fill[0],fill[1],fill[2],alpha))
    def poly(self,pts,outline=None,ow=2,fill=None,oalpha=255,falpha=255):
        p=[(x*SS,y*SS) for x,y in pts]
        self.d.polygon(p,outline=(outline[0],outline[1],outline[2],oalpha) if outline else None,
                       fill=(fill[0],fill[1],fill[2],falpha) if fill else None,width=int(ow*SS))
    def finish(self): return self.img.resize((W,H),Image.LANCZOS)

MUTED=(120,114,104); FG=(236,232,217); WHITE=(245,245,250); DIM=(150,144,134)
M=72; CX=W//2
RED=hx("ff5a3c")

def status_bar(ui):
    ui.text(M,58,"9:41",F_SANS_B,33,WHITE,anchor="lm",alpha=240)
    bx=W-M
    ui.rrect(bx-46,48,bx-6,74,6,outline=WHITE,ow=2,oalpha=185)
    ui.rrect(bx-43,51,bx-15,71,3,fill=WHITE,falpha=215)
    ui.rect(bx-4,56,bx-1,66,WHITE,alpha=185)
    ui.text(bx-66,61,"5G",F_SANS_B,26,WHITE,anchor="rm",alpha=205)
    for i in range(4):
        h=8+i*5; x=bx-150+i*12
        ui.rect(x,70-h,x+7,70,WHITE,alpha=205)

def hexbadge(ui,cx,cy,r,label,accent):
    pts=[(cx+math.cos(math.pi/6+i*math.pi/3)*r, cy+math.sin(math.pi/6+i*math.pi/3)*r) for i in range(6)]
    ui.poly(pts,outline=accent,ow=3,fill=accent,oalpha=235,falpha=22)
    ui.text(cx,cy+1,label,F_MONO_B,26,accent,anchor="mm")

def resource_row(ui,y,label,rate,rate_col,bar_pct,bar_col,val,exp,unit):
    ui.text(M+34,y,label,F_MONO,26,DIM,anchor="lm",tracking=3)
    ui.text(M+34+ui.tlen(label,F_MONO,26)+24,y,rate,F_MONO,21,rate_col,anchor="lm")
    bx0=M+250; bx1=W-430
    ui.line(bx0,y,bx1,y,(255,255,255),9,alpha=26)
    ui.line(bx0,y,bx0+(bx1-bx0)*bar_pct,y,bar_col,9,alpha=235)
    ui.text(W-300,y,val,F_MONO,27,FG,anchor="rm")
    ui.text(W-150,y,exp,F_MONO,24,DIM,anchor="rm")
    ui.text(W-M-12,y,unit,F_MONO,24,DIM,anchor="rm")

def card(ui,y0,h,accent,letter,name,desc,price,x0,x1):
    # body
    ui.rrect(x0,y0,x1,y0+h,20,fill=(255,255,255),outline=accent,ow=2,falpha=7,oalpha=70)
    ui.rrect(x0,y0+10,x0+7,y0+h-10,4,fill=accent,falpha=150)  # left accent edge
    cy=y0+h/2
    # icon
    isz=130; ix0=x0+30; 
    ui.rrect(ix0,cy-isz/2,ix0+isz,cy+isz/2,22,fill=accent,outline=accent,ow=2,falpha=34,oalpha=150)
    ui.text(ix0+isz/2,cy,letter,F_SANS_B,58,accent,anchor="mm")
    tx=ix0+isz+40
    ui.text(tx,cy-30,name,F_SANS_B,43,FG,anchor="lm")
    ui.text(tx,cy+34,desc,F_MONO,28,MUTED,anchor="lm")
    # buy button
    bw=212; bh=132; bx1=x1-26; bx0=bx1-bw; by0=cy-bh/2
    ui.rrect(bx0,by0,bx1,by0+bh,16,fill=accent,outline=accent,ow=2,falpha=16,oalpha=165)
    ui.text((bx0+bx1)/2,cy-20,price,F_SANS_B,44,accent,anchor="mm")
    ui.text((bx0+bx1)/2,cy+34,"BUY",F_MONO_B,27,accent,anchor="mm",tracking=3,alpha=210)

def render():
    sc=new_scene((30,13,11),(4,2,5))
    add_radial(sc,CX,250,W*0.95,hx("8a2a14"),falloff=2.4,strength=0.5)
    add_radial(sc,CX,360,W*0.5,hx("ff6a30"),falloff=2.2,strength=0.18)
    starfield(sc,170,5)
    add_radial(sc,CX,H-40,520,hx("ff7a3c"),falloff=2.2,strength=0.22)  # faint core peeking at bottom
    img=scene_to_img(sc)
    ui=UI()
    status_bar(ui)
    # stage header
    hexbadge(ui,M+38,200,40,"03",RED)
    ui.text(M+100,200,"Quark-Gluon Plasma",F_SANS_B,46,WHITE,anchor="lm")
    # entropy right cluster: ENTROPY  62.79 MB
    ev=" 62.79"; eu=" MB"
    wlab=ui.tlen("ENTROPY",F_MONO,25); wv=ui.tlen(ev,F_MONO,29); wu=ui.tlen(eu,F_MONO,24)
    xr=W-M
    ui.text(xr,200,eu,F_MONO,24,RED,anchor="rm")
    ui.text(xr-wu,200,ev,F_MONO,29,FG,anchor="rm")
    ui.text(xr-wu-wv,200,"ENTROPY",F_MONO,25,DIM,anchor="rm",tracking=2)
    # resource panel
    rp0,rp1=288,470
    ui.rrect(M-8,rp0,W-M+8,rp1,22,fill=(255,255,255),outline=(255,255,255),ow=2,falpha=8,oalpha=26)
    resource_row(ui,rp0+62,"MATTER","7.4/s",hx("ff9f40"),0.27,hx("ff7a3c"),"1.0649/4","E+5","Q")
    resource_row(ui,rp1-58,"TIME","",hx("66ccff"),1.0,hx("4db4ff"),"1.0000/1","E-6","S")
    # shop modal panel
    PL,PR=26,W-26; PT=628
    ui.rrect(PL,PT,PR,H+60,34,fill=(14,14,20),outline=(255,255,255),falpha=243,oalpha=22,ow=2)
    ui.text(PL+46,700,"COSMIC SHOP",F_MONO_B,30,hx("ffcf6b"),anchor="lm",tracking=4)
    ui.text(PL+44,772,"Boosts",F_SANS_B,66,WHITE,anchor="lm")
    # X close
    xb=PR-46; ui.rrect(xb-66,742-34,xb,742+34,16,fill=(255,255,255),outline=(255,255,255),falpha=12,oalpha=40,ow=2)
    ui.text(xb-33,742,"X",F_SANS_B,34,DIM,anchor="mm")
    ui.line(PL+44,838,PR-44,838,(255,255,255),2,alpha=30)
    # sections
    cx0,cx1=PL+40,PR-40
    ui.text(cx0,902,"BOOSTS",F_MONO_B,27,DIM,anchor="lm",tracking=5)
    ch=196; gap=26; top=946
    boosts=[
        (hx("4df0cc"),"T","Temporal Drive","Time x3 for 1 hour","$0.99"),
        (hx("ffd766"),"M","Matter Surge","Matter x3 for 1 hour","$0.99"),
        (hx("9cecff"),"T+","Deep Time Engine","Time x3 for 6 hours","$4.99"),
        (hx("ff9f40"),"M+","Matter Storm","Matter x3 for 6 hours","$4.99"),
    ]
    for i,(ac,lt,nm,ds,pr) in enumerate(boosts):
        card(ui,top+i*(ch+gap),ch,ac,lt,nm,ds,pr,cx0,cx1)
    py=top+4*(ch+gap)+24
    ui.text(cx0,py,"PERMANENT UPGRADES",F_MONO_B,27,DIM,anchor="lm",tracking=5)
    card(ui,py+44,ch,hx("c6a4ff"),"S","Deep Space Storage","Offline reward storage up to 8 hours","$2.99",cx0,cx1)
    # footer
    ui.line(PL+44,H-210,PR-44,H-210,(255,255,255),2,alpha=20)
    ui.text(PL+46,H-150,"Total spent: $0.00 (test mode)",F_MONO,28,MUTED,anchor="lm")
    overlay=ui.finish()
    img=img.convert("RGBA"); img.alpha_composite(overlay)
    out=img.convert("RGB"); path=os.path.join(OUT,"appstore_07_shop.png")
    out.save(path,"PNG"); print("saved",path,out.size); return path

if __name__=="__main__":
    render()
