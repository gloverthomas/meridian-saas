/**
 * Demo bridge: Reporting chrome failure → workflow service /signal.
 */
async function postSignal(body: Record<string, unknown>): Promise<{ ok: boolean; detail?: string }> {
  const endpoint =
    import.meta.env.VITE_WORKFLOW_SIGNAL_URL?.trim() || "http://127.0.0.1:4100/signal";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ...body,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
    if (!response.ok) {
      return { ok: false, detail: (await response.text()).slice(0, 200) };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** LIQ-17 — Notifications dead in Reporting. */
export async function signalNotificationsIncident(args: {
  surface: "header";
}): Promise<{ ok: boolean; detail?: string }> {
  return postSignal({
    issueIdentifier: "LIQ-17",
    title: "[Hero] Notifications work in Core but are dead in Reporting",
    source: `notifications_${args.surface}`,
    hash: "notifications",
  });
}

/** Related questions fail after a successful Reporting reply. No ticket id: Linear creates a MER issue. */
export async function signalRelatedQuestionsIncident(args: {
  surface: "header";
}): Promise<{ ok: boolean; detail?: string }> {
  return postSignal({
    title: "[Hero] Related questions load in Core but fail in Reporting",
    source: `assistant_related_${args.surface}`,
    hash: "ai-assistant",
    detail:
      "Core shows follow-up questions after an assistant reply. Reporting returns the reply, then related questions fail to load (related_questions_unavailable).",
  });
}

/** LIQ-24 — AI Assistant rail duplicated but BFF never wired in Reporting. */
export async function signalAssistantIncident(args: {
  surface: "header";
}): Promise<{ ok: boolean; detail?: string }> {
  return postSignal({
    issueIdentifier: "LIQ-24",
    title: "[Hero] AI Assistant works in Core but is dead in Reporting",
    source: `assistant_${args.surface}`,
    hash: "ai-assistant",
  });
}
