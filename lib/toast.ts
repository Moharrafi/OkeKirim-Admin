import { toast } from 'sonner'

/**
 * Show a success toast notification with 3s auto-dismiss and slide-in animation from top.
 * Requirements: 1.3
 */
export function showSuccessToast(message: string) {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
  })
}

/**
 * Show a persistent error toast with an optional "Coba Lagi" retry button.
 * The toast remains visible until the user dismisses it or presses retry.
 * Requirements: 1.4
 */
export function showErrorToast(message: string, onRetry?: () => void) {
  toast.error(message, {
    duration: Infinity,
    position: 'top-center',
    ...(onRetry && {
      action: {
        label: 'Coba Lagi',
        onClick: onRetry,
      },
    }),
  })
}

/**
 * Show a persistent timeout error toast with message "Waktu permintaan habis"
 * and an optional "Coba Lagi" retry button.
 * Requirements: 1.6
 */
export function showTimeoutToast(onRetry?: () => void) {
  toast.error('Waktu permintaan habis', {
    duration: Infinity,
    position: 'top-center',
    ...(onRetry && {
      action: {
        label: 'Coba Lagi',
        onClick: onRetry,
      },
    }),
  })
}
