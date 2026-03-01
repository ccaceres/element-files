import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenEntryScreen } from "@/auth/TokenEntryScreen";

const setTokenMock = vi.fn();
const setMatrixTokenMock = vi.fn();
const clearExpiredStateMock = vi.fn();
const validateTokenMock = vi.fn();

vi.mock("@/auth/TokenContext", () => ({
  useTokenContext: () => ({
    setToken: setTokenMock,
    setMatrixToken: setMatrixTokenMock,
    matrixHomeserver: "https://matrix.bsdu.eu",
    status: "none",
    clearExpiredState: clearExpiredStateMock,
  }),
}));

vi.mock("@/api/teams", () => ({
  validateToken: (...args: unknown[]) => validateTokenMock(...args),
}));

describe("TokenEntryScreen", () => {
  beforeEach(() => {
    setTokenMock.mockReset();
    setMatrixTokenMock.mockReset();
    clearExpiredStateMock.mockReset();
    validateTokenMock.mockReset();
    setMatrixTokenMock.mockResolvedValue(true);
    validateTokenMock.mockResolvedValue({ valid: false, status: 401, message: "Unauthorized" });
  });

  it("submits token and calls onSuccess when valid", async () => {
    setTokenMock.mockResolvedValue(true);
    const onSuccess = vi.fn();

    render(<TokenEntryScreen onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Microsoft 365 Token (required)"), {
      target: { value: "token-value" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByRole("button", { name: "Connecting..." })).toBeInTheDocument();
    await Promise.resolve();

    expect(setTokenMock).toHaveBeenCalledWith("token-value");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows error when token validation fails", async () => {
    setTokenMock.mockResolvedValue(false);

    render(<TokenEntryScreen />);

    fireEvent.change(screen.getByLabelText("Microsoft 365 Token (required)"), {
      target: { value: "invalid" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByText(/Graph \/me returned 401 Unauthorized/i),
    ).toBeInTheDocument();
    expect(setTokenMock).toHaveBeenCalledWith("invalid");
  });
});

