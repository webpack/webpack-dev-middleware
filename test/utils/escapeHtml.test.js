import escapeHtml from "../../src/utils/escapeHtml";

describe("escapeHtml", () => {
  it("should work", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml("test")).toBe("test");
    expect(escapeHtml("\"&'<>test")).toBe("&quot;&amp;&#39;&lt;&gt;test");
    expect(escapeHtml("\"&'test<>")).toBe("&quot;&amp;&#39;test&lt;&gt;");
    expect(escapeHtml("test\"&'<>")).toBe("test&quot;&amp;&#39;&lt;&gt;");
  });
});
