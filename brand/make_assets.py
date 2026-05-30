#!/usr/bin/env python3
"""Generate ExitRadar brand/social assets, faithful to the site (exitradar.fun).

Outputs (in ./out):
  logos:   exitradar-logo-green.png  (green mark, transparent — visible on light OR dark)
           exitradar-logo-white.png  (white mark, transparent — for dark backgrounds)
           exitradar-logo-dark.png   (mark on solid brand-black square)
           exitradar-avatar.png      (rounded dark badge — X profile picture)
  banners: exitradar-banner-1-hero.png       (centered hero)
           exitradar-banner-2-feed.png        (product: live realized-exits feed)
           exitradar-banner-3-statement.png   (bold statement)
           exitradar-banner-4-features.png    (three pillars)
  header:  exitradar-header.png      (1500x500 X header)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
OUT = HERE
os.makedirs(OUT, exist_ok=True)
HANKEN = os.path.join(FONTS, "HankenGrotesk-var.ttf")
PLEX = {w: os.path.join(FONTS, f"IBMPlexMono-{w}.ttf") for w in ("Regular", "Medium", "SemiBold")}

# palette (from landing-page CSS)
BG      = (8, 9, 10, 255)        # #08090a
BG2     = (12, 13, 15, 255)      # #0c0d0f
PANEL   = (14, 15, 17, 255)
WHITE   = (250, 250, 250, 255)   # #fafafa
GREEN   = (95, 211, 154, 255)    # #5fd39a
GREEN_D = (63, 143, 105, 255)    # #3f8f69
MUTED   = (161, 161, 170, 255)   # #a1a1aa
MUTED_D = (113, 113, 122, 255)   # #71717a
LINE    = (38, 40, 45, 255)
SEP     = (75, 77, 82, 255)
GREEN_LINE  = (46, 88, 68, 255)    # solid dim green border (banners are opaque)
GREEN_LINE2 = (64, 124, 92, 255)   # solid green CTA border
HOT_BG      = (19, 30, 26, 255)     # subtle green-tinted highlight row
ROW_SEP     = (28, 30, 34, 255)

S = 2
def sc(v): return int(round(v * S))

class Canvas:
    def __init__(self, w, h, bg=(0, 0, 0, 0)):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w * S, h * S), bg)
        self.d = ImageDraw.Draw(self.img)
    def hanken(self, size, weight="SemiBold"):
        f = ImageFont.truetype(HANKEN, sc(size))
        try: f.set_variation_by_name(weight)
        except Exception: pass
        return f
    def plex(self, size, weight="Regular"):
        return ImageFont.truetype(PLEX[weight], sc(size))
    def measure(self, text, font, track=0.0):
        if not text: return 0
        return sum(font.getlength(c) for c in text) + sc(track) * (len(text) - 1)
    def tracked(self, x, y, text, font, fill, track=0.0, anchor="la"):
        cx, ty, t = sc(x), sc(y), sc(track)
        for c in text:
            self.d.text((cx, ty), c, font=font, fill=fill, anchor=anchor)
            cx += font.getlength(c) + t
    def tracked_center(self, cx, y, text, font, fill, track=0.0):
        x = cx - (self.measure(text, font, track) / S) / 2
        self.tracked(x, y, text, font, fill, track)
    def two_tone_center(self, cx, y, segs, font, track=0.0):
        total = sum(self.measure(t, font, track) for t, _ in segs) / S + track * (len(segs) - 1)
        x = cx - total / 2
        for t, col in segs:
            self.tracked(x, y, t, font, col, track)
            x += self.measure(t, font, track) / S + track
    def text(self, x, y, s, font, fill, anchor="la"):
        self.d.text((sc(x), sc(y)), s, font=font, fill=fill, anchor=anchor)
    def reticle(self, cx, cy, R, stroke=WHITE, sw=None, dot=GREEN, dot_r=None):
        sw = sw if sw is not None else R * 0.155
        dot_r = dot_r if dot_r is not None else R * 0.43
        cxs, cys, Rs, sws = sc(cx), sc(cy), sc(R), max(1, sc(sw))
        self.d.ellipse([cxs - Rs, cys - Rs, cxs + Rs, cys + Rs], outline=stroke, width=sws)
        ti, to, cap = R * 1.06, R * 1.5, sws / 2
        for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            x1, y1, x2, y2 = cx + dx * ti, cy + dy * ti, cx + dx * to, cy + dy * to
            self.d.line([sc(x1), sc(y1), sc(x2), sc(y2)], fill=stroke, width=sws)
            for px, py in [(x1, y1), (x2, y2)]:
                self.d.ellipse([sc(px) - cap, sc(py) - cap, sc(px) + cap, sc(py) + cap], fill=stroke)
        drs = sc(dot_r)
        self.d.ellipse([cxs - drs, cys - drs, cxs + drs, cys + drs], fill=dot)
    def rrect(self, box, radius, fill=None, outline=None, width=1.0):
        self.d.rounded_rectangle([sc(box[0]), sc(box[1]), sc(box[2]), sc(box[3])],
                                 radius=sc(radius), fill=fill, outline=outline, width=max(1, sc(width)))
    def line(self, x1, y1, x2, y2, fill, width=1.0):
        self.d.line([sc(x1), sc(y1), sc(x2), sc(y2)], fill=fill, width=max(1, sc(width)))
    def finish(self, name):
        p = os.path.join(OUT, name)
        self.img.resize((self.w, self.h), Image.LANCZOS).save(p)
        return p

def glow(cv, cx, cy, rw, rh, color, alpha, blur):
    layer = Image.new("RGBA", cv.img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([sc(cx - rw), sc(cy - rh), sc(cx + rw), sc(cy + rh)], fill=color[:3] + (alpha,))
    cv.img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(sc(blur))))

def rings(cv, cx, cy, radii, color, alpha, sw, blur=1.5):
    layer = Image.new("RGBA", cv.img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for r in radii:
        ld.ellipse([sc(cx - r), sc(cy - r), sc(cx + r), sc(cy + r)], outline=color[:3] + (alpha,), width=max(1, sc(sw)))
    cv.img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(sc(blur))))

def lockup(cv, x, y, mark_r, word_size, color=WHITE):
    cv.reticle(x + mark_r, y, mark_r, stroke=color)
    f = cv.hanken(word_size, "SemiBold")
    tx = x + mark_r * 2 + word_size * 0.42
    cv.text(tx, y, "ExitRadar", f, color, anchor="lm")
    return tx + f.getlength("ExitRadar") / S

def pill(cv, x, y, h, text, font, fg, border=None, fillbg=None, dot=None, pad=18, gap=10):
    w = pad * 2 + font.getlength(text) / S + ((h * 0.2 + gap) if dot else 0)
    cv.rrect([x, y, x + w, y + h], radius=h / 2, fill=fillbg, outline=border, width=1.4)
    cx, cy = x + pad, y + h / 2
    if dot:
        r = h * 0.10
        cv.d.ellipse([sc(cx), sc(cy - r), sc(cx + 2 * r), sc(cy + r)], fill=dot)
        cx += 2 * r + gap
    cv.text(cx, cy, text, font, fg, anchor="lm")
    return w

def footer(cv, W, y, center=True):
    ff = cv.plex(17, "Medium")
    parts = [("exitradar.fun", WHITE), ("  ·  ", SEP), ("@exitradar_fun", MUTED),
             ("  ·  ", SEP), ("CA: ", MUTED_D), ("coming soon", GREEN)]
    totw = sum(ff.getlength(t) / S for t, _ in parts)
    x = (W / 2 - totw / 2) if center else 96
    for t, col in parts:
        cv.text(x, y, t, ff, col); x += ff.getlength(t) / S

# ---------------- LOGOS ----------------
def logo_green():
    cv = Canvas(1024, 1024)
    cv.reticle(512, 512, 300, stroke=GREEN, dot=GREEN)
    return cv.finish("exitradar-logo-green.png")

def logo_white():
    cv = Canvas(1024, 1024)
    cv.reticle(512, 512, 300, stroke=WHITE, dot=GREEN)
    return cv.finish("exitradar-logo-white.png")

def logo_dark():
    cv = Canvas(1024, 1024, BG)
    glow(cv, 512, 470, 320, 270, (255, 255, 255), 12, 150)
    rings(cv, 512, 512, [250, 350], GREEN, 20, 4, blur=2)
    cv.reticle(512, 512, 250, stroke=WHITE, dot=GREEN, sw=250 * 0.135)
    return cv.finish("exitradar-logo-dark.png")

def avatar():
    cv = Canvas(1024, 1024)
    cv.rrect([0, 0, 1024, 1024], radius=224, fill=BG)
    glow(cv, 512, 350, 300, 240, (255, 255, 255), 12, 140)
    rings(cv, 512, 512, [250, 340], GREEN, 22, 5, blur=2)
    cv.reticle(512, 512, 250, stroke=WHITE, dot=GREEN, sw=250 * 0.135)
    cv.rrect([8, 8, 1016, 1016], radius=218, outline=(255, 255, 255, 22), width=2)
    return cv.finish("exitradar-avatar.png")

# ---------------- BANNERS (1600x900) ----------------
def banner_hero():
    W, H = 1600, 900
    cv = Canvas(W, H, BG)
    glow(cv, W / 2, -30, 620, 380, (255, 255, 255), 16, 150)
    rings(cv, W / 2, 300, [240, 360, 500, 660], GREEN, 16, 1.4, blur=1.6)
    glow(cv, W / 2, 300, 520, 360, GREEN, 9, 220)
    M = 96
    lockup(cv, M, 78, 17, 31)
    fp = cv.plex(15.5, "Medium")
    w = cv.measure("JOIN THE WAITLIST", fp) / S
    pill(cv, W - M - (w + 44), 60, 38, "JOIN THE WAITLIST", fp, GREEN, border=GREEN_LINE2, pad=20)
    pill(cv, W / 2 - (cv.plex(15, "Medium").getlength("Live on Solana") / S + 58) / 2, 196, 36,
         "Live on Solana", cv.plex(15, "Medium"), MUTED, dot=GREEN, border=(70, 72, 78, 255), pad=18)
    fH = cv.hanken(94, "ExtraBold"); tr = -0.035 * 94
    y1 = 296
    cv.tracked_center(W / 2, y1, "Everyone tracks the buys.", fH, WHITE, tr)
    cv.two_tone_center(W / 2, y1 + 94 * 1.06, [("We track the ", MUTED_D), ("cash-out.", GREEN)], fH, tr)
    fS = cv.hanken(27, "Medium")
    for i, ln in enumerate(["A real-time terminal for realized profit on Solana — watch wallets",
                            "take money off the table the moment it lands on-chain, ranked by dollars."]):
        cv.text(W / 2 - fS.getlength(ln) / S / 2, 296 + 94 * 1.18 + 22 + i * 40, ln, fS, MUTED)
    footer(cv, W, H - 92)
    return cv.finish("exitradar-banner-1-hero.png")

def banner_feed():
    W, H = 1600, 900
    cv = Canvas(W, H, BG)
    glow(cv, 300, -40, 560, 360, (255, 255, 255), 13, 150)
    glow(cv, 1180, 460, 460, 460, GREEN, 7, 240)
    M = 96
    lockup(cv, M, 80, 16, 29)
    pill(cv, M, 168, 30, "REAL-TIME · REALIZED · SOLANA", cv.plex(12.5, "Medium"), GREEN_D,
         border=(70, 72, 78, 255), pad=14, dot=GREEN, gap=9)
    fH = cv.hanken(70, "ExtraBold"); tr = -0.035 * 70
    cv.tracked(M, 236, "We track", fH, WHITE, tr)
    cv.tracked(M, 236 + 70 * 1.02, "the cash-out.", fH, GREEN, tr)
    fS = cv.hanken(24, "Medium")
    for i, ln in enumerate(["Realized profit, the moment it lands", "on-chain — ranked by dollars."]):
        cv.text(M, 420 + i * 34, ln, fS, MUTED)
    fp = cv.plex(14.5, "Medium")
    pill(cv, M, 520, 40, "JOIN THE WAITLIST  →", fp, GREEN, border=GREEN_LINE2, pad=20)
    footer(cv, W, H - 86, center=False)

    # ---- right: live realized-exits panel ----
    px0, py0, px1, py1 = 770, 132, 1504, 792
    cv.rrect([px0, py0, px1, py1], radius=26, fill=PANEL, outline=LINE, width=1.4)
    pad = 34
    hd = cv.plex(15, "SemiBold")
    cv.d.ellipse([sc(px0 + pad), sc(py0 + 40 - 5), sc(px0 + pad + 10), sc(py0 + 40 + 5)], fill=GREEN)
    cv.text(px0 + pad + 20, py0 + 40, "REALIZED EXITS", hd, WHITE, anchor="lm")
    pill(cv, px1 - pad - 86, py0 + 26, 28, "LIVE", cv.plex(11.5, "SemiBold"), GREEN,
         border=GREEN_LINE, dot=GREEN, pad=11, gap=7)
    cv.line(px0 + pad, py0 + 70, px1 - pad, py0 + 70, LINE, 1.2)
    rows = [("1", "$WIF", "7xQ…k29", "+$248,910", True),
            ("2", "$POPCAT", "9zR…m4d", "+$182,400", False),
            ("3", "$BONK", "Ah3…f1c", "+$96,750", False),
            ("4", "$MEW", "Bk8…q7e", "+$61,230", False)]
    top = py0 + 84
    rh = (py1 - 24 - top) / len(rows)
    fr = cv.plex(15, "SemiBold"); fm = cv.plex(13.5, "Regular"); fa = cv.plex(22, "SemiBold")
    fnum = cv.plex(16, "Medium"); ftag = cv.plex(11, "SemiBold")
    for i, (rank, tok, wal, amt, hot) in enumerate(rows):
        ry = top + i * rh
        if hot:
            cv.rrect([px0 + 16, ry + 8, px1 - 16, ry + rh - 8], radius=14, fill=HOT_BG)
            cv.rrect([px0 + 16, ry + 14, px0 + 21, ry + rh - 14], radius=2.5, fill=GREEN)
        cy = ry + rh / 2
        cv.text(px0 + pad, cy, rank, fnum, MUTED_D, anchor="lm")
        cv.text(px0 + pad + 42, cy - 13, tok, fr, WHITE, anchor="lm")
        cv.text(px0 + pad + 42, cy + 15, wal, fm, MUTED_D, anchor="lm")
        cv.text(px1 - pad, cy - 12, amt, fa, GREEN, anchor="rm")
        # OUT tag
        tw = ftag.getlength("OUT") / S
        cv.rrect([px1 - pad - tw - 18, cy + 8, px1 - pad, cy + 30], radius=6,
                 outline=(95, 211, 154, 90), width=1.2)
        cv.text(px1 - pad - 9, cy + 19, "OUT", ftag, GREEN, anchor="mm")
        if i < len(rows) - 1:
            cv.line(px0 + 16, ry + rh, px1 - 16, ry + rh, ROW_SEP, 1)
    return cv.finish("exitradar-banner-2-feed.png")

def banner_statement():
    W, H = 1600, 900
    cv = Canvas(W, H, BG)
    rings(cv, W / 2, 420, [180, 300, 430, 580, 740], GREEN, 16, 1.6, blur=1.8)
    glow(cv, W / 2, 380, 560, 420, GREEN, 9, 240)
    glow(cv, W / 2, -40, 640, 360, (255, 255, 255), 14, 160)
    lockup(cv, W / 2 - 78, 92, 17, 30)
    kf = cv.plex(15, "Medium")
    cv.tracked_center(W / 2, 220, "REAL-TIME REALIZED PROFIT  ·  LIVE ON SOLANA", kf, GREEN_D, 1.2)
    fH = cv.hanken(96, "ExtraBold"); tr = -0.04 * 96
    cv.tracked_center(W / 2, 300, "The smart money", fH, WHITE, tr)
    cv.two_tone_center(W / 2, 300 + 96 * 1.04, [("is ", WHITE), ("cashing out.", GREEN)], fH, tr)
    fS = cv.hanken(28, "Medium")
    ln = "ExitRadar ranks every realized exit by real dollars — the second it lands on-chain."
    cv.text(W / 2 - fS.getlength(ln) / S / 2, 300 + 96 * 1.04 + 96 + 26, ln, fS, MUTED)
    footer(cv, W, H - 96)
    return cv.finish("exitradar-banner-3-statement.png")

def banner_features():
    W, H = 1600, 900
    cv = Canvas(W, H, BG)
    glow(cv, W / 2, -30, 620, 360, (255, 255, 255), 15, 150)
    glow(cv, W / 2, 760, 700, 280, GREEN, 6, 240)
    M = 96
    lockup(cv, M, 80, 17, 31)
    pill(cv, W - M - (cv.plex(15, "Medium").getlength("Live on Solana") / S + 58), 62, 36,
         "Live on Solana", cv.plex(15, "Medium"), MUTED, dot=GREEN, border=(70, 72, 78, 255), pad=18)
    fH = cv.hanken(62, "ExtraBold"); tr = -0.035 * 62
    cv.tracked_center(W / 2, 210, "Everyone tracks the buys.", fH, WHITE, tr)
    cv.two_tone_center(W / 2, 210 + 62 * 1.04, [("We track the ", MUTED_D), ("cash-out.", GREEN)], fH, tr)
    # three feature cards
    cards = [("REALIZED PNL", "Not paper gains. Money that actually", "left the table."),
             ("RANKED BY $ OUT", "Biggest exits first — sorted by the", "dollars taken off."),
             ("REAL-TIME ON-CHAIN", "The instant it settles on Solana,", "it hits your feed.")]
    cw, gap = 410, 36
    total = cw * 3 + gap * 2
    x0 = W / 2 - total / 2
    cy0, ch = 470, 250
    th = cv.plex(16, "SemiBold"); tb = cv.hanken(21, "Medium")
    for i, (title, l1, l2) in enumerate(cards):
        x = x0 + i * (cw + gap)
        cv.rrect([x, cy0, x + cw, cy0 + ch], radius=20, fill=BG2, outline=LINE, width=1.3)
        cv.d.ellipse([sc(x + 34), sc(cy0 + 40), sc(x + 34 + 11), sc(cy0 + 40 + 11)], fill=GREEN)
        cv.text(x + 60, cy0 + 45, title, th, WHITE, anchor="lm")
        cv.line(x + 34, cy0 + 78, x + cw - 34, cy0 + 78, LINE, 1)
        cv.text(x + 34, cy0 + 104, l1, tb, MUTED)
        cv.text(x + 34, cy0 + 134, l2, tb, MUTED)
    footer(cv, W, H - 92)
    return cv.finish("exitradar-banner-4-features.png")

# ---------------- HEADER 1500x500 ----------------
def header():
    W, H = 1500, 500
    cv = Canvas(W, H, BG)
    rings(cv, W * 0.80, H * 0.5, [150, 250, 360, 470], GREEN, 20, 1.5, blur=1.6)
    glow(cv, W * 0.80, H * 0.5, 360, 320, GREEN, 12, 220)
    glow(cv, W * 0.30, -40, 520, 300, (255, 255, 255), 14, 150)
    M = 90
    lockup(cv, M, 150, 24, 44)
    fH = cv.hanken(46, "ExtraBold"); tr = -0.035 * 46
    cv.tracked(M, 210, "Everyone tracks the buys.", fH, WHITE, tr)
    x = M
    for t, col in [("We track the ", MUTED_D), ("cash-out.", GREEN)]:
        cv.tracked(x, 210 + 46 * 1.12, t, fH, col, tr); x += cv.measure(t, fH, tr) / S + tr
    ff = cv.plex(18, "Medium")
    cv.text(M, H - 70, "exitradar.fun", ff, WHITE)
    cv.text(M + ff.getlength("exitradar.fun") / S, H - 70, "   ·   @exitradar_fun", ff, MUTED_D)
    cv.reticle(W * 0.80, H * 0.5, 120, stroke=(255, 255, 255, 60), sw=120 * 0.07)
    cv.reticle(W * 0.80, H * 0.5, 60, stroke=(255, 255, 255, 110), sw=60 * 0.12)
    return cv.finish("exitradar-header.png")

if __name__ == "__main__":
    for fn in (logo_green, logo_white, logo_dark, avatar,
               banner_hero, banner_feed, banner_statement, banner_features, header):
        p = fn()
        print("wrote", os.path.relpath(p, HERE), os.path.getsize(p), "bytes")
