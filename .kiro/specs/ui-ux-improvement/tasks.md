# Implementation Plan: UI/UX Improvement

## Overview

Implementasi peningkatan UI/UX untuk aplikasi OkeMitra (Driver Deposit App). Mencakup loading states, form validation dengan Zod, animasi CSS, navigasi mobile, optimasi input, tampilan daftar orderan, dark mode theming, dan halaman sukses/konfirmasi. Semua komponen dibangun menggunakan TypeScript, Next.js App Router, Tailwind CSS v4, dan shadcn/ui pattern.

## Tasks

- [x] 1. Set up utility functions and validation schemas
  - [x] 1.1 Create currency utility functions (`formatCurrency`, `parseCurrency`)
    - Create `lib/utils/currency.ts` with `formatCurrency(value: number): string` that formats numbers with Indonesian thousand separators (dots)
    - Create `parseCurrency(formatted: string): number` that strips separators and returns the numeric value
    - Handle edge cases: 0, negative numbers, max value 999999999
    - _Requirements: 5.4, 6.1_

  - [x] 1.2 Create order utility functions (`isOverdue`, `filterOrders`, `groupOrdersByDate`)
    - Create `lib/utils/orders.ts` with `isOverdue(orderDate: string, days: number): boolean` using calendar day difference
    - Implement `filterOrders(orders: Order[], query: string): Order[]` with case-insensitive partial match on driver name, lokasi muat, lokasi bongkar, and order ID
    - Implement `groupOrdersByDate(orders: Order[]): GroupedOrders[]` returning groups sorted by date descending with "DD MMM YYYY" format headers
    - _Requirements: 6.2, 6.3, 6.5, 4.6_

  - [x] 1.3 Create location suggestion utility (`getLocationSuggestions`)
    - Create `lib/utils/location.ts` with `getLocationSuggestions(input: string, history: LocationHistory[]): string[]`
    - Return max 5 suggestions, filtered by case-insensitive substring match on input (min 2 chars), sorted by frequency descending
    - _Requirements: 5.1, 5.2_

  - [x] 1.4 Create Zod validation schemas (`orderFormSchema`, `fileUploadSchema`)
    - Create `lib/schemas/order-form.ts` with `orderFormSchema` (lokasiMuat, lokasiBongkar, argo 1000-999999999, orderType, date, driverId)
    - Create `fileUploadSchema` (size max 5MB, type JPG/PNG only)
    - Export `OrderFormData` and `FileUploadData` types
    - Implement `validateOrderForm(data: OrderFormData): ValidationResult` wrapper
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.5 Create contrast ratio utility (`calculateContrastRatio`)
    - Create `lib/utils/contrast.ts` with `calculateContrastRatio(color1: string, color2: string): number`
    - Implement relative luminance calculation per WCAG 2.1 formula
    - Support hex color input (#RRGGBB format)
    - _Requirements: 7.3, 7.4_

- [x] 2. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement core UI components
  - [x] 3.1 Create `SkeletonOrderList` component
    - Create `components/ui/skeleton-order-list.tsx` using existing shadcn Skeleton component
    - Accept `count` prop (default 3), render skeleton cards mimicking OrderCard layout
    - Display within 100ms of data fetch start
    - _Requirements: 1.1_

  - [x] 3.2 Create `ToastNotification` configuration
    - Create `lib/toast.ts` with helper functions wrapping Sonner toast
    - Implement `showSuccessToast(message)` with 3s auto-dismiss and slide-in animation
    - Implement `showErrorToast(message, onRetry)` with persistent display and "Coba Lagi" action button
    - _Requirements: 1.3, 1.4, 1.6_

  - [x] 3.3 Create `FormField` wrapper component
    - Create `components/ui/form-field.tsx` with label, error message display, and touched state handling
    - Show error message below field only when `touched` is true and `error` is present
    - Clear error display when error prop becomes undefined
    - _Requirements: 2.1, 2.2, 2.8_

  - [x] 3.4 Create `CurrencyInput` component
    - Create `components/ui/currency-input.tsx` with auto-formatting (thousand separators as dots)
    - Accept only numeric digits, format on every keystroke
    - Enforce max value 99999999, min value display warning
    - Use numeric keyboard on mobile (`inputMode="numeric"`)
    - _Requirements: 5.4, 2.3_

  - [x] 3.5 Create `LocationAutocomplete` component
    - Create `components/ui/location-autocomplete.tsx` with dropdown suggestions
    - Show suggestions when input length >= 2 characters
    - Display max 5 suggestions sorted by frequency
    - Hide suggestions when no matches or input < 2 chars
    - Handle selection (fill input, close dropdown)
    - _Requirements: 5.1, 5.2_

  - [x] 3.6 Create `StepIndicator` component
    - Create `components/ui/step-indicator.tsx` accepting `steps` array and `currentStep` index
    - Render horizontal step indicators with labels, active step highlighted
    - Support deposit flow: "Daftar Orderan → Detail Setoran → Konfirmasi"
    - Support batch flow: "Daftar Orderan → Pilih Orderan → Pembayaran Batch → Konfirmasi"
    - _Requirements: 4.2, 4.3_

  - [x] 3.7 Create enhanced `OrderCard` component
    - Create `components/ui/order-card.tsx` with overdue indicator (red border when > 7 days)
    - Add stagger fade-in animation via CSS (opacity 0→1, 300ms duration, 50ms delay per card, max 20 cards)
    - Add touch feedback (scale 0.98 on press, 100ms duration)
    - Support selection state for batch mode (checkbox/highlight)
    - _Requirements: 3.4, 3.5, 6.5_

  - [x] 3.8 Create `SuccessPage` component
    - Create `components/deposit/success-page.tsx` with checkmark animation (zoom-in, 300ms)
    - Display driver name, amount (Rupiah format), route (lokasi muat → lokasi bongkar)
    - Support batch mode: show order count and total nominal
    - Include "Kembali ke Daftar" button
    - _Requirements: 8.1, 8.4_

  - [x] 3.9 Create `SwipeBackDetector` component
    - Create `components/ui/swipe-back-detector.tsx` using touch events
    - Detect swipe from left edge (startX <= 20px) with distance >= 50px
    - Call `onSwipeBack` callback when gesture detected
    - Disable on main pages (Dashboard, Deposit list, Riwayat, Profil)
    - _Requirements: 4.4, 4.5_

- [x] 4. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement CSS animations and transitions
  - [x] 5.1 Create CSS animation keyframes and utility classes
    - Add to `app/globals.css`: `@keyframes slideInRight`, `@keyframes slideOutRight`, `@keyframes slideInLeft`, `@keyframes fadeIn`, `@keyframes staggerFadeIn`, `@keyframes zoomIn`, `@keyframes slideInFromTop`
    - Create Tailwind utility classes for each animation
    - Add `prefers-reduced-motion` media query to disable animations for accessibility
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1_

  - [x] 5.2 Implement tab switching animation
    - Add slide-left/slide-right CSS transitions (200ms, ease-in-out) to tab content container in deposit page
    - Track direction based on tab index change (left-to-right or right-to-left)
    - Cancel running animation if new navigation occurs
    - _Requirements: 3.1, 3.6_

  - [x] 5.3 Implement page transition animations for detail/batch views
    - Add slide-in from right (translateX 100%→0%, 250ms, ease-out) for entering detail view
    - Add slide-out to right (translateX 0%→100%, 200ms, ease-in) for back navigation
    - Wire animations to navigation state machine transitions
    - _Requirements: 3.2, 3.3_

- [x] 6. Implement dark mode and theming
  - [x] 6.1 Set up comprehensive CSS variables for dark mode
    - Audit and extend `app/globals.css` CSS variables to cover all UI elements (inputs, cards, borders, backgrounds, text)
    - Ensure no hardcoded colors remain in component styles
    - Add dark mode variables for modal, dialog, bottom sheet, and toast components
    - _Requirements: 7.1_

  - [x] 6.2 Implement FOUC prevention with inline theme script
    - Add inline `<script>` in `app/layout.tsx` `<head>` that reads localStorage "theme" key and applies class before paint
    - Default to "light" if no preference stored or localStorage unavailable
    - Ensure theme applies before any content renders (blocking script)
    - _Requirements: 7.5, 7.6, 7.7_

  - [x] 6.3 Implement theme switching without reload
    - Update theme toggle in profile/settings to apply CSS class change immediately (< 100ms)
    - Persist selection to localStorage with key "theme"
    - Apply to all visible elements including modals and overlays
    - _Requirements: 7.2, 7.5_

  - [x] 6.4 Verify and fix contrast ratios for WCAG 2.1 AA compliance
    - Check all text/background color pairs in both light and dark themes
    - Ensure normal text has >= 4.5:1 contrast ratio
    - Ensure large text and UI borders have >= 3:1 contrast ratio
    - Fix any non-compliant color pairs
    - _Requirements: 7.3, 7.4_

- [x] 7. Implement form validation and error handling on deposit page
  - [x] 7.1 Integrate Zod schema with react-hook-form on order input form
    - Wire `orderFormSchema` to the order input form using `zodResolver`
    - Implement on-blur validation for lokasiMuat and lokasiBongkar fields
    - Show inline error messages using `FormField` component
    - Clear errors when user corrects input (within 1 second)
    - _Requirements: 2.1, 2.2, 2.8_

  - [x] 7.2 Implement argo field validation with CurrencyInput
    - Replace existing argo input with `CurrencyInput` component
    - Show warning message for values < 1000 or > 999999999
    - Auto-format with thousand separators while typing
    - _Requirements: 2.3, 5.4_

  - [x] 7.3 Implement file upload validation
    - Add size check (max 5MB) and type check (JPG/PNG only) before upload
    - Display inline error messages for rejected files
    - Preserve previous file state when new upload is rejected
    - _Requirements: 2.4, 2.5_

  - [x] 7.4 Implement submit button disabled state logic
    - Disable order submit button when lokasiMuat, lokasiBongkar, or argo are invalid
    - Disable deposit confirm button when no file is uploaded
    - Apply visual disabled styling (opacity, cursor)
    - _Requirements: 2.6, 2.7_

- [x] 8. Implement loading states and submission flow
  - [x] 8.1 Implement skeleton loading for order list
    - Show `SkeletonOrderList` immediately when data fetch begins
    - Replace with actual content when data arrives
    - Handle loading state in tab setoran
    - _Requirements: 1.1_

  - [x] 8.2 Implement button loading states with timeout
    - Add spinner to submit/confirm buttons during API calls
    - Disable button while loading
    - Implement 30-second timeout with `AbortController`
    - Re-enable button and show timeout error toast on timeout
    - _Requirements: 1.2, 1.6_

  - [x] 8.3 Implement pull-to-refresh with timeout
    - Enhance existing pull-to-refresh on deposit setoran tab
    - Add 30-second timeout handling
    - Show error feedback on failure
    - Hide refresh indicator on success or timeout
    - _Requirements: 1.5_

  - [x] 8.4 Implement form reset after successful order submission
    - Clear lokasiMuat, lokasiBongkar, argo fields on success
    - Reset orderType to stored default from localStorage
    - Preserve driver and date field values
    - _Requirements: 5.6_

  - [x] 8.5 Implement order type default persistence
    - Save selected order type to localStorage key "default_order_type"
    - Load and apply stored default on form initialization
    - Default to "online" if no stored preference
    - _Requirements: 5.3_

- [x] 9. Implement enhanced order list features
  - [x] 9.1 Implement total sisa setoran display
    - Calculate and display total remaining deposit amount in Rupiah format
    - Position above order list, sticky on scroll
    - Update when orders change (filter, refresh)
    - _Requirements: 6.1_

  - [x] 9.2 Implement order search/filter
    - Add search input above order list (visible when > 10 items)
    - Filter on driver name, lokasi muat, lokasi bongkar, order ID
    - Case-insensitive partial match, minimum 1 character
    - _Requirements: 6.2_

  - [x] 9.3 Implement date grouping with sticky headers
    - Group orders by date using `groupOrdersByDate` utility
    - Display sticky date headers in "DD MMM YYYY" format
    - Most recent dates at top
    - _Requirements: 6.3_

  - [x] 9.4 Implement batch mode select all/deselect all
    - Add "Pilih Semua" and "Hapus Pilihan" buttons above list in batch mode
    - "Pilih Semua" selects all visible (filtered) orders
    - "Hapus Pilihan" deselects all
    - _Requirements: 6.4_

  - [x] 9.5 Implement overdue order visual indicator
    - Apply red border to order cards where creation date > 7 days ago
    - Use `isOverdue` utility function
    - _Requirements: 6.5_

- [x] 10. Implement navigation enhancements
  - [x] 10.1 Enhance bottom navigation active indicator
    - Add primary color to active icon and label
    - Add scale 1.1 effect on active icon
    - Add background highlight on active item area
    - Ensure exactly one item is active at any time
    - _Requirements: 4.1_

  - [x] 10.2 Integrate StepIndicator into deposit flow
    - Add StepIndicator to detail setoran view (3 steps)
    - Add StepIndicator to batch payment view (4 steps)
    - Update current step based on navigation state
    - _Requirements: 4.2, 4.3_

  - [x] 10.3 Integrate SwipeBackDetector into deposit detail/batch pages
    - Wrap detail and batch payment views with SwipeBackDetector
    - Navigate back on swipe detection
    - Disable on main pages
    - _Requirements: 4.4, 4.5_

  - [x] 10.4 Implement overdue badge on dashboard
    - Calculate count of orders overdue > 3 days
    - Display badge with count on bell icon in dashboard header
    - Update on data refresh
    - _Requirements: 4.6_

- [x] 11. Implement confirmation dialog and success flow
  - [x] 11.1 Enhance confirmation dialog for deposit
    - Show amount in Rupiah format and order count (for batch) in dialog
    - Include "Ya, Lanjutkan" and "Batal" buttons
    - Block interaction with overlay behind dialog
    - Close only via button press (not backdrop click)
    - _Requirements: 8.2, 8.3_

  - [x] 11.2 Wire success page into deposit flow
    - Navigate to SuccessPage after successful deposit confirmation
    - Pass driver name, amount, route data
    - For batch: pass order count and total nominal
    - Handle back button: navigate to list and refresh data
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 11.3 Implement form state preservation on failure
    - On deposit submission failure, retain uploaded file reference and pay amount
    - Show error toast with failure reason
    - Do not clear or reset form fields
    - _Requirements: 8.6_

- [x] 12. Implement keyboard and mobile optimizations
  - [x] 12.1 Implement keyboard viewport adjustment
    - Detect keyboard appearance on mobile (visual viewport API or resize event)
    - Scroll active input into view within 300ms
    - Ensure field is not obscured by keyboard
    - _Requirements: 5.5_

  - [x] 12.2 Implement location history persistence
    - Save location entries to localStorage key "location_history_{userId}" on successful order submit
    - Increment frequency counter for existing locations
    - Load history on LocationAutocomplete mount
    - _Requirements: 5.1_

- [x] 13. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Property-based tests for correctness properties
  - [ ]* 14.1 Write property test for required field validation (Property 1)
    - **Property 1: Required field validation rejects empty/whitespace input**
    - Test with arbitrary whitespace strings → should fail validation
    - Test with strings containing non-whitespace → should pass validation
    - **Validates: Requirements 2.1, 2.2, 2.8**

  - [ ]* 14.2 Write property test for argo range validation (Property 2)
    - **Property 2: Argo range validation**
    - Test with arbitrary numbers: valid iff 1000 <= value <= 999999999
    - **Validates: Requirements 2.3**

  - [ ]* 14.3 Write property test for file upload validation (Property 3)
    - **Property 3: File upload validation**
    - Test with arbitrary size/type combinations: reject if size > 5MB OR type not JPG/PNG
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 14.4 Write property test for form submit button state (Property 4)
    - **Property 4: Form submit button state is a function of field validity**
    - Test with arbitrary field value combinations: enabled iff all fields valid
    - **Validates: Requirements 2.6**

  - [ ]* 14.5 Write property test for currency formatting round-trip (Property 5)
    - **Property 5: Currency formatting round-trip**
    - Test with arbitrary integers 1000-999999999: formatCurrency then parseCurrency returns original
    - **Validates: Requirements 5.4**

  - [ ]* 14.6 Write property test for location autocomplete (Property 6)
    - **Property 6: Location autocomplete filtering and limiting**
    - Test with arbitrary input (>= 2 chars) and history lists: max 5 results, all match input, sorted by frequency
    - **Validates: Requirements 5.1**

  - [ ]* 14.7 Write property test for order search filter (Property 7)
    - **Property 7: Order search filter correctness**
    - Test with arbitrary queries and order lists: all results contain query in at least one searchable field
    - **Validates: Requirements 6.2**

  - [ ]* 14.8 Write property test for order grouping (Property 8)
    - **Property 8: Order grouping by date produces descending date order**
    - Test with arbitrary order lists: groups ordered descending, all orders in correct group, total count preserved
    - **Validates: Requirements 6.3**

  - [ ]* 14.9 Write property test for total sisa computation (Property 9)
    - **Property 9: Total sisa computation equals sum of individual sisa values**
    - Test with arbitrary order lists: computed total equals arithmetic sum
    - **Validates: Requirements 6.1**

  - [ ]* 14.10 Write property test for overdue detection (Property 10)
    - **Property 10: Overdue order detection**
    - Test with arbitrary dates: overdue iff calendar day difference > 7
    - **Validates: Requirements 6.5**

  - [ ]* 14.11 Write property test for overdue badge count (Property 11)
    - **Property 11: Overdue badge count for dashboard**
    - Test with arbitrary order lists and dates: badge count equals orders with day difference > 3
    - **Validates: Requirements 4.6**

  - [ ]* 14.12 Write property test for theme persistence (Property 12)
    - **Property 12: Theme persistence round-trip**
    - Test with arbitrary valid theme values: save and read returns same value
    - **Validates: Requirements 7.5**

  - [ ]* 14.13 Write property test for color contrast (Property 13)
    - **Property 13: Color contrast compliance**
    - Test with theme color pairs: contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text/borders
    - **Validates: Requirements 7.3, 7.4**

  - [ ]* 14.14 Write property test for swipe back gesture (Property 14)
    - **Property 14: Swipe back gesture detection**
    - Test with arbitrary startX and distance: triggers iff startX <= 20 AND distance >= 50
    - **Validates: Requirements 4.4**

  - [ ]* 14.15 Write property test for success page display (Property 15)
    - **Property 15: Success page displays correct deposit information**
    - Test with arbitrary deposit data: all values displayed correctly, amount in Rupiah format
    - **Validates: Requirements 8.1, 8.4**

  - [ ]* 14.16 Write property test for form state preservation on failure (Property 16)
    - **Property 16: Form state preservation on submission failure**
    - Test with arbitrary form states: state after failure identical to state before submission
    - **Validates: Requirements 8.6**

  - [ ]* 14.17 Write property test for form reset after success (Property 17)
    - **Property 17: Form reset after successful order submission**
    - Test with arbitrary form states: location/argo reset, type returns to default, driver/date preserved
    - **Validates: Requirements 5.6**

  - [ ]* 14.18 Write property test for navigation active indicator (Property 18)
    - **Property 18: Navigation active indicator correctness**
    - Test with arbitrary valid routes: exactly one nav item active, matches route
    - **Validates: Requirements 4.1**

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- All animations respect `prefers-reduced-motion` for accessibility
- CSS-first approach for animations (no Framer Motion) to keep bundle size small
- Existing shadcn/ui components (Skeleton, Toast/Sonner, Dialog) are leveraged where possible

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.8", "3.9", "5.1", "6.1"] },
    { "id": 2, "tasks": ["3.7", "5.2", "5.3", "6.2", "6.3"] },
    { "id": 3, "tasks": ["6.4", "7.1", "7.2", "7.3", "7.4", "8.1", "8.5"] },
    { "id": 4, "tasks": ["8.2", "8.3", "8.4", "9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3", "10.4", "11.1", "12.1", "12.2"] },
    { "id": 6, "tasks": ["11.2", "11.3"] },
    { "id": 7, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8", "14.9", "14.10", "14.11", "14.12", "14.13", "14.14", "14.15", "14.16", "14.17", "14.18"] }
  ]
}
```
