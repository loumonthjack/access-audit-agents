import { Fragment } from 'react';
import { clsx } from 'clsx';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4 text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={clsx('flex', className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            <li className="flex items-center">
              {item.current ? (
                <span className="text-sm font-medium text-neutral-900">
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  {item.label}
                </a>
              )}
            </li>
            {index < items.length - 1 && (
              <li>
                <ChevronRightIcon />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
