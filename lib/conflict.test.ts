import { describe, expect, it } from "vitest";
import { findOverlaps, rangesOverlap, isActiveBookingStatus, sameClientDifferentRoom } from "./conflict";

const bk = (id: string, room: string | null, start: string, end: string, status = "confirmed", client: string | null = null) =>
  ({ id, room_id: room, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), status, client_id: client });

describe("rangesOverlap", () => {
  const a = ["2026-11-13T10:00:00Z", "2026-11-13T11:00:00Z"] as const;
  it("detects partial overlap", () => expect(rangesOverlap(a[0], a[1], "2026-11-13T10:30:00Z", "2026-11-13T12:00:00Z")).toBe(true));
  it("detects containment", () => expect(rangesOverlap(a[0], a[1], "2026-11-13T10:15:00Z", "2026-11-13T10:45:00Z")).toBe(true));
  it("detects container", () => expect(rangesOverlap(a[0], a[1], "2026-11-13T08:00:00Z", "2026-11-13T14:00:00Z")).toBe(true));
  it("allows back-to-back (touching endpoints do not conflict)", () => expect(rangesOverlap(a[0], a[1], "2026-11-13T11:00:00Z", "2026-11-13T12:00:00Z")).toBe(false));
  it("allows fully disjoint", () => expect(rangesOverlap(a[0], a[1], "2026-11-13T12:00:00Z", "2026-11-13T13:00:00Z")).toBe(false));
});

describe("isActiveBookingStatus", () => {
  it("confirmed and pending_conflict are active", () => {
    expect(isActiveBookingStatus("confirmed")).toBe(true);
    expect(isActiveBookingStatus("pending_conflict")).toBe(true);
  });
  it("cancelled/completed are inactive", () => {
    expect(isActiveBookingStatus("cancelled")).toBe(false);
    expect(isActiveBookingStatus("completed")).toBe(false);
  });
});

describe("findOverlaps", () => {
  const candidates = [
    bk("a", "room-1", "2026-11-13T14:00:00Z", "2026-11-13T15:30:00Z"),
    bk("b", "room-1", "2026-11-13T16:00:00Z", "2026-11-13T17:00:00Z"),
    bk("c", "room-2", "2026-11-13T14:00:00Z", "2026-11-13T15:30:00Z"), // other room: fine
    bk("d", "room-1", "2026-11-13T14:30:00Z", "2026-11-13T15:00:00Z", "cancelled"), // cancelled: fine
    bk("e", "room-1", "2026-11-13T10:00:00Z", "2026-11-13T11:00:00Z", "pending_conflict"), // held: still blocks
  ];

  it("finds same-room active overlaps", () => {
    const hits = findOverlaps("room-1", "2026-11-13T14:30:00Z", "2026-11-13T16:30:00Z", candidates);
    expect(hits.map((h) => h.id).sort()).toEqual(["a", "b"]);
  });
  it("ignores other rooms and cancelled", () => {
    expect(findOverlaps("room-2", "2026-11-13T14:00:00Z", "2026-11-13T15:30:00Z", candidates).map(h => h.id)).toEqual(["c"]);
    expect(findOverlaps("room-1", "2026-11-13T14:30:00Z", "2026-11-13T15:00:00Z", candidates).map(h => h.id)).toEqual(["a"]);
  });
  it("respects excludeId (editing self)", () => {
    expect(findOverlaps("room-1", "2026-11-13T14:00:00Z", "2026-11-13T15:30:00Z", candidates, "a")).toEqual([]);
  });
  it("roomless bookings never room-conflict", () => {
    expect(findOverlaps(null, "2026-11-13T14:00:00Z", "2026-11-13T15:30:00Z", candidates)).toEqual([]);
  });
  it("pending_conflict blocks new bookings", () => {
    expect(findOverlaps("room-1", "2026-11-13T10:30:00Z", "2026-11-13T10:45:00Z", candidates).map(h => h.id)).toEqual(["e"]);
  });
});

describe("sameClientDifferentRoom", () => {
  const candidates = [
    bk("a", "room-1", "2026-11-13T14:00:00Z", "2026-11-13T15:00:00Z", "confirmed", "cli-1"),
    bk("b", "room-2", "2026-11-13T14:00:00Z", "2026-11-13T15:00:00Z", "confirmed", "cli-2"),
  ];
  it("flags same client in another room, not the same room", () => {
    const hits = sameClientDifferentRoom("cli-1", "room-2", "2026-11-13T14:30:00Z", "2026-11-13T14:45:00Z", candidates);
    expect(hits.map((h) => h.id)).toEqual(["a"]);
  });
  it("ignores different clients", () => {
    expect(sameClientDifferentRoom("cli-9", "room-3", "2026-11-13T14:30:00Z", "2026-11-13T14:45:00Z", candidates)).toEqual([]);
  });
});
