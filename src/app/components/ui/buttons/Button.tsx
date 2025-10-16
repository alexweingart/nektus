"use client"
 
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
 
import { cn } from "@/lib/utils/cn"
 
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        white: "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 transition-all duration-200 active:scale-95 rounded-full shadow-md",
        circle: "rounded-full aspect-square p-0 flex items-center justify-center bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 transition-all duration-200 active:scale-95 shadow-md",
        theme: "bg-white text-[#004D40] hover:bg-gray-50 border border-gray-200 transition-all duration-200 active:scale-95 rounded-full shadow-md",
        destructive: "bg-red-500 text-white hover:bg-red-600 border border-red-600 transition-all duration-200 active:scale-95 rounded-full shadow-md",
      },
      size: {
        md: "h-12 px-6 text-base",
        lg: "h-14 px-8 text-lg",
        xl: "h-16 px-10 text-xl",
        icon: "h-12 w-12 p-0 text-sm",
      },
    },
    defaultVariants: {
      variant: "white",
      size: "md",
    },
  }
)
 
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: "white" | "circle" | "theme" | "destructive";
  size?: "md" | "lg" | "xl" | "icon";
}
 
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, icon, iconPosition = 'left', ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const buttonClass = cn(
      buttonVariants({ variant, size }),
      className
    );

    if (asChild) {
      return (
        <Comp
          className={buttonClass}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }
    
    return (
      <Comp
        className={buttonClass}
        ref={ref}
        {...props}
      >
        {icon && iconPosition === 'left' && (
          <span className="mr-2">{icon}</span>
        )}
        {children}
        {icon && iconPosition === 'right' && (
          <span className="ml-2">{icon}</span>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button"
 
export { Button, buttonVariants }
