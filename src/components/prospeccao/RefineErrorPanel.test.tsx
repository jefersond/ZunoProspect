import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RefineErrorPanel } from "./RefineErrorPanel";

describe("RefineErrorPanel", () => {
  it("shows the public code and retry action without exposing request id", () => {
    const html = renderToStaticMarkup(
      <RefineErrorPanel
        error={{
          success: false,
          request_id: "8fd50939-bbef-4dc6-a337-aa8168cc25d1",
          public_error_code: "ZUN-REF-CC25D1",
          category: "timeout_error",
          safe_message: "A operação demorou. Tente novamente.",
          retryable: true,
          error_code: "REFINE_PROVIDER_TIMEOUT",
        }}
        onRetry={() => undefined}
      />,
    );
    expect(html).toContain("ZUN-REF-CC25D1");
    expect(html).toContain("Tentar novamente");
    expect(html).toContain("Reportar problema");
    expect(html).not.toContain("8fd50939-bbef-4dc6-a337-aa8168cc25d1");
  });

  it("does not offer retry for a permanent error", () => {
    const html = renderToStaticMarkup(
      <RefineErrorPanel error={{
        success: false,
        request_id: "request-private",
        public_error_code: "ZUN-REF-000001",
        category: "validation_error",
        safe_message: "Dados inválidos.",
        retryable: false,
      }} />,
    );
    expect(html).not.toContain("Tentar novamente");
  });
});
