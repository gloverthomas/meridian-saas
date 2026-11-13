export function sanitizeContext(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 100);
}

export function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) => entry && ["user", "assistant"].includes(entry.role))
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content ?? "").slice(0, 1000),
    }))
    .slice(-6);
}

export function fixtureAssistantReply(message) {
  const lower = String(message ?? "").toLowerCase();
  if (lower.includes("quarter") || lower.includes("compare")) {
    return {
      reply:
        "Income is up versus last quarter, and net profit improved as client work held steady.\n\n1. **Income** – $56,180 this quarter vs $48,210 last quarter\n2. **Net profit** – $24,202 vs $18,640\n\nFigures use Harbour Studio demo books (AUD).",
      table: {
        headers: ["Metric", "Last Quarter (Apr–Jun 2026)", "Current Quarter (Jul–Sep 2026)"],
        rows: [
          ["Income", "$48,210", "$56,180"],
          ["Net Profit", "$18,640", "$24,202"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Compared current quarter (Jul–Sep 2026) income and net profit against last quarter (Apr–Jun 2026) from Harbour Studio demo books.",
      relatedQuestions: [
        "What's driving the income increase?",
        "What's my gross profit margin?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("margin") || lower.includes("gross")) {
    return {
      reply:
        "Gross profit margin is about **58%** this quarter on demo data — strong for wholesale coffee.",
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale: "Divided gross profit by income for the current quarter on Harbour Studio demo books.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What are my biggest expenses?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("income") || lower.includes("source")) {
    return {
      reply:
        "Your top income sources this quarter are:\n\n1. **Coffee Sales** – $142,800 (retail & wholesale combined)\n2. **Merchandise** – $18,450\n3. **Catering Events** – $12,300\n\nLast quarter: Coffee Sales were $138,200, Merchandise $15,900, Catering $9,800.",
      table: {
        headers: ["Source", "Amount"],
        rows: [
          ["Coffee Sales", "$142,800"],
          ["Merchandise", "$18,450"],
          ["Catering Events", "$12,300"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Ranked income accounts for the current quarter from Harbour Studio demo books, then compared the same categories to last quarter.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What's my gross profit margin?",
        "Which income source grew the most?",
      ],
    };
  }
  return {
    reply:
      "I can compare quarters, margin, or income sources using Harbour Studio demo books. Ask a finance question to continue.",
    table: null,
    cta: null,
    provider: "fixture",
    rationale: "No specific metric requested — offered the default demo finance prompts.",
    relatedQuestions: [
      "How does this quarter compare to last?",
      "What's my gross profit margin?",
      "What are my biggest income sources?",
    ],
  };
}

export function parseGrokPayload(raw, fallbackMessage) {
  try {
    const cleaned = String(raw ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    const reply = String(parsed.reply ?? "").trim();
    if (!reply) throw new Error("missing_reply");
    return {
      reply,
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      rationale:
        String(parsed.rationale ?? "").trim() ||
        "Answered from Harbour Studio demo books for this page context.",
      relatedQuestions: (Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 3),
    };
  } catch {
    const fixture = fixtureAssistantReply(fallbackMessage);
    return {
      reply: String(raw ?? "").trim() || fixture.reply,
      table: null,
      cta: fixture.cta,
      rationale: fixture.rationale,
      relatedQuestions: fixture.relatedQuestions,
    };
  }
}

export function fillRelatedQuestions(parsed, message) {
  if (!parsed.relatedQuestions.length) {
    parsed.relatedQuestions = fixtureAssistantReply(message).relatedQuestions;
  }
  return parsed;
}
