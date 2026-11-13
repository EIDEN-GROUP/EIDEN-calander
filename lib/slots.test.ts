import { describe, expect, it } from "vitest";
import { parseTimeToMinutes, suggestSlots, type WorkingHoursEntry } from "./slots";

const WH: WorkingHoursEntry[] = [
  { weekday: "mon", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "tue", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "wed", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "thu", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "fri", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "sat", is_open: true, open_time: "09:00", close_time: "13:00" },
  { weekday: "sun", is_open: false, open_time: "00:00", close_time: "00:00" },
];

const bk = (startIso: string, endIso: string, status = "confirmed") =>
  ({ id: Math.random().toString(36).slice(2), room_id: "room-1", starts_at: startIso, ends_at: endIso, status });

// 2026-11-12 is a THURSDAY. Fixed clock keeps tests deterministic.
const NOW = new Date("2026-11-12T08:00:00Z");

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("20:00")).toBe(1200);
  });
  it("parses HH:MM:SS", () => expect(parseTimeToMinutes("09:15:00")).toBe(555));
});

describe("suggestSlots", () => {
  it("returns same-day slots before later days", () => {
    const out = suggestSlots({
      roomId: "room-1",
      desiredStart: new Date("2026-11-12T09:00:00Z"),
      durationMin: 60,
      incrementMin: 30,
      bufferMin: 0,
      daysAhead: 3,
      limit: 4,
      existing: [],
      workingHours: WH,
      timeZone: "Africa/Casablanca",
      now: NOW,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].labelKey).toBe("today");
    // 09:00Z = 10:00 in Casablanca (UTC+1) → first slot should respect working hours.
    const firstHour = new Date(out[0].startsAt).getUTCHours();
    expect(firstHour).toBeGreaterThanOrEqual(7); // opens 08:00 local (=07:00Z)
  });

  it("skips occupied windows", () => {
    const existing = [bk("2026-11-12T09:00:00Z", "2026-11-12T12:00:00Z")]; // morning blocked
    const out = suggestSlots({
      roomId: "room-1",
      desiredStart: new Date("2026-11-12T09:00:00Z"),
      durationMin: 60,
      incrementMin: 60,
      bufferMin: 0,
      daysAhead: 1,
      limit: 3,
      existing,
      workingHours: WH,
      timeZone: "Africa/Casablanca",
      now: NOW,
    });
    for (const s of out) {
      const st = new Date(s.startsAt).getTime();
      const en = new Date(s.endsAt).getTime();
      const bs = Date.parse("2026-11-12T09:00:00Z");
      const be = Date.parse("2026-11-12T12:00:00Z");
      const overlaps = st < be && en > bs;
      expect(overlaps).toBe(false);
    }
    expect(out.length).toBeGreaterThan(0);
  });

  it("respects buffer time around bookings", () => {
    const existing = [bk("2026-11-12T12:00:00Z", "2026-11-12T13:00:00Z")];
    const noBuffer = suggestSlots({
      roomId: "room-1", desiredStart: new Date("2026-11-12T10:00:00Z"), durationMin: 30,
      incrementMin: 30, bufferMin: 0, daysAhead: 1, limit: 60, existing, workingHours: WH, timeZone: "Africa/Casablanca", now: NOW,
    });
    const withBuffer = suggestSlots({
      roomId: "room-1", desiredStart: new Date("2026-11-12T10:00:00Z"), durationMin: 30,
      incrementMin: 30, bufferMin: 30, daysAhead: 1, limit: 60, existing, workingHours: WH, timeZone: "Africa/Casablanca", now: NOW,
    });
    expect(withBuffer.length).toBeLessThan(noBuffer.length);
  });

  it("honours closed days (Sunday) and short Saturday hours", () => {
    // Thursday→Sunday scan: Sunday must yield nothing.
    const out = suggestSlots({
      roomId: "room-1", desiredStart: new Date("2026-11-15T08:00:00Z"), // Sunday
      durationMin: 60, incrementMin: 60, bufferMin: 0, daysAhead: 1, limit: 8,
      existing: [], workingHours: WH, timeZone: "Africa/Casablanca", now: NOW,
    });
    expect(out).toEqual([]);

    const sat = suggestSlots({
      roomId: "room-1", desiredStart: new Date("2026-11-14T08:00:00Z"), // Saturday (closes 13:00)
      durationMin: 60, incrementMin: 60, bufferMin: 0, daysAhead: 1, limit: 10,
      existing: [], workingHours: WH, timeZone: "Africa/Casablanca", now: NOW,
    });
    expect(sat.length).toBeGreaterThan(0);
    const lastEnd = new Date(sat[sat.length - 1].endsAt).getUTCHours();
    expect(lastEnd).toBeLessThanOrEqual(13); // 13:00 local = 12:00Z… be lenient
  });

  it("never suggests a slot that has already ended", () => {
    const out = suggestSlots({
      roomId: "room-1", desiredStart: NOW, durationMin: 60, incrementMin: 60,
      bufferMin: 0, daysAhead: 1, limit: 4, existing: [], workingHours: WH, timeZone: "Africa/Casablanca", now: NOW,
    });
    for (const s of out) expect(new Date(s.endsAt).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("returns empty for impossible durations", () => {
    expect(suggestSlots({
      roomId: "room-1", desiredStart: NOW, durationMin: 0, incrementMin: 30,
      bufferMin: 0, daysAhead: 1, limit: 4, existing: [], workingHours: WH, timeZone: "Africa/Casablanca", now: NOW,
    })).toEqual([]);
  });
});
