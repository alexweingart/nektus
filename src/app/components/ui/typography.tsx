// Simple cn utility function since we're having path resolution issues
function cn(...classes: (string | undefined | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}
import { HTMLAttributes } from 'react';

// Define heading styles
const headingStyles = {
  h1: 'text-2xl font-bold text-white',
  h2: 'text-xl font-semibold text-white',
  h3: 'text-lg font-medium',
} as const;

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function Heading({ 
  as: Tag = 'h1', 
  className, 
  ...props 
}: HeadingProps) {
  return (
    <Tag 
      className={cn(headingStyles[Tag], className)} 
      {...props} 
    />
  );
}

// Text component for paragraphs and other text elements
interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div';
  variant?: 'base' | 'small' | 'muted';
  className?: string;
}

export function Text({ 
  as: Tag = 'p', 
  variant = 'base',
  className,
  ...props 
}: TextProps) {
  const variants = {
    base: 'text-base text-white',
    small: 'text-sm text-white',
    muted: 'text-sm text-muted-foreground',
  } as const;
  
  return (
    <Tag 
      className={cn(variants[variant], className)} 
      {...props} 
    />
  );
}

// Label component for form labels
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-sm font-medium mb-1', className)}
      {...props}
    />
  );
}

// Helper text component for form helper/error messages
export function HelperText({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs text-muted-foreground mt-1', className)}
      {...props}
    />
  );
}
