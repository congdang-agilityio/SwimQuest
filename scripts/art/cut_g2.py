#!/usr/bin/env python3
"""Cut the G2 art group (characters, poses, ships, badges, medals) from the two
SwimQuest asset sheets into public/art/mockup/<group>/ with one manifest per group.

Spec: one object per file, no text, transparent background, fixed canvas per kind,
~8% padding, LANCZOS upscale + mild unsharp mask, PNG + WebP (q90).

Usage:
    python3 scripts/art/cut_g2.py [--out public/art/mockup] [--contact DIR] [--only key,key]

Requires numpy, scipy-free OpenCV (opencv-python-headless) and Pillow.
The sheets are read from requirement/assets/reference/ when present, otherwise from
the path given with --sheets (or $SWIMQUEST_SHEETS).

Every source box is listed below in sheet pixel coordinates (x0, y0, x1, y1) on the
1536x1024 sheets. When higher-resolution sheets arrive, scale the boxes and re-run.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

PAD = 0.08

# Canvas sizes (w, h) per kind of object.
CANVAS = {
    'portrait': (256, 256),
    'body': (256, 384),
    'pose': (384, 256),
    'ship': (384, 384),
    'badge': (256, 256),
    'medal': (256, 256),
}

ITEMS = []
CLUSTERS = {}


def item(group, key, sheet, box, kind, vi, en, **opt):
    """box = (x0, y0, x1, y1) on the sheet: the object must lie inside it, labels outside."""
    ITEMS.append(dict(group=group, key=key, sheet=sheet, box=box, kind=kind, alt=dict(vi=vi, en=en), **opt))


def cluster(name, sheet, box, **opt):
    """Objects that overlap on the sheet: keyed together, then split by seeded watershed."""
    CLUSTERS[name] = dict(sheet=sheet, box=box, **opt)


# --------------------------------------------------------------------------- characters
# Sheet A portraits: five overlapping busts; the sheet cuts them at y=235.
# The glow between the heads is enclosed by the characters and is close to skin colour, but
# every character has a light rim outline: a watershed from background seed points placed in
# each glow gap stops at that rim.
_GLOW = [(345, 100), (460, 80), (458, 110), (447, 135), (442, 140), (450, 146), (567, 80), (567, 110), (542, 140),
         (543, 152), (650, 140), (652, 135), (650, 145), (665, 70), (666, 95), (752, 140), (750, 145), (756, 135),
         (763, 70), (763, 110), (778, 134), (782, 130), (865, 80), (870, 110), (852, 145), (850, 155), (855, 130),
         (458, 158), (465, 168), (754, 158), (845, 160), (848, 150)]
cluster('portraits', 'sheet-a', (336, 40, 892, 234), bottom_cut=True, method='ws', fg_auto=False,
        bg=[(x - 2, y - 2, x + 2, y + 2) for x, y in _GLOW])
# The busts overlap below the chin line, so portraits are head-and-shoulders avatars that
# fade out between these sheet rows.
PORTRAIT_FADE = (150, 172)
# Ownership polygons follow the front character's silhouette: each character stands in
# front of the one on its left, except char 1, and char 4's raised arm is in front of char 5.
_B12 = [(444, 40), (444, 140), (452, 152), (462, 166), (470, 182), (487, 200), (497, 215), (499, 236)]
_B23 = [(561, 40), (561, 120), (557, 147), (548, 157), (546, 175), (547, 236)]
_B34 = [(657, 40), (657, 128), (642, 145), (648, 165), (660, 236)]
_B45 = [(764, 40), (764, 132), (790, 138), (792, 236)]


def _between(left, right):
    return left + right[::-1]


# Foreground seeds inside each character (face, neck, shoulders, hands).
PORTRAIT_FG = {
    'portrait-blue-cap': [(380, 70, 430, 125), (400, 128, 425, 148), (350, 160, 440, 176)],
    'portrait-pink-cap': [(490, 75, 545, 135), (515, 138, 535, 150), (500, 160, 540, 176)],
    'portrait-green-cap': [(585, 80, 640, 125), (600, 128, 625, 148), (590, 155, 640, 176)],
    'portrait-yellow-cap': [(690, 80, 752, 135), (700, 138, 725, 150), (765, 142, 785, 160), (680, 160, 750, 176)],
    'portrait-senior': [(785, 80, 840, 128), (805, 130, 832, 145), (865, 138, 880, 160), (800, 160, 845, 176)],
}
PORTRAITS = [
    ('portrait-blue-cap', [(336, 40)] + _B12 + [(336, 236)],
     'Chân dung vận động viên nam đội mũ bơi xanh dương', 'Portrait of a male swimmer in a blue cap'),
    ('portrait-pink-cap', _between(_B12, _B23),
     'Chân dung vận động viên nữ đội mũ bơi hồng', 'Portrait of a female swimmer in a pink cap'),
    ('portrait-green-cap', _between(_B23, _B34),
     'Chân dung vận động viên đội mũ bơi xanh lá', 'Portrait of a swimmer in a green cap'),
    ('portrait-yellow-cap', _between(_B34, _B45),
     'Chân dung vận động viên nữ đội mũ bơi vàng', 'Portrait of a female swimmer in a yellow cap'),
    ('portrait-senior', _B45 + [(890, 236), (890, 40)],
     'Chân dung vận động viên lớn tuổi', 'Portrait of a senior swimmer'),
]
for k, poly, vi, en in PORTRAITS:
    xs = [x for x, _ in poly]
    item('characters', k, 'sheet-a', (min(xs), 40, max(xs), PORTRAIT_FADE[1]), 'portrait', vi, en, cluster='portraits',
         poly=poly, set='portraits', fade_y=PORTRAIT_FADE, fg=PORTRAIT_FG[k])

# Sheet B full-body characters (labels start at y=176).
BODIES = [
    ('swimmer-male-basic', (338, 33, 392, 173), 'Vận động viên nam - cơ bản', 'Male swimmer, basic suit'),
    ('swimmer-male-basic-alt', (392, 33, 448, 173), 'Vận động viên nam - cơ bản (biến thể)', 'Male swimmer, basic suit (variant)'),
    ('swimmer-female-basic', (480, 33, 535, 173), 'Vận động viên nữ - cơ bản', 'Female swimmer, basic suit'),
    ('swimmer-wetsuit', (548, 33, 600, 173), 'Vận động viên mặc wetsuit', 'Swimmer in a wetsuit'),
    ('swimmer-outfit-red', (612, 33, 666, 173), 'Vận động viên đồ bơi đỏ', 'Swimmer in a red swimsuit'),
    ('swimmer-outfit-green', (683, 33, 732, 173), 'Vận động viên đồ bơi hai mảnh', 'Swimmer in a two-piece swimsuit'),
    ('swimmer-outfit-black', (732, 33, 784, 173), 'Vận động viên đồ bơi đen', 'Swimmer in a black swimsuit'),
]
# Limb strokes (sheet-b PNG pixels) for figures whose dark suit is close to the background colour.
BODY_LINES = {
    'swimmer-wetsuit': [[(570, 42), (587, 42)], [(578, 50), (578, 106)], [(560, 78), (555, 105)], [(590, 78), (592, 105)],
                        [(568, 108), (586, 108)], [(566, 110), (561, 156)], [(583, 110), (581, 156)]],
    'swimmer-female-basic': [[(493, 78), (486, 98), (482, 118)], [(518, 78), (522, 98), (525, 116)],
                             [(497, 115), (494, 140), (491, 165)], [(510, 115), (512, 140), (514, 165)],
                             [(500, 60), (505, 110)]],
    'swimmer-outfit-black': [[(745, 80), (770, 80)], [(757, 75), (757, 112)], [(748, 104), (748, 118)], [(766, 104), (766, 118)]],
}
# Glow between and beside the legs (sure background).
BODY_BG = {'swimmer-female-basic': [(500, 140, 503, 160), (476, 130, 482, 165), (527, 130, 532, 165), (493, 100, 495, 110)]}
for k, b, vi, en in BODIES:
    item('characters', k, 'sheet-b', b, 'body', vi, en, set='bodies', align='bottom', lines=BODY_LINES.get(k, ()),
         bg=BODY_BG.get(k, ()), warm_k=0.4 if k == 'swimmer-female-basic' else 1.0)

# --------------------------------------------------------------------------- poses
# Sheet A sprites. The swim rows are joined by water, so they are split as clusters.
cluster('swim-front', 'sheet-a', (282, 252, 476, 318), fade=True)
cluster('swim-side', 'sheet-a', (478, 252, 655, 318), fade=True)
SWIM_A = [
    ('swim-front', [((282, 252, 352, 318), (300, 270, 345, 300)), ((347, 252, 412, 318), (365, 270, 400, 300)),
                    ((405, 252, 476, 318), (425, 270, 465, 300))]),
    ('swim-side', [((478, 252, 540, 318), (495, 268, 535, 300)), ((536, 252, 597, 318), (550, 268, 590, 300)),
                   ((592, 252, 655, 318), (610, 268, 650, 300))]),
]
for name, frames in SWIM_A:
    for i, (b, seed) in enumerate(frames, 1):
        vi = 'Khung bơi trực diện' if name == 'swim-front' else 'Khung bơi nhìn ngang'
        en = 'Swimming frame, front view' if name == 'swim-front' else 'Swimming frame, side view'
        item('poses', f'{name}-{i:02d}', 'sheet-a', b, 'pose', f'{vi} {i}', f'{en} {i}',
             cluster=name, seeds=[seed], set=name)
for i, b in enumerate([(661, 244, 704, 333), (706, 244, 748, 333)], 1):
    item('poses', f'idle-{i:02d}', 'sheet-a', b, 'body', f'Tư thế đứng chờ {i}', f'Idle pose {i}', set='idle', align='bottom')
for i, b in enumerate([(752, 243, 827, 333), (829, 243, 882, 333)], 1):
    item('poses', f'cheer-{i:02d}', 'sheet-a', b, 'body', f'Tư thế cổ vũ {i}', f'Cheer pose {i}', set='cheer', align='bottom')

# Sheet B swim frames: row 2 sits above the four stroke labels (labels start at y=294).
STROKES = [
    ('freestyle-01', (331, 247, 441, 292), 'Bơi sải', 'Freestyle'),
    ('breaststroke-01', (441, 247, 562, 292), 'Bơi ếch', 'Breaststroke'),
    ('backstroke-01', (562, 247, 677, 292), 'Bơi ngửa', 'Backstroke'),
    ('butterfly-01', (677, 247, 790, 292), 'Bơi bướm', 'Butterfly'),
]
for k, b, vi, en in STROKES:
    item('poses', k, 'sheet-b', b, 'pose', vi, en, set='strokes', method='ws')
# Row 1: five unlabelled stroke frames.
for i, b in enumerate([(331, 197, 420, 248), (420, 196, 512, 248), (514, 196, 603, 246), (603, 196, 678, 246),
                       (678, 200, 790, 248)], 1):
    item('poses', f'swim-stroke-{i:02d}', 'sheet-b', b, 'pose', f'Khung bơi {i}', f'Swim stroke frame {i}', set='stroke-cycle',
         method='ws')

# --------------------------------------------------------------------------- ships
# Sheet B ship tiers 1-4: tiers 1-3 touch at the water line.
cluster('ship-tiers', 'sheet-b', (797, 36, 1136, 210),
        bg=[(889, 150, 893, 210), (962, 140, 968, 210), (1046, 150, 1050, 210)])
# The tier ships only touch at the water line, so each owns a vertical strip.
TIERS = [('ship-tier-1', 797, 893), ('ship-tier-2', 893, 968), ('ship-tier-3', 968, 1050), ('ship-tier-4', 1050, 1136)]
for i, (k, x0, x1) in enumerate(TIERS, 1):
    item('ships', k, 'sheet-b', (x0, 36, x1, 210), 'ship', f'Tàu cấp {i}', f'Ship tier {i}', cluster='ship-tiers',
         poly=[(x0, 36), (x1, 36), (x1, 210), (x0, 210)], set='tiers', fill=400)
SMALL = [
    ('ship-tier-1-small', (801, 231, 846, 311), 1), ('ship-tier-1-small-alt', (846, 231, 888, 311), 1),
    ('ship-tier-2-small', (906, 231, 955, 311), 2), ('ship-tier-3-small', (985, 231, 1036, 311), 3),
    ('ship-tier-4-small', (1067, 231, 1118, 311), 4),
]
for k, b, t in SMALL:
    alt = ' (biến thể)' if k.endswith('alt') else ''
    item('ships', k, 'sheet-b', b, 'ship', f'Tàu cấp {t} thu nhỏ{alt}', f'Small ship, tier {t}' + (' (variant)' if alt else ''),
         set='small')
# Sheet A team boats: three overlapping boats on one wave.
cluster('team-boats', 'sheet-a', (880, 50, 1262, 302), fade=True,
        bg=[(x - 2, y - 2, x + 2, y + 2) for x, y in [(1040, 100), (1040, 125), (1032, 150), (1026, 172), (1135, 110),
                                                       (1138, 135), (1135, 195), (1138, 210), (1230, 105), (1215, 105), (1220, 125),
                                                       (1055, 100), (1048, 118), (1040, 140),
                                                       (1234, 130)]])
# Seeds sit fully inside each boat's sails and hull (blue sails are close to the background).
BOATS = [
    ('boat-team-blue', (880, 50, 1025, 302), [(920, 160, 945, 195), (970, 110, 1019, 185), (900, 225, 1000, 250)],
     'Thuyền đội xanh dương', 'Blue team boat'),
    ('boat-team-red', (995, 45, 1140, 302), [(1030, 150, 1055, 200), (1075, 110, 1120, 195), (1020, 235, 1120, 265),
                                              (1082, 61, 1102, 68)],
     'Thuyền đội đỏ', 'Red team boat'),
    ('boat-team-purple', (1118, 50, 1262, 302), [(1140, 160, 1160, 200), (1180, 120, 1220, 195), (1145, 225, 1230, 245)],
     'Thuyền đội tím', 'Purple team boat'),
]
# The red boat's left rope sits in a band of glow: drop everything left of its jib's edge.
BOAT_CUT = {'boat-team-red': [(990, 45), (1074, 45), (1064, 92), (1018, 205), (990, 205)]}
# Extra split seeds on the mast, flag and bow wave of each boat.
BOAT_SPLIT = {
    'boat-team-blue': [(959, 75, 961, 200), (965, 63, 980, 68), (905, 258, 960, 270)],
    'boat-team-red': [(1078, 60, 1080, 200), (1088, 60, 1100, 66), (1030, 280, 1100, 290)],
    'boat-team-purple': [(1167, 60, 1169, 200), (1176, 64, 1190, 69), (1190, 255, 1235, 265)],
}
for k, b, seeds, vi, en in BOATS:
    item('ships', k, 'sheet-a', b, 'ship', vi, en, cluster='team-boats', seeds=seeds + BOAT_SPLIT[k], fg=seeds,
         set='team-boats', fill=400, min_frac=0.003, cut_poly=BOAT_CUT.get(k))

# --------------------------------------------------------------------------- badges
SHIELDS = [
    ('badge-shield-wave', (1235, 40, 1310, 127), 'Huy hiệu khiên sóng nước', 'Shield badge with waves'),
    ('badge-shield-swimmer', (1310, 40, 1380, 127), 'Huy hiệu khiên vận động viên', 'Shield badge with a swimmer'),
    ('badge-shield-island', (1381, 40, 1453, 127), 'Huy hiệu khiên hòn đảo', 'Shield badge with an island'),
    ('badge-shield-lighthouse', (1453, 40, 1522, 127), 'Huy hiệu khiên hải đăng', 'Shield badge with a lighthouse'),
    ('badge-coin-star', (1238, 127, 1311, 199), 'Huy hiệu ngôi sao', 'Star coin badge'),
    ('badge-coin-trophy', (1311, 127, 1382, 199), 'Huy hiệu cúp', 'Trophy coin badge'),
    ('badge-coin-anchor', (1382, 127, 1452, 199), 'Huy hiệu mỏ neo', 'Anchor coin badge'),
    ('badge-coin-crown', (1452, 127, 1522, 199), 'Huy hiệu vương miện', 'Crown coin badge'),
]
for k, b, vi, en in SHIELDS:
    item('badges', k, 'sheet-a', b, 'badge', vi, en, fill='all')
ACH = [
    ('badge-participation', (891, 355, 958, 431), 'Tham gia', 'Participation'),
    ('badge-explorer', (959, 355, 1025, 431), 'Khám phá', 'Explorer'),
    ('badge-conqueror', (1024, 355, 1088, 431), 'Chinh phục', 'Conqueror'),
    ('badge-season', (1088, 355, 1152, 431), 'Mùa giải', 'Season'),
    ('badge-teamwork', (1152, 355, 1217, 431), 'Đồng đội', 'Teamwork'),
    ('badge-persistence', (1216, 355, 1281, 431), 'Kiên trì', 'Persistence'),
    ('badge-training', (898, 460, 978, 552), 'Tập luyện', 'Training'),
    ('badge-milestone', (987, 460, 1069, 552), 'Cột mốc', 'Milestone'),
    ('badge-beyond-limits', (1078, 460, 1159, 552), 'Vượt giới hạn', 'Beyond limits'),
    ('badge-legend', (1168, 454, 1257, 552), 'Huyền thoại', 'Legend'),
]
for k, b, vi, en in ACH:
    item('badges', k, 'sheet-b', b, 'badge', f'Huy hiệu {vi}', f'{en} badge', fill='all')

# --------------------------------------------------------------------------- medals
for k, b, vi, en in [
    ('medal-bronze', (1268, 198, 1347, 315), 'Huy chương đồng', 'Bronze medal'),
    ('medal-silver', (1350, 198, 1429, 315), 'Huy chương bạc', 'Silver medal'),
    ('medal-gold', (1429, 198, 1508, 315), 'Huy chương vàng', 'Gold medal'),
]:
    item('medals', k, 'sheet-a', b, 'medal', vi, en, fill='all')
# Trophies 2 (left) and 3 (right) sit below trophy 1; ownership polygons follow the gaps.
cluster('trophies', 'sheet-b', (1318, 612, 1532, 750),
        bg=[(x - 1, y - 2, x + 2, y + 2) for x, y in [(1386, 645), (1457, 645), (1333, 694), (1383, 693), (1466, 694),
                                                       (1515, 694)]])
_T12 = [(1368, 612), (1368, 668), (1384, 680), (1394, 694), (1399, 714)]
_T13 = [(1474, 612), (1474, 668), (1462, 676), (1456, 690), (1451, 714)]
TROPHIES = [
    ('trophy-rank-1', _T12 + _T13[::-1], 1),
    ('trophy-rank-2', [(1318, 662)] + _T12[1:] + [(1399, 750), (1318, 750)], 2),
    ('trophy-rank-3', [(1532, 662)] + _T13[1:] + [(1451, 750), (1532, 750)], 3),
]
for k, poly, n in TROPHIES:
    xs = [x for x, _ in poly]; ys = [y for _, y in poly]
    item('medals', k, 'sheet-b', (min(xs), min(ys), max(xs), max(ys)), 'medal', f'Cúp hạng {n}', f'Rank {n} trophy',
         cluster='trophies', poly=poly, set='trophies')


# =========================================================================== processing
# The large sheets are 2576x1717 upscales of the 1536x1024 PNGs (pixel-aligned), so their
# boxes are the PNG boxes times LARGE_SCALE. Every asset is cut from both sources and the
# visibly cleaner result is kept: the large sheet by default, or the PNG where an item says
# use='png' (chosen by comparing both on the contact sheets).
SOURCES = {
    'sheet-a': 'asset-sheet-a.png', 'sheet-b': 'asset-sheet-b.png',
    'sheet-a-large': 'asset-sheet-a-large.jpg', 'sheet-b-large': 'asset-sheet-b-large.jpg',
}
LARGE_SCALE = (2576 / 1536, 1717 / 1024)


def find_sheets(arg):
    cands = []
    if arg:
        cands.append(arg)
    if os.environ.get('SWIMQUEST_SHEETS'):
        cands.append(os.environ['SWIMQUEST_SHEETS'])
    cands.append(os.path.join(ROOT, 'requirement', 'assets', 'reference'))
    # the shared ops folder sits in <repo>/.worktrees/_ops (also reachable from a worktree)
    d = ROOT
    for _ in range(4):
        cands.append(os.path.join(d, '.worktrees', '_ops', 'sheets'))
        d = os.path.dirname(d)
    for d in cands:
        if all(os.path.exists(os.path.join(d, n)) for n in SOURCES.values()):
            return {k: os.path.join(d, n) for k, n in SOURCES.items()}
    sys.exit('asset sheets not found; pass --sheets DIR (looked in: %s)' % ', '.join(cands))


def odd(v):
    v = max(1, int(round(v)))
    return v if v % 2 else v + 1


def scale_box(b, s):
    return (int(round(b[0] * s[0])), int(round(b[1] * s[1])), int(round(b[2] * s[0])), int(round(b[3] * s[1])))


def bg_field(a, k=1.0, sched=((90, 14), (60, 10), (40, 8), (32, 6))):
    """Smooth estimate of the navy gradient + glow behind the objects (normalised convolution,
    coarse to fine so the soft glow is absorbed into the background)."""
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.broadcast_to(np.median(border, 0), a.shape).copy()
    for thr, sig in sched:
        d = np.sqrt(((a - bg) ** 2).sum(2))
        w = cv2.erode((d < thr).astype(np.float32), np.ones((odd(3 * k),) * 2))
        num = cv2.GaussianBlur(a * w[..., None], (0, 0), sig * k)
        den = cv2.GaussianBlur(w, (0, 0), sig * k)[..., None]
        bg = np.where(den > 0.02, num / np.maximum(den, 1e-3), bg)
    return bg


def fill_holes(m, max_area):
    """Fill enclosed holes up to max_area pixels ('all' fills every enclosed hole)."""
    if max_area != 'all' and max_area <= 0:
        return m
    n, lab, st, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), connectivity=4)
    out = m.copy()
    h, w = m.shape
    for i in range(1, n):
        x, y, ww, hh, ar = st[i]
        if x == 0 or y == 0 or x + ww == w or y + hh == h:
            continue
        if max_area == 'all' or ar <= max_area:
            out |= lab == i
    return out


def rect_mask(shape, origin, rects):
    m = np.zeros(shape, bool)
    ox, oy = origin
    for x0, y0, x1, y1 in rects:
        m[max(0, y0 - oy):max(0, y1 - oy), max(0, x0 - ox):max(0, x1 - ox)] = True
    return m


def line_mask(shape, origin, lines, k, width=1.5):
    """Polylines (already in this source's pixels) drawn as sure-foreground strokes."""
    m = np.zeros(shape, np.uint8)
    for pts in lines:
        p = np.array([(x - origin[0], y - origin[1]) for x, y in pts], np.int32)
        cv2.polylines(m, [p], False, 1, max(1, int(round(width * k))))
    return m > 0


def scale_lines(lines, s):
    return [[(int(round(x * s[0])), int(round(y * s[1]))) for x, y in pts] for pts in lines]


def key_mask(a, origin, k, method='gc', thr=30, fg_hints=(), bg_hints=(), keep_bottom=False, warm_k=1.0, fg_lines=(), fg_auto=True):
    """Hard foreground mask. The colour distance to the local background gives sure
    foreground (bright, saturated parts) and sure background (far from anything); a
    watershed (default) or GrabCut decides the rest along the object's own outline.
    fg_hints / bg_hints are rectangles (in this source's pixels) forced to fg / bg."""
    bg = bg_field(a, k)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    m = (d > thr).astype(np.uint8)
    fgh = rect_mask(m.shape, origin, fg_hints) | line_mask(m.shape, origin, fg_lines, k, 3.0)
    bgh = rect_mask(m.shape, origin, bg_hints)
    border = np.zeros(m.shape, bool)
    border[0, :] = border[:, 0] = border[:, -1] = True
    if not keep_bottom:
        border[-1, :] = True
    if method == 'gc':
        gc = np.full(m.shape, cv2.GC_PR_BGD, np.uint8)
        gc[m > 0] = cv2.GC_PR_FGD
        gc[d > thr * 2.5] = cv2.GC_FGD
        gc[cv2.dilate(m, np.ones((odd(15 * k),) * 2, np.uint8)) == 0] = cv2.GC_BGD
        # the glow behind the art is warm (red >= blue) and close to the background field,
        # while navy suits and caps are blue-dominant: the warm part is sure background
        warm = (d < thr * warm_k) & (a[..., 0] >= a[..., 2] - 4)
        gc[warm] = cv2.GC_BGD
        gc[fgh] = cv2.GC_FGD
        gc[bgh | border] = cv2.GC_BGD
        bgd = np.zeros((1, 65)); fgd = np.zeros((1, 65))
        cv2.grabCut(a.astype(np.uint8)[:, :, ::-1].copy(), gc, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
        g = (gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)
    else:
        mk = np.zeros(m.shape, np.int32)
        # small enclosed dark parts (goggle lenses, gaps in a dark suit) are not background
        mf = fill_holes(m > 0, 300 * k * k).astype(np.uint8)
        mk[cv2.dilate(mf, np.ones((odd(5 * k),) * 2, np.uint8)) == 0] = 1
        if fg_auto:
            mk[cv2.erode((d > thr * 2).astype(np.uint8), np.ones((odd(3 * k),) * 2, np.uint8)) > 0] = 2
        mk[fgh] = 2
        mk[bgh | border] = 1
        img = cv2.bilateralFilter(np.clip(a, 0, 255).astype(np.uint8), odd(5 * k), 30, 5 * k)[:, :, ::-1].copy()
        g = cv2.watershed(img, mk) == 2
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((odd(2 * k),) * 2, np.uint8)) > 0
    return g & ~bgh, bg


def keep_components(m, k, min_frac=0.02, min_px=25):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    if n <= 1:
        return m
    big = st[1:, 4].max()
    out = np.zeros_like(m)
    for i in range(1, n):
        if st[i, 4] >= max(min_px * k * k, big * min_frac):
            out |= lab == i
    return out


def split_cluster(A, c, members, s, k):
    """Key the whole cluster, then split it among members with a seeded watershed."""
    x0, y0, x1, y1 = scale_box(c['box'], s)
    p = int(10 * k)
    X0, Y0 = max(0, x0 - p), max(0, y0 - p)
    X1 = min(A.shape[1], x1 + p)
    Y1 = y1 if c.get('bottom_cut') else min(A.shape[0], y1 + p)
    a = A[Y0:Y1, X0:X1]
    sc = lambda rs: [scale_box(r, s) for r in rs]
    hints = sc([h for it in members for h in it.get('fg', ())])
    bgh = sc(list(c.get('bg', ())) + [h for it in members for h in it.get('bg', ())])
    lines = scale_lines([ln for it in members for ln in it.get('lines', ())], s)
    m, bg = key_mask(a, (X0, Y0), k, c.get('method', 'gc'), c.get('thr', 30), hints, bgh,
                     keep_bottom=c.get('bottom_cut', False), fg_lines=lines, fg_auto=c.get('fg_auto', True))
    m &= rect_mask(m.shape, (X0, Y0), [(x0, y0, x1, y1)])
    markers = np.zeros(m.shape, np.int32)
    markers[cv2.dilate(m.astype(np.uint8), np.ones((odd(5 * k),) * 2, np.uint8)) == 0] = 1
    for i, it in enumerate(members, 2):
        if 'seeds' in it:
            markers[rect_mask(m.shape, (X0, Y0), sc(it['seeds'])) & m] = i
    ws = cv2.watershed(np.clip(a, 0, 255).astype(np.uint8)[:, :, ::-1].copy(), markers.copy())
    out = {}
    for i, it in enumerate(members, 2):
        if 'poly' in it:
            own = np.zeros(m.shape, np.uint8)
            pts = np.array([(x * s[0] - X0, y * s[1] - Y0) for x, y in it['poly']], np.int32)
            cv2.fillPoly(own, [pts], 1)
            mi = m & (own > 0)
        else:
            mi = (ws == i) & m & rect_mask(m.shape, (X0, Y0), [scale_box(it['box'], s)])
        out[it['key']] = (a, mi, bg, (X0, Y0), ws, i)
    return out


def finish_alpha(a, m, k, erode=1, fade=None):
    """Hard mask -> soft alpha, with interior colours extended over the edge band so no
    semi-transparent pixel carries background (no navy fringe)."""
    m8 = m.astype(np.uint8)
    e = int(round(erode * k))
    if e:
        m8 = cv2.erode(m8, np.ones((2 * e + 1,) * 2, np.uint8))
    interior = cv2.erode(m8, np.ones((odd(3 * k),) * 2, np.uint8))
    src = np.clip(a, 0, 255).astype(np.float32)
    w = interior.astype(np.float32)
    ext = src.copy()
    done = w > 0
    for sig in (1.0, 2.0, 4.0, 8.0):
        num = cv2.GaussianBlur(src * w[..., None], (0, 0), sig * k)
        den = cv2.GaussianBlur(w, (0, 0), sig * k)[..., None]
        fill = (den[..., 0] > 0.01) & ~done
        ext[fill] = (num / np.maximum(den, 1e-6))[fill]
        done |= fill
    rgb = np.where(interior[..., None] > 0, src, ext).astype(np.uint8)
    alpha = cv2.GaussianBlur(m8.astype(np.float32), (0, 0), 0.8 * k)
    alpha = np.where(m8 > 0, np.maximum(alpha, 0.5), alpha)
    alpha = np.where(interior > 0, 1.0, alpha)
    if fade is not None:
        alpha *= fade
    alpha[alpha < 0.03] = 0
    return rgb, alpha


def cut_fade(ws, label, k, width=6):
    """Alpha ramp where an object was split from a neighbour (not from the background)."""
    other = (ws > 1) & (ws != label)
    if not other.any():
        return None
    dist = cv2.distanceTransform((~other).astype(np.uint8), cv2.DIST_L2, 3)
    return np.clip(dist / (width * k), 0, 1).astype(np.float32)


def cut_item(it, A, src, cache):
    large = src.endswith('-large')
    s = LARGE_SCALE if large else (1.0, 1.0)
    k = s[0]
    fade = None
    if it.get('cluster'):
        cname = it['cluster']
        ck = (cname, src)
        if ck not in cache:
            members = [x for x in ITEMS if x.get('cluster') == cname]
            cache[ck] = split_cluster(A, CLUSTERS[cname], members, s, k)
        a, m, bg, origin, ws, lab = cache[ck][it['key']]
        if CLUSTERS[cname].get('fade'):
            fade = cut_fade(ws, lab, k)
    else:
        x0, y0, x1, y1 = scale_box(it['box'], s)
        p = int(8 * k)
        X0, Y0, X1, Y1 = max(0, x0 - p), max(0, y0 - p), min(A.shape[1], x1 + p), min(A.shape[0], y1 + p)
        a = A[Y0:Y1, X0:X1]
        origin = (X0, Y0)
        sc = lambda rs: [scale_box(r, s) for r in rs]
        m, bg = key_mask(a, origin, k, it.get('method', 'gc'), it.get('thr', 30), sc(it.get('fg', ())), sc(it.get('bg', ())),
                         fg_lines=scale_lines(it.get('lines', ()), s), warm_k=it.get('warm_k', 1.0))
        m &= rect_mask(m.shape, origin, [(x0, y0, x1, y1)])
    if it.get('cut_poly'):
        # area removed from this object only (e.g. a rope wrapped in glow beside a sail)
        cp = np.zeros(m.shape, np.uint8)
        pts = np.array([(x * s[0] - origin[0], y * s[1] - origin[1]) for x, y in it['cut_poly']], np.int32)
        cv2.fillPoly(cp, [pts], 1)
        m = m & (cp == 0)
    if it.get('fade_y'):
        ys = (np.arange(m.shape[0]) + origin[1]) / s[1]
        f0, f1 = it['fade_y']
        ramp = np.clip((f1 - ys) / (f1 - f0), 0, 1).astype(np.float32)[:, None] * np.ones((1, m.shape[1]), np.float32)
        fade = ramp if fade is None else fade * ramp
        m = m & (ramp > 0)
    m = keep_components(m, k, min_frac=it.get('min_frac', 0.02))
    fill = it.get('fill', 40)
    m = fill_holes(m, fill if fill == 'all' else fill * k * k)
    rgb, alpha = finish_alpha(a, m, k, erode=it.get('erode', 1), fade=fade)
    ys, xs = np.nonzero(alpha > 0.03)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.dstack([rgb, (alpha * 255).round().astype(np.uint8)])[by0:by1, bx0:bx1]
    box = [int(origin[0] + bx0), int(origin[1] + by0), int(bx1 - bx0), int(by1 - by0)]
    return Image.fromarray(rgba, 'RGBA'), box


def process(sheets, only=None, both=False):
    """Returns results with the chosen cut in 'img'; with both=True also 'alt_img' (the other source)."""
    cache = {}
    arrs = {}

    def arr(src):
        if src not in arrs:
            arrs[src] = np.asarray(Image.open(sheets[src]).convert('RGB')).astype(np.float32)
        return arrs[src]

    results = []
    for it in ITEMS:
        if only and it['key'] not in only and it.get('set') not in only and it['group'] not in only:
            continue
        large_src = it['sheet'] + '-large'
        use = large_src if it.get('use', 'large') == 'large' else it['sheet']
        other = it['sheet'] if use == large_src else large_src
        img, box = cut_item(it, arr(use), use, cache)
        r = dict(it, img=img, srcbox=box, source=use)
        if both:
            r['alt_img'], _ = cut_item(it, arr(other), other, cache)
            r['alt_source'] = other
        results.append(r)
    return results


def resize_premul(im, size):
    a = np.asarray(im).astype(np.float32) / 255
    pre = np.dstack([a[..., :3] * a[..., 3:], a[..., 3:]])
    chans = [np.asarray(Image.fromarray((pre[..., i] * 255).round().astype(np.uint8)).resize(size, Image.LANCZOS)) for i in range(4)]
    out = np.dstack(chans).astype(np.float32) / 255
    al = out[..., 3:]
    rgb = np.where(al > 1e-3, out[..., :3] / np.maximum(al, 1e-3), 0)
    res = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), al]) * 255).round().astype(np.uint8), 'RGBA')
    sharp = res.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    sharp.putalpha(res.getchannel('A'))
    return sharp


