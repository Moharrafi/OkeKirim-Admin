"use client"

import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmText = "Ya, Lanjutkan", cancelText = "Batal", onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <div className="flex gap-3 mt-5">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
