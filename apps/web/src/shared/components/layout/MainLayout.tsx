import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Header, type HeaderProps, type NavLink } from './Header';
import { Sidebar, type NavItem } from './Sidebar';

export interface MainLayoutProps {
  children: ReactNode;
  navLinks?: NavLink[];
  logo?: HeaderProps['logo'];
  userMenu?: HeaderProps['userMenu'];
  banner?: ReactNode;
  className?: string;
  /** Hide the header/navbar (e.g., for unauthenticated users) */
  hideHeader?: boolean;
}

export function MainLayout({
  children,
  navLinks = [],
  logo,
  userMenu,
  banner,
  className,
  hideHeader = false,
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Convert NavLinks to NavItems for mobile sidebar
  const navItems: NavItem[] = navLinks.map(link => ({
    ...link,
  }));

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>

      {!hideHeader && (
        <>
          <Header
            logo={logo}
            userMenu={userMenu}
            navLinks={navLinks}
            onMenuClick={() => setSidebarOpen(true)}
          />

          {/* Mobile sidebar */}
          <Sidebar
            items={navItems}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* Banner area (for connection status, etc.) */}
      {banner}

      {/* Main content area - full width with dark background */}
      <main
        id="main-content"
        className={clsx(
          hideHeader ? 'min-h-screen' : 'min-h-[calc(100vh-3.5rem)]',
          'bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950',
          className
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
