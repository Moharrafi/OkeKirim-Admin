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
    <header className="safe-area-top sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-xl" role="banner">
      <div className="flex min-h-[60px] items-center justify-between px-4 py-2.5">
        {showGreeting ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-primary/20 bg-primary/10">
              <AvatarImage src="/avatar.jpg" alt={`Foto profil ${user.name}`} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {user.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Selamat datang</p>
              <p className="text-base font-semibold leading-tight text-foreground">{user.name}</p>
            </div>
          </div>
        ) : showBack ? (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="-ml-2 h-10 w-10 rounded-lg text-foreground"
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
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-lg text-muted-foreground" aria-label="Notifikasi">
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-label="Ada notifikasi baru" />
          </Button>
          <Link href="/profile" aria-label="Pengaturan">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg text-muted-foreground" aria-label="Pengaturan">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
