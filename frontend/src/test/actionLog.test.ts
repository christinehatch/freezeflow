import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPatch, apiPost } from "../api/client";
import { describeApiCall } from "../utils/actionDescriptions";
import {
  getRecentActions,
  logAction,
  resetActionLogForTests,
} from "../utils/actionLog";

describe("actionLog", () => {
  beforeEach(() => {
    resetActionLogForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("caps at 20 entries, dropping the oldest first", () => {
    for (let index = 0; index < 25; index += 1) {
      logAction(`Action ${index}`);
    }

    const recent = getRecentActions();
    expect(recent).toHaveLength(20);
    expect(recent[0]).toBe("Action 5");
    expect(recent[recent.length - 1]).toBe("Action 24");
  });
});

describe("describeApiCall", () => {
  it("describes a representative sample of known calls", () => {
    expect(describeApiCall("POST", "/production-batches")).toBe(
      "Created a Production Batch",
    );
    expect(describeApiCall("POST", "/production-batches/batch-1/start")).toBe(
      "Started a Production Batch",
    );
    expect(describeApiCall("POST", "/trays/tray-1/weight-checks")).toBe(
      "Recorded a Weight Check",
    );
    expect(describeApiCall("PATCH", "/preparation-presets/preset-1")).toBe(
      "Updated a Preparation Preset",
    );
  });

  it("falls back to a generic method + path description when unmapped", () => {
    expect(describeApiCall("POST", "/something-new")).toBe(
      "POST /something-new",
    );
  });
});

describe("apiRequest logging", () => {
  beforeEach(() => {
    resetActionLogForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("logs a plain-English entry when a mutating call succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: "batch-1" },
              meta: {},
            }),
        } as Response),
      ),
    );

    await apiPost("/production-batches", { batch_number: "Batch 001" });

    expect(getRecentActions()).toEqual(["Created a Production Batch"]);
  });

  it("logs a Failed entry when a mutating call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              detail: { code: "business_rule_violation", message: "Nope." },
            }),
        } as Response),
      ),
    );

    await expect(
      apiPatch("/preparation-presets/preset-1", { name: "New Name" }),
    ).rejects.toThrow();

    expect(getRecentActions()).toEqual([
      "Failed: Updated a Preparation Preset — Nope.",
    ]);
  });

  it("does not log GET requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [], meta: {} }),
        } as Response),
      ),
    );

    await apiGet("/freeze-dryers");

    expect(getRecentActions()).toEqual([]);
  });
});