def place(r, img, scale):
    cw, ch = CANVAS[r['kind']]
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    obj = resize_premul(img, (w, h))
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    x = (cw - w) // 2
    y = ch - round(ch * PAD) - h if r.get('align') == 'bottom' else (ch - h) // 2
    canvas.alpha_composite(obj, (x, y))
    return canvas


def layout(results):
    """Common scale per animation/series set (sizes stay consistent), then centre on the canvas."""
    def fit(r, img):
        cw, ch = CANVAS[r['kind']]
        return min(cw * (1 - 2 * PAD) / img.width, ch * (1 - 2 * PAD) / img.height)
    sets = {}
    for r in results:
        if r.get('set'):
            sets.setdefault((r['set'], r['kind']), []).append(r)
    for r in results:
        group = sets.get((r.get('set'), r['kind']), [r])
        for attr in ('img', 'alt_img'):
            if attr not in r:
                continue
            # set scale in "PNG pixels": normalise each member's fit by its source scale
            norm = lambda x, a: fit(x, x[a if a in x else 'img']) * (LARGE_SCALE[0] if (x['source'] if a == 'img' else x['alt_source']).endswith('-large') else 1)
            ref = min(norm(x, attr) for x in group)
            mine = LARGE_SCALE[0] if (r['source'] if attr == 'img' else r['alt_source']).endswith('-large') else 1
            r['out' if attr == 'img' else 'alt_out'] = place(r, r[attr], ref / mine)


