"use client"
 
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
 
import { cn } from "@/lib/cn"
 
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 button-release",
  {
    variants: {
      variant: {
        white: "bg-white/40 text-gray-900 hover:bg-white/50 border border-white/40 rounded-full shadow-md backdrop-blur-lg transition-all",
        circle: "rounded-full aspect-square p-0 flex items-center justify-center bg-white/40 text-gray-900 hover:bg-white/50 border border-white/40 shadow-md backdrop-blur-lg transition-all",
        theme: "bg-white/40 text-[#004D40] hover:bg-white/50 border border-white/40 rounded-full shadow-md backdrop-blur-lg transition-all font-semibold",
        destructive: "bg-red-500/40 text-white hover:bg-red-500/50 border border-red-400/50 rounded-full shadow-md backdrop-blur-lg transition-all",
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
