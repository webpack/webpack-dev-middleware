import path from "node:path";
import ts from "typescript";

describe("wrapper types", () => {
  it("exposes each wrapper's middleware API and preserves request/response types", () => {
    const program = ts.createProgram(
      [path.resolve(__dirname, "fixtures/types/wrappers.cts")],
      {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        types: ["node"],
      },
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    ).toEqual([]);
  });
});
