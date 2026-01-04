import { type ReactNode, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/shared/components/ui/Button';
import { HealthIndicator } from '@/shared/components/feedback/HealthIndicator';

export interface NavLink {
  id: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface HeaderProps {
  logo?: ReactNode;
  userMenu?: ReactNode;
  onMenuClick?: () => void;
  navLinks?: NavLink[];
  className?: string;
}

function DefaultLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-col -space-y-0.25">
        <span className="text-sm font-bold text-white tracking-tight">
          AccessAuditAgent
        </span>
        <span className="text-[10px] text-neutral-500 font-medium">
          Accessibility Tool
        </span>
      </div>
    </div>
  );
}

export function Header({
  logo,
  userMenu,
  navLinks = [],
  className,
}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 flex h-14 items-center justify-between px-4 lg:px-6',
        'transition-all duration-250 ease-smooth',
        isScrolled
          ? 'bg-neutral-900/95 backdrop-blur-lg shadow-lg border-b border-neutral-800/50'
          : 'bg-neutral-900 border-b border-neutral-800',
        className
      )}
    >
      {/* Left section: Mobile Menu + Logo + Nav */}
      <div className="flex items-center gap-3">

        <a
          href="/"
          className="focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-lg"
          aria-label="Go to home page"
        >
          {logo || <DefaultLogo />}
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-primary-400',
                link.active
                  ? 'text-white bg-neutral-800'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              )}
              aria-current={link.active ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Right section: Actions + User */}
      <div className="flex items-center gap-3">
        {/* Health indicator - compact version */}
        <HealthIndicator compact showEnvironment className="hidden sm:flex" />

        {/* New Scan button */}
        <a href="/">
          <Button
            variant="primary"
            size="sm"
            className="hidden sm:inline-flex bg-primary-600 hover:bg-primary-700 border-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Scan
          </Button>
        </a>

        {userMenu && <div className="flex items-center">{userMenu}</div>}
      </div>
    </header>
  );
}
