import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, productionApi } from "../api/client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("apiRequest network failure handling", () => {
  it("turns a rejected fetch into a friendly ApiError instead of a raw TypeError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const result = productionApi.listFreezeDryers();

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      code: "network_error",
      message: "Could not reach the server. Check your connection.",
    });
  });
});
