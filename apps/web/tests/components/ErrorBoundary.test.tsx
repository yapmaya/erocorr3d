// apps/web/tests/components/ErrorBoundary.test.tsx

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";

function Bomb(): never {
  throw new Error("test patlaması");
}

describe("ErrorBoundary", () => {
  it("hata fırlatmayan alt bileşeni olduğu gibi render eder", () => {
    render(
      <ErrorBoundary>
        <div>çocuk içerik</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("çocuk içerik")).toBeTruthy();
  });

  it("render sırasında fırlatılan hatayı yakalar ve düşme ekranını gösterir", () => {
    // React, error boundary testlerinde konsola beklenen bir hata yazar — bunu bilerek susturuyoruz.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Beklenmeyen bir hata oluştu")).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});
