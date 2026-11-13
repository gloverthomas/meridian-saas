import { describe, expect, it } from "vitest";
import {
  fillRelatedQuestions,
  fixtureAssistantReply,
  parseGrokPayload,
  sanitizeContext,
  sanitizeHistory,
} from "./assistantPayload.mjs";

const quarterQuestions = [
  "What's driving the income increase?",
  "What's my gross profit margin?",
  "What are my biggest income sources?",
];

const marginQuestions = [
  "How does this quarter compare to last?",
  "What are my biggest expenses?",
  "What are my biggest income sources?",
];

const incomeQuestions = [
  "How does this quarter compare to last?",
  "What's my gross profit margin?",
  "Which income source grew the most?",
];

const defaultQuestions = [
  "How does this quarter compare to last?",
  "What's my gross profit margin?",
  "What are my biggest income sources?",
];

describe("fixtureAssistantReply", () => {
  it("returns quarter follow-ups and a comparison table", () => {
    for (const message of ["How did this quarter go?", "Compare the two periods"]) {
      const payload = fixtureAssistantReply(message);
      expect(payload.relatedQuestions).toEqual(quarterQuestions);
    }

    expect(fixtureAssistantReply("this quarter").table).toEqual({
      headers: ["Metric", "Last Quarter (Apr–Jun 2026)", "Current Quarter (Jul–Sep 2026)"],
      rows: [
        ["Income", "$48,210", "$56,180"],
        ["Net Profit", "$18,640", "$24,202"],
      ],
    });
  });

  it("returns margin follow-ups for margin and gross", () => {
    expect(fixtureAssistantReply("what's my margin").relatedQuestions).toEqual(marginQuestions);
    expect(fixtureAssistantReply("gross profit").relatedQuestions).toEqual(marginQuestions);
  });

  it("returns income follow-ups for income and source", () => {
    expect(fixtureAssistantReply("income breakdown").relatedQuestions).toEqual(incomeQuestions);
    expect(fixtureAssistantReply("top source").relatedQuestions).toEqual(incomeQuestions);
  });

  it("returns the default follow-ups and no table", () => {
    const payload = fixtureAssistantReply("hello there");
    expect(payload.relatedQuestions).toEqual(defaultQuestions);
    expect(payload.table).toBeNull();
  });
});

describe("sanitizeContext", () => {
  it("turns null and undefined into an empty string", () => {
    expect(sanitizeContext(null)).toBe("");
    expect(sanitizeContext(undefined)).toBe("");
  });

  it("replaces newlines and carriage returns with spaces", () => {
    expect(sanitizeContext("line1\nline2\rline3\r\nline4")).toBe("line1 line2 line3 line4");
  });

  it("caps the result at 100 characters", () => {
    expect(sanitizeContext("a".repeat(150))).toBe("a".repeat(100));
    expect(sanitizeContext("a".repeat(150)).length).toBeLessThanOrEqual(100);
  });
});

describe("sanitizeHistory", () => {
  it("returns an empty list for non-arrays", () => {
    expect(sanitizeHistory(null)).toEqual([]);
    expect(sanitizeHistory(undefined)).toEqual([]);
    expect(sanitizeHistory("user said hi")).toEqual([]);
    expect(sanitizeHistory({ role: "user", content: "hi" })).toEqual([]);
  });

  it("drops null entries and roles other than user or assistant", () => {
    expect(
      sanitizeHistory([
        null,
        { role: "system", content: "secret" },
        { role: "tool", content: "lookup" },
        { role: "user", content: "kept" },
      ]),
    ).toEqual([{ role: "user", content: "kept" }]);
  });

  it("slices content to 1000 characters and keeps only the last 6 entries", () => {
    const long = "y".repeat(1000);
    const history = sanitizeHistory([
      { role: "user", content: "dropped-oldest" },
      { role: "assistant", content: `${long}${"z".repeat(50)}` },
      { role: "user", content: "second" },
      { role: "assistant", content: "third" },
      { role: "user", content: "fourth" },
      { role: "assistant", content: "fifth" },
      { role: "user", content: "sixth" },
    ]);

    expect(history).toEqual([
      { role: "assistant", content: long },
      { role: "user", content: "second" },
      { role: "assistant", content: "third" },
      { role: "user", content: "fourth" },
      { role: "assistant", content: "fifth" },
      { role: "user", content: "sixth" },
    ]);
    expect(history[0].content).toHaveLength(1000);
  });
});

describe("parseGrokPayload", () => {
  it("parses a fenced json payload", () => {
    const raw = [
      "```json",
      JSON.stringify({
        reply: "Income rose.",
        rationale: "Compared demo quarters.",
        relatedQuestions: ["Why?", "Margin?", "Sources?"],
      }),
      "```",
    ].join("\n");

    expect(parseGrokPayload(raw, "unused")).toMatchObject({
      reply: "Income rose.",
      rationale: "Compared demo quarters.",
      relatedQuestions: ["Why?", "Margin?", "Sources?"],
    });
  });

  it("falls back to fixture related questions when reply is missing", () => {
    const raw = JSON.stringify({
      rationale: "unused",
      relatedQuestions: ["should not win"],
    });
    const message = "how does this quarter compare";

    expect(parseGrokPayload(raw, message).relatedQuestions).toEqual(
      fixtureAssistantReply(message).relatedQuestions,
    );
  });

  it("uses non-empty raw text as the reply when JSON is invalid", () => {
    const raw = "The books show a surplus.";
    const message = "what is my margin";
    const parsed = parseGrokPayload(raw, message);

    expect(parsed.reply).toBe(raw);
    expect(parsed.relatedQuestions).toEqual(fixtureAssistantReply(message).relatedQuestions);
  });

  it("turns a non-array relatedQuestions value into an empty list", () => {
    const raw = JSON.stringify({
      reply: "Answer",
      rationale: "Why",
      relatedQuestions: "not-an-array",
    });

    expect(parseGrokPayload(raw, "hello").relatedQuestions).toEqual([]);
  });

  it("drops blank follow-ups", () => {
    const raw = JSON.stringify({
      reply: "Answer",
      rationale: "Why",
      relatedQuestions: ["Keep me", "   ", "", null],
    });

    expect(parseGrokPayload(raw, "hello").relatedQuestions).toEqual(["Keep me"]);
  });

  it("keeps at most three follow-ups", () => {
    const raw = JSON.stringify({
      reply: "Answer",
      rationale: "Why",
      relatedQuestions: ["one", "two", "three", "four", "five"],
    });

    expect(parseGrokPayload(raw, "hello").relatedQuestions).toEqual(["one", "two", "three"]);
  });
});

describe("fillRelatedQuestions", () => {
  it("replaces an empty follow-up list from the fixture for that message", () => {
    const parsed = { reply: "Answer", relatedQuestions: [] };
    const message = "compare the periods";

    const result = fillRelatedQuestions(parsed, message);

    expect(result).toBe(parsed);
    expect(result.relatedQuestions).toEqual(fixtureAssistantReply(message).relatedQuestions);
  });

  it("leaves a non-empty follow-up list unchanged", () => {
    const relatedQuestions = ["Already asked"];
    const parsed = { reply: "Answer", relatedQuestions };

    const result = fillRelatedQuestions(parsed, "compare the periods");

    expect(result).toBe(parsed);
    expect(result.relatedQuestions).toBe(relatedQuestions);
  });
});
