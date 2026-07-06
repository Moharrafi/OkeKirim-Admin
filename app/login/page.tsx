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
        await login("admin")
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
          await login("driver", data.driver.name)

          // Save driver details to localStorage
          localStorage.setItem("driverVehicle", data.driver.vehicle || "")
          localStorage.setItem("driverPhone", data.driver.phone || "")
          localStorage.setItem("driverEmail", data.driver.email || "")
          router.push("/")
        } else if (data.needsRegistration) {
          setError("Password telah di-reset oleh Admin, silakan registrasi password baru kembali.")
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Blue Header Section */}
      <div className="relative bg-primary text-white pb-28 pt-16 px-6 rounded-b-[3.5rem] shadow-md overflow-hidden border-none text-center">
        {/* Radial color glows for deep luxury finish */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />
        {/* Decorative mesh vector grids */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
        
        {/* Logo & Info inside Blue Header */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-inner">
            <img src="/logo.png" alt="OkeMitra" className="h-16 w-16 rounded-xl" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white leading-none">OkeMitra</h1>
          <p className="text-xs text-blue-100/80 font-medium mt-1.5 leading-none">Manajemen Setoran Driver</p>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="px-4 -mt-20 pb-12 z-10 max-w-sm mx-auto w-full">
        <Card className="border border-slate-100 bg-card shadow-[0_25px_50px_-12px_rgba(56,116,255,0.12)] rounded-3xl overflow-hidden">
          <CardContent className="p-5 space-y-5">
            
            {/* Login Type Tabs inside the Card */}
            <div className="flex gap-1 p-1 rounded-2xl bg-slate-100/80 border border-slate-200/50 mb-1">
              <button
                onClick={() => setLoginType("admin")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition-all",
                  loginType === "admin"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/30"
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </button>
              <button
                onClick={() => setLoginType("driver")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition-all",
                  loginType === "driver"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/30"
                )}
              >
                <Truck className="h-3.5 w-3.5" />
                Driver
              </button>
            </div>
            {loginType === "admin" ? (
              <>
                {/* Admin: Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Masukkan email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl bg-slate-50 border border-slate-200/80 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Admin: Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 rounded-xl bg-slate-50 border border-slate-200/80 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary transition-all text-sm"
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Pilih Kendaraan</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger className="h-12 w-full rounded-xl bg-slate-50 border border-slate-200/80 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary transition-all text-sm font-semibold">
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showDriverPassword ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={driverPassword}
                      onChange={(e) => setDriverPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 rounded-xl bg-slate-50 border border-slate-200/80 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary transition-all text-sm"
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
                <p className="text-sm text-green-600 text-center font-medium">{info}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive text-center font-medium">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <Button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/95 active:scale-[0.98] transition-all hover:shadow-xl hover:shadow-primary/30"
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
                  <ArrowRight className="h-4 w-4 animate-pulse" />
                </span>
              )}
            </Button>

            {/* Register Link for Drivers */}
            {loginType === "driver" && (
              <Link
                href="/register"
                className="w-full flex items-center justify-center gap-2 text-xs text-primary hover:text-primary/80 font-bold transition-colors pt-2"
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
