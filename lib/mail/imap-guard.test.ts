import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Boot-time mailbox guard tests. The module reads env at import time, so each
 * case re-imports with a fresh module registry and mutated env.
 */

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  vi.resetModules();
  setEnv({
    IMAP_USER: undefined,
    IMAP_PASSWORD: undefined,
    MAILBOX_ALLOWED: undefined,
    IMAP_HOST: undefined,
    IMAP_PORT: undefined,
  });
});

afterEach(() => {
  setEnv(Object.fromEntries(Object.keys(process.env).map((k) => [k, ORIGINAL_ENV[k]])));
  vi.resetModules();
});

describe("lib/mail/imap boot guard", () => {
  it("is unconfigured (no throw) when env is missing", async () => {
    const mod = await import("./imap");
    expect(mod.isMailConfigured()).toBe(false);
    expect(await mod.Mailbox.create()).toBeNull(); // demo path: never throws
  });

  it("throws at import time when IMAP_USER and MAILBOX_ALLOWED mismatch", async () => {
    setEnv({ IMAP_USER: "someone@else.com", MAILBOX_ALLOWED: "contact@eiden-group.com" });
    await expect(import("./imap")).rejects.toThrow(/MAILBOX_ALLOWED mismatch/i);
  });

  it("is configured when env is consistent", async () => {
    setEnv({
      IMAP_USER: "contact@eiden-group.com",
      MAILBOX_ALLOWED: "contact@eiden-group.com",
      IMAP_PASSWORD: "secret",
      IMAP_HOST: "imap.hostinger.com",
      IMAP_PORT: "993",
    });
    const mod = await import("./imap");
    expect(mod.isMailConfigured()).toBe(true);
  });

  it("returns null (never throws) when the server is unreachable", async () => {
    setEnv({
      IMAP_USER: "contact@eiden-group.com",
      MAILBOX_ALLOWED: "contact@eiden-group.com",
      IMAP_PASSWORD: "secret",
      IMAP_HOST: "127.0.0.1",
      IMAP_PORT: "1", // ECONNREFUSED: fast
    });
    const mod = await import("./imap");
    const mailbox = await mod.Mailbox.create();
    expect(mailbox).toBeNull();
  }, 15_000);

  it("is unconfigured when password is missing even if both names match", async () => {
    setEnv({
      IMAP_USER: "contact@eiden-group.com",
      MAILBOX_ALLOWED: "contact@eiden-group.com",
      IMAP_PASSWORD: undefined,
    });
    const mod = await import("./imap");
    expect(mod.isMailConfigured()).toBe(false);
  });

  it("matches case-insensitively", async () => {
    setEnv({
      IMAP_USER: "Contact@Eiden-Group.com",
      MAILBOX_ALLOWED: "contact@eiden-group.com",
      IMAP_PASSWORD: "secret",
    });
    const mod = await import("./imap");
    expect(mod.isMailConfigured()).toBe(true);
  });
});
