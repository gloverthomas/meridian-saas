import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportShareUrl, copyReportShareLink } from "./shareReportLink";

const baseLocation = {
  href: "http://localhost:3001/?token=secret&authorization=Bearer%20leak#profit-loss",
  origin: "http://localhost:3001",
  pathname: "/",
};

const profitAndLossState = {
  section: "performance" as const,
  performanceReport: "Profit & Loss" as const,
  statementReport: "Balance sheet" as const,
};

const tokenPathLocation = {
  href: "http://localhost:3001/token=secret",
  origin: "http://localhost:3001",
  pathname: "/token=secret",
};

describe("buildReportShareUrl", () => {
  it("maps each report to the same hash slugs as openReport", () => {
    expect(
      buildReportShareUrl(baseLocation, {
        section: "performance",
        performanceReport: "Profit & Loss",
        statementReport: "Balance sheet",
      }),
    ).toBe("http://localhost:3001/#profit-loss");

    expect(
      buildReportShareUrl(baseLocation, {
        section: "performance",
        performanceReport: "Cash flow",
        statementReport: "Balance sheet",
      }),
    ).toBe("http://localhost:3001/#cash-flow");

    expect(
      buildReportShareUrl(baseLocation, {
        section: "performance",
        performanceReport: "Revenue summary",
        statementReport: "Balance sheet",
      }),
    ).toBe("http://localhost:3001/#revenue-summary");

    expect(
      buildReportShareUrl(baseLocation, {
        section: "statements",
        performanceReport: "Profit & Loss",
        statementReport: "Balance sheet",
      }),
    ).toBe("http://localhost:3001/#balance-sheet");

    expect(
      buildReportShareUrl(baseLocation, {
        section: "statements",
        performanceReport: "Profit & Loss",
        statementReport: "Trial balance",
      }),
    ).toBe("http://localhost:3001/#trial-balance");
  });

  it("strips query params so share URLs never carry tokens", () => {
    const url = buildReportShareUrl(baseLocation, {
      section: "performance",
      performanceReport: "Profit & Loss",
      statementReport: "Balance sheet",
    });
    expect(url).not.toContain("?");
    expect(url).not.toMatch(/token|authorization|Bearer|MERIDIAN_BFF|\/api\/v1/i);
  });

  it("keeps a non-root path and hashes section all without a query", () => {
    expect(
      buildReportShareUrl(
        {
          href: "http://localhost:3001/reports/harbour?token=secret#profit-loss",
          origin: "http://localhost:3001",
          pathname: "/reports/harbour",
        },
        {
          section: "all",
          performanceReport: "Profit & Loss",
          statementReport: "Balance sheet",
        },
      ),
    ).toBe("http://localhost:3001/reports/harbour#all");
  });

  it("throws when the path still contains token= after the query is cleared", () => {
    expect(() => buildReportShareUrl(tokenPathLocation, profitAndLossState)).toThrow(
      /credentials|Share URL/i,
    );
  });
});

describe("copyReportShareLink", () => {
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  }

  afterEach(() => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      return;
    }
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("writes the share URL when the clipboard resolves", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const url = buildReportShareUrl(baseLocation, profitAndLossState);

    await expect(copyReportShareLink(baseLocation, profitAndLossState)).resolves.toEqual({
      ok: true,
      url,
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("returns ok false when the clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    stubClipboard(writeText);

    await expect(copyReportShareLink(baseLocation, profitAndLossState)).resolves.toEqual({
      ok: false,
      error: "clipboard denied",
    });
  });

  it("returns ok false without writing when the share URL is rejected", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    const result = await copyReportShareLink(tokenPathLocation, profitAndLossState);

    expect(result.ok).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});
