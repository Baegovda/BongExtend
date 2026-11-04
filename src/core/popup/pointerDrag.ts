// 팝업에서 끌어 순서를 바꿀 때의 손 상태. 화면은 이 결과가 drop/click/cancel 이면 항상 꾸민 자리를 치운다.

export type DragEnd = "drop" | "click" | "cancel" | "revert";

export type Box = {left: number; top: number; width: number; height: number};

export const gridDropIndex = (boxes: readonly Box[], pointer: {x: number; y: number}): number => {
    const rows = Array.isArray(boxes) ? boxes : [];
    const x = Number(pointer?.x);
    const y = Number(pointer?.y);
    if (!rows.length || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const centers = rows.map((box) => {
        const width = Number(box?.width) || 0;
        const height = Number(box?.height) || 0;
        return {
            cx: Number(box?.left) + width / 2,
            cy: Number(box?.top) + height / 2,
            w: width,
            h: height
        };
    });
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < centers.length; i += 1) {
        const dx = x - centers[i].cx;
        const dy = y - centers[i].cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
            bestDist = dist;
            best = i;
        }
    }
    const ys = centers.map((item) => item.cy);
    const xs = centers.map((item) => item.cx);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    const hit = centers[best];
    const grid = xSpread > 24 && ySpread > 24;
    let after = false;
    if (!grid) after = ySpread >= xSpread ? y > hit.cy : x > hit.cx;
    else {
        const sameRow = Math.abs(y - hit.cy) <= Math.max(hit.h / 2, 8);
        after = sameRow ? x > hit.cx : y > hit.cy;
    }
    return after ? best + 1 : best;
};

export const edgeScrollDelta = (
    box: {top: number; bottom: number; left: number; right: number},
    pointer: {x: number; y: number},
    edge = 28,
    step = 16
) => {
    let x = 0;
    let y = 0;
    if (pointer.y < box.top + edge) y = -step;
    else if (pointer.y > box.bottom - edge) y = step;
    if (pointer.x < box.left + edge) x = -step;
    else if (pointer.x > box.right - edge) x = step;
    return {x, y};
};

export type PointerLike = {
    button?: number;
    pointerId: number;
    clientX: number;
    clientY: number;
};

export const nearestSlot = (mids: readonly number[], pointer: number): number => {
    const y = Number(pointer);
    for (let i = 0; i < mids.length; i += 1) {
        if (y < Number(mids[i])) return i;
    }
    return mids.length;
};

export const createPointerDrag = (options: {axis: "x" | "y"; threshold?: number}) => {
    const threshold = options.threshold ?? 5;
    let phase: "idle" | "pending" | "dragging" = "idle";
    let pointerId: number | null = null;
    let originX = 0;
    let originY = 0;
    let x = 0;
    let y = 0;

    const end = (kind: "up" | "cancel", id?: number): DragEnd | null => {
        if (phase === "idle" || pointerId == null) return null;
        if (id != null && id !== pointerId) return null;
        const dragging = phase === "dragging";
        phase = "idle";
        pointerId = null;
        if (dragging) return "drop";
        return kind === "up" ? "click" : "cancel";
    };

    return {
        get phase() { return phase; },
        get pointerId() { return pointerId; },
        get originX() { return originX; },
        get originY() { return originY; },
        get x() { return x; },
        get y() { return y; },
        down(event: PointerLike) {
            if (phase !== "idle") return false;
            if (event.button != null && event.button !== 0) return false;
            phase = "pending";
            pointerId = event.pointerId;
            originX = x = event.clientX;
            originY = y = event.clientY;
            return true;
        },
        move(event: PointerLike): "ignore" | "pending" | "start" | "drag" {
            if (phase === "idle" || event.pointerId !== pointerId) return "ignore";
            x = event.clientX;
            y = event.clientY;
            if (phase === "dragging") return "drag";
            const delta = Math.hypot(x - originX, y - originY);
            if (delta < threshold) return "pending";
            phase = "dragging";
            return "start";
        },
        up(event: {pointerId: number}) {
            return end("up", event.pointerId);
        },
        cancel(event?: {pointerId?: number}) {
            if (event?.pointerId != null && pointerId != null && event.pointerId !== pointerId) return null;
            return end("cancel");
        },
        revert() {
            if (phase === "idle" || pointerId == null) return null;
            phase = "idle";
            pointerId = null;
            return "revert" as const;
        }
    };
};