def write(results, out_dir):
    manifests = {}
    for r in results:
        d = os.path.join(out_dir, r['group'])
        os.makedirs(d, exist_ok=True)
        r['out'].save(os.path.join(d, r['key'] + '.png'), optimize=True)
        r['out'].save(os.path.join(d, r['key'] + '.webp'), quality=90, method=6)
        manifests.setdefault(r['group'], []).append(dict(
            key=f"{r['group']}/{r['key']}", file=f"/art/mockup/{r['group']}/{r['key']}.png", webp=f"/art/mockup/{r['group']}/{r['key']}.webp",
            width=r['out'].width, height=r['out'].height, source=r['source'], box=r['srcbox'], alt=r['alt']))
    for g, entries in manifests.items():
        with open(os.path.join(out_dir, g, 'manifest.json'), 'w', encoding='utf-8') as f:
            json.dump(entries, f, indent=2, ensure_ascii=False)
            f.write('\n')


def checker(size, sq=12):
    cb = Image.new('RGB', size, (255, 255, 255))
    d = ImageDraw.Draw(cb)
    for yy in range(0, size[1], sq):
        for xx in range(0, size[0], sq):
            if (xx + yy) // sq % 2:
                d.rectangle([xx, yy, xx + sq - 1, yy + sq - 1], fill=(204, 204, 204))
    return cb


