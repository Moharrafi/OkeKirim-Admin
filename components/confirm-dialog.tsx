"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/currency"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  amount?: number
  amountLabel?: string
  orderCount?: number
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  amount,
  amountLabel = "Jumlah Bayar",
  orderCount,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm rounded-2xl p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {title}
          </DialogTitle>
          {message && (
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {message}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Amount and order count display */}
        {amount !== undefined && (
          <div className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{amountLabel}</span>
              <span className="text-lg font-bold text-primary">
                Rp {formatCurrency(amount)}
              </span>
            </div>
            {orderCount !== undefined && orderCount > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Jumlah Orderan</span>
                <span className="text-sm font-semibold text-foreground">
                  {orderCount} orderan
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-row gap-3 mt-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
