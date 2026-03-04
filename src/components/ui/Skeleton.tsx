'use client';

import { cn } from '@/lib/utils/format';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export default function Skeleton({ className, lines = 1 }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 rounded shimmer',
              i === lines - 1 ? 'w-3/4' : 'w-full',
              className,
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={cn('h-4 rounded shimmer', className)} />;
}

export function ChartSkeleton() {
  return (
    <div className="h-64 rounded shimmer flex items-center justify-center">
      <svg className="w-8 h-8 text-cream-400 animate-pulse-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 12l4-4 4 6 4-8 6 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 rounded border border-cream-300 space-y-2">
          <div className="h-3 w-16 rounded shimmer" />
          <div className="h-6 w-20 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}