def contact(results, path, attrs=('out',), cell=220, cols=6):
    """Each asset on a checkerboard and on navy #0b2a4a, the canvas outlined in magenta.
    With attrs=('out','alt_out') each row pairs the chosen cut with the other source."""
    tiles = [(r, a) for r in results for a in attrs if a in r]
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * (2 * cell + 16)), (255, 255, 255))
    dr = ImageDraw.Draw(sheet)
    for i, (r, attr) in enumerate(tiles):
        cx, cy = (i % cols) * cell, (i // cols) * (2 * cell + 16)
        im = r[attr].copy()
        im.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
        ox, oy = (cell - im.width) // 2, (cell - im.height) // 2
        for j, base in enumerate([checker((cell, cell)), Image.new('RGB', (cell, cell), (11, 42, 74))]):
            ImageDraw.Draw(base).rectangle([ox - 1, oy - 1, ox + im.width, oy + im.height], outline=(255, 0, 160))
            base.paste(im, (ox, oy), im)
            sheet.paste(base, (cx, cy + j * cell))
        src = r['source'] if attr == 'out' else r['alt_source']
        dr.text((cx + 4, cy + 2 * cell + 2), f"{r['key']} [{src}]", fill=(0, 0, 0))
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'art', 'mockup'))
    ap.add_argument('--sheets', default=None, help='directory holding the four asset sheets')
    ap.add_argument('--contact', default=None, help='directory for <group>-contact.png sheets')
    ap.add_argument('--compare', action='store_true', help='also cut the other source and write <group>-compare.png')
    ap.add_argument('--only', default=None, help='comma-separated keys, set names or groups (no files written)')
    ap.add_argument('--groups', default=None, help='comma-separated groups to cut and write (default: all)')
    args = ap.parse_args()
    sheets = find_sheets(args.sheets)
    only = set(args.only.split(',')) if args.only else None
    if args.groups:
        groups = args.groups.split(',')
        for g in groups:  # one group at a time keeps memory low
            r = process(sheets, {g}, both=args.compare)
            layout(r)
            write(r, args.out)
            if args.contact:
                os.makedirs(args.contact, exist_ok=True)
                contact(r, os.path.join(args.contact, f'{g}-contact.png'))
            print(f'{g}: {len(r)} assets')
        return
    results = process(sheets, only, both=args.compare)
    layout(results)
    if not only:
        write(results, args.out)
    if args.contact:
        os.makedirs(args.contact, exist_ok=True)
        for g in sorted({r['group'] for r in results}):
            rs = [r for r in results if r['group'] == g]
            contact(rs, os.path.join(args.contact, f'{g}-contact.png'))
            if args.compare:
                contact(rs, os.path.join(args.contact, f'{g}-compare.png'), ('out', 'alt_out'))
    print(f'{len(results)} assets')


if __name__ == '__main__':
    main()
