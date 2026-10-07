#!/usr/bin/env python3
"""Reel V2 (Clara): zooms suaves, legendas cinéticas, destaques animados.

  plan   : gera o SRT editável (blocos de 2-5 palavras) a partir das âncoras de
           tempo das frases + distribuição por sílabas dentro de cada frase.
  render : lê o SRT (editável) -> ASS estilizado -> MP4 final (ffmpeg + libass).

Marca correta: "Zuno Propect" (sem "s"). Nenhum áudio é alterado além do volume.
Somente ffmpeg + Python (PIL só para medir texto). Nada é publicado.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_reel import (W, H, GREEN, DARK_GREEN, OFF_WHITE, FONT, ass_color,  # noqa: E402
                        ts_ass, ts_srt, read_srt, write_srt, pill, probe_duration)
from PIL import ImageFont  # noqa: E402

BRAND = "Zuno Propect"
END_CARD_SECONDS = 1.4
CAP_Y = 1400                 # centro das legendas (safe zone: acima de ~1580)
FS_NORMAL, FS_KEY = 56, 64
FONT_FILE = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FONT_SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
K_LIBASS = 0.826             # largura libass = fs * 0.826 (Inter: ascent+descent = 1.21 em)

# Frases: (início, fim, [blocos]); cada bloco é texto com **palavra-chave** em verde.
# Âncoras vêm das pausas e fricativas reais do áudio (3,03-3,24 / 3,89-4,14 / 5,60 / 8,05).
PHRASES = [
    (0.14, 2.02, ["Se sua agência", "ainda depende", "só de **INDICAÇÃO**"]),
    (2.02, 3.00, ["para conseguir clientes,"]),
    (3.24, 3.88, ["presta atenção."]),
    (4.14, 5.55, ["O problema não é", "falta de mercado."]),
    (5.62, 6.95, ["É não ter um", "**PROCESSO PREVISÍVEL**"]),
    (6.95, 8.05, ["para encontrar", "**NOVAS OPORTUNIDADES**"]),
    (8.08, 9.15, ["É exatamente nisso que"]),
    (9.15, 9.94, ["o **ZUNO PROPECT** entra."]),
]

# (início da transição, duração, zoom, âncora x). Transições caem nas pausas da fala.
ZOOM_KEYS = [
    (0.00, 0.00, 1.00, 0.50),
    (1.95, 0.30, 1.07, 0.50),   # "para conseguir clientes"
    (3.95, 0.30, 1.00, 0.50),   # pausa -> volta ao normal
    (5.50, 0.30, 1.09, 0.47),   # "processo previsível" + leve reenquadramento
    (6.90, 0.30, 1.03, 0.50),
    (8.00, 0.30, 1.00, 0.50),
    (9.10, 0.55, 1.10, 0.50),   # marca
]
ANCHOR_Y = 0.38              # mantém o rosto no terço superior ao dar zoom


# ------------------------------------------------------------------ plan

def syl(text):
    plain = re.sub(r"[*<>]|font[^>]*", "", text).lower()
    return max(1, len(re.findall(r"[aeiouáàâãéêíóôõúü]+", plain)))


def plan(out_srt):
    cues = []
    for a, b, blocks in PHRASES:
        w = [syl(x) for x in blocks]
        tot, t = sum(w), a
        for blk, wi in zip(blocks, w):
            d = (b - a) * wi / tot
            cues.append((t, t + d, blk))
            t += d
    # bloco só some quando o próximo entra, exceto nas pausas reais da fala
    out = []
    for i, (a, b, txt) in enumerate(cues):
        out.append((a, min(b + 0.04, cues[i + 1][0]) if i + 1 < len(cues) else b, txt))
    srt = [(a, b, re.sub(r"\*\*(.+?)\*\*", rf'<font color="{GREEN}">\1</font>', t)) for a, b, t in out]
    write_srt(srt, out_srt)
    print(f"SRT: {out_srt} ({len(srt)} blocos)")


# ---------------------------------------------------------------- layout

def tw(text, size, semi=False):
    f = ImageFont.truetype(FONT_SEMI if semi else FONT_FILE, int(size * K_LIBASS * 100))
    return f.getlength(text) / 100


def segments(text):
    """'só de <font>INDICAÇÃO</font>' -> [('só de ', False), ('INDICAÇÃO', True)]"""
    segs, pos = [], 0
    for m in re.finditer(r'<font color="#[0-9A-Fa-f]{6}">(.*?)</font>', text):
        if m.start() > pos:
            segs.append((text[pos:m.start()], False))
        segs.append((m.group(1), True))
        pos = m.end()
    if pos < len(text):
        segs.append((text[pos:], False))
    return [(re.sub(r"<[^>]+>", "", s), k) for s, k in segs]


def ass_line(segs):
    parts = []
    for s, key in segs:
        if key:
            parts.append("{\\1c" + ass_color(GREEN)[2:] + "&\\fs%d\\t(0,130,\\fscx116\\fscy116)\\t(130,300,\\fscx100\\fscy100)}%s" % (FS_KEY, s))
            parts.append("{\\1c&HFFFFFF&\\fs%d}" % FS_NORMAL)
        else:
            parts.append(s)
    return "{\\fs%d}" % FS_NORMAL + "".join(parts)


def rect(x, y, w, h):
    return f"m {x} {y} l {x+w} {y} l {x+w} {y+h} l {x} {y+h}"


def shape(t0, t1, x, y, drawing, extra="", layer=4, color=GREEN):
    return (f"Dialogue: {layer},{ts_ass(t0)},{ts_ass(t1)},Shape,,0,0,0,,"
            f"{{\\an7\\pos({x:.0f},{y:.0f})\\1c{ass_color(color)[2:]}&\\bord0\\shad0{extra}\\p1}}{drawing}{{\\p0}}")


def effects(a, b, segs):
    """Elementos gráficos minimalistas ligados à palavra-chave do bloco."""
    out = []
    key = next(((s, i) for i, (s, k) in enumerate(segs) if k), None)
    if not key:
        return out
    kw = key[0]
    pre = "".join(s for s, k in segs[:key[1]])
    full = tw("".join(s for s, _ in segs if True), FS_NORMAL)  # aproximação base
    w_pre = tw(pre, FS_NORMAL)
    w_kw = tw(kw, FS_KEY) * 1.0
    w_rest = sum(tw(s, FS_NORMAL) for s, k in segs[key[1] + 1:])
    total = w_pre + w_kw + w_rest
    left = W / 2 - total / 2 + w_pre
    right = left + w_kw
    y_base = CAP_Y + FS_KEY * 0.52
    low = kw.lower()
    t0 = a + 0.10
    if low == "indicação":
        out.append(shape(t0, b, left, y_base + 6, rect(0, 0, w_kw, 8),
                         "\\fscx0\\t(0,260,\\fscx100)\\fad(0,120)"))
    elif low == "processo previsível":
        pad = 22
        out.append(
            f"Dialogue: 4,{ts_ass(t0)},{ts_ass(b)},Shape,,0,0,0,,"
            f"{{\\an7\\pos({left - pad:.0f},{CAP_Y - FS_KEY * 0.62:.0f})\\1a&HFF&\\3c{ass_color(GREEN)[2:]}&\\bord4\\shad0\\fscx0\\fscy100"
            f"\\t(0,280,\\fscx100)\\fad(0,120)\\p1}}{pill(0, 0, w_kw + 2 * pad, FS_KEY * 1.24, 14)}{{\\p0}}")
    elif low == "novas oportunidades":
        out.append(shape(t0, b, left, y_base + 6, rect(0, 0, w_kw, 8), "\\fscx0\\t(0,260,\\fscx100)\\fad(0,120)"))
        ax, ay = right - 46, CAP_Y - FS_KEY * 0.62 - 70   # seta para cima/direita
        arrow = "m 0 34 l 28 0 l 56 34 l 40 34 l 40 62 l 16 62 l 16 34"
        out.append(shape(t0 + 0.05, b, ax, ay, arrow, "\\fscy0\\t(0,220,\\fscy112)\\t(220,380,\\fscy100)\\fad(0,120)", layer=4))
    return out


# ------------------------------------------------------------------- ASS

def build_ass(cues, speech_end, out_ass):
    white = ass_color("#FFFFFF")
    hdr = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{FONT} ExtraBold,{FS_NORMAL},{white},{white},{ass_color(DARK_GREEN)},{ass_color('#000000', 0x80)},0,0,0,0,100,100,0,0,1,5,3,5,60,60,0,1
Style: Tag,{FONT} SemiBold,30,{white},{white},{ass_color(DARK_GREEN)},{ass_color('#000000', 0xFF)},0,0,0,0,100,100,4,0,1,0,0,5,0,0,0,1
Style: Hook,{FONT} Bold,50,{white},{white},{ass_color(DARK_GREEN)},{ass_color('#000000', 0xFF)},0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Shape,{FONT},10,{white},{white},{white},{white},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: EndBrand,{FONT} Display Bold,104,{white},{white},{white},{white},0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: EndSub,{FONT} Medium,42,{ass_color(OFF_WHITE)},{white},{white},{white},0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1
Style: EndCta,{FONT} SemiBold,38,{ass_color(GREEN)},{white},{white},{white},0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    s0, s1 = 0.25, speech_end

    # Selo da marca (discreto, canto superior esquerdo)
    bx, by, bw, bh = 64, 210, 306, 64
    ev.append(shape(s0, s1, 0, 0, pill(bx, by, bw, bh, 32), "\\fad(300,200)\\1a&H26&", layer=1, color=DARK_GREEN))
    ev.append(shape(s0, s1, bx + 26, by + 25, pill(0, 0, 14, 14, 7), "\\fad(300,200)", layer=2))
    ev.append(f"Dialogue: 2,{ts_ass(s0)},{ts_ass(s1)},Tag,,0,0,0,,{{\\an4\\pos({bx + 56},{by + bh // 2})\\fad(300,200)}}ZUNO PROPECT")

    # Hook visual (rápido; sai antes de competir com a legenda de "indicação")
    h0, h1 = 0.20, 1.75
    hw = tw("Depender só de indicação?", 50, semi=True) + 84
    hx, hy, hh = W / 2 - hw / 2, 1180, 92
    ev.append(shape(h0, h1, 0, 0, pill(hx, hy, hw, hh, 42), "\\fad(120,160)\\1a&H20&", layer=3, color=DARK_GREEN))
    ev.append(f"Dialogue: 4,{ts_ass(h0)},{ts_ass(h1)},Hook,,0,0,0,,{{\\an5\\pos({W // 2},{hy + hh // 2})"
              f"\\fad(120,160)\\fscx92\\fscy92\\t(0,140,\\fscx100\\fscy100)}}Depender só de "
              f"{{\\1c{ass_color(GREEN)[2:]}&}}indicação{{\\1c&HFFFFFF&}}?")

    # Legendas cinéticas + destaques
    for a, b, text in cues:
        segs = segments(text)
        ev.append(
            f"Dialogue: 5,{ts_ass(a)},{ts_ass(b)},Caption,,0,0,0,,"
            f"{{\\an5\\move({W // 2},{CAP_Y + 26},{W // 2},{CAP_Y},0,110)\\fad(60,50)\\fscx88\\fscy88\\t(0,110,\\fscx100\\fscy100)}}"
            f"{ass_line(segs)}")
        ev += effects(a, b, segs)
        if any(s.lower() == "zuno propect" for s, k in segs if k):
            # chip discreto da marca acima da legenda
            cw = tw("ZUNO PROPECT", 30, semi=True) + 4 * 11 + 96
            cx, cy = W / 2 - cw / 2, 1262
            ev.append(shape(a, speech_end + 0.1, 0, 0, pill(cx, cy, cw, 60, 30),
                            f"\\fad(140,0)\\move(0,18,0,0,0,140)\\1a&H1A&", layer=3, color=DARK_GREEN))
            ev.append(shape(a, speech_end + 0.1, cx + 24, cy + 23, pill(0, 0, 14, 14, 7), "\\fad(140,0)\\move(0,18,0,0,0,140)", layer=4))
            ev.append(f"Dialogue: 4,{ts_ass(a)},{ts_ass(speech_end + 0.1)},Tag,,0,0,0,,"
                      f"{{\\an4\\pos({cx + 50:.0f},{cy + 30})\\fad(140,0)\\move({cx + 50:.0f},{cy + 48},{cx + 50:.0f},{cy + 30},0,140)}}ZUNO PROPECT")

    # Cartão final
    e0, e1 = speech_end + 0.05, speech_end + END_CARD_SECONDS
    ev.append(shape(e0, e1, W // 2 - 48, 850, pill(0, 0, 96, 10, 5), "\\fad(250,0)", layer=6))
    ev.append(f"Dialogue: 6,{ts_ass(e0)},{ts_ass(e1)},EndBrand,,0,0,0,,{{\\an5\\pos({W // 2},960)\\fad(250,0)}}{BRAND}")
    ev.append(f"Dialogue: 6,{ts_ass(e0)},{ts_ass(e1)},EndSub,,0,0,0,,{{\\an5\\pos({W // 2},1060)\\fad(350,0)}}Prospecção B2B com IA")
    ev.append(f"Dialogue: 6,{ts_ass(e0)},{ts_ass(e1)},EndCta,,0,0,0,,{{\\an5\\pos({W // 2},1170)\\fad(450,0)}}Encontre novas oportunidades.")
    Path(out_ass).write_text(hdr + "\n".join(ev) + "\n", encoding="utf-8")


# ------------------------------------------------------------------ zoom

def sm(t0, d):
    s = f"clip((t-{t0})/{d},0,1)"
    return f"({s}*{s}*(3-2*{s}))"


def curve(idx):
    expr, prev = f"{ZOOM_KEYS[0][idx]}", ZOOM_KEYS[0][idx]
    for t0, d, z, ax in ZOOM_KEYS[1:]:
        v = z if idx == 2 else ax
        if abs(v - prev) > 1e-9:
            expr += f"+({v - prev:.4f})*{sm(t0, d)}"
        prev = v
    return expr


def render(video, srt, out_mp4, preview_at=None, workdir=None):
    cues = read_srt(srt)
    dur = probe_duration(video)
    ass = Path(out_mp4).with_suffix(".ass")
    build_ass(cues, dur, ass)
    end = dur + END_CARD_SECONDS
    Z, AX = curve(2), curve(3)
    g = DARK_GREEN.lstrip("#")
    graph = (
        f"[0:v]scale=w='2*trunc(({W}*({Z}))/2)':h='2*trunc(({H}*({Z}))/2)':eval=frame:flags=lanczos,"
        f"crop={W}:{H}:x='({AX})*(iw-{W})':y='{ANCHOR_Y}*(ih-{H})',setsar=1,format=yuv420p,"
        f"tpad=stop_mode=clone:stop_duration={END_CARD_SECONDS},split[base][blur];"
        f"[blur]gblur=sigma=28,drawbox=c=0x{g}@0.72:t=fill,format=yuva420p,"
        f"fade=t=in:st={dur:.3f}:d=0.30:alpha=1[card];"
        f"[base][card]overlay=enable='gte(t,{dur:.3f})',"
        f"ass={ass}:fontsdir=/usr/share/fonts/opentype/inter[v]"
    )
    agraph = (
        f";[0:a]afade=t=out:st={dur - 0.06:.3f}:d=0.06,loudnorm=I=-14:TP=-1.5:LRA=11,"
        f"aresample=48000,apad,atrim=0:{end:.3f}[a]"
    )
    script = Path(out_mp4).with_suffix(".filtergraph.txt")
    script.write_text(graph if preview_at is not None else graph + agraph)
    if preview_at is not None:
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-filter_complex_script", str(script),
               "-map", "[v]", "-ss", str(preview_at), "-frames:v", "1", str(out_mp4)]
    else:
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-filter_complex_script", str(script),
               "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
               "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
               "-movflags", "+faststart", "-t", f"{end:.3f}", str(out_mp4)]
    try:
        subprocess.run(cmd, check=True)
    finally:
        script.unlink(missing_ok=True)
    print(f"ok: {out_mp4}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("plan"); a.add_argument("out_srt")
    r = sub.add_parser("render")
    r.add_argument("video"); r.add_argument("srt"); r.add_argument("out")
    r.add_argument("--preview-at", type=float)
    args = p.parse_args()
    if args.cmd == "plan":
        plan(args.out_srt)
    else:
        render(args.video, args.srt, args.out, args.preview_at)


if __name__ == "__main__":
    sys.exit(main())
