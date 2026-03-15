import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Library, Settings, BookOpen, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

export function Sidebar() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    const navItems = [
        { name: "Home", href: "/", icon: Home },
        { name: "Library", href: "/library", icon: Library },
        { name: "Settings", href: "/settings", icon: Settings },
    ];

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div
            className={`flex flex-col bg-card/60 backdrop-blur-md text-card-foreground h-screen shrink-0 transition-all duration-300 shadow-[2px_0_12px_-4px_rgba(0,0,0,0.05)] border-r border-slate-200/50 relative ${isCollapsed ? "w-16" : "w-64"
                }`}
        >
            {/* Toggle Button */}
            <Button
                variant="outline"
                size="icon"
                className="absolute -right-4 top-5 z-20 rounded-full w-8 h-8 shadow-sm hover:shadow-md border-slate-200/60 bg-background hidden md:flex transition-all hover:scale-105"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>

            {/* Logo Area */}
            <div className={`h-16 flex items-center border-b border-slate-200/50 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                <BookOpen className="w-6 h-6 text-primary shrink-0" />
                {!isCollapsed && (
                    <span className="ml-3 font-semibold text-lg truncate flex-1">Project Prism</span>
                )}
            </div>

            {/* Navigation Links */}
            <div className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "hover:bg-primary/5 hover:text-primary"
                                } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                            title={isCollapsed ? item.name : undefined}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!isCollapsed && (
                                <span className="ml-4 font-medium truncate">{item.name}</span>
                            )}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-14 bg-popover text-popover-foreground px-2 py-1 rounded-md text-sm hidden group-hover:block z-50 border shadow-sm whitespace-nowrap">
                                    {item.name}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* User area at the bottom */}
            <div className={`border-t border-slate-200/50 p-4 ${isCollapsed ? 'flex justify-center' : ''}`}>
                {isCollapsed ? (
                    <button
                        onClick={handleLogout}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors group relative"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                        <div className="absolute left-14 bg-popover text-popover-foreground px-2 py-1 rounded-md text-sm hidden group-hover:block z-50 border shadow-sm whitespace-nowrap">
                            Logout
                        </div>
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                            {user?.email?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.email ?? 'User'}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
