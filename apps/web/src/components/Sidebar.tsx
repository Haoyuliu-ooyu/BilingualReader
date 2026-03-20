import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Library, Settings, BookOpen, PanelLeftClose, PanelLeftOpen, LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Library", href: "/library", icon: Library },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="md:hidden fixed top-4 left-4 z-30 p-2 bg-card border border-border rounded-lg shadow-sm"
            aria-label="Open menu"
        >
            <Menu className="h-5 w-5" />
        </button>
    );
}

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleNavClick = () => {
        onMobileClose();
    };

    const sidebarContent = (collapsed: boolean) => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Logo Area */}
            <div className={`h-16 flex items-center border-b border-border ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
                <BookOpen className="w-6 h-6 text-primary shrink-0" />
                <AnimatePresence mode="wait">
                    {!collapsed && (
                        <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                            className="ml-3 font-semibold text-lg whitespace-nowrap overflow-hidden"
                        >
                            Project Prism
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={handleNavClick}
                            className={`flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                } ${collapsed ? 'justify-center' : 'justify-start'}`}
                            aria-label={collapsed ? item.name : undefined}
                            title={collapsed ? item.name : undefined}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            <AnimatePresence mode="wait">
                                {!collapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: "auto" }}
                                        exit={{ opacity: 0, width: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="ml-3 font-medium whitespace-nowrap overflow-hidden"
                                    >
                                        {item.name}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {/* Tooltip for collapsed state */}
                            {collapsed && (
                                <div className="absolute left-14 bg-popover text-popover-foreground px-2 py-1 rounded-md text-sm hidden group-hover:block z-50 border shadow-sm whitespace-nowrap">
                                    {item.name}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* User area at the bottom */}
            <div className={`border-t border-border p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
                {collapsed ? (
                    <>
                        <ThemeToggle />
                        <button
                            onClick={handleLogout}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors group relative"
                            aria-label="Log out"
                            title="Log out"
                        >
                            <LogOut className="w-5 h-5" />
                            <div className="absolute left-14 bg-popover text-popover-foreground px-2 py-1 rounded-md text-sm hidden group-hover:block z-50 border shadow-sm whitespace-nowrap">
                                Log out
                            </div>
                        </button>
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                            {user?.email?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.email ?? 'User'}</p>
                        </div>
                        <ThemeToggle />
                        <button
                            onClick={handleLogout}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0"
                            aria-label="Log out"
                            title="Log out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop sidebar — overflow-visible so the toggle button can protrude, z-50 to paint above main */}
            <motion.div
                className="hidden md:flex flex-col bg-card/60 backdrop-blur-md text-card-foreground h-screen shrink-0 shadow-[2px_0_12px_-4px_rgba(0,0,0,0.05)] border-r border-border relative z-50"
                animate={{ width: isCollapsed ? 64 : 256 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {/* Floating toggle button — protrudes outside sidebar */}
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute -right-4 top-5 z-20 rounded-full w-8 h-8 shadow-sm hover:shadow-md border-border bg-background hidden md:flex transition-all hover:scale-105"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>

                {sidebarContent(isCollapsed)}
            </motion.div>

            {/* Mobile drawer */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onMobileClose}
                        />
                        {/* Drawer panel */}
                        <motion.div
                            className="fixed left-0 top-0 h-full w-64 z-50 bg-card border-r border-border flex flex-col md:hidden"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        >
                            {/* Close button */}
                            <button
                                onClick={onMobileClose}
                                className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            {sidebarContent(false)}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
