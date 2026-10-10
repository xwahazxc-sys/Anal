"""2D puppet rig for Lenny (lenny_point.png): head tilt/nod, breathing, blink, voice-driven mouth.

    rig(img, t, mouth=0..1, blink=0..1, tilt=deg, nod=px) -> RGBA numpy image
"""
import math
import cv2
import numpy as np

# landmarks in lenny_point.png (1408x768)
EYES = [(695, 167, 21, 16), (775, 165, 20, 16)]          # cx, cy, rx, ry
MOUTH = (742, 233)                                        # centre of the smile line
SMILE = [(700, 222), (720, 230), (742, 234), (765, 231), (786, 226)]
PIVOT = (738, 285)                                        # neck
HEAD = (738, 150, 190, 165)                               # head ellipse cx, cy, rx, ry
H, W = 768, 1408
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def soft_ellipse(cx, cy, rx, ry, feather=.35):
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip((1 + feather - d) / feather, 0, 1)


W_HEAD = soft_ellipse(*HEAD, feather=.45)
W_JAW = soft_ellipse(MOUTH[0], MOUTH[1] + 22, 60, 30, feather=.8) * (yy > MOUTH[1] - 4)
BODY = (yy > 260) & (yy < 760)


def rig(img, mouth=0.0, blink=0.0, tilt=0.0, nod=0.0, breathe=0.0):
    a = math.radians(tilt)
    px, py = PIVOT
    # inverse map: where each output pixel samples from
    dx, dy = xx - px, yy - py
    rx = px + dx * math.cos(-a) - dy * math.sin(-a)
    ry = py + dx * math.sin(-a) + dy * math.cos(-a)
    mx = xx + (rx - xx) * W_HEAD
    my = yy + (ry - yy) * W_HEAD - nod * W_HEAD
    # jaw drop: pull pixels below the smile line from higher up
    my = my - mouth * 11 * W_JAW
    # breathing: tiny vertical stretch of the torso around the feet
    my = np.where(BODY, 760 + (my - 760) / (1 + breathe * .012), my)
    out = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

    # forward-transform a point the same way the head moved (approx: rotate about pivot + nod)
    def fwd(x, y, jaw=0.0):
        dx, dy = x - px, y - py
        return (px + dx * math.cos(a) - dy * math.sin(a), py + dx * math.sin(a) + dy * math.cos(a) + nod + jaw)

    ov = out.copy()
    if mouth > .04:  # mouth interior under the smile line
        pts = [fwd(x, y) for x, y in SMILE]
        low = [fwd(x, y + mouth * (14 if i in (1, 2, 3) else 6), 0) for i, (x, y) in enumerate(SMILE)][::-1]
        poly = np.array(pts + low, np.int32)
        cv2.fillPoly(ov, [poly], (30, 14, 18, 255), lineType=cv2.LINE_AA)
        tx, ty = fwd(MOUTH[0] + 4, MOUTH[1] + mouth * 9)
        cv2.ellipse(ov, (int(tx), int(ty)), (int(10 + 6 * mouth), int(3 + 3 * mouth)), tilt, 0, 360, (120, 70, 190, 255), -1, cv2.LINE_AA)
        cv2.polylines(ov, [np.array(pts, np.int32)], False, (25, 20, 25, 255), 3, cv2.LINE_AA)
        out = cv2.addWeighted(ov, 1, out, 0, 0)
    if blink > .02:  # dark eyelids (the eyes sit inside the black mask fur)
        for cx, cy, ex, ey in EYES:
            fx, fy = fwd(cx, cy)
            lid = np.zeros((H, W), np.uint8)
            cv2.ellipse(lid, (int(fx), int(fy)), (ex + 3, ey + 3), tilt, 0, 360, 255, -1, cv2.LINE_AA)
            cut = (yy < fy - ey - 3 + (2 * ey + 6) * blink).astype(np.uint8)
            m = cv2.GaussianBlur((lid * cut).astype(np.float32) / 255, (5, 5), 0)[..., None]
            col = np.array([38, 36, 40, 255], np.float32)
            out = (out * (1 - m) + col * m).astype(np.uint8)
            if blink > .85:  # lash line
                cv2.ellipse(out, (int(fx), int(fy + ey * .2)), (ex, 4), tilt, 10, 170, (15, 15, 18, 255), 3, cv2.LINE_AA)
    return out


if __name__ == "__main__":
    import sys
    img = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)
    tiles = []
    for kw in [dict(), dict(mouth=.5), dict(mouth=1), dict(blink=1), dict(tilt=4, nod=4, mouth=.7), dict(tilt=-4, mouth=.3, blink=.5)]:
        o = rig(img, **kw)[20:330, 560:930]
        bg = np.full(o.shape[:2] + (3,), (40, 60, 60), np.uint8)
        al = o[..., 3:4] / 255
        tiles.append((o[..., :3] * al + bg * (1 - al)).astype(np.uint8))
    cv2.imwrite(sys.argv[2], np.vstack([np.hstack(tiles[:3]), np.hstack(tiles[3:])]))
