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
import { cn } from "@/lib/utils"

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
  const isDestructive = 
    confirmText.toLowerCase().includes("hapus") || 
    title.toLowerCase().includes("hapus") ||
    confirmText.toLowerCase().includes("delete") || 
    title.toLowerCase().includes("delete");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-[340px] rounded-[28px] p-6 gap-0 border-none shadow-xl bg-card"
      >
        <DialogHeader className="space-y-2 flex flex-col items-center justify-center">
          <DialogTitle className="text-lg font-bold text-foreground text-center leading-tight">
            {title}
          </DialogTitle>
          {message && (
            <DialogDescription className="text-xs text-muted-foreground text-center leading-relaxed mt-1 px-1">
              {message}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Amount and order count display styled professionally */}
        {amount !== undefined && (
          <div className="w-full mt-4 py-3 px-4 bg-secondary/40 border border-border/40 rounded-2xl space-y-1 my-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center">
              {amountLabel}
            </p>
            <p className="text-lg font-black text-primary text-center leading-none">
              Rp {formatCurrency(amount)}
            </p>
            {orderCount !== undefined && orderCount > 1 && (
              <p className="text-[9px] text-muted-foreground text-center font-bold border-t border-border/40 pt-1.5 mt-1.5">
                {orderCount} Orderan
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-row gap-3 mt-6 justify-center items-center w-full">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-full border border-border bg-transparent text-foreground font-bold hover:bg-secondary/40 active:scale-95 transition-all text-xs"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            className={cn(
              "flex-1 h-12 rounded-full font-bold active:scale-95 transition-all border-none text-xs text-white",
              isDestructive 
                ? "bg-red-600 hover:bg-red-500 shadow-md shadow-red-500/10" 
                : "bg-primary hover:bg-primary/95 shadow-md shadow-primary/10"
            )}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
