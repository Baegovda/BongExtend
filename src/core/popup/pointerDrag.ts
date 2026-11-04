// 팝업에서 끌어 순서를 바꿀 때의 손 상태. 화면은 이 결과가 drop/click/cancel 이면 항상 꾸민 자리를 치운다.

export type DragEnd = "drop" | "click" | "cancel";

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
            const delta = options.axis === "x" ? x - originX : y - originY;
            if (Math.abs(delta) < threshold) return "pending";
            phase = "dragging";
            return "start";
        },
        up(event: {pointerId: number}) {
            return end("up", event.pointerId);
        },
        cancel(event?: {pointerId?: number}) {
            if (event?.pointerId != null && pointerId != null && event.pointerId !== pointerId) return null;
            return end("cancel");
        }
    };
};
