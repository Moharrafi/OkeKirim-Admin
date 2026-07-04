"use client"

import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  Bell,
  Moon,
  LogOut,
  Smartphone,
  Mail,
  Building,
  Edit,
  Car,
  Sun,
  MapPin,
  Check,
  X,
  Loader2,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { useTheme } from "@/lib/theme-context"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useState, useEffect } from "react"

interface DriverData {
  id: number
  name: string
  phone: string
  email: string
  address: string
  vehicle: string
  vehicleType: string
  vehicleYear: string
  status: string
  joinDate: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAdmin, isDriver, logout, isAuthenticated } = useUser()
  const { theme, toggleTheme } = useTheme()
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [driverData, setDriverData] = useState<DriverData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Unified display states
  const [profileName, setProfileName] = useState(user.name)
  const [profilePhone, setProfilePhone] = useState(user.phone || "")
  const [profileEmail, setProfileEmail] = useState(user.email || "")
  const [profileAddress, setProfileAddress] = useState("")

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  })

  // Load configuration
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (isAdmin) {
      const name = localStorage.getItem("adminName") || user.name
      const phone = localStorage.getItem("adminPhone") || user.phone || "+62 812 3456 7890"
      const email = localStorage.getItem("adminEmail") || user.email || "admin@driverpay.id"
      setProfileName(name)
      setProfilePhone(phone)
      setProfileEmail(email)
      setEditForm({
        name,
        phone,
        email,
        address: "",
      })
    } else if (isDriver) {
      fetchDriverData()
    }
  }, [isAuthenticated, isAdmin, isDriver, user, router])

  const fetchDriverData = async () => {
    setLoading(true)
    try {
      const driverName = localStorage.getItem("driverName") || user.name
      const response = await fetch("/api/drivers")
      const data = await response.json()

      if (data.drivers) {
        const matched = data.drivers.find(
          (d: DriverData) => d.name === driverName
        )
        if (matched) {
          setDriverData(matched)
          setProfileName(matched.name)
          setProfilePhone(matched.phone || "")
          setProfileEmail(matched.email || "")
          setProfileAddress(matched.address || "")
          setEditForm({
            name: matched.name,
            phone: matched.phone || "",
            email: matched.email || "",
            address: matched.address || "",
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch driver data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartEdit = () => {
    setEditForm({
      name: profileName,
      phone: profilePhone,
      email: profileEmail,
      address: profileAddress,
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      if (isAdmin) {
        // Save Admin Info to LocalStorage
        localStorage.setItem("adminName", editForm.name)
        localStorage.setItem("adminPhone", editForm.phone)
        localStorage.setItem("adminEmail", editForm.email)
        
        setProfileName(editForm.name)
        setProfilePhone(editForm.phone)
        setProfileEmail(editForm.email)
        
        setIsEditing(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else if (isDriver && driverData) {
        // Save Driver Info to Database
        const response = await fetch("/api/drivers/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: driverData.id,
            name: editForm.name,
            phone: editForm.phone,
            email: editForm.email,
            address: editForm.address,
          }),
        })

        const result = await response.json()
        if (result.success) {
          // Update localStorage context identifiers
          localStorage.setItem("driverName", editForm.name)
          localStorage.setItem("driverPhone", editForm.phone)
          localStorage.setItem("driverEmail", editForm.email)
          localStorage.setItem("driverAddress", editForm.address)
          
          setDriverData({ ...driverData, ...editForm })
          setProfileName(editForm.name)
          setProfilePhone(editForm.phone)
          setProfileEmail(editForm.email)
          setProfileAddress(editForm.address)
          
          setIsEditing(false)
          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 3000)
        }
      }
    } catch (error) {
      console.error("Failed to update profile:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditForm({
      name: profileName,
      phone: profilePhone,
      email: profileEmail,
      address: profileAddress,
    })
    setIsEditing(false)
  }

  if (!isAuthenticated) {
    return null
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen pb-28 bg-background">
      <MobileHeader title="Profil Saya" variant="dark" />
      
      {/* Immersive Profile Header Panel */}
      <div className="relative bg-primary text-white pb-20 pt-4 px-4 rounded-b-none shadow-md overflow-hidden border-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white/90 leading-none">Mitra OkeKirim</h2>
            <p className="text-[10px] text-blue-100/70 mt-1 leading-none font-medium">Informasi Karyawan & Akun</p>
          </div>
          
          {!isEditing ? (
            <Button 
              variant="outline" 
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white rounded-xl text-xs font-bold px-3 h-8 active:scale-95 transition-all"
              onClick={handleStartEdit}
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Edit Profil
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-xl active:scale-95 transition-all"
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                className="h-8 w-8 bg-white text-primary hover:bg-white/90 rounded-xl active:scale-95 transition-all"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Check className="h-4 w-4 text-primary" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      <main className="px-4 py-4 space-y-6">
        {/* Digital ID Card */}
        <div className="relative -mt-16 mx-0 z-10 px-0">
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl p-5 rounded-3xl overflow-hidden border border-white/10 shadow-indigo-950/20">
            {/* Watermark Logo Icon */}
            <div className="absolute -right-6 -bottom-6 opacity-[0.04] pointer-events-none">
              <Car className="h-32 w-32" />
            </div>
            
            {/* Top row */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-[9px] font-black tracking-widest text-blue-400 uppercase">
                KARTU ANGGOTA DIGITAL
              </span>
              <span className="text-xs font-black tracking-tight text-white/95">
                OkeMitra
              </span>
            </div>

            {/* Content Row: Avatar + Metadata */}
            <div className="mt-4 flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-white/20 rounded-2xl shadow-md bg-white/10">
                <AvatarImage src="/avatar.jpg" alt="User" />
                <AvatarFallback className="bg-white/10 text-white text-lg font-black">
                  {profileName.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[8px] font-bold text-emerald-300 tracking-wider">
                  {isAdmin ? "SUPER ADMIN" : "PENGEMUDI"}
                </span>
                <h3 className="text-sm font-black text-white mt-1 leading-tight uppercase truncate">
                  {profileName}
                </h3>
                <p className="text-[9px] font-mono text-slate-400 mt-1 leading-none">
                  {isAdmin ? `ADM-2026-${profileName.slice(0,3).toUpperCase()}` : `DRV-2026-${String(driverData?.id || 0).padStart(4, "0")}`}
                </p>
              </div>
              
              {isDriver && (
                <div className="shrink-0 text-right">
                  <div className="inline-block bg-black border border-neutral-700 rounded px-2 py-1 shadow-inner">
                    <p className="text-[10px] font-black tracking-wide text-white leading-none">
                      {driverData?.vehicle || user.vehicle || "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success Feedback */}
        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm">
            <Check className="h-4 w-4" />
            <span>Profil Anda berhasil diperbarui!</span>
          </div>
        )}

        {/* Info & Account Settings Group */}
        <div className="space-y-2">
          <span className="text-[10px] font-black tracking-wider text-muted-foreground uppercase pl-1">
            Informasi Akun
          </span>
          <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-xs divide-y divide-border/40">
            {/* Name Row (Editable) */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100/30">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Nama Lengkap</p>
                  {isEditing ? (
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="h-8 text-sm mt-1 focus-visible:ring-primary rounded-lg border-border w-full"
                      placeholder="Nama Lengkap"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                      {profileName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Email Row (Editable) */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100/30">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Email</p>
                  {isEditing ? (
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="h-8 text-sm mt-1 focus-visible:ring-primary rounded-lg border-border w-full"
                      placeholder="Email"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-foreground mt-1.5 leading-none truncate">
                      {profileEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Phone Row (Editable) */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100/30">
                  <Smartphone className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Nomor Telepon</p>
                  {isEditing ? (
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="h-8 text-sm mt-1 focus-visible:ring-primary rounded-lg border-border w-full"
                      placeholder="Telepon"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                      {profilePhone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Address / Company Row */}
            {isDriver ? (
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 w-full">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100/30">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Alamat Rumah</p>
                    {isEditing ? (
                      <Input
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="h-8 text-sm mt-1 focus-visible:ring-primary rounded-lg border-border w-full"
                        placeholder="Alamat"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                        {profileAddress || "-"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 w-full">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                    <Building className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Perusahaan</p>
                    <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                      PT. OkeKirim Indonesia
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Menu Group (Only fully functional options) */}
        <div className="space-y-2">
          <span className="text-[10px] font-black tracking-wider text-muted-foreground uppercase pl-1">
            Pengaturan Aplikasi
          </span>
          <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-xs divide-y divide-border/40">
            {/* Notification Switch */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100/30">
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-none">Notifikasi</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-none">Status pemberitahuan</p>
                </div>
              </div>
              <Switch 
                checked={notificationEnabled} 
                onCheckedChange={setNotificationEnabled}
              />
            </div>

            {/* Dark Mode Switch */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200/50">
                  {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-none">
                    {theme === "light" ? "Mode Gelap" : "Mode Terang"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-none">Sesuaikan visual aplikasi</p>
                </div>
              </div>
              <Switch 
                checked={theme === "dark"} 
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full h-12 rounded-2xl border border-red-200 dark:border-red-900/30 bg-transparent text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 active:scale-95 transition-all font-black flex items-center justify-center gap-2 shadow-xs"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut className="h-4.5 w-4.5" />
          Keluar dari Akun
        </Button>

        {/* Logout Confirmation Dialog */}
        <ConfirmDialog
          open={showLogoutConfirm}
          title="Keluar dari Akun?"
          message="Kamu akan keluar dari aplikasi OkeMitra. Pastikan semua data sudah tersimpan."
          confirmText="Ya, Keluar"
          cancelText="Batal"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />

        {/* Version */}
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground py-2">
          OkeMitra v1.0.0
        </p>
      </main>
    </div>
  )
}
