import { z } from "zod"

export const orderFormSchema = z.object({
  lokasiMuat: z
    .string()
    .trim()
    .min(1, "Lokasi muat wajib diisi"),
  lokasiBongkar: z
    .string()
    .trim()
    .min(1, "Lokasi bongkar wajib diisi"),
  argo: z
    .number()
    .min(1000, "Nilai argo tidak valid (minimum Rp 1.000)")
    .max(999999999, "Nilai argo tidak valid (maksimum Rp 999.999.999)"),
  orderType: z.enum(["online", "offline"]),
  date: z.string().min(1, "Tanggal wajib diisi"),
  driverId: z.string().optional(),
})

export const fileUploadSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Ukuran file maksimal 5MB"),
  type: z.enum(["image/jpeg", "image/jpg", "image/png"], {
    errorMap: () => ({ message: "Format file harus JPG atau PNG" }),
  }),
})

export type OrderFormData = z.infer<typeof orderFormSchema>
export type FileUploadData = z.infer<typeof fileUploadSchema>

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateOrderForm(data: OrderFormData): ValidationResult {
  const result = orderFormSchema.safeParse(data)

  if (result.success) {
    return { valid: true, errors: {} }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field && !errors[String(field)]) {
      errors[String(field)] = issue.message
    }
  }

  return { valid: false, errors }
}
