#!/usr/bin/env python3
"""Monta um Reel vertical (9:16) com legendas embutidas no padrão visual Zuno Prospect.

Fluxo:
  1. (opcional) `auto-time`  : texto puro (uma legenda por linha) -> SRT temporizado
                               pelas regiões de voz do áudio.
  2. `render`                : SRT editável -> ASS estilizado -> MP4 final.

As palavras-chave ficam marcadas no SRT com <font color="#22D29E">...</font>,
o que mantém o arquivo editável em CapCut, Premiere, DaVinci etc.

Somente ffmpeg + Python stdlib. Nada é publicado.
"""
import argparse
import array
import re
import subprocess
import sys
from pathlib import Path

W, H = 1080, 1920
GREEN = "#22D29E"          # --primary do app: hsl(162 72% 48%)
DARK_GREEN = "#062B20"     # verde escuro da marca
OFF_WHITE = "#F5F3EE"
END_CARD_SECONDS = 1.4
FONT = "Inter"


# ---------------------------------------------------------------- utilidades

def ass_color(hex_rgb, alpha=0):
    r, g, b = hex_rgb[1:3], hex_rgb[3:5], hex_rgb[5:7]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


def ts_srt(t):
    ms = round(t * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def ts_ass(t):
    cs = round(t * 100)
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02}:{s:02}.{cs:02}"


def parse_ts(s):
    h, m, rest = s.strip().split(":")
    sec, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000


def probe_duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path)])
    return float(out)


def read_srt(path):
    cues = []
    for block in re.split(r"\n\s*\n", Path(path).read_text(encoding="utf-8").strip()):
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        start, end = (parse_ts(x) for x in lines[1].split("-->"))
        cues.append((start, end, "\n".join(lines[2:])))
    return cues


# ------------------------------------------------------------ auto-timing

def voiced_regions(video, frame=0.02, thresh_db=-38.0, min_gap=0.12):
    """Regiões com voz, a partir do envelope RMS do áudio (16 kHz mono)."""
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(video), "-ac", "1", "-ar", "16000",
        "-f", "s16le", "-"])
    pcm = array.array("h", raw)
    n = int(16000 * frame)
    flags = []
    for i in range(0, len(pcm) - n, n):
        chunk = pcm[i:i + n]
        rms = (sum(x * x for x in chunk) / n) ** 0.5
        db = 20 * __import__("math").log10(rms / 32768 + 1e-9)
        flags.append(db > thresh_db)
    regions, start = [], None
    for i, on in enumerate(flags + [False]):
        t = i * frame
        if on and start is None:
            start = t
        elif not on and start is not None:
            if regions and start - regions[-1][1] < min_gap:
                regions[-1] = (regions[-1][0], t)
            else:
                regions.append((start, t))
            start = None
    return [r for r in regions if r[1] - r[0] > 0.08]


def syllables(text):
    plain = re.sub(r"<[^>]+>", "", text).lower()
    return max(1, len(re.findall(r"[aeiouáàâãéêíóôõúü]+", plain)))


def auto_time(video, script_path, out_srt):
    lines = [l.strip() for l in Path(script_path).read_text(encoding="utf-8").splitlines() if l.strip()]
    regions = voiced_regions(video)
    total_voice = sum(b - a for a, b in regions)
    weights = [syllables(l) for l in lines]
    per_unit = total_voice / sum(weights)

    # Caminha pelo "tempo de voz" e converte de volta para tempo real.
    def voice_to_real(v):
        for a, b in regions:
            if v <= b - a:
                return a + v
            v -= b - a
        return regions[-1][1]

    cues, acc = [], 0.0
    for line, w in zip(lines, weights):
        start = voice_to_real(acc + 1e-6)
        acc += w * per_unit
        end = voice_to_real(acc)
        cues.append((start, end, line))
    # Legendas encostadas: sem piscar entre blocos.
    for i in range(len(cues) - 1):
        cues[i] = (cues[i][0], cues[i + 1][0], cues[i][2])
    write_srt(cues, out_srt)
    print(f"voz detectada: {[(round(a, 2), round(b, 2)) for a, b in regions]}")
    print(f"SRT gerado: {out_srt}")


