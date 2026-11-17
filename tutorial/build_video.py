#!/usr/bin/env python3
"""CALENDAR. — video tutorial builder."""
import json, subprocess, sys, os

TUT = "/Users/marouaneakrich/Desktop/projects-eiden/eiden-calander/tutorial"
FR = f"{TUT}/frames"
AU = f"{TUT}/audio"
OUT = f"{TUT}/_segments"
os.makedirs(OUT, exist_ok=True)

FPS = 30
W, H = 1440, 900
F_BOLD = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
F_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
F_ITALIC = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"

CANVAS = "0xF5F5F7"
OBSIDIAN = "0x1D1D1F"
ELECTRIC = "0x0066CC"
MUTED = "0x86868B"
EDGE = "0xE5E5EA"

segs = json.load(open(f"{TUT}/segments.json", encoding="utf-8"))

def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print("FFMPEG FAIL:\n", r.stderr[-2000:])
        sys.exit(1)

def cap_pill(text_file, tag):
    """lower-third caption pill (two lines, max)"""
    return f"drawtext=textfile={text_file}:fontfile={F_BOLD}:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=14:x=48:y=H-92"

def wordmark(x="w-tw-40", y="34", size=17, color="0xFFFFFF@0.92"):
    return f"drawtext=text='CALENDAR.':fontfile={F_BOLD}:fontsize={size}:fontcolor={color}:x={x}:y={y}"

def stepno(tag_txt, x=44, y=34, size=15, color="0xFFFFFF@0.92"):
    return None  # chapter number lives in caption instead

# ---------- intro card ----------
intro_txt = f"{TUT}/_intro.txt"
open(intro_txt, "w").write("CALENDAR.")
intro_sub = f"{TUT}/_intro_sub.txt"
open(intro_sub, "w").write("Architecture for Time.  ·  Eiden Group — an internal tour")
intro_sub2 = f"{TUT}/_intro_sub2.txt"
open(intro_sub2, "w").write("Booking rooms. Running formations. Keeping the schedule honest.")

# ---------- title/intro ----------
intro_dur = 5
intro_frames = intro_dur * FPS
run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c={CANVAS}:s={W}x{H}:r={FPS}:d={intro_dur}",
    "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={intro_dur}",
    "-filter_complex",
    (
        f"[0:v]format=rgb24,"
        f"drawbox=x=0:y=0:w={W}:h=8:color={ELECTRIC}:t=fill,"
        f"drawtext=textfile={intro_txt}:fontfile={F_BOLD}:fontsize=150:fontcolor={OBSIDIAN}:x=118:y=h/2-172,"
        f"drawbox=x=122:y=h/2-28:w=240:h=10:color={ELECTRIC}:t=fill,"
        f"drawtext=text='Architecture for Time.':fontfile={F_REG}:fontsize=46:fontcolor={OBSIDIAN}:x=122:y=h/2+30,"
        f"drawtext=text='EIDEN GROUP · INTERNAL TOUR':fontfile={F_REG}:fontsize=19:fontcolor={MUTED}:x=122:y=h/2+96,"
        f"drawtext=text='calendar.eiden-group.com':fontfile={F_REG}:fontsize=19:fontcolor={MUTED}:x=122:y=h-54,"
        "fade=t=in:st=0:d=0.6,fade=t=out:st=4.4:d=0.6[v]"
    ),
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    f"{OUT}/00-intro.mp4",
])

# ---------- segments ----------
seg_list = []
for idx, seg in enumerate(segs):
    n = int(seg["id"])
    dur = seg["dur"] + 0.6  # pad tail
    total_frames = int(dur * FPS) + 1
    cap_file = f"{TUT}/_cap_{seg['id']}.txt"
    open(cap_file, "w").write(seg["caption"])
    frame = seg['frame'] if seg['frame'].startswith("/") else f"{TUT}/{seg['frame']}"
    out = f"{OUT}/{seg['id']}-seg.mp4"
    # gentle ken burns: start 1.08 -> 1.0 over the segment
    bg = (
        f"scale=2760:1725:force_original_aspect_ratio=increase,"
        f"crop=2760:1725,"
        f"zoompan=z='1.08-0.08*min(on/{max(total_frames-1,1)},1)'"
        f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={W}x{H}:fps={FPS}[bg]"
    )
    overlay = (
        f"[bg]"
        f"drawtext=textfile={cap_file}:fontfile={F_BOLD}:fontsize=21:fontcolor=white:box=1:boxcolor=black@0.58:boxborderw=13:x=44:y=H-78,"
        f"drawtext=text='CALENDAR.':fontfile={F_BOLD}:fontsize=17:fontcolor=0xFFFFFF@0.85:x=w-tw-36:y=34,"
        f"drawtext=text='{seg['id']} / {len(segs)}':fontfile={F_BOLD}:fontsize=14:fontcolor=0xFFFFFF@0.7:x=36:y=34,"
        f"fade=t=in:st=0:d=0.35,fade=t=out:st={dur-0.35:.2f}:d=0.35[v]"
    )
    run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", frame,
        "-i", f"{TUT}/{seg['audio']}",
        "-filter_complex", f"{bg};{overlay}",
        "-map", "[v]", "-map", "1:a",
        "-frames:v", str(total_frames),
        "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
        "-shortest", "-t", str(dur),
        out,
    ])
    seg_list.append(out)
    print(f"segment {seg['id']} done ({dur:.1f}s)")

# ---------- outro card ----------
outro_title = f"{TUT}/_outro.txt"
open(outro_title, "w").write("Architecture for Time.")
outro_sub = f"{TUT}/_outro_sub.txt"
open(outro_sub, "w").write("calendar.eiden-group.com   ·   your admin has the keys")
outro_tag = f"{TUT}/_outro_tag.txt"
open(outro_tag, "w").write("CALENDAR.")
outro_dur = 6
run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c={OBSIDIAN}:s={W}x{H}:r={FPS}:d={outro_dur}",
    "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={outro_dur}",
    "-filter_complex",
    (
        f"[0:v]format=rgb24,"
        f"drawtext=textfile={outro_tag}:fontfile={F_BOLD}:fontsize=110:fontcolor=white:x=(w-tw)/2:y=h/2-140,"
        f"drawtext=text='.':fontfile={F_BOLD}:fontsize=110:fontcolor={ELECTRIC}:x=(w+tw)/2-90:y=h/2-140,"
        f"drawtext=textfile={outro_title}:fontfile={F_BOLD}:fontsize=44:fontcolor=white:x=(w-tw)/2:y=h/2-6,"
        f"drawtext=textfile={outro_sub}:fontfile={F_REG}:fontsize=20:fontcolor=0xA9A9AE:x=(w-tw)/2:y=h/2+62,"
        "fade=t=in:st=0:d=0.6,fade=t=out:st=5.4:d=0.6[v]"
    ),
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    f"{OUT}/99-outro.mp4",
])
seg_list.append(f"{OUT}/99-outro.mp4")

# ---------- concat ----------
cl = f"{OUT}/concat.txt"
with open(cl, "w") as f:
    f.write("ffconcat version 1.0\n\n")
    for p in [f"{OUT}/00-intro.mp4", *seg_list]:
        f.write(f"file '{p}'\n")

run([
    "ffmpeg", "-y",
    "-f", "concat", "-safe", "0", "-i", cl,
    "-c", "copy",
    "/Users/marouaneakrich/Desktop/projects-eiden/eiden-calander/CALENDAR-tutorial.mp4",
])
print("DONE — CALENDAR-tutorial.mp4")
