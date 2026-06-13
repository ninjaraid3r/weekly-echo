import { Link, useRouterState } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Settings,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Weekly", url: "/weekly", icon: BookOpen },
  { title: "Monthly", url: "/monthly", icon: CalendarDays },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (path: string) => currentPath === path;

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        collapsed ? "w-[var(--sidebar-width-icon)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Sidebar Header with Star Trigger */}
      <div className="flex items-center gap-2 p-3 border-b border-sidebar-border">
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center justify-center rounded-lg transition-colors cursor-pointer",
            collapsed ? "w-9 h-9 mx-auto" : "w-9 h-9",
            "bg-primary/20 hover:bg-primary/30"
          )}
          title="Toggle Sidebar"
        >
          <Star className="size-5 text-white fill-white" />
        </button>
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground truncate">
            Trading Journal
          </span>
        )}
      </div>

      {/* Tabbed Navigation */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.url);
          return (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon
                className={cn(
                  "size-5 shrink-0",
                  active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"
                )}
              />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && (
          <p className="text-[10px] text-sidebar-foreground/50 text-center">
            Data stored locally
          </p>
        )}
      </div>
    </div>
  );
}
