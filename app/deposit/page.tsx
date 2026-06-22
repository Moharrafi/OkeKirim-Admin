"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Smartphone,
  Banknote,
  CheckCircle2,
  Upload,
  ChevronRight,
  MapPin,
  FileText,
  Clock,
  X,
  Image as ImageIcon,
  CheckSquare,
  Trash2,
  Pencil,
  Search,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isOverdue, groupOrdersByDate, filterOrders } from "@/lib/utils/orders"
import { formatCurrency } from "@/lib/utils/currency"
import { useUser } from "@/lib/user-context"
import { fetchSchedules, fetchPendingSchedules, fetchDrivers, createOrder, type Schedule, type Driver } from "@/lib/okekirim-api"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { orderFormSchema, fileUploadSchema, type OrderFormData } from "@/lib/schemas/order-form"
import { FormField } from "@/components/ui/form-field"
import { SkeletonOrderList } from "@/components/ui/skeleton-order-list"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Textarea } from "@/components/ui/textarea"
import { LocationAutocomplete } from "@/components/ui/location-autocomplete"
import { loadLocationHistory, saveLocationToHistory } from "@/lib/utils/location-history"
import { showSuccessToast, showErrorToast, showTimeoutToast } from "@/lib/toast"
import { SearchInput } from "@/components/ui/search-input"
import { SwipeBackDetector } from "@/components/ui/swipe-back-detector"
import { ANDROID_BACK_EVENT } from "@/components/android-back-handler"
import { StepIndicator } from "@/components/ui/step-indicator"
import { SuccessPage } from "@/components/deposit/success-page"
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport"
import {
  parseManualPaymentAmount,
  resolveDepositPaymentAmount,
  shouldAutoRecordPartialFromProof,
} from "@/lib/deposit-payment"
import { getBatchItemDepositDue } from "@/lib/deposit-batch"

type MainTab = "orderan" | "setoran"
type OrderType = "online" | "offline"
type ViewState = "list" | "detail" | "batch" | "success"
type ProofOcrStatus = "idle" | "reading" | "matched" | "mismatch" | "not_found" | "failed"

// Tab index mapping for direction detection (constant, outside component)
const TAB_INDEX: Record<MainTab, number> = { orderan: 0, setoran: 1 }
const PROOF_AMOUNT_TOLERANCE = 100
const REQUIRED_TRANSFER_RECIPIENT = "GITA VEBBY ILLAHY"

interface Order {
  id: string
  driver: string
  driverId: string
  vehicle: string
  lokasiMuat: string
  lokasiBongkar: string
  argo: number
  companyShare: number
  paidAmount: number
  sisa: number
  type: OrderType
  date: string
  rawDate: string
  time: string
  status: string
  isOverdue7: boolean
}

function parseCurrencyToken(token: string) {
  const compact = token.replace(/\s/g, "")
  if (!compact) return 0

  const lastDot = compact.lastIndexOf(".")
  const lastComma = compact.lastIndexOf(",")
  const lastSeparator = Math.max(lastDot, lastComma)
  let integerPart = compact

  if (lastSeparator >= 0) {
    const decimalPart = compact.slice(lastSeparator + 1)
    const integerCandidate = compact.slice(0, lastSeparator)
    const hasMultipleSeparators = (compact.match(/[.,]/g) || []).length > 1
    const decimalLooksLikeCents = /^\d{2}$/.test(decimalPart)
    const decimalLooksLikeOcrCents = /^00\d$/.test(decimalPart) && hasMultipleSeparators
    const integerHasCurrencyGrouping = /[.,]\d{3}$/.test(integerCandidate)

    if (decimalLooksLikeCents || (decimalLooksLikeOcrCents && (hasMultipleSeparators || integerHasCurrencyGrouping))) {
      integerPart = integerCandidate
    }
  }

  const digits = integerPart.replace(/\D/g, "")
  return digits ? Number(digits) : 0
}

function extractTransferAmount(text: string) {
  const normalized = text.replace(/[Oo]/g, "0")
  const matches = Array.from(normalized.matchAll(/(?:RP|IDR)\s*[:.]?\s*([0-9][0-9.,\s]{2,})/gi))
  const amounts = matches
    .map((match) => parseCurrencyToken(match[1] || ""))
    .filter((amount) => amount >= 1000 && amount <= 999999999)

  if (amounts.length === 0) return null
  return Math.max(...amounts)
}

function isAmountMismatch(expected: number, detected: number | null) {
  if (!detected || expected <= 0) return false
  return Math.abs(expected - detected) > PROOF_AMOUNT_TOLERANCE
}

function normalizeRecipientText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/1/g, "I")
    .replace(/0/g, "O")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/[^A-Z]/g, "")
}

function recipientSimilarity(candidate: string) {
  const target = normalizeRecipientText(REQUIRED_TRANSFER_RECIPIENT)
  const normalizedCandidate = normalizeRecipientText(candidate)
  if (!normalizedCandidate) return 0
  if (normalizedCandidate.includes(target)) return 1

  const rows = target.length + 1
  const cols = normalizedCandidate.length + 1
  const distances = Array.from({ length: rows }, (_, row) => Array(cols).fill(row))
  for (let col = 0; col < cols; col++) distances[0][col] = col

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const cost = target[row - 1] === normalizedCandidate[col - 1] ? 0 : 1
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + cost
      )
    }
  }

  const distance = distances[target.length][normalizedCandidate.length]
  return 1 - distance / Math.max(target.length, normalizedCandidate.length)
}

function extractTransferRecipient(text: string) {
  const requiredWords = REQUIRED_TRANSFER_RECIPIENT.split(" ")
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const directLine = lines.find((line) => {
    const normalizedLine = line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
    return requiredWords.every((word) => normalizedLine.includes(word))
  })

  if (directLine) {
    return { matched: true, detectedName: directLine }
  }

  const destinationRecipientLine = lines.find((line, index) => {
    const previousLineLooksLikeDestination = /^ke\s*\d+/i.test(lines[index - 1] || "")
    const letterCount = (line.match(/[A-Za-z]/g) || []).length
    const nonRecipientPattern = /^(BCA|BRI|BNI|MANDIRI|CIMB|DANA|OVO|GOPAY|SHOPEEPAY|RP|IDR|ADMIN|BIAYA|TOTAL)/i
    return previousLineLooksLikeDestination && letterCount >= 3 && !nonRecipientPattern.test(line)
  })

  if (destinationRecipientLine) {
    const score = recipientSimilarity(destinationRecipientLine)
    return { matched: score >= 0.82, detectedName: destinationRecipientLine }
  }

  const ignoredLinePattern = /^(M[\s-]?TRANSFER|TRANSFER|BERHASIL|GAGAL|PENDING|BCA|RP|IDR|ADMIN|BIAYA|TOTAL|NO\.?|REF|TANGGAL|DARI|KE\s*\d+)/i
  const candidateLines = lines.filter((line, index) => {
    const letterCount = (line.match(/[A-Za-z]/g) || []).length
    const previousLineLooksLikeDestination = /^ke\s*\d+/i.test(lines[index - 1] || "")
    return letterCount >= 6 && (previousLineLooksLikeDestination || !ignoredLinePattern.test(line))
  })

  let bestCandidate: { line: string; score: number } | null = null
  for (const line of candidateLines) {
    const score = recipientSimilarity(line)
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { line, score }
    }
  }

  if (bestCandidate && bestCandidate.score >= 0.82) {
    return { matched: true, detectedName: bestCandidate.line }
  }

  return {
    matched: false,
    detectedName: bestCandidate?.score && bestCandidate.score >= 0.45 ? bestCandidate.line : null,
  }
}

