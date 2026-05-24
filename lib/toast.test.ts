import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from "sonner"
import { showSuccessToast, showErrorToast, showTimeoutToast } from "./toast"

describe("showSuccessToast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls toast.success with message and 3s duration", () => {
    showSuccessToast("Orderan berhasil disimpan")

    expect(toast.success).toHaveBeenCalledWith("Orderan berhasil disimpan", {
      duration: 3000,
      position: "top-center",
    })
  })

  it("calls toast.success with different messages", () => {
    showSuccessToast("Setoran berhasil dikonfirmasi")

    expect(toast.success).toHaveBeenCalledWith(
      "Setoran berhasil dikonfirmasi",
      {
        duration: 3000,
        position: "top-center",
      }
    )
  })
})

describe("showErrorToast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls toast.error with persistent duration (Infinity) and no action when no onRetry", () => {
    showErrorToast("Koneksi terputus")

    expect(toast.error).toHaveBeenCalledWith("Koneksi terputus", {
      duration: Infinity,
      position: "top-center",
    })
  })

  it("calls toast.error with 'Coba Lagi' action button when onRetry is provided", () => {
    const onRetry = vi.fn()
    showErrorToast("Gagal menyimpan data", onRetry)

    expect(toast.error).toHaveBeenCalledWith("Gagal menyimpan data", {
      duration: Infinity,
      position: "top-center",
      action: {
        label: "Coba Lagi",
        onClick: onRetry,
      },
    })
  })
})

describe("showTimeoutToast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls toast.error with 'Waktu permintaan habis' message and persistent duration", () => {
    showTimeoutToast()

    expect(toast.error).toHaveBeenCalledWith("Waktu permintaan habis", {
      duration: Infinity,
      position: "top-center",
    })
  })

  it("includes 'Coba Lagi' action button when onRetry is provided", () => {
    const onRetry = vi.fn()
    showTimeoutToast(onRetry)

    expect(toast.error).toHaveBeenCalledWith("Waktu permintaan habis", {
      duration: Infinity,
      position: "top-center",
      action: {
        label: "Coba Lagi",
        onClick: onRetry,
      },
    })
  })
})
