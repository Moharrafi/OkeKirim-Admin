"use client"

import dynamic from "next/dynamic"

const UpdateChecker = dynamic(
  () => import("@/components/update-checker").then((m) => m.UpdateChecker || m.default),
  { ssr: false }
)

export function UpdateCheckerWrapper() {
  return <UpdateChecker />
}

export default UpdateCheckerWrapper
