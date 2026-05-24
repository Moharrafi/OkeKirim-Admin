import { describe, it, expect } from "vitest"
import {
  orderFormSchema,
  fileUploadSchema,
  validateOrderForm,
  type OrderFormData,
} from "./order-form"

describe("orderFormSchema", () => {
  const validData: OrderFormData = {
    lokasiMuat: "Jakarta",
    lokasiBongkar: "Surabaya",
    argo: 50000,
    orderType: "online",
    date: "2024-01-15",
  }

  it("accepts valid order form data", () => {
    const result = orderFormSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("accepts data with optional driverId", () => {
    const result = orderFormSchema.safeParse({ ...validData, driverId: "driver-123" })
    expect(result.success).toBe(true)
  })

  it("rejects empty lokasiMuat", () => {
    const result = orderFormSchema.safeParse({ ...validData, lokasiMuat: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Lokasi muat wajib diisi")
    }
  })

  it("rejects whitespace-only lokasiMuat", () => {
    const result = orderFormSchema.safeParse({ ...validData, lokasiMuat: "   " })
    expect(result.success).toBe(false)
  })

  it("rejects empty lokasiBongkar", () => {
    const result = orderFormSchema.safeParse({ ...validData, lokasiBongkar: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Lokasi bongkar wajib diisi")
    }
  })

  it("rejects argo below 1000", () => {
    const result = orderFormSchema.safeParse({ ...validData, argo: 999 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Nilai argo tidak valid (minimum Rp 1.000)")
    }
  })

  it("accepts argo at minimum boundary (1000)", () => {
    const result = orderFormSchema.safeParse({ ...validData, argo: 1000 })
    expect(result.success).toBe(true)
  })

  it("accepts argo at maximum boundary (999999999)", () => {
    const result = orderFormSchema.safeParse({ ...validData, argo: 999999999 })
    expect(result.success).toBe(true)
  })

  it("rejects argo above 999999999", () => {
    const result = orderFormSchema.safeParse({ ...validData, argo: 1000000000 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Nilai argo tidak valid (maksimum Rp 999.999.999)")
    }
  })

  it("rejects invalid orderType", () => {
    const result = orderFormSchema.safeParse({ ...validData, orderType: "invalid" })
    expect(result.success).toBe(false)
  })

  it("rejects empty date", () => {
    const result = orderFormSchema.safeParse({ ...validData, date: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Tanggal wajib diisi")
    }
  })
})

describe("fileUploadSchema", () => {
  it("accepts valid JPEG file", () => {
    const result = fileUploadSchema.safeParse({ size: 1024 * 1024, type: "image/jpeg" })
    expect(result.success).toBe(true)
  })

  it("accepts valid JPG file", () => {
    const result = fileUploadSchema.safeParse({ size: 2 * 1024 * 1024, type: "image/jpg" })
    expect(result.success).toBe(true)
  })

  it("accepts valid PNG file", () => {
    const result = fileUploadSchema.safeParse({ size: 3 * 1024 * 1024, type: "image/png" })
    expect(result.success).toBe(true)
  })

  it("accepts file at exactly 5MB", () => {
    const result = fileUploadSchema.safeParse({ size: 5 * 1024 * 1024, type: "image/png" })
    expect(result.success).toBe(true)
  })

  it("rejects file larger than 5MB", () => {
    const result = fileUploadSchema.safeParse({ size: 5 * 1024 * 1024 + 1, type: "image/png" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Ukuran file maksimal 5MB")
    }
  })

  it("rejects invalid file type", () => {
    const result = fileUploadSchema.safeParse({ size: 1024, type: "application/pdf" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Format file harus JPG atau PNG")
    }
  })
})

describe("validateOrderForm", () => {
  const validData: OrderFormData = {
    lokasiMuat: "Jakarta",
    lokasiBongkar: "Surabaya",
    argo: 50000,
    orderType: "online",
    date: "2024-01-15",
  }

  it("returns valid: true for valid data", () => {
    const result = validateOrderForm(validData)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it("returns errors for multiple invalid fields", () => {
    const result = validateOrderForm({
      lokasiMuat: "",
      lokasiBongkar: "",
      argo: 500,
      orderType: "online",
      date: "2024-01-15",
    })
    expect(result.valid).toBe(false)
    expect(result.errors.lokasiMuat).toBe("Lokasi muat wajib diisi")
    expect(result.errors.lokasiBongkar).toBe("Lokasi bongkar wajib diisi")
    expect(result.errors.argo).toBe("Nilai argo tidak valid (minimum Rp 1.000)")
  })

  it("returns only the first error per field", () => {
    const result = validateOrderForm({
      lokasiMuat: "",
      lokasiBongkar: "Valid",
      argo: 5000,
      orderType: "online",
      date: "2024-01-15",
    })
    expect(result.valid).toBe(false)
    expect(Object.keys(result.errors)).toEqual(["lokasiMuat"])
  })
})
