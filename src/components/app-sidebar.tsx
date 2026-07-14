import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Settings,
  Star,
  ChevronLeft,
  NotebookPen,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Weekly", url: "/weekly", icon: BookOpen },
  { title: "Monthly", url: "/monthly", icon: CalendarDays },
  { title: "Journal", url: "/journal", icon: NotebookPen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (path: string) => currentPath === path;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 left-0 shrink-0 border-r border-border bg-card transition-all duration-200 ease-in-out z-30",
          collapsed ? "w-[4rem]" : "w-[16rem]"
        )}
      >
        {/* Header with Star */}
        <div className="flex items-center gap-2 p-3 border-b border-border/60">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors cursor-pointer shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Star className="size-5 text-white fill-white" />
          </button>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground truncate">
              Trading Journal
            </span>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Collapse"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
        </div>

        {/* Tabbed Navigation */}
        <nav className="flex-1 overflow-auto p-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.title}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.title : undefined}
              >
                <item.icon className={cn("size-5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground/70")} />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/60">
          {!collapsed && (
            <p className="text-[10px] text-muted-foreground text-center">
              Data stored locally
            </p>
          )}
        </div>
      </aside>

      {/* Mobile trigger */}
      <MobileSidebar />
    </>
  );
}

function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (path: string) => currentPath === path;

  return (
    <>
      {/* Mobile trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg"
        aria-label="Open sidebar"
      >
        <Star className="size-5 text-white fill-white" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setOpen(false)}
          />
          <aside className="md:hidden fixed top-0 left-0 h-screen w-[18rem] bg-card border-r border-border z-50 flex flex-col animate-in slide-in-from-left">
            {/* Mobile header */}
            <div className="flex items-center justify-between p-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
                  <Star className="size-5 text-white fill-white" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Trading Journal
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-5" />
              </button>
            </div>

            {/* Mobile nav */}
            <nav className="flex-1 overflow-auto p-2 space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className={cn("size-5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground/70")} />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
