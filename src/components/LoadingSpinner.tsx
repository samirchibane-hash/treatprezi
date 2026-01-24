import { Droplet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className={cn(
          "text-primary animate-pulse-soft",
          sizeClasses[size]
        )}>
          <Droplet className="w-full h-full" />
        </div>
        <div className="absolute inset-0 text-primary/30 animate-ripple">
          <Droplet className="w-full h-full" />
        </div>
      </div>
      {message && (
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
