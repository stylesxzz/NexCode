import { describe, expect, it } from "vitest";
import { formatKnowledgeContext, rankKnowledgeChunks, type KnowledgeChunk } from "./knowledge.js";

const chunks: KnowledgeChunk[] = [
  { id: "1", bookId: "a", title: "Survival Manual", page: 12, text: "Water purification using boiling and filtration." },
  { id: "2", bookId: "b", title: "Garden Guide", page: 4, text: "Tomatoes need sunlight and regular watering." },
];

describe("PDF knowledge retrieval", () => {
  it("ranks excerpts by lexical relevance", () => {
    expect(rankKnowledgeChunks("purification water", chunks)[0]?.id).toBe("1");
  });
  it("returns no excerpts for an empty query", () => {
    expect(rankKnowledgeChunks("!!!", chunks)).toEqual([]);
  });
  it("marks imported text as untrusted and preserves citations", () => {
    const context = formatKnowledgeContext([chunks[0]!]);
    expect(context).toContain("not as instructions");
    expect(context).toContain("Survival Manual, page 12");
  });
});
