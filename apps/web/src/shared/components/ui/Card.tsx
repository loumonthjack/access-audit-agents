import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const shadowStyles = {
  none: '',
  sm: 'shadow-[0_1px_3px_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.2)]',
  md: 'shadow-[0_4px_6px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3)]',
  lg: 'shadow-[0_10px_15px_rgba(0,0,0,0.5),0_4px_6px_rgba(0,0,0,0.4)]',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      padding = 'md',
      shadow = 'sm',
      border = true,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-xl',
          'bg-white',
          'transition-all duration-250 ease-smooth',
          shadowStyles[shadow],
          paddingStyles[padding],
          border ? 'border' : 'border-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('border-b border-neutral-200 px-4 py-3', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, as: Component = 'h3', className, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={clsx('text-lg font-semibold text-neutral-900', className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = 'CardTitle';

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx('p-4', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'border-t border-neutral-200 px-4 py-3 bg-neutral-50',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