def write_srt(cues, path):
    out = []
    for i, (a, b, text) in enumerate(cues, 1):
        out += [str(i), f"{ts_srt(a)} --> {ts_srt(b)}", text, ""]
    Path(path).write_text("\n".join(out), encoding="utf-8")


# ------------------------------------------------------------------ ASS

def srt_text_to_ass(text):
    """<font color="#xxxxxx">palavra</font> -> override de cor ASS."""
    def repl(m):
        return "{\\c" + ass_color(m.group(1))[2:] + "&}" + m.group(2) + "{\\c" + ass_color("#FFFFFF")[2:] + "&}"
    text = re.sub(r'<font color="(#[0-9A-Fa-f]{6})">(.*?)</font>', repl, text)
    return re.sub(r"<[^>]+>", "", text).replace("\n", "\\N")


def pill(x, y, w, h, r):
    """Retângulo de cantos arredondados em desenho ASS (\\p1)."""
    k = 0.55 * r
    return (f"m {x+r} {y} l {x+w-r} {y} b {x+w-r+k} {y} {x+w} {y+r-k} {x+w} {y+r} "
            f"l {x+w} {y+h-r} b {x+w} {y+h-r+k} {x+w-r+k} {y+h} {x+w-r} {y+h} "
            f"l {x+r} {y+h} b {x+r-k} {y+h} {x} {y+h-r+k} {x} {y+h-r} "
            f"l {x} {y+r} b {x} {y+r-k} {x+r-k} {y} {x+r} {y}")


def build_ass(cues, speech_end, title, out_ass):
    white = ass_color("#FFFFFF")
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{FONT} ExtraBold,56,{white},{white},{ass_color(DARK_GREEN)},{ass_color('#000000', 0x90)},0,0,0,0,100,100,0,0,1,5,3,5,60,60,0,1
Style: Tag,{FONT} SemiBold,30,{white},{white},{ass_color(DARK_GREEN)},{ass_color('#000000', 0xFF)},0,0,0,0,100,100,4,0,1,0,0,4,0,0,0,1
Style: Title,{FONT} Display ExtraBold,58,{white},{white},{ass_color(DARK_GREEN)},{ass_color('#000000', 0x90)},0,0,0,0,100,100,0,0,1,4,3,5,60,60,0,1
Style: Shape,{FONT},10,{white},{white},{white},{white},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: EndBrand,{FONT} Display Bold,104,{white},{white},{white},{white},0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: EndSub,{FONT} Medium,42,{ass_color(OFF_WHITE)},{white},{white},{white},0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1
Style: EndCta,{FONT} SemiBold,32,{ass_color(DARK_GREEN)},{white},{white},{white},0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    t0, t1 = ts_ass(0.25), ts_ass(speech_end)

    # Selo da marca (topo, fora da área de UI do Instagram).
    tag_x, tag_y, tag_w, tag_h = 64, 210, 330, 64
    ev.append(f"Dialogue: 1,{t0},{t1},Shape,,0,0,0,,{{\\an7\\pos(0,0)\\fad(300,200)\\1c{ass_color(DARK_GREEN)[2:]}&\\1a&H26&\\bord0\\shad0\\p1}}{pill(tag_x, tag_y, tag_w, tag_h, 32)}{{\\p0}}")
    ev.append(f"Dialogue: 2,{t0},{t1},Shape,,0,0,0,,{{\\an7\\pos(0,0)\\fad(300,200)\\1c{ass_color(GREEN)[2:]}&\\bord0\\shad0\\p1}}{pill(tag_x + 26, tag_y + 25, 14, 14, 7)}{{\\p0}}")
    ev.append(f"Dialogue: 2,{t0},{t1},Tag,,0,0,0,,{{\\an4\\pos({tag_x + 56},{tag_y + tag_h // 2})\\fad(300,200)}}ZUNO PROSPECT")

    # Título de abertura (opcional), acima do rosto não: logo abaixo do selo.
    if title:
        a, b, text = title
        ev.append(f"Dialogue: 3,{ts_ass(a)},{ts_ass(b)},Title,,0,0,0,,{{\\an7\\pos({tag_x},{tag_y + tag_h + 26})\\q2\\fad(250,250)}}{srt_text_to_ass(text)}")

    # Legendas: bloco curto, centralizado, com leve "pop" de entrada.
    for a, b, text in cues:
        ev.append(
            f"Dialogue: 5,{ts_ass(a)},{ts_ass(b)},Caption,,0,0,0,,"
            f"{{\\an5\\pos({W // 2},1400)\\fad(70,0)\\fscx90\\fscy90\\t(0,110,\\fscx100\\fscy100)}}"
            f"{srt_text_to_ass(text)}")

    # Cartão final sobre o último quadro desfocado.
    e0, e1 = ts_ass(speech_end + 0.05), ts_ass(speech_end + END_CARD_SECONDS)
    ev.append(f"Dialogue: 6,{e0},{e1},Shape,,0,0,0,,{{\\an7\\pos(0,0)\\fad(250,0)\\1c{ass_color(GREEN)[2:]}&\\bord0\\shad0\\p1}}{pill(W // 2 - 48, 850, 96, 10, 5)}{{\\p0}}")
    ev.append(f"Dialogue: 6,{e0},{e1},EndBrand,,0,0,0,,{{\\an5\\pos({W // 2},960)\\fad(250,0)}}Zuno Prospect")
    ev.append(f"Dialogue: 6,{e0},{e1},EndSub,,0,0,0,,{{\\an5\\pos({W // 2},1060)\\fad(350,0)}}Prospecção B2B com IA")
    ev.append(f"Dialogue: 6,{e0},{e1},Shape,,0,0,0,,{{\\an7\\pos(0,0)\\fad(400,0)\\1c{ass_color(GREEN)[2:]}&\\bord0\\shad0\\p1}}{pill(W // 2 - 220, 1150, 440, 72, 36)}{{\\p0}}")
    ev.append(f"Dialogue: 7,{e0},{e1},EndCta,,0,0,0,,{{\\an5\\pos({W // 2},1186)\\fad(400,0)}}Conheça o Zuno Prospect")

    Path(out_ass).write_text(header + "\n".join(ev) + "\n", encoding="utf-8")


