import { reportHashFor, type PerformanceReport, type Section, type StatementReport } from "./reportRoutes";

export type ReportShareState = {
  section: Section;
  performanceReport: PerformanceReport;
  statementReport: StatementReport;
};

const FORBIDDEN_IN_SHARE_URL = /Bearer|MERIDIAN_BFF|\/api\/v1|authorization|token=/i;

function activeReportName(state: ReportShareState): PerformanceReport | StatementReport | undefined {
  if (state.section === "performance") {
    return state.performanceReport;
  }
  if (state.section === "statements") {
    return state.statementReport;
  }
  return undefined;
}

export function buildReportShareUrl(
  location: Pick<Location, "href" | "origin" | "pathname">,
  state: ReportShareState,
): string {
  const hash = reportHashFor(state.section, activeReportName(state));
  const url = new URL(location.href);
  url.search = "";
  url.hash = hash;
  const result = url.toString();
  if (FORBIDDEN_IN_SHARE_URL.test(result)) {
    throw new Error("Share URL must not include credentials or API paths");
  }
  return result;
}

export async function copyReportShareLink(
  location: Pick<Location, "href" | "origin" | "pathname">,
  state: ReportShareState,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const url = buildReportShareUrl(location, state);
    await navigator.clipboard.writeText(url);
    return { ok: true, url };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
