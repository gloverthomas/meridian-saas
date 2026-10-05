import { describe, expect, it } from "vitest";
import { buildReportShareUrl } from "./shareReportLink";

const baseLocation = {
  href: "http://localhost:3001/?token=secret&authorization=Bearer%20leak#profit-loss",
  origin: "http://localhost:3001",
  pathname: "/",
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
});
