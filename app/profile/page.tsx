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
  Shield,
  Moon,
  HelpCircle,
  LogOut,
  ChevronRight,
  Smartphone,
  Mail,
  Building,
  Edit,
  Car,
  UserCog,
  Sun,
  MapPin,
  Check,
  X,
  Loader2,
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
  const { user, isAdmin, isDriver, setUserRole, logout, isAuthenticated } = useUser()
  const { theme, toggleTheme } = useTheme()
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [driverData, setDriverData] = useState<DriverData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [editForm, setEditForm] = useState({
    phone: "",
    email: "",
    address: "",
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    if (isDriver && isAuthenticated) {
      fetchDriverData()
    }
  }, [isDriver, isAuthenticated])

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
          setEditForm({
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

  const handleSave = async () => {
    if (!driverData) return

    setSaving(true)
    setSaveSuccess(false)
    try {
      const response = await fetch("/api/drivers/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: driverData.id,
          phone: editForm.phone,
          email: editForm.email,
          address: editForm.address,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setDriverData({ ...driverData, ...editForm })
        setIsEditing(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      console.error("Failed to update driver:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (driverData) {
      setEditForm({
        phone: driverData.phone || "",
        email: driverData.email || "",
        address: driverData.address || "",
      })
    }
    setIsEditing(false)
  }

  if (!isAuthenticated) {
    return null
  }

  const adminStats = [
    { label: "Transaksi", value: "156" },
    { label: "Hari Aktif", value: "45" },
    { label: "Driver", value: "24" },
  ]

  const driverStats = [
    { label: "Kendaraan", value: driverData?.vehicleType || "-" },
    { label: "Bergabung", value: driverData?.joinDate ? new Date(driverData.joinDate).toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : "-" },
    { label: "Status", value: driverData?.status || "-" },
  ]

  const stats = isAdmin ? adminStats : driverStats

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const menuItems = [
    {
      id: "notification",
      label: "Notifikasi",
      icon: Bell,
      hasToggle: true,
      value: notificationEnabled,
      onToggle: () => setNotificationEnabled(!notificationEnabled),
    },
    {
      id: "security",
      label: "Keamanan",
      icon: Shield,
      description: "Password & 2FA",
    },
    {
      id: "theme",
      label: theme === "light" ? "Mode Gelap" : "Mode Terang",
      icon: theme === "light" ? Moon : Sun,
      hasToggle: true,
      value: theme === "dark",
      onToggle: toggleTheme,
    },
    {
      id: "help",
      label: "Bantuan",
      icon: HelpCircle,
      description: "FAQ & Dukungan",
    },
  ]

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Profil" />
      
      <div className="px-4 py-4 space-y-4">
        {/* Success Feedback */}
        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm">
            <Check className="h-4 w-4" />
            <span>Profil berhasil diperbarui!</span>
          </div>
        )}

        {/* Profile Card */}
        <Card className="border-border bg-card overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/10" />
          <CardContent className="p-4 pt-0 -mt-8">
            <div className="flex items-end gap-3">
              <Avatar className="h-16 w-16 border-4 border-card">
                <AvatarImage src="/avatar.jpg" alt="User" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                  {(driverData?.name || user.name).split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 pb-1">
                <h2 className="font-bold text-foreground text-lg">{driverData?.name || user.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? "Super Admin" : "Driver"}
                </p>
              </div>
              {isDriver && !isEditing && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 border-border rounded-xl"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {isDriver && isEditing && (
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9 border-border rounded-xl"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="h-9 w-9 rounded-xl"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground">Informasi Akun</h3>
            <div className="space-y-3">
              {/* Email */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-secondary">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  {isEditing && isDriver ? (
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="h-8 text-sm mt-1"
                      placeholder="Email"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      {isDriver ? (driverData?.email || user.email) : user.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-secondary">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Telepon</p>
                  {isEditing && isDriver ? (
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="h-8 text-sm mt-1"
                      placeholder="Nomor telepon"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      {isDriver ? (driverData?.phone || user.phone) : user.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Vehicle / Company */}
              {isAdmin ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-secondary">
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Perusahaan</p>
                    <p className="text-sm font-medium text-foreground">PT. Driver Indonesia</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-secondary">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Kendaraan</p>
                    <p className="text-sm font-medium text-foreground">
                      {driverData?.vehicle || user.vehicle || "-"}
                      {driverData?.vehicleType && ` (${driverData.vehicleType})`}
                    </p>
                  </div>
                </div>
              )}

              {/* Address - Driver only */}
              {isDriver && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-secondary">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Alamat</p>
                    {isEditing ? (
                      <Input
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="h-8 text-sm mt-1"
                        placeholder="Alamat"
                      />
                    ) : (
                      <p className="text-sm font-medium text-foreground">
                        {driverData?.address || "-"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings Menu */}
        <Card className="border-border bg-card">
          <CardContent className="p-0 divide-y divide-border">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-secondary">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
                {item.hasToggle ? (
                  <Switch 
                    checked={item.value} 
                    onCheckedChange={item.onToggle}
                  />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Keluar
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
        <p className="text-center text-xs text-muted-foreground py-2">
          OkeMitra v1.0.0
        </p>
      </div>
    </div>
  )
}
