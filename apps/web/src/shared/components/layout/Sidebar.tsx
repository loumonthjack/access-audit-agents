import { Fragment, type ReactNode } from 'react';
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { clsx } from 'clsx';
import { Badge } from '@/shared/components/ui/Badge';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  active?: boolean;
}

export interface SidebarProps {
  items: NavItem[];
  isOpen: boolean;
  onClose: () => void;
  footer?: ReactNode;
  className?: string;
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <a
      href={item.href}
      onClick={onNavigate}
      className={clsx(
        'group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium',
        'transition-all duration-250 ease-smooth',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900',
        'min-h-[44px] sm:min-h-0',
        item.active
          ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
      )}
      aria-current={item.active ? 'page' : undefined}
    >
      {/* Active indicator bar */}
      {item.active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary-500" />
      )}

      {item.icon && (
        <span
          className={clsx(
            'flex-shrink-0 transition-transform duration-250',
            'group-hover:scale-110',
            item.active ? 'text-primary-500' : 'text-neutral-500'
          )}
          aria-hidden="true"
        >
          {item.icon}
        </span>
      )}
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <Badge
          variant={item.active ? 'primary' : 'default'}
          size="sm"
          className="ml-auto"
        >
          {item.badge}
        </Badge>
      )}
    </a>
  );
}

function SidebarContent({
  items,
  footer,
  onNavigate,
}: {
  items: NavItem[];
  footer?: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-1.5 px-3 py-4" aria-label="Main navigation">
        {items.map((item) => (
          <NavLink key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      {footer && (
        <div className="border-t border-neutral-800 px-3 py-4 bg-neutral-900/50">{footer}</div>
      )}
    </div>
  );
}

export function Sidebar({
  items,
  isOpen,
  onClose,
  footer,
  className,
}: SidebarProps) {
  return (
    <>
      {/* Mobile sidebar - slide-out drawer */}
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 md:hidden" onClose={onClose}>
          <TransitionChild
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
          </TransitionChild>

          <div className="fixed inset-0 flex">
            <TransitionChild
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
                <TransitionChild
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="rounded-md p-2.5 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <CloseIcon className="h-6 w-6" />
                    </button>
                  </div>
                </TransitionChild>

                <div className="flex grow flex-col overflow-y-auto bg-neutral-900 border-r border-neutral-800 safe-area-inset">
                  {/* Mobile sidebar header */}
                  <div className="flex h-14 items-center border-b border-neutral-800 px-4 bg-neutral-900/50">
                    <span className="text-base font-semibold text-white">
                      Navigation
                    </span>
                  </div>
                  <SidebarContent items={items} footer={footer} onNavigate={onClose} />
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
