/**
 * UserMenu Component
 * Displays user email and logout button
 * Requirements: 7.4, 7.5
 */
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/Button';
import type { User } from '@/types/domain';

/**
 * Props for UserMenu component
 */
export interface UserMenuProps {
  /** Current authenticated user */
  user: User;
  /** Callback when logout is clicked */
  onLogout: () => Promise<void>;
  /** Whether logout is in progress */
  isLoading?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * User avatar component
 */
function UserAvatar({ user }: { user: User }) {
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.name || user.email}'s avatar`}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/**
 * Logout icon SVG component
 */
function LogoutIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

/**
 * UserMenu component
 * Shows user info and provides logout functionality
 * Requirements: 7.4, 7.5
 */
export function UserMenu({ user, onLogout, isLoading = false, className = '' }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  };

  const isButtonLoading = isLoading || isLoggingOut;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md p-1.5 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <UserAvatar user={user} />
        <span className="hidden text-sm font-medium text-neutral-700 md:block">{user.email}</span>
        <svg
          className={`h-4 w-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
        >
          <div className="border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-medium text-neutral-900">{user.name || 'User'}</p>
            <p className="truncate text-sm text-neutral-500" data-testid="user-email">
              {user.email}
            </p>
            {user.authProvider !== 'local' && (
              <p className="mt-1 text-xs text-neutral-400">
                Signed in with{' '}
                {user.authProvider.charAt(0).toUpperCase() + user.authProvider.slice(1)}
              </p>
            )}
          </div>
          <div className="p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isButtonLoading}
              isLoading={isButtonLoading}
              leftIcon={!isButtonLoading ? <LogoutIcon /> : undefined}
              className="w-full justify-start text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
              role="menuitem"
            >
              {isButtonLoading ? 'Signing out...' : 'Sign out'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
