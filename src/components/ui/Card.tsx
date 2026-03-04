'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/format';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-7',
};

export default function Card({ children, className, hover = false, padding = 'md', onClick }: CardProps) {
  const Component = hover ? motion.div : 'div';
  const hoverProps = hover ? {
    whileHover: { y: -2, boxShadow: '0 4px 16px rgba(26, 26, 46, 0.1)' },
    transition: { duration: 0.2 },
  } : {};

  return (
    <Component
      className={cn(
        'rounded border border-cream-300 bg-white/80 backdrop-blur-sm shadow-sm',
        'dark:bg-ink-700/80 dark:border-ink-500',
        paddings[padding],
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...hoverProps}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-semibold text-ink-700 dark:text-cream-100', className)}>
      {children}
    </h3>
  );
}

