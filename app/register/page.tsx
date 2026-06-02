"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  Car,
  ArrowLeft,
  UserPlus,
} from "lucide-react"

interface DriverOption {
  id: number
  name: string
  vehicle: string | null
  phone: string | null
  email: string | null
  status: string | null
  password_hash: string | null
}

const isActiveDriver = (driver: DriverOption) =>
  (driver.status || "").trim().toLowerCase() === "aktif"

export default function RegisterPage() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedDriver, setSelectedDriver] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Fetch drivers for dropdown (only those without password_hash)
  useEffect(() => {
    fetch("/api/drivers")
      .then((r) => r.json())
      .then((d) => {
        const activeDrivers = (d.drivers || []).filter(
          (driver: DriverOption) => isActiveDriver(driver) && !driver.password_hash
        )
        setDrivers(activeDrivers)
      })
      .catch(() => {})
  }, [])

  const handleRegister = async () => {
    setError("")
    setSuccess("")

    if (!selectedDriver) {
      setError("Pilih kendaraan terlebih dahulu")
      return
    }

    if (!password) {
      setError("Password wajib diisi")
      return
    }

    if (password.length < 6) {
      setError("Password minimal 6 karakter")
      return
    }

    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password tidak cocok")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/register-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: parseInt(selectedDriver),
          password,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(data.message)
        setTimeout(() => {
          router.push("/login?registered=1")
        }, 1500)
      } else {
        setError(data.message || "Gagal mendaftar")
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5">
            <img src="/logoapk.png" alt="OkeMitra" className="h-20 w-20 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Daftar Driver</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buat password untuk login ke OkeMitra
          </p>
        </div>

        {/* Register Form */}
        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-5">
            {/* Select Vehicle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Pilih Kendaraan</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="h-12 w-full rounded-xl bg-secondary border-0">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Pilih nopol kendaraan..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="min-w-[17rem]">
                  {drivers.map((d) => (
                    <SelectItem
                      key={d.id}
                      value={String(d.id)}
                      className="py-2.5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[state=checked]:[&_.driver-sub]:text-primary-foreground/85 data-[highlighted]:[&_.driver-sub]:text-primary-foreground/85"
                    >
                      <div className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="max-w-[13rem] truncate font-semibold leading-tight">{d.vehicle || "-"}</span>
                        <span className="driver-sub max-w-[13rem] truncate text-xs leading-tight text-muted-foreground">{d.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {drivers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Semua driver sudah terdaftar atau tidak ada driver aktif.
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Password Baru</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl bg-secondary border-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Konfirmasi Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl bg-secondary border-0"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-600 text-center">{success}</p>
              </div>
            )}

            {/* Register Button */}
            <Button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25"
              disabled={!selectedDriver || !password || !confirmPassword || isLoading}
              onClick={handleRegister}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Daftar
                </span>
              )}
            </Button>

            {/* Back to Login */}
            <button
              onClick={() => router.push("/login")}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke halaman login
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="px-6 py-4">
        <p className="text-center text-xs text-muted-foreground">
          v1.0.0 - OkeMitra
        </p>
      </div>
    </div>
  )
}
