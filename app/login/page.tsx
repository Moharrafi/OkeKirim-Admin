"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  Truck,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  Shield,
  Car,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import Link from "next/link"

interface DriverOption {
  id: number
  name: string
  vehicle: string | null
  phone: string | null
  email: string | null
  status: string | null
}

const isActiveDriver = (driver: DriverOption) => (driver.status || "").trim().toLowerCase() === "aktif"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useUser()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loginType, setLoginType] = useState<"admin" | "driver">("admin")

  // Driver login states
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedDriver, setSelectedDriver] = useState("")
  const [driverPassword, setDriverPassword] = useState("")
  const [showDriverPassword, setShowDriverPassword] = useState(false)

  // Show success message after registration
  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setInfo("Registrasi berhasil! Silakan login dengan password baru Anda.")
      setLoginType("driver")
    }
  }, [searchParams])

  // Fetch drivers for dropdown
  useEffect(() => {
    if (loginType === "driver") {
      fetch("/api/drivers")
        .then((r) => r.json())
        .then((d) => setDrivers((d.drivers || []).filter(isActiveDriver)))
        .catch(() => {})
    }
  }, [loginType])

  const handleLogin = async () => {
    setError("")
    setInfo("")
    setIsLoading(true)

    if (loginType === "admin") {
      await new Promise((resolve) => setTimeout(resolve, 800))
      if (email === "admin@okekirim.com" && password === "admin123") {
        login("admin")
        router.push("/")
      } else {
        setError("Email atau password salah")
      }
    } else {
      // Driver login via API with bcrypt password
      const driver = drivers.find((d) => String(d.id) === selectedDriver)
      if (!driver) {
        setError("Pilih kendaraan terlebih dahulu")
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch("/api/auth/login-driver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: parseInt(selectedDriver),
            password: driverPassword,
          }),
        })

        const data = await res.json()

        if (data.success) {
          // Save driver details to localStorage
          localStorage.setItem("driverVehicle", data.driver.vehicle || "")
          localStorage.setItem("driverPhone", data.driver.phone || "")
          localStorage.setItem("driverEmail", data.driver.email || "")
          login("driver", data.driver.name)
          router.push("/")
        } else if (data.needsRegistration) {
          setError("Silakan daftar terlebih dahulu")
        } else {
          setError(data.message || "Password salah")
        }
      } catch {
        setError("Terjadi kesalahan. Coba lagi.")
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5">
            <img src="/logoapk.png" alt="OkeMitra" className="h-20 w-20 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">OkeMitra</h1>
          <p className="text-sm text-muted-foreground mt-1">Manajemen Setoran Driver</p>
        </div>

        {/* Login Type Tabs */}
        <div className="flex gap-2 p-1.5 rounded-full bg-secondary border border-border mb-6">
          <button
            onClick={() => setLoginType("admin")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-medium text-sm transition-all",
              loginType === "admin"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </button>
          <button
            onClick={() => setLoginType("driver")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-medium text-sm transition-all",
              loginType === "driver"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground"
            )}
          >
            <Truck className="h-4 w-4" />
            Driver
          </button>
        </div>

        {/* Login Form */}
        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-5">
            {loginType === "admin" ? (
              <>
                {/* Admin: Email */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Masukkan email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl bg-secondary border-0"
                    />
                  </div>
                </div>

                {/* Admin: Password */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan password"
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
              </>
            ) : (
              <>
                {/* Driver: Pilih Kendaraan */}
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
                          className="py-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[state=checked]:[&_.driver-sub]:text-primary-foreground/85 data-[state=checked]:[&_.driver-sep]:text-primary-foreground/60 data-[highlighted]:[&_.driver-sub]:text-primary-foreground/85 data-[highlighted]:[&_.driver-sep]:text-primary-foreground/60"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="max-w-[7rem] truncate font-semibold">{d.vehicle || "-"}</span>
                            <span className="driver-sep text-muted-foreground">-</span>
                            <span className="driver-sub max-w-[6rem] truncate text-muted-foreground">{d.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Driver: Password */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showDriverPassword ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={driverPassword}
                      onChange={(e) => setDriverPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 rounded-xl bg-secondary border-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDriverPassword(!showDriverPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showDriverPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Info Message */}
            {info && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-600 text-center">{info}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <Button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25"
              disabled={
                loginType === "admin"
                  ? !email || !password || isLoading
                  : !selectedDriver || !driverPassword || isLoading
              }
              onClick={handleLogin}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Masuk
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>

            {/* Register Link for Drivers */}
            {loginType === "driver" && (
              <Link
                href="/register"
                className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors pt-2"
              >
                <UserPlus className="h-4 w-4" />
                Belum punya password? Daftar
              </Link>
            )}
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
