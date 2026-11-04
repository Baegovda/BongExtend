import {describe, expect, test} from "bun:test";
import {createPointerDrag, edgeScrollDelta, gridDropIndex, nearestSlot} from "./pointerDrag";

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

const cell = (col: number, row: number): {left: number; top: number; width: number; height: number} => ({
    left: col * 100,
    top: row * 60,
    width: 100,
    height: 50
});
const grid = [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1)];

describe("gridDropIndex", () => {
    test("the center of a card keeps that slot", () => {
        expect(gridDropIndex(grid, {x: 50, y: 25})).toBe(0);
        expect(gridDropIndex(grid, {x: 150, y: 85})).toBe(5);
    });
    test("just past a center opens the next slot in that row", () => {
        expect(gridDropIndex(grid, {x: 60, y: 25})).toBe(1);
        expect(gridDropIndex(grid, {x: 360, y: 25})).toBe(4);
    });
    test("a vertical list uses the row centers, and a tab row uses x", () => {
        const column = [0, 1, 2].map((row) => ({left: 0, top: row * 80, width: 300, height: 70}));
        expect(gridDropIndex(column, {x: 40, y: 130})).toBe(2);
        expect(gridDropIndex(column, {x: 40, y: 20})).toBe(0);
        const tabs = [0, 1, 2].map((col) => ({left: col * 80, top: 0, width: 70, height: 40}));
        expect(gridDropIndex(tabs, {x: 130, y: 10})).toBe(2);
    });
    test("empty list stays at the start", () => {
        expect(gridDropIndex([], {x: 10, y: 10})).toBe(0);
    });
});

describe("edgeScrollDelta", () => {
    const box = {top: 0, bottom: 200, left: 0, right: 200};
    test("near the edges scrolls, the middle does not", () => {
        expect(edgeScrollDelta(box, {x: 100, y: 10}).y).toBeLessThan(0);
        expect(edgeScrollDelta(box, {x: 100, y: 190}).y).toBeGreaterThan(0);
        expect(edgeScrollDelta(box, {x: 100, y: 100})).toEqual({x: 0, y: 0});
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
        drag.down({button: 0, pointerId: 4, clientX: 0, clientY: 0});
        drag.move({pointerId: 4, clientX: 0, clientY: 20});
        expect(drag.revert()).toBe("revert");
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
