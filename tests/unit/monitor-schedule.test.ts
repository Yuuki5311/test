import { describe, expect, it } from "vitest";
import { isShanghaiNine, shanghaiParts } from "@/lib/monitor/schedule";

describe("shanghai nine o'clock", () => {
  it("matches 09:00 in Asia/Shanghai and ignores other minutes", () => {
    const nine = new Date("2026-09-21T01:00:00.000Z");
    expect(shanghaiParts(nine)).toMatchObject({ date: "2026-09-21", hour: 9, minute: 0 });
    expect(isShanghaiNine(nine)).toBe(true);
    expect(isShanghaiNine(new Date("2026-09-21T01:01:00.000Z"))).toBe(false);
  });
});
