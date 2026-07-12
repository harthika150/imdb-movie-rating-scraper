import { Link, useLocation } from "wouter";
import { Film, BarChart3, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 transition-colors hover:text-primary" data-testid="link-home-logo">
              <Film className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg tracking-tight">CineScrape</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/" 
                className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}
                data-testid="link-nav-dashboard"
              >
                Dashboard
              </Link>
              <Link 
                href="/stats" 
                className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 ${location === "/stats" ? "text-primary" : "text-muted-foreground"}`}
                data-testid="link-nav-stats"
              >
                <BarChart3 className="h-4 w-4" />
                Statistics
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
