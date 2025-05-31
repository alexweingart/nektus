import * as React from "react"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className = '', size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8'
    } as const

    return (
      <div 
        ref={ref}
        className={`flex items-center justify-center ${className}`}
        role="status"
        aria-label="Loading..."
        {...props}
      >
        <div 
          className={`
            animate-spin rounded-full border-2 border-gray-300 border-t-primary
            ${sizeClasses[size]}
          `}
        >
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }
)

LoadingSpinner.displayName = "LoadingSpinner"

export { LoadingSpinner }
