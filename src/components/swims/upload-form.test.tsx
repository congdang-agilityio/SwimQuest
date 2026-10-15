// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import vi from "../../../messages/vi/swims.json";
import { UploadForm } from "./upload-form";

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("UploadForm busy state", () => {
  it("shows busy text and disables the input and button while the upload is pending", async () => {
    vitest.stubGlobal(
      "fetch",
      vitest.fn(() => new Promise(() => {})),
    );
    const { container } = render(
      <NextIntlClientProvider locale="vi" messages={{ swims: vi }}>
        <UploadForm />
      </NextIntlClientProvider>,
    );
    const input = screen.getByLabelText(vi.connect.upload) as HTMLInputElement;
    const file = new File(["<gpx/>"], "swim.gpx", { type: "application/gpx+xml" });
    // jsdom's FormData ignores files set programmatically, so hand the file over directly.
    vitest.stubGlobal(
      "FormData",
      class {
        get = () => file;
      },
    );
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(vi.connect.busy));
    expect(container.querySelector("form")!.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(input.disabled).toBe(true);
  });
});