export default function DepositPage() {
  const router = useRouter()
  const { isAdmin, isDriver, user, isAuthenticated } = useUser()

  // Keyboard viewport adjustment for mobile (Requirement 5.5)
  useKeyboardViewport()
  const [mainTab, setMainTab] = useState<MainTab>("orderan")
  const [tabAnimationClass, setTabAnimationClass] = useState<string>("")
  const tabContentRef = useRef<HTMLDivElement>(null)
  const prevTabRef = useRef<MainTab>("orderan")

  // Tab index mapping for direction detection
  const handleTabSwitch = useCallback((newTab: MainTab) => {
    if (newTab === mainTab) return

    // Cancel any running animation by forcing a reflow
    if (tabContentRef.current) {
      tabContentRef.current.getAnimations().forEach(anim => anim.cancel())
    }

    // Determine direction based on tab index
    const direction = TAB_INDEX[newTab] > TAB_INDEX[prevTabRef.current]
      ? "animate-tab-slide-right"  // Moving to higher index: content slides in from right
      : "animate-tab-slide-left"   // Moving to lower index: content slides in from left

    setTabAnimationClass(direction)
    prevTabRef.current = newTab
    setMainTab(newTab)

    // Clear animation class after animation completes (200ms)
    setTimeout(() => {
      setTabAnimationClass("")
    }, 200)
  }, [mainTab])
  
  // Read tab from URL params (e.g. /deposit?tab=setoran)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab")
    if (tab === "setoran") {
      setMainTab("setoran")
      prevTabRef.current = "setoran"
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  // Input Orderan States
  const [selectedDriver, setSelectedDriver] = useState("")
  const [argo, setArgo] = useState("")
  const [orderType, setOrderType] = useState<OrderType>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("default_order_type")
      if (stored === "online" || stored === "offline") return stored
    }
    return "online"
  })
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0])
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [showOrderConfirm, setShowOrderConfirm] = useState(false)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)

  // react-hook-form with Zod validation for order input
  const {
    register,
    formState: { errors, touchedFields },
    trigger,
    setValue: setFormValue,
    watch,
    reset: resetForm,
    clearErrors,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    mode: "onBlur",
    defaultValues: {
      lokasiMuat: "",
      lokasiBongkar: "",
      argo: 0,
      orderType: "online",
      date: new Date().toISOString().split("T")[0],
      driverId: undefined,
    },
  })

  const lokasiMuat = watch("lokasiMuat")
  const lokasiBongkar = watch("lokasiBongkar")

  // Location history state (Requirement 5.1)
  const [locationHistory, setLocationHistory] = useState<{ value: string; frequency: number }[]>([])

  // Load location history on mount
  useEffect(() => {
    if (user?.id) {
      const history = loadLocationHistory(user.id)
      setLocationHistory(history)
    }
  }, [user?.id])

  // Setoran States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [showBatchPayment, setShowBatchPayment] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [fileUploadError, setFileUploadError] = useState<string | null>(null)
  const [proofOcrAmount, setProofOcrAmount] = useState<number | null>(null)
  const [proofOcrRecipient, setProofOcrRecipient] = useState<string | null>(null)
  const [proofOcrRecipientMatched, setProofOcrRecipientMatched] = useState<boolean | null>(null)
  const [proofOcrStatus, setProofOcrStatus] = useState<ProofOcrStatus>("idle")
  const [proofOcrError, setProofOcrError] = useState<string | null>(null)
  const [proofMismatchReason, setProofMismatchReason] = useState("")
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false)
  const [showDepositSuccess, setShowDepositSuccess] = useState(false)
  const [depositSuccessData, setDepositSuccessData] = useState<{
    driverName: string
    amount: number
    route: string
    batchCount?: number
  } | null>(null)
  const [batchTotal, setBatchTotal] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null)
  const [editArgo, setEditArgo] = useState("")
  const [editOrigin, setEditOrigin] = useState("")
  const [editDestination, setEditDestination] = useState("")
  const [editDate, setEditDate] = useState("")
  const [payAmount, setPayAmount] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const proofOcrRequestRef = useRef(0)

  const resetProofCheck = useCallback(() => {
    proofOcrRequestRef.current += 1
    setProofOcrAmount(null)
    setProofOcrRecipient(null)
    setProofOcrRecipientMatched(null)
    setProofOcrStatus("idle")
    setProofOcrError(null)
    setProofMismatchReason("")
  }, [])

  // Computed validation for order submit button (Requirement 2.6)
  const argoValue = parseInt(argo || "0")
  const isOrderFormValid =
    lokasiMuat.trim().length > 0 &&
    lokasiBongkar.trim().length > 0 &&
    argoValue >= 1000 &&
    argoValue <= 999999999
  const manualPaymentAmount = useMemo(() => parseManualPaymentAmount(payAmount), [payAmount])
  const depositPaymentAmount = useMemo(() => {
    if (showBatchPayment) {
      return manualPaymentAmount || batchTotal
    }
    return manualPaymentAmount || selectedOrder?.sisa || 0
  }, [batchTotal, manualPaymentAmount, selectedOrder?.sisa, showBatchPayment])
  const autoPartialFromProof = useMemo(() => shouldAutoRecordPartialFromProof({
    expectedAmount: depositPaymentAmount,
    manualAmount: manualPaymentAmount,
    proofDetectedAmount: proofOcrAmount,
    tolerance: PROOF_AMOUNT_TOLERANCE,
  }), [depositPaymentAmount, manualPaymentAmount, proofOcrAmount])
  const submittedDepositPaymentAmount = useMemo(() => resolveDepositPaymentAmount({
    expectedAmount: depositPaymentAmount,
    manualAmount: manualPaymentAmount,
    proofDetectedAmount: proofOcrAmount,
    tolerance: PROOF_AMOUNT_TOLERANCE,
  }), [depositPaymentAmount, manualPaymentAmount, proofOcrAmount])
  const autoPartialRemainingAmount = Math.max(depositPaymentAmount - submittedDepositPaymentAmount, 0)
  const depositConfirmMessage = autoPartialFromProof
    ? `Nominal bukti lebih kecil. Sistem mencatat Rp ${formatCurrency(submittedDepositPaymentAmount)} sebagai cicilan dan sisa Rp ${formatCurrency(autoPartialRemainingAmount)} tetap belum lunas.`
    : "Yakin mau melanjutkan pembayaran setoran ini?"
  const proofRecipientBlocking =
    !isAdmin &&
    Boolean(uploadedFile) &&
    proofOcrStatus !== "idle" &&
    proofOcrStatus !== "reading" &&
    proofOcrRecipientMatched !== true
  const proofNeedsReason =
    (isAdmin &&
     Boolean(uploadedFile) &&
     proofOcrStatus !== "idle" &&
     proofOcrStatus !== "reading" &&
     proofOcrStatus !== "matched" &&
     proofMismatchReason.trim().length < 3) ||
    (!isAdmin &&
     proofOcrStatus === "mismatch" &&
     proofOcrRecipientMatched === true &&
     proofMismatchReason.trim().length < 3)
  const proofCheckBlocking = proofOcrStatus === "reading" || proofNeedsReason || proofRecipientBlocking

  useEffect(() => {
    if (!proofOcrAmount || proofOcrStatus === "idle" || proofOcrStatus === "reading" || proofOcrStatus === "not_found" || proofOcrStatus === "failed") {
      return
    }

    const mismatch = isAmountMismatch(depositPaymentAmount, proofOcrAmount) || proofOcrRecipientMatched !== true
    setProofOcrStatus(mismatch ? "mismatch" : "matched")
    if (!mismatch) {
      setProofMismatchReason("")
    }
  }, [depositPaymentAmount, proofOcrAmount, proofOcrRecipientMatched, proofOcrStatus])

  // Page transition animation state
  const [viewState, setViewState] = useState<ViewState>("list")
  const [animationClass, setAnimationClass] = useState("")
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number | null>(null)
  const viewContainerRef = useRef<HTMLDivElement>(null)

  // Cancel any running animation
  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (viewContainerRef.current) {
      viewContainerRef.current.getAnimations().forEach(anim => anim.cancel())
    }
    setIsAnimating(false)
    setAnimationClass("")
  }, [])

  // Navigate to a detail/batch view with slide-in animation
  const navigateToView = useCallback((target: ViewState) => {
    if (isAnimating) {
      cancelAnimation()
    }
    // Push state so OS back button returns to list instead of leaving page
    window.history.pushState({ view: target }, "", window.location.href)
    // Scroll to top instantly when entering a new view (bypass smooth scroll)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    setViewState(target)
    setAnimationClass("animate-slide-in-right")
    setIsAnimating(true)
    animationRef.current = requestAnimationFrame(() => {
      animationRef.current = null
    })
  }, [isAnimating, cancelAnimation])

  // Handle OS back button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      // If we're in a sub-view, go back to list
      if (selectedOrder) {
        setSelectedOrder(null)
        setUploadedFile(null)
        setUploadedImage(null)
        setPayAmount("")
        setFileUploadError(null)
        resetProofCheck()
        setViewState("list")
        setAnimationClass("")
      } else if (showBatchPayment) {
        setShowBatchPayment(false)
        setUploadedFile(null)
        setUploadedImage(null)
        setPayAmount("")
        setFileUploadError(null)
        resetProofCheck()
        setViewState("list")
        setAnimationClass("")
      } else if (showDepositSuccess) {
        setShowDepositSuccess(false)
        setDepositSuccessData(null)
        setViewState("list")
        setAnimationClass("")
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [resetProofCheck, selectedOrder, showBatchPayment, showDepositSuccess])

  // Navigate back with slide-out animation
  const navigateBack = useCallback((target: ViewState, onComplete: () => void) => {
    if (isAnimating) {
      cancelAnimation()
    }
    setAnimationClass("animate-slide-out-right")
    setIsAnimating(true)
    
    let handled = false
    const handleEnd = () => {
      if (handled) return
      handled = true
      setIsAnimating(false)
      setAnimationClass("")
      setViewState(target)
      onComplete()
    }

    // Fallback timeout at 250ms in case animationend doesn't fire
    const timeout = setTimeout(handleEnd, 250)
    animationRef.current = requestAnimationFrame(() => {
      animationRef.current = null
    })

    if (viewContainerRef.current) {
      const container = viewContainerRef.current
      const onAnimEnd = () => {
        clearTimeout(timeout)
        container.removeEventListener("animationend", onAnimEnd)
        handleEnd()
      }
      container.addEventListener("animationend", onAnimEnd, { once: true })
    }
  }, [isAnimating, cancelAnimation])

  const closeBatchPaymentView = useCallback(() => {
    navigateBack("list", () => {
      setShowBatchPayment(false)
      setUploadedFile(null)
      setUploadedImage(null)
      setPayAmount("")
      setFileUploadError(null)
      resetProofCheck()
    })
  }, [navigateBack, resetProofCheck])

  const closeSinglePaymentView = useCallback(() => {
    navigateBack("list", () => {
      setSelectedOrder(null)
      setUploadedFile(null)
      setUploadedImage(null)
      setPayAmount("")
      setFileUploadError(null)
      resetProofCheck()
    })
  }, [navigateBack, resetProofCheck])

  // Fetch real data from OkeKirim API
  const [apiOrders, setApiOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [apiDrivers, setApiDrivers] = useState<Driver[]>([])
  const [filterDriver, setFilterDriver] = useState<string>("")

  const handleSuccessBack = useCallback(() => {
    setShowDepositSuccess(false)
    setDepositSuccessData(null)
    setSelectedOrder(null)
    setSelectedOrders([])
    setIsBatchMode(false)
    setShowBatchPayment(false)
    setUploadedFile(null)
    setUploadedImage(null)
    setFileUploadError(null)
    resetProofCheck()
    setPayAmount("")
    setViewState("list")
    setAnimationClass("")
    // Refresh data from server
    setLoadingOrders(true)
    const driverName = isDriver ? user.name : (filterDriver || undefined)
    fetchPendingSchedules(driverName)
      .then((schedules) => {
        const mapped: Order[] = schedules.map(s => ({
          id: `SCH${String(s.id).padStart(3, "0")}`,
          driver: s.driver || "Unknown",
          driverId: String(s.id),
          vehicle: s.vehicle || s.driverVehicle || "-",
          lokasiMuat: s.origin || "-",
          lokasiBongkar: s.destination || "-",
          argo: s.fare || 0,
          companyShare: s.companyShare || Math.round((s.fare || 0) * 0.4),
          paidAmount: s.paidCompanyAmount || 0,
          sisa: (s.companyShare || Math.round((s.fare || 0) * 0.4)) - (s.paidCompanyAmount || 0),
          type: (s.orderType === "offline" ? "offline" : "online") as OrderType,
          date: s.date ? new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-",
          rawDate: s.date ? new Date(s.date).toISOString().split("T")[0] : "",
          time: "",
          status: "pending",
          isOverdue7: s.date ? isOverdue(new Date(s.date).toISOString().split("T")[0], 7) : false,
        }))
        setApiOrders(mapped)
      })
      .catch(() => setApiOrders([]))
      .finally(() => setLoadingOrders(false))
  }, [filterDriver, isDriver, resetProofCheck, user.name])

  useEffect(() => {
    const handleAndroidBack = (event: Event) => {
      if (showOrderConfirm) {
        event.preventDefault()
        setShowOrderConfirm(false)
        return
      }

      if (showConfirm) {
        event.preventDefault()
        setShowConfirm(false)
        return
      }

      if (showDepositSuccess) {
        event.preventDefault()
        handleSuccessBack()
        return
      }

      if (showBatchPayment) {
        event.preventDefault()
        closeBatchPaymentView()
        return
      }

      if (selectedOrder) {
        event.preventDefault()
        closeSinglePaymentView()
      }
    }

    window.addEventListener(ANDROID_BACK_EVENT, handleAndroidBack)
    return () => window.removeEventListener(ANDROID_BACK_EVENT, handleAndroidBack)
  }, [
    closeBatchPaymentView,
    closeSinglePaymentView,
    handleSuccessBack,
    selectedOrder,
    showBatchPayment,
    showConfirm,
    showDepositSuccess,
    showOrderConfirm,
  ])

  // Fetch drivers on mount
  useEffect(() => {
    fetchDrivers().then(setApiDrivers).catch(() => {})
  }, [])

  useEffect(() => {
    if (mainTab === "setoran") {
      setLoadingOrders(true)
      // If driver is logged in, auto-filter by their name
      const driverName = isDriver ? user.name : (filterDriver || undefined)
      fetchPendingSchedules(driverName)
        .then((schedules) => {
          const mapped: Order[] = schedules.map(s => ({
            id: `SCH${String(s.id).padStart(3, "0")}`,
            driver: s.driver || "Unknown",
            driverId: String(s.id),
            vehicle: s.vehicle || s.driverVehicle || "-",
            lokasiMuat: s.origin || "-",
            lokasiBongkar: s.destination || "-",
            argo: s.fare || 0,
            companyShare: s.companyShare || Math.round((s.fare || 0) * 0.4),
            paidAmount: s.paidCompanyAmount || 0,
            sisa: (s.companyShare || Math.round((s.fare || 0) * 0.4)) - (s.paidCompanyAmount || 0),
            type: (s.orderType === "offline" ? "offline" : "online") as OrderType,
            date: s.date ? new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-",
            rawDate: s.date ? new Date(s.date).toISOString().split("T")[0] : "",
            time: "",
            status: "pending",
            isOverdue7: s.date ? isOverdue(new Date(s.date).toISOString().split("T")[0], 7) : false,
          }))
          setApiOrders(mapped)
        })
        .catch(() => setApiOrders([]))
        .finally(() => setLoadingOrders(false))
    }
  }, [mainTab, filterDriver, isDriver, user.name])

  const orders = apiOrders

  const filteredOrders = useMemo(() => filterOrders(orders as any, debouncedSearchQuery) as Order[], [orders, debouncedSearchQuery])
  
  // Memoize total sisa to avoid recomputing on every render
  const totalSisa = useMemo(() => filteredOrders.reduce((sum, order) => sum + order.sisa, 0), [filteredOrders])
  // Group filtered orders by date for sticky headers (Requirement 6.3)
  const groupedOrders = useMemo(() => {
    // Use rawDate directly (already in ISO format yyyy-MM-dd)
    const groups = groupOrdersByDate(filteredOrders.map(o => ({ ...o, date: o.rawDate || o.date })) as any)
    return groups.map(g => ({ ...g, orders: g.orders as unknown as Order[] }))
  }, [filteredOrders])
  const activeDrivers = apiDrivers.filter((driver) => (driver.status || "").trim().toLowerCase() === "aktif")

  // Pull-to-refresh state and logic (Requirement 1.5)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const pullStartY = useRef<number | null>(null)
  const pullContainerRef = useRef<HTMLDivElement>(null)
  const refreshAbortRef = useRef<AbortController | null>(null)

  const PULL_THRESHOLD = 60 // px to trigger refresh
  const REFRESH_TIMEOUT = 30000 // 30 seconds

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)

    const abortController = new AbortController()
    refreshAbortRef.current = abortController

    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, REFRESH_TIMEOUT)

    try {
      const driverName = isDriver ? user.name : (filterDriver || undefined)
      const schedules = await fetchPendingSchedules(driverName)

      if (abortController.signal.aborted) return

      const mapped: Order[] = schedules.map(s => ({
        id: `SCH${String(s.id).padStart(3, "0")}`,
        driver: s.driver || "Unknown",
        driverId: String(s.id),
        vehicle: s.vehicle || s.driverVehicle || "-",
        lokasiMuat: s.origin || "-",
        lokasiBongkar: s.destination || "-",
        argo: s.fare || 0,
        companyShare: s.companyShare || Math.round((s.fare || 0) * 0.4),
        paidAmount: s.paidCompanyAmount || 0,
        sisa: (s.companyShare || Math.round((s.fare || 0) * 0.4)) - (s.paidCompanyAmount || 0),
        type: (s.orderType === "offline" ? "offline" : "online") as OrderType,
        date: s.date ? new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-",
        rawDate: s.date ? new Date(s.date).toISOString().split("T")[0] : "",
            time: "",
            status: "pending",
            isOverdue7: s.date ? isOverdue(new Date(s.date).toISOString().split("T")[0], 7) : false,
      }))
      setApiOrders(mapped)
    } catch (error) {
      if (abortController.signal.aborted) {
        showErrorToast("Waktu permintaan habis", () => handleRefresh())
      } else {
        showErrorToast("Gagal memuat data. Periksa koneksi Anda.", () => handleRefresh())
      }
    } finally {
      clearTimeout(timeoutId)
      setIsRefreshing(false)
      setPullDistance(0)
      refreshAbortRef.current = null
    }
  }, [isRefreshing, isDriver, user.name, filterDriver])

  const handlePullTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return
    const container = pullContainerRef.current
    if (container && container.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY
    }
  }, [isRefreshing])

  const handlePullTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null || isRefreshing) return
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - pullStartY.current)
    // Apply resistance: the further you pull, the harder it gets
    const resistedDistance = Math.min(distance * 0.5, 100)
    setPullDistance(resistedDistance)
  }, [isRefreshing])

  const handlePullTouchEnd = useCallback(() => {
    if (pullStartY.current === null) return
    pullStartY.current = null
    if (pullDistance >= PULL_THRESHOLD) {
      handleRefresh()
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, handleRefresh])

  const handleSubmitOrder = async () => {
    setIsSubmittingOrder(true)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const driverData = activeDrivers.find(d => String(d.id) === selectedDriver)
      const result = await createOrder({
        driver: driverData?.name || user.name,
        vehicle: driverData?.vehicle || undefined,
        date: orderDate,
        origin: lokasiMuat,
        destination: lokasiBongkar,
        orderType: orderType,
        fare: parseInt(argo || "0"),
      }, { signal: controller.signal })

      clearTimeout(timeoutId)
      setIsSubmittingOrder(false)

      if (result.success) {
        // Save locations to history for autocomplete (Requirement 5.1)
        if (lokasiMuat.trim()) {
          saveLocationToHistory(user.id, lokasiMuat)
        }
        if (lokasiBongkar.trim()) {
          saveLocationToHistory(user.id, lokasiBongkar)
        }
        // Reload location history so autocomplete reflects new entries
        setLocationHistory(loadLocationHistory(user.id))

        showSuccessToast("Orderan berhasil disimpan")
        setShowOrderSuccess(true)
        setTimeout(() => {
          setShowOrderSuccess(false)
          // Clear location and argo fields
          setFormValue("lokasiMuat", "")
          setFormValue("lokasiBongkar", "")
          clearErrors()
          setArgo("")
          // Reset orderType to stored default from localStorage
          setOrderType((localStorage.getItem("default_order_type") as OrderType) || "online")
          // Preserve selectedDriver and orderDate (don't reset)
        }, 2000)
      } else if (result.error === "AbortError") {
        showTimeoutToast(() => handleSubmitOrder())
      } else {
        showErrorToast(result.error || "Gagal menyimpan orderan", () => handleSubmitOrder())
      }
    } catch (err) {
      clearTimeout(timeoutId)
      setIsSubmittingOrder(false)

      if (err instanceof DOMException && err.name === "AbortError") {
        showTimeoutToast(() => handleSubmitOrder())
      } else {
        showErrorToast("Koneksi terputus, coba lagi", () => handleSubmitOrder())
      }
    }
  }

  const handleSubmitDeposit = async () => {
    if (proofOcrStatus === "reading") {
      showErrorToast("Bukti TF masih dibaca, tunggu sebentar")
      return
    }
    if (proofRecipientBlocking) {
      showErrorToast(`Nama penerima berbeda, bukan ${REQUIRED_TRANSFER_RECIPIENT}`)
      return
    }
    if (proofNeedsReason) {
      showErrorToast("Isi alasan selisih bukti TF dulu")
      return
    }

    setIsSubmittingDeposit(true)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    // Determine which orders to mark as paid
    const orderIds = showBatchPayment
      ? selectedOrders.map(id => {
          const order = orders.find(o => o.id === id)
          return order ? parseInt(order.driverId) : 0
        }).filter(id => id > 0)
      : selectedOrder
        ? [parseInt(selectedOrder.driverId)]
        : []

    try {
      // Update payment status in database
      if (orderIds.length > 0) {
        const amountToRecord = submittedDepositPaymentAmount
        const shouldSendExplicitAmount = manualPaymentAmount > 0 || autoPartialFromProof
        const explicitAmount = shouldSendExplicitAmount ? amountToRecord : undefined
        
        // Determine payment notes
        let paymentNotes = "Lunas"
        if (amountToRecord > 0 && amountToRecord < depositPaymentAmount) {
          paymentNotes = `Cicil Rp ${amountToRecord.toLocaleString("id-ID")}`
        }

        const payResp = await fetch("/api/tarikan/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ids: orderIds, 
            paymentNotes, 
            amount: explicitAmount
          }),
          signal: controller.signal,
        })
        if (!payResp.ok) {
          throw new Error("Gagal memproses setoran")
        }
      }

      // Send Telegram notification (non-blocking, don't use abort signal)
      try {
        const order = selectedOrder || (selectedOrders.length > 0 ? orders.find(o => selectedOrders.includes(o.id)) : null)
        const totalAmount = submittedDepositPaymentAmount
        const driverName = order?.driver || user.name
        const route = order ? `${order.lokasiMuat} → ${order.lokasiBongkar}` : "-"
        const type = order?.type || "online"
        const fare = order?.argo || 0
        const companyShare = order?.companyShare || Math.round(fare * 0.4)

        // Calculate sisa setoran after this payment (ALL pending orders for this driver)
        const driverOrders = orders.filter(o => o.driver.toLowerCase() === driverName.toLowerCase())
        const currentDriverSisa = driverOrders.reduce((sum, o) => sum + o.sisa, 0)
        const sisaAfterPayment = currentDriverSisa - totalAmount

        // Build batch items for telegram
        const batchItems = showBatchPayment
          ? selectedOrders.map(id => {
              const o = orders.find(ord => ord.id === id)
              return o ? { route: `${o.lokasiMuat} → ${o.lokasiBongkar}`, fare: o.argo, companyShare: o.companyShare, type: o.type } : null
            }).filter(Boolean)
          : undefined

        batchItems?.forEach((item, index) => {
          const order = orders.find(o => o.id === selectedOrders[index])
          if (order) {
            const telegramItem = item as { sisa?: number }
            telegramItem.sisa = Math.max(order.sisa, 0)
          }
        })

        await fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driver: driverName,
            amount: totalAmount,
            route: route,
            orderType: type,
            fare: fare,
            companyShare,
            imageBase64: uploadedImage || undefined,
            batchItems: batchItems,
            sisaSetoran: sisaAfterPayment > 0 ? sisaAfterPayment : undefined,
            proofDetectedAmount: proofOcrAmount || undefined,
            proofMismatchReason: proofOcrStatus === "mismatch" ? proofMismatchReason.trim() : undefined,
          }),
        })
      } catch {
        // Don't block deposit if Telegram fails
      }

      clearTimeout(timeoutId)
      setIsSubmittingDeposit(false)
      showSuccessToast("Setoran berhasil dikonfirmasi")

      // Store success data for SuccessPage component
      const order = selectedOrder || (selectedOrders.length > 0 ? orders.find(o => selectedOrders.includes(o.id)) : null)
      const totalAmount = submittedDepositPaymentAmount
      const successDriverName = order?.driver || user.name
      const successRoute = showBatchPayment
        ? `${selectedOrders.length} orderan (batch)`
        : order ? `${order.lokasiMuat} → ${order.lokasiBongkar}` : "-"

      setDepositSuccessData({
        driverName: successDriverName,
        amount: totalAmount,
        route: successRoute,
        batchCount: showBatchPayment ? selectedOrders.length : undefined,
      })
      setShowDepositSuccess(true)
      navigateToView("success")
    } catch (err) {
      clearTimeout(timeoutId)
      setIsSubmittingDeposit(false)

      // Requirement 8.6: Preserve form state on failure
      // Do NOT clear uploadedFile, uploadedImage, or payAmount here.
      // The user's uploaded file reference and pay amount must be retained
      // so they can retry without re-entering data.

      if (err instanceof DOMException && err.name === "AbortError") {
        showTimeoutToast(() => handleSubmitDeposit())
      } else {
        const message = err instanceof Error ? err.message : "Koneksi terputus, coba lagi"
        showErrorToast(message, () => handleSubmitDeposit())
      }
    }
  }

  const analyzeProofImage = useCallback(async (imageDataUrl: string) => {
    const requestId = proofOcrRequestRef.current + 1
    proofOcrRequestRef.current = requestId
    setProofOcrAmount(null)
    setProofOcrRecipient(null)
    setProofOcrRecipientMatched(null)
    setProofOcrStatus("reading")
    setProofOcrError(null)
    setProofMismatchReason("")

    try {
      const { recognize } = await import("tesseract.js")
      const result = await recognize(imageDataUrl, "eng")
      if (proofOcrRequestRef.current !== requestId) return

      const ocrText = result.data.text || ""
      const recipientResult = extractTransferRecipient(ocrText)
      const detectedAmount = extractTransferAmount(ocrText)
      setProofOcrRecipient(recipientResult.detectedName)
      setProofOcrRecipientMatched(recipientResult.matched)

      if (!detectedAmount) {
        setProofOcrStatus("not_found")
        setProofOcrError("Nominal bukti TF tidak terbaca otomatis")
        return
      }

      setProofOcrAmount(detectedAmount)
      setProofOcrStatus(
        isAmountMismatch(depositPaymentAmount, detectedAmount) || !recipientResult.matched
          ? "mismatch"
          : "matched"
      )
    } catch {
      if (proofOcrRequestRef.current !== requestId) return
      setProofOcrStatus("failed")
      setProofOcrError("Gagal membaca nominal bukti TF")
    }
  }, [depositPaymentAmount])

  const processProofFile = useCallback((file: File, fallbackName = "bukti-transfer.png") => {
    const validation = fileUploadSchema.safeParse({ size: file.size, type: file.type })
    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || "File tidak valid"
      setFileUploadError(errorMessage)
      return false
    }

    setFileUploadError(null)
    proofOcrRequestRef.current += 1
    setUploadedFile(file.name || fallbackName)
    setProofOcrAmount(null)
    setProofOcrRecipient(null)
    setProofOcrRecipientMatched(null)
    setProofOcrStatus("reading")
    setProofOcrError(null)
    setProofMismatchReason("")

    const reader = new FileReader()
    reader.onerror = () => {
      setFileUploadError("Gagal membaca gambar")
      setProofOcrStatus("failed")
    }
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onerror = () => {
        setFileUploadError("Gambar tidak bisa diproses")
        setProofOcrStatus("failed")
      }
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const maxSize = 800
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize
            width = maxSize
          } else {
            width = (width / height) * maxSize
            height = maxSize
          }
        }
        const outputWidth = Math.max(1, Math.round(width))
        const outputHeight = Math.max(1, Math.round(height))
        canvas.width = outputWidth
        canvas.height = outputHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          setFileUploadError("Gambar tidak bisa diproses")
          setProofOcrStatus("failed")
          return
        }

        // Keep transparent PNG proofs from turning black when exported as JPEG.
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, outputWidth, outputHeight)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(img, 0, 0, outputWidth, outputHeight)
        const compressed = canvas.toDataURL("image/jpeg", 0.7)
        setUploadedImage(compressed)
        void analyzeProofImage(compressed)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
    return true
  }, [analyzeProofImage])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const accepted = processProofFile(file)
    if (!accepted) {
      e.target.value = ""
    }
  }

  const handleProofPaste = useCallback((e: ClipboardEvent | React.ClipboardEvent<HTMLElement>) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"))
    const file = imageItem?.getAsFile()
    if (!file) return

    e.preventDefault()
    const extension = file.type.split("/")[1] || "png"
    processProofFile(file, `bukti-transfer-paste.${extension}`)
  }, [processProofFile])

  useEffect(() => {
    if (viewState !== "detail" && viewState !== "batch") return

    window.addEventListener("paste", handleProofPaste)
    return () => {
      window.removeEventListener("paste", handleProofPaste)
    }
  }, [handleProofPaste, viewState])

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSelection = prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
      
      const total = newSelection.reduce((sum, id) => {
        const order = orders.find(o => o.id === id)
        return sum + (order ? getBatchItemDepositDue(order) : 0)
      }, 0)
      setBatchTotal(total)
      
      return newSelection
    })
  }

  const handleBatchPayment = () => {
    if (selectedOrders.length > 0) {
      resetProofCheck()
      setShowBatchPayment(true)
      navigateToView("batch")
    }
  }

  const renderProofCheckPanel = (expectedAmount: number) => {
    if (!uploadedFile || proofOcrStatus === "idle") return null

    if (proofOcrStatus === "reading") {
      return (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Membaca nominal dan penerima bukti TF...
          </div>
        </div>
      )
    }

    if (proofOcrStatus === "matched") {
      return (
        <div className="mt-3 rounded-xl border border-success/20 bg-success/10 p-3">
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-success">Bukti transfer cocok</span>
              <span className="font-semibold text-foreground">
                Rp {formatCurrency(proofOcrAmount || 0)}
              </span>
            </div>
            <p className="text-xs text-success">
              Penerima: {REQUIRED_TRANSFER_RECIPIENT}
            </p>
          </div>
        </div>
      )
    }

    if (proofOcrStatus === "mismatch") {
      const amountMismatch = isAmountMismatch(expectedAmount, proofOcrAmount)
      const recipientMismatch = proofOcrRecipientMatched !== true
      const proofShortage = proofOcrAmount ? expectedAmount - proofOcrAmount : 0

      return (
        <div className="mt-3 space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Bukti transfer perlu dicek</p>
              {amountMismatch && (
                <p className="text-muted-foreground">
                  Jumlah bayar Rp {formatCurrency(expectedAmount)} tetapi bukti terbaca Rp {formatCurrency(proofOcrAmount || 0)}.
                </p>
              )}
              {recipientMismatch && (
                <>
                  <p className="text-destructive">
                    {proofOcrRecipient
                      ? `Nama penerima berbeda, bukan ${REQUIRED_TRANSFER_RECIPIENT}.`
                      : `Nama penerima tidak terbaca. Penerima harus ${REQUIRED_TRANSFER_RECIPIENT}.`}
                  </p>
                  {proofOcrRecipient && (
                    <p className="text-destructive">
                      {`OCR membaca "${proofOcrRecipient}".`}
                    </p>
                  )}
                  <p className="text-destructive">
                    Upload bukti transfer ke rekening yang benar untuk lanjut.
                  </p>
                </>
              )}
              {!recipientMismatch && manualPaymentAmount <= 0 && proofShortage > PROOF_AMOUNT_TOLERANCE && (
                <p className="text-warning">
                  Sistem akan mencatat Rp {formatCurrency(proofOcrAmount || 0)} sebagai pembayaran sebagian. Sisa Rp {formatCurrency(proofShortage)} tetap belum lunas.
                </p>
              )}
            </div>
          </div>
          {(!recipientMismatch || isAdmin) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Alasan tetap gunakan bukti ini</Label>
              <Textarea
                value={proofMismatchReason}
                onChange={(e) => setProofMismatchReason(e.target.value)}
                placeholder="Contoh: transfer dua kali, bukti salah kirim, atau sudah dicek manual"
                className="min-h-20 rounded-xl bg-background"
              />
              {proofNeedsReason && (
                <p className="text-xs text-warning">Alasan wajib diisi sebelum konfirmasi.</p>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="mt-3 space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Bukti belum bisa dicek otomatis</p>
            <p className="text-xs text-muted-foreground">
              {proofOcrError || "Silakan cek manual sebelum konfirmasi."}
            </p>
            {proofOcrRecipientMatched === true ? (
              <p className="mt-1 text-xs text-success">
                Penerima terdeteksi: {REQUIRED_TRANSFER_RECIPIENT}
              </p>
            ) : (
              <p className="mt-1 text-xs text-destructive">
                {proofOcrRecipient
                  ? `Nama penerima berbeda, bukan ${REQUIRED_TRANSFER_RECIPIENT}. OCR membaca "${proofOcrRecipient}".`
                  : `Nama penerima tidak terbaca. Penerima harus ${REQUIRED_TRANSFER_RECIPIENT}.`}
              </p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="space-y-1.5 pt-2 border-t border-warning/20">
            <Label className="text-xs font-medium text-foreground">Alasan tetap gunakan bukti ini</Label>
            <Textarea
              value={proofMismatchReason}
              onChange={(e) => setProofMismatchReason(e.target.value)}
              placeholder="Contoh: transfer dua kali, bukti salah kirim, atau sudah dicek manual"
              className="min-h-20 rounded-xl bg-background"
            />
            {proofNeedsReason && (
              <p className="text-xs text-warning">Alasan wajib diisi sebelum konfirmasi.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Success screens
  if (showOrderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10 animate-in zoom-in duration-300">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Orderan Berhasil!</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Orderan telah berhasil dicatat
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">
            Rp {parseInt(argo || "0").toLocaleString("id-ID")}
          </p>
        </div>
      </div>
    )
  }

  if (showDepositSuccess) {
    return (
      <div className="min-h-screen">
        <SuccessPage
          driverName={depositSuccessData?.driverName || ""}
          amount={depositSuccessData?.amount || 0}
          route={depositSuccessData?.route || ""}
          batchCount={depositSuccessData?.batchCount}
          onBack={handleSuccessBack}
        />
      </div>
    )
  }

  // Batch Payment View
  if (showBatchPayment) {
    const selectedOrderItems = orders.filter(o => selectedOrders.includes(o.id))
    
    return (
      <SwipeBackDetector enabled={true} onSwipeBack={closeBatchPaymentView}>
      <div ref={viewContainerRef} className={cn("min-h-screen", animationClass)} onAnimationEnd={() => { setIsAnimating(false); setAnimationClass(""); }}>
        <MobileHeader 
          title="Pembayaran Batch" 
          showBack 
          onBack={closeBatchPaymentView} 
        />
        
        <div className="px-4 py-4 pb-28 space-y-4">
          {/* Step Indicator for batch flow */}
          <StepIndicator
            steps={["Daftar Orderan", "Pilih Orderan", "Pembayaran Batch", "Konfirmasi"]}
            currentStep={showConfirm ? 3 : 2}
          />

          {/* Selected Orders Summary */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Orderan Terpilih</h3>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                  {selectedOrders.length} orderan
                </span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedOrderItems.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{order.id}</span>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          order.type === "online" ? "bg-primary/10 text-primary" : "bg-chart-3/10 text-chart-3"
                        )}>
                          {order.type === "online" ? "Online" : "Offline"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground/80 truncate">
                        {order.driver}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.lokasiMuat} → {order.lokasiBongkar}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Argo: Rp {order.argo.toLocaleString("id-ID")}</p>
                      <p className="text-sm font-semibold text-primary">
                        {order.paidAmount > 0 ? "Sisa" : "Setoran"}: Rp {order.sisa.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Total Argo</span>
                  <span className="text-sm font-medium text-foreground">
                    Rp {batchTotal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Sisa Setoran</span>
                  <span className="text-xl font-bold text-primary">
                    Rp {batchTotal.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bayar Sebagian Toggle - Batch */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">Bayar Sebagian</Label>
                <button
                  onClick={() => { setPayAmount(payAmount ? "" : "0") }}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    payAmount !== "" ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    payAmount !== "" && "translate-x-5"
                  )} />
                </button>
              </div>
              {payAmount !== "" && (
                <div className="mt-3">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">Rp</span>
                    <Input
                      type="number"
                      placeholder="Masukkan jumlah..."
                      value={payAmount === "0" ? "" : payAmount}
                      onChange={(e) => setPayAmount(e.target.value || "0")}
                      className="bg-secondary border-0 pl-10 h-12 rounded-xl"
                      autoFocus
                    />
                  </div>
                  {payAmount && parseInt(payAmount) > 0 && parseInt(payAmount) < batchTotal && (
                    <p className="text-xs text-warning mt-2">
                      ⚠️ Sisa setelah bayar: Rp {(batchTotal - parseInt(payAmount)).toLocaleString("id-ID")} — orderan terbaru yang belum lunas
                    </p>
                  )}
                </div>
              )}
              {payAmount === "" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Bayar penuh Rp {batchTotal.toLocaleString("id-ID")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upload Bukti Transfer */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <Label className="text-sm font-medium text-foreground">Upload Bukti Transfer</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Upload atau paste bukti transfer untuk {selectedOrders.length} orderan sekaligus
              </p>

              {fileUploadError && (
                <p className="text-xs text-destructive mb-3">{fileUploadError}</p>
              )}
              
              {uploadedFile ? (
                <div className="space-y-3">
                  {uploadedImage && (
                    <div className="rounded-xl overflow-hidden border border-border">
                      <img src={uploadedImage} alt="Bukti transfer" className="w-full h-48 object-cover" />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-success/10 border border-success/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/20">
                        <ImageIcon className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{uploadedFile}</p>
                        <p className="text-xs text-success">Berhasil diupload</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setUploadedFile(null); setUploadedImage(null); setFileUploadError(null); resetProofCheck() }}
                      className="p-1.5 rounded-full hover:bg-secondary"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  tabIndex={0}
                  className="w-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/50 p-6 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors cursor-pointer"
                >
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Ketuk upload / paste gambar</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG (max 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
              {renderProofCheckPanel(depositPaymentAmount)}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!uploadedFile || isSubmittingDeposit || proofCheckBlocking}
            onClick={() => setShowConfirm(true)}
          >
            {isSubmittingDeposit ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Memproses...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Konfirmasi {selectedOrders.length} Setoran
                <ChevronRight className="h-5 w-5" />
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Confirm Dialog for batch payment */}
      <ConfirmDialog
        open={showConfirm}
        title="Konfirmasi Setoran"
        message={depositConfirmMessage}
        amount={submittedDepositPaymentAmount}
        orderCount={selectedOrders.length}
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
        onConfirm={() => {
          setShowConfirm(false)
          handleSubmitDeposit()
        }}
        onCancel={() => setShowConfirm(false)}
      />
      </SwipeBackDetector>
    )
  }

  // Single Setoran Detail View
  if (selectedOrder) {
    return (
      <SwipeBackDetector enabled={true} onSwipeBack={closeSinglePaymentView}>
      <div ref={viewContainerRef} className={cn("min-h-screen", animationClass)} onAnimationEnd={() => { setIsAnimating(false); setAnimationClass(""); }}>
        <MobileHeader 
          title="Konfirmasi Setoran" 
          showBack 
          onBack={closeSinglePaymentView} 
        />
        
        <div className="px-4 py-4 pb-28 space-y-4">
          {/* Step Indicator for deposit detail flow */}
          <StepIndicator
            steps={["Daftar Orderan", "Detail Setoran", "Konfirmasi"]}
            currentStep={showConfirm ? 2 : 1}
          />

          {/* Order Detail Card */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">#{selectedOrder.id}</span>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full",
                  selectedOrder.type === "online" 
                    ? "bg-primary/10 text-primary" 
                    : "bg-chart-3/10 text-chart-3"
                )}>
                  {selectedOrder.type === "online" ? "Online" : "Offline"}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedOrder.driver}</p>
                    <p className="text-xs text-muted-foreground">{selectedOrder.vehicle}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-success" />
                    <div className="w-0.5 h-8 bg-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Lokasi Muat</p>
                      <p className="text-sm font-medium text-foreground">{selectedOrder.lokasiMuat}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lokasi Bongkar</p>
                      <p className="text-sm font-medium text-foreground">{selectedOrder.lokasiBongkar}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Nilai Argo</span>
                    <span className="text-base font-semibold text-foreground">
                      Rp {selectedOrder.argo.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Setoran (40%)</span>
                    <span className="text-sm text-foreground">
                      Rp {selectedOrder.companyShare.toLocaleString("id-ID")}
                    </span>
                  </div>
                  {selectedOrder.paidAmount > 0 && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Terbayar</span>
                      <span className="text-sm text-success">
                        Rp {selectedOrder.paidAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {selectedOrder.paidAmount > 0 ? "Sisa" : "Setoran"}
                    </span>
                    <span className="text-xl font-bold text-primary">
                      Rp {selectedOrder.sisa.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Jumlah Bayar */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">Bayar Sebagian</Label>
                <button
                  onClick={() => { setPayAmount(payAmount ? "" : "0") }}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    payAmount !== "" ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    payAmount !== "" && "translate-x-5"
                  )} />
                </button>
              </div>
              {payAmount !== "" && (
                <div className="mt-3">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">Rp</span>
                    <Input
                      type="number"
                      placeholder="Masukkan jumlah..."
                      value={payAmount === "0" ? "" : payAmount}
                      onChange={(e) => setPayAmount(e.target.value || "0")}
                      className="bg-secondary border-0 pl-10 h-12 rounded-xl"
                      autoFocus
                    />
                  </div>
                  {payAmount && parseInt(payAmount) > 0 && parseInt(payAmount) < selectedOrder.sisa && (
                    <p className="text-xs text-warning mt-2">
                      ⚠️ Sisa setelah bayar: Rp {(selectedOrder.sisa - parseInt(payAmount)).toLocaleString("id-ID")}
                    </p>
                  )}
                </div>
              )}
              {payAmount === "" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Bayar penuh Rp {selectedOrder.sisa.toLocaleString("id-ID")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upload Bukti Transfer */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <Label className="text-sm font-medium text-foreground">Upload Bukti Transfer</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Upload atau paste bukti transfer untuk konfirmasi setoran
              </p>

              {fileUploadError && (
                <p className="text-xs text-destructive mb-3">{fileUploadError}</p>
              )}
              
              {uploadedFile ? (
                <div className="space-y-3">
                  {uploadedImage && (
                    <div className="rounded-xl overflow-hidden border border-border">
                      <img src={uploadedImage} alt="Bukti transfer" className="w-full h-48 object-cover" />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-success/10 border border-success/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/20">
                        <ImageIcon className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{uploadedFile}</p>
                        <p className="text-xs text-success">Berhasil diupload</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setUploadedFile(null); setUploadedImage(null); setFileUploadError(null); resetProofCheck() }}
                      className="p-1.5 rounded-full hover:bg-secondary"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  tabIndex={0}
                  className="w-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/50 p-6 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors cursor-pointer"
                >
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Ketuk upload / paste gambar</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG (max 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
              {renderProofCheckPanel(depositPaymentAmount)}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Driver</span>
                  <span className="font-medium text-foreground">{selectedOrder.driver}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipe Orderan</span>
                  <span className="font-medium text-foreground">
                    {selectedOrder.type === "online" ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bukti Transfer</span>
                  <span className={cn(
                    "font-medium",
                    uploadedFile ? "text-success" : "text-warning"
                  )}>
                    {uploadedFile ? "Sudah diupload" : "Belum diupload"}
                  </span>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Nilai Argo</span>
                    <span className="text-sm font-medium text-foreground">
                      Rp {selectedOrder.argo.toLocaleString("id-ID")}
                    </span>
                  </div>
                  {selectedOrder.paidAmount > 0 && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">Sudah Terbayar</span>
                      <span className="text-sm text-success">
                        Rp {selectedOrder.paidAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">
                      {selectedOrder.paidAmount > 0 ? "Sisa Setoran" : "Setoran"}
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      Rp {selectedOrder.sisa.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!uploadedFile || isSubmittingDeposit || proofCheckBlocking}
            onClick={() => setShowConfirm(true)}
          >
            {isSubmittingDeposit ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Memproses...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Konfirmasi Setoran
                <ChevronRight className="h-5 w-5" />
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Confirm Dialog for single payment */}
      <ConfirmDialog
        open={showConfirm}
        title="Konfirmasi Setoran"
        message={depositConfirmMessage}
        amount={submittedDepositPaymentAmount}
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
        onConfirm={() => {
          setShowConfirm(false)
          handleSubmitDeposit()
        }}
        onCancel={() => setShowConfirm(false)}
      />
      </SwipeBackDetector>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Deposit" />
      
      <div className="px-4 py-4 space-y-4">
        {/* Main Tab Switcher - For both Admin and Driver */}
        <div className="flex gap-2 p-1 rounded-2xl bg-secondary">
          <button
            onClick={() => handleTabSwitch("orderan")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all",
              mainTab === "orderan"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            Input Orderan
          </button>
          <button
            onClick={() => handleTabSwitch("setoran")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all",
              mainTab === "setoran"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground"
            )}
          >
            <Banknote className="h-4 w-4" />
            Setoran
          </button>
        </div>

        {/* Tab Content Container with slide animation */}
        <div
          ref={tabContentRef}
          className={cn("overflow-hidden space-y-4", tabAnimationClass)}
        >

        {/* Input Orderan Tab - For both Admin and Driver */}
        {mainTab === "orderan" && (
          <>
            {/* Driver Selection - Only for Admin */}
            {isAdmin ? (
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Pilih Driver</Label>
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger className="bg-secondary border-0 h-12 w-full rounded-xl">
                        <SelectValue placeholder="Pilih driver..." />
                      </SelectTrigger>
                      <SelectContent className="min-w-[16rem]">
                        {activeDrivers.map((driver) => (
                          <SelectItem
                            key={driver.id}
                            value={String(driver.id)}
                            className="py-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[state=checked]:[&_.driver-sub]:text-primary-foreground/85 data-[state=checked]:[&_.driver-sep]:text-primary-foreground/60 data-[highlighted]:[&_.driver-sub]:text-primary-foreground/85 data-[highlighted]:[&_.driver-sep]:text-primary-foreground/60"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="max-w-[6.5rem] truncate font-semibold">{driver.name}</span>
                              <span className="driver-sep text-muted-foreground">-</span>
                              <span className="driver-sub max-w-[7rem] truncate text-muted-foreground">{driver.vehicle || "-"}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">B 1234 ABC</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Date Input */}
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Tanggal</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="bg-secondary border-0 pl-10 h-12 rounded-xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Input */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-4">
                <FormField
                  label="Lokasi Muat"
                  error={errors.lokasiMuat?.message}
                  touched={touchedFields.lokasiMuat}
                >
                  <LocationAutocomplete
                    value={lokasiMuat}
                    onChange={(val) => {
                      setFormValue("lokasiMuat", val)
                      if (errors.lokasiMuat) {
                        setTimeout(() => clearErrors("lokasiMuat"), 500)
                      }
                    }}
                    onSelect={(val) => {
                      setFormValue("lokasiMuat", val)
                      if (errors.lokasiMuat) {
                        setTimeout(() => clearErrors("lokasiMuat"), 500)
                      }
                      trigger("lokasiMuat")
                    }}
                    placeholder="Masukkan lokasi muat..."
                    history={locationHistory}
                    icon={<MapPin className="h-4 w-4 text-success" />}
                    error={touchedFields.lokasiMuat ? errors.lokasiMuat?.message : undefined}
                  />
                </FormField>

                <FormField
                  label="Lokasi Bongkar"
                  error={errors.lokasiBongkar?.message}
                  touched={touchedFields.lokasiBongkar}
                >
                  <LocationAutocomplete
                    value={lokasiBongkar}
                    onChange={(val) => {
                      setFormValue("lokasiBongkar", val)
                      if (errors.lokasiBongkar) {
                        setTimeout(() => clearErrors("lokasiBongkar"), 500)
                      }
                    }}
                    onSelect={(val) => {
                      setFormValue("lokasiBongkar", val)
                      if (errors.lokasiBongkar) {
                        setTimeout(() => clearErrors("lokasiBongkar"), 500)
                      }
                      trigger("lokasiBongkar")
                    }}
                    placeholder="Masukkan lokasi bongkar..."
                    history={locationHistory}
                    icon={<MapPin className="h-4 w-4 text-destructive" />}
                    error={touchedFields.lokasiBongkar ? errors.lokasiBongkar?.message : undefined}
                  />
                </FormField>
              </CardContent>
            </Card>

            {/* Argo Input */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Nilai Argo</Label>
                  <CurrencyInput
                    value={argo ? parseInt(argo) : 0}
                    onChange={(value) => setArgo(value > 0 ? String(value) : "")}
                    min={1000}
                    max={999999999}
                    placeholder="0"
                    error={
                      argo && parseInt(argo) > 0 && (parseInt(argo) < 1000 || parseInt(argo) > 999999999)
                        ? parseInt(argo) < 1000
                          ? "Nilai argo tidak valid (minimum Rp 1.000)"
                          : "Nilai argo tidak valid (maksimum Rp 999.999.999)"
                        : undefined
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Type */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-medium text-foreground">Tipe Orderan</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setOrderType("online"); localStorage.setItem("default_order_type", "online") }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                      orderType === "online"
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-secondary border-2 border-transparent"
                    )}
                  >
                    <Smartphone
                      className={cn(
                        "h-6 w-6",
                        orderType === "online" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        orderType === "online" ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      Online
                    </span>
                  </button>
                  <button
                    onClick={() => { setOrderType("offline"); localStorage.setItem("default_order_type", "offline") }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                      orderType === "offline"
                        ? "bg-chart-3/10 border-2 border-chart-3"
                        : "bg-secondary border-2 border-transparent"
                    )}
                  >
                    <Banknote
                      className={cn(
                        "h-6 w-6",
                        orderType === "offline" ? "text-chart-3" : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        orderType === "offline" ? "text-chart-3" : "text-muted-foreground"
                      )}
                    >
                      Offline
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Driver</span>
                    <span className="font-medium text-foreground">
                      {isAdmin 
                        ? (selectedDriver ? activeDrivers.find((d) => String(d.id) === selectedDriver)?.name : "-")
                        : user.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rute</span>
                    <span className="font-medium text-foreground text-right max-w-[200px] truncate">
                      {lokasiMuat && lokasiBongkar 
                        ? `${lokasiMuat} - ${lokasiBongkar}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipe</span>
                    <span className="font-medium text-foreground">
                      {orderType === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Nilai Argo</span>
                      <span className="text-2xl font-bold text-primary">
                        Rp {argo ? parseInt(argo).toLocaleString("id-ID") : "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={(isAdmin && !selectedDriver) || !isOrderFormValid || isSubmittingOrder}
              onClick={() => setShowOrderConfirm(true)}
            >
              {isSubmittingOrder ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Memproses...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Simpan Orderan
                  <ChevronRight className="h-5 w-5" />
                </div>
              )}
            </Button>
          </>
        )}

        {/* Setoran Tab - For both Admin and Driver */}
        {mainTab === "setoran" && (
          <>
            {/* Driver Filter */}
            {isAdmin && (
              <Select value={filterDriver} onValueChange={(v) => setFilterDriver(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-card border-border h-11 rounded-xl">
                  <SelectValue placeholder="Semua Supir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Supir</SelectItem>
                  {activeDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name} ({d.vehicle || "-"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Pull-to-refresh container */}
            <div
              ref={pullContainerRef}
              onTouchStart={handlePullTouchStart}
              onTouchMove={handlePullTouchMove}
              onTouchEnd={handlePullTouchEnd}
              className="relative"
            >
              {/* Pull-to-refresh indicator */}
              {(pullDistance > 0 || isRefreshing) && (
                <div
                  className="flex items-center justify-center overflow-hidden transition-all duration-200"
                  style={{ height: isRefreshing ? 48 : pullDistance }}
                >
                  <div className={cn(
                    "flex items-center gap-2 text-sm text-muted-foreground",
                    pullDistance >= PULL_THRESHOLD && !isRefreshing && "text-primary"
                  )}>
                    {isRefreshing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span>Memuat ulang...</span>
                      </>
                    ) : pullDistance >= PULL_THRESHOLD ? (
                      <span>Lepas untuk refresh</span>
                    ) : (
                      <span>Tarik ke bawah untuk refresh</span>
                    )}
                  </div>
                </div>
              )}

            {loadingOrders ? (
              <SkeletonOrderList count={4} />
            ) : (
            <>
            {/* Total Sisa Setoran - sticky above order list */}
            {orders.length > 0 && (
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Sisa Setoran</span>
                  <span className="text-lg font-bold text-primary">
                    Rp {formatCurrency(totalSisa)}
                  </span>
                </div>
              </div>
            )}

            {/* Order Search - visible when > 10 items */}
            {orders.length > 10 && (
              <SearchInput
                placeholder="Cari driver, lokasi, atau ID orderan..."
                onSearch={setDebouncedSearchQuery}
                debounceMs={300}
                className="mt-1"
              />
            )}

            <div className="flex items-center justify-between mt-3">
              <h3 className="text-sm font-bold text-foreground">Orderan Belum Disetor</h3>
              <div className="flex items-center gap-1.5">
                {orders.length > 1 && (
                  <button
                    onClick={() => {
                      setIsBatchMode(!isBatchMode)
                      if (isBatchMode) {
                        setSelectedOrders([])
                        setBatchTotal(0)
                      }
                    }}
                    className={cn(
                      "text-[11px] font-medium px-2.5 py-1 rounded-full transition-all border",
                      isBatchMode 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      Batch
                    </div>
                  </button>
                )}
                <span className="text-[11px] font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                  {filteredOrders.length} orderan
                </span>
              </div>
            </div>

            {/* Batch Selection Info */}
            {isBatchMode && selectedOrders.length > 0 && (
              <Card className="border-primary/50 bg-primary/5 mt-3">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedOrders.length} orderan dipilih
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: Rp {batchTotal.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground rounded-xl"
                      onClick={handleBatchPayment}
                    >
                      Bayar Sekaligus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Batch Mode: Select All / Deselect All Buttons */}
            {isBatchMode && (
              <div className="flex items-center gap-2 mt-2 mb-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => {
                    const allOrderIds = orders.map(o => o.id)
                    setSelectedOrders(allOrderIds)
                    const total = allOrderIds.reduce((sum, id) => {
                      const order = orders.find(o => o.id === id)
                      return sum + (order ? getBatchItemDepositDue(order) : 0)
                    }, 0)
                    setBatchTotal(total)
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  Pilih Semua
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border text-muted-foreground hover:bg-secondary"
                  onClick={() => {
                    setSelectedOrders([])
                    setBatchTotal(0)
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Hapus Pilihan
                </Button>
              </div>
            )}

            <div className="space-y-3 mt-3" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}>
              {groupedOrders.map((group) => (
                <div key={group.date} className="space-y-2.5">
                  {/* Sticky date header */}
                  <div className="sticky top-0 z-[5] bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.date}
                    </p>
                  </div>
                  {group.orders.map((order) => (
                <Card 
                  key={order.id} 
                  className={cn(
                    "border-border bg-card",
                    isBatchMode && selectedOrders.includes(order.id) && "border-primary bg-primary/5",
                    !isBatchMode && "active:scale-[0.98] cursor-pointer",
                    order.isOverdue7 && "border-l-4 border-l-destructive"
                  )}
                  onClick={() => {
                    if (isBatchMode) {
                      toggleOrderSelection(order.id)
                    } else {
                      resetProofCheck()
                      setSelectedOrder(order)
                      navigateToView("detail")
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {isBatchMode && (
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                            className="mr-1"
                          />
                        )}
                        <span className="text-xs font-medium text-muted-foreground">#{order.id}</span>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          order.type === "online" 
                            ? "bg-primary/10 text-primary" 
                            : "bg-chart-3/10 text-chart-3"
                        )}>
                          {order.type === "online" ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {order.date}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                          "p-2 rounded-xl",
                          order.type === "online" ? "bg-primary/10" : "bg-chart-3/10"
                        )}>
                          {order.type === "online" ? (
                            <Smartphone className="h-4 w-4 text-primary" />
                          ) : (
                            <Banknote className="h-4 w-4 text-chart-3" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{order.driver}</p>
                          <p className="text-xs text-muted-foreground">{order.vehicle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <MapPin className="h-3 w-3 text-success flex-shrink-0" />
                      <span className="truncate">{order.lokasiMuat}</span>
                      <ChevronRight className="h-3 w-3 flex-shrink-0" />
                      <MapPin className="h-3 w-3 text-destructive flex-shrink-0" />
                      <span className="truncate">{order.lokasiBongkar}</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Argo: Rp {order.argo.toLocaleString("id-ID")}</p>
                        <p className="text-sm font-bold text-primary">
                          {order.paidAmount > 0 ? "Sisa" : "Setoran"}: Rp {order.sisa.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {order.paidAmount > 0 && (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                            Terbayar: Rp {order.paidAmount.toLocaleString("id-ID")}
                          </span>
                        )}
                        {isAdmin && !isBatchMode && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingOrder(order)
                                setEditArgo(String(order.argo))
                                setEditOrigin(order.lokasiMuat)
                                setEditDestination(order.lokasiBongkar)
                                setEditDate(order.rawDate || "")
                              }}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              aria-label="Edit orderan"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingOrder(order)
                              }}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors"
                              aria-label="Hapus orderan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
                </div>
              ))}
            </div>

            {orders.length === 0 && (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Tidak ada orderan yang perlu disetor</p>
              </div>
            )}
            </>
            )}
            </div>{/* End pull-to-refresh container */}
          </>
        )}
        </div>
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingOrder(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Edit Orderan</h3>
              <button onClick={() => setEditingOrder(null)} className="p-1 rounded-full hover:bg-secondary">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Lokasi Muat</Label>
                <Input
                  value={editOrigin}
                  onChange={(e) => setEditOrigin(e.target.value)}
                  className="bg-secondary border-0 h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Lokasi Bongkar</Label>
                <Input
                  value={editDestination}
                  onChange={(e) => setEditDestination(e.target.value)}
                  className="bg-secondary border-0 h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Nilai Argo</Label>
                <Input
                  type="number"
                  value={editArgo}
                  onChange={(e) => setEditArgo(e.target.value)}
                  className="bg-secondary border-0 h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Tanggal</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-secondary border-0 h-10 rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl"
                onClick={() => setEditingOrder(null)}
              >
                Batal
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground"
                onClick={async () => {
                  await fetch(`/api/tarikan/${editingOrder.driverId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      driver: editingOrder.driver,
                      origin: editOrigin,
                      destination: editDestination,
                      fare: parseInt(editArgo || "0"),
                      orderType: editingOrder.type,
                      date: editDate || undefined,
                    }),
                  })
                  // Update local state
                  const newCompanyShare = Math.round(parseInt(editArgo || "0") * 0.4)
                  setApiOrders(prev => prev.map(o => o.id === editingOrder.id ? {
                    ...o,
                    lokasiMuat: editOrigin,
                    lokasiBongkar: editDestination,
                    argo: parseInt(editArgo || "0"),
                    companyShare: newCompanyShare,
                    sisa: newCompanyShare - o.paidAmount,
                    rawDate: editDate || o.rawDate,
                    date: editDate ? new Date(editDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : o.date,
                  } : o))
                  setEditingOrder(null)
                }}
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation Dialog */}
      <ConfirmDialog
        open={showOrderConfirm}
        title="Konfirmasi Orderan"
        message={`Driver: ${
          isAdmin
            ? (activeDrivers.find((d) => String(d.id) === selectedDriver)?.name || "-")
            : user.name
        } | Rute: ${lokasiMuat || "-"} - ${lokasiBongkar || "-"} | Tanggal: ${orderDate}`}
        amount={parseInt(argo || "0")}
        amountLabel="Nilai Argo"
        confirmText="Ya, Simpan"
        cancelText="Cek Lagi"
        onConfirm={() => {
          setShowOrderConfirm(false)
          handleSubmitOrder()
        }}
        onCancel={() => setShowOrderConfirm(false)}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Konfirmasi Setoran"
        message={depositConfirmMessage}
        amount={submittedDepositPaymentAmount}
        orderCount={showBatchPayment ? selectedOrders.length : undefined}
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
        onConfirm={() => {
          setShowConfirm(false)
          handleSubmitDeposit()
        }}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingOrder}
        title="Hapus Orderan?"
        message={deletingOrder ? `Orderan ${deletingOrder.id} (${deletingOrder.driver} - ${deletingOrder.lokasiMuat} → ${deletingOrder.lokasiBongkar}) akan dihapus permanen.` : ""}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={() => {
          if (deletingOrder) {
            fetch(`/api/tarikan/${deletingOrder.driverId}`, { method: "DELETE" })
              .then(() => setApiOrders(prev => prev.filter(o => o.id !== deletingOrder.id)))
              .catch(() => {})
          }
          setDeletingOrder(null)
        }}
        onCancel={() => setDeletingOrder(null)}
      />
    </div>
  )
}
