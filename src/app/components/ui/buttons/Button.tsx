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
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-full",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-full",
        link: "text-primary underline-offset-4 hover:underline",
        theme: "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 transition-all duration-200 active:scale-95 rounded-full shadow-md",
        white: "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 transition-all duration-200 active:scale-95 rounded-full",
        circle: "rounded-full aspect-square p-0 flex items-center justify-center bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 transition-all duration-200 active:scale-95 shadow-md",
      },
      size: {
        default: "h-12 px-6 text-base",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-lg",
        xl: "h-16 px-10 text-xl",
        icon: "h-12 w-12 p-0 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
 
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "theme" | "white" | "circle";
  size?: "default" | "sm" | "lg" | "xl" | "icon";
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
