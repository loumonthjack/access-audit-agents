import { type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  width,
  height,
  variant = 'text',
  animation = 'wave',
  className,
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  return (
    <div
      className={clsx(
        'bg-neutral-200',
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height:
          typeof height === 'number'
            ? `${height}px`
            : height || (variant === 'text' ? '1em' : undefined),
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={clsx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" height={16} width={i === lines - 1 ? '75%' : '100%'} />
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  className?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function SkeletonCard({
  className,
  showHeader = true,
  showFooter = false,
}: SkeletonCardProps) {
  return (
    <div
      className={clsx('rounded-lg border border-neutral-200 bg-white overflow-hidden', className)}
      aria-hidden="true"
    >
      {showHeader && (
        <div className="border-b border-neutral-200 px-4 py-3">
          <Skeleton variant="text" height={20} width="40%" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <Skeleton variant="text" height={16} width="100%" />
        <Skeleton variant="text" height={16} width="90%" />
        <Skeleton variant="text" height={16} width="70%" />
      </div>
      {showFooter && (
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
          <Skeleton variant="rectangular" height={32} width={80} />
        </div>
      )}
    </div>
  );
}

export interface SkeletonListProps {
  count?: number;
  className?: string;
}

export function SkeletonList({ count = 3, className }: SkeletonListProps) {
  return (
    <div className={clsx('space-y-4', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height={16} width="60%" />
            <Skeleton variant="text" height={14} width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}
