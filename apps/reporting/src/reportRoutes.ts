export type Section = "all" | "performance" | "statements";
export type PerformanceReport = "Profit & Loss" | "Cash flow" | "Revenue summary";
export type StatementReport = "Balance sheet" | "Trial balance";
export type OpenReportName = PerformanceReport | StatementReport;

export const reportRouteByHash: Record<
  string,
  { section: Section; report?: PerformanceReport | StatementReport }
> = {
  "profit-loss": { section: "performance", report: "Profit & Loss" },
  "cash-flow": { section: "performance", report: "Cash flow" },
  "revenue-summary": { section: "performance", report: "Revenue summary" },
  "balance-sheet": { section: "statements", report: "Balance sheet" },
  "trial-balance": { section: "statements", report: "Trial balance" },
  all: { section: "all" },
};

export function reportHashFor(nextSection: Section, report?: OpenReportName): string {
  if (nextSection === "all") {
    return "all";
  }
  if (report === "Profit & Loss") {
    return "profit-loss";
  }
  if (report === "Cash flow") {
    return "cash-flow";
  }
  if (report === "Revenue summary") {
    return "revenue-summary";
  }
  if (report === "Balance sheet") {
    return "balance-sheet";
  }
  if (report === "Trial balance") {
    return "trial-balance";
  }
  return nextSection;
}
