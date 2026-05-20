"use client"

import { Bell, Settings, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { useUser } from "@/lib/user-context"

interface MobileHeaderProps {
  title?: string
  showGreeting?: boolean
  showBack?: boolean
  onBack?: () => void
}

export function MobileHeader({ title, showGreeting = false, showBack = false, onBack }: MobileHeaderProps) {
  const { user } = useUser()
  
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50" role="banner">
      <div className="flex items-center justify-between px-4 py-3">
        {showGreeting ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src="/avatar.jpg" alt={`Foto profil ${user.name}`} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {user.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Selamat datang</p>
              <p className="font-semibold text-foreground">{user.name}</p>
            </div>
          </div>
        ) : showBack ? (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-foreground -ml-2"
              onClick={onBack}
              aria-label="Kembali"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
          </div>
        ) : (
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
        )}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground" aria-label="Notifikasi">
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-label="Ada notifikasi baru" />
          </Button>
          <Link href="/profile" aria-label="Pengaturan">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="Pengaturan">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