# --------------------------------------------------------------- render

def render(video, srt, out_mp4, title=None, preview_at=None):
    cues = read_srt(srt)
    dur = probe_duration(video)
    ass = Path(out_mp4).with_suffix(".ass")
    build_ass(cues, dur, title, ass)
    end = dur + END_CARD_SECONDS
    green = DARK_GREEN.lstrip("#")
    vf = (
        f"[0:v]scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p,"
        f"tpad=stop_mode=clone:stop_duration={END_CARD_SECONDS},split[base][blur];"
        f"[blur]gblur=sigma=28,drawbox=c=0x{green}@0.72:t=fill,format=yuva420p,"
        f"fade=t=in:st={dur:.3f}:d=0.30:alpha=1[card];"
        f"[base][card]overlay=enable='gte(t,{dur:.3f})',"
        f"ass={ass}:fontsdir=/usr/share/fonts/opentype/inter[v]"
    )
    af = (f"[0:a]afade=t=out:st={dur - 0.06:.3f}:d=0.06,"
          f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,apad,atrim=0:{end:.3f}[a]")
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video),
           "-filter_complex", vf + ";" + af, "-map", "[v]", "-map", "[a]"]
    if preview_at is not None:
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video),
               "-filter_complex", vf, "-map", "[v]", "-ss", str(preview_at),
               "-frames:v", "1", str(out_mp4)]
    else:
        cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", "-t", f"{end:.3f}", str(out_mp4)]
    subprocess.run(cmd, check=True)
    print(f"ok: {out_mp4}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("auto-time")
    a.add_argument("video"); a.add_argument("script"); a.add_argument("out_srt")
    r = sub.add_parser("render")
    r.add_argument("video"); r.add_argument("srt"); r.add_argument("out")
    r.add_argument("--title", help="título de abertura: 'inicio|fim|texto'")
    r.add_argument("--preview-at", type=float, help="gera só um PNG nesse instante")
    args = p.parse_args()
    if args.cmd == "auto-time":
        auto_time(args.video, args.script, args.out_srt)
    else:
        title = None
        if args.title:
            a_, b_, t_ = args.title.split("|", 2)
            title = (float(a_), float(b_), t_)
        render(args.video, args.srt, args.out, title, args.preview_at)


if __name__ == "__main__":
    sys.exit(main())
