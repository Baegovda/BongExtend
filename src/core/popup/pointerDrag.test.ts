import {describe, expect, test} from "bun:test";
import {createPointerDrag, nearestSlot} from "./pointerDrag";

const down = {button: 0, pointerId: 3, clientX: 40, clientY: 20};

describe("nearestSlot", () => {
    test("pointer before the first midpoint stays at the start", () => {
        expect(nearestSlot([10, 30, 50], 9)).toBe(0);
    });
    test("pointer between midpoints picks the later slot", () => {
        expect(nearestSlot([10, 30, 50], 31)).toBe(2);
    });
    test("pointer past the last midpoint goes to the end", () => {
        expect(nearestSlot([10, 30], 80)).toBe(2);
        expect(nearestSlot([], 10)).toBe(0);
    });
});

describe("createPointerDrag", () => {
    test("a press without movement is a click and the session goes idle", () => {
        const drag = createPointerDrag({axis: "x"});
        expect(drag.down(down)).toBe(true);
        expect(drag.move({pointerId: 3, clientX: 42, clientY: 20})).toBe("pending");
        expect(drag.up({pointerId: 3})).toBe("click");
        expect(drag.phase).toBe("idle");
        expect(drag.up({pointerId: 3})).toBe(null);
        expect(drag.cancel()).toBe(null);
    });

    test("passing the threshold then releasing is a drop", () => {
        const drag = createPointerDrag({axis: "x", threshold: 5});
        drag.down(down);
        expect(drag.move({pointerId: 3, clientX: 46, clientY: 20})).toBe("start");
        expect(drag.move({pointerId: 3, clientX: 70, clientY: 22})).toBe("drag");
        expect(drag.up({pointerId: 3})).toBe("drop");
        expect(drag.phase).toBe("idle");
        expect(drag.pointerId).toBe(null);
    });

    test("cancel, blur, and leave while dragging still end as a drop so the row can land", () => {
        const drag = createPointerDrag({axis: "y"});
        drag.down({button: 0, pointerId: 8, clientX: 0, clientY: 100});
        expect(drag.move({pointerId: 8, clientX: 0, clientY: 120})).toBe("start");
        expect(drag.cancel({pointerId: 8})).toBe("drop");
        expect(drag.phase).toBe("idle");

        drag.down({button: 0, pointerId: 9, clientX: 0, clientY: 10});
        drag.move({pointerId: 9, clientX: 0, clientY: 30});
        expect(drag.cancel()).toBe("drop");
        expect(drag.phase).toBe("idle");
    });

    test("cancel before movement is not a click", () => {
        const drag = createPointerDrag({axis: "x"});
        drag.down(down);
        expect(drag.cancel({pointerId: 3})).toBe("cancel");
        expect(drag.phase).toBe("idle");
    });

    test("another pointer and the wrong button are ignored", () => {
        const drag = createPointerDrag({axis: "y"});
        expect(drag.down({button: 2, pointerId: 1, clientX: 0, clientY: 0})).toBe(false);
        expect(drag.down(down)).toBe(true);
        expect(drag.down({button: 0, pointerId: 4, clientX: 1, clientY: 1})).toBe(false);
        expect(drag.move({pointerId: 4, clientX: 99, clientY: 99})).toBe("ignore");
        expect(drag.up({pointerId: 4})).toBe(null);
        expect(drag.phase).toBe("pending");
        expect(drag.cancel({pointerId: 4})).toBe(null);
        expect(drag.up({pointerId: 3})).toBe("click");
    });
});
