"use client"

import * as React from "react"
import ReactPhoneInput from "react-phone-number-input"
import { CountryCode, E164Number } from "libphonenumber-js"

import { cn } from "@/app/utils/cn"

import "react-phone-number-input/style.css"
import "./phone-input.css"

export type PhoneInputProps = React.ComponentPropsWithoutRef<typeof ReactPhoneInput> & {
  onCountryChange?: (country: CountryCode) => void
}

const PhoneInput = React.forwardRef<React.ElementRef<"input">, PhoneInputProps>(
  ({ className, onCountryChange, ...props }, ref) => {
    return (
      <div className="relative">
        <ReactPhoneInput
          className={cn("flex", className)}
          international
          countryCallingCodeEditable={false}
          defaultCountry="US"
          onCountryChange={(value) => {
            onCountryChange?.(value as CountryCode)
          }}
          {...props}
        />
      </div>
    )
  }
)
PhoneInput.displayName = "PhoneInput"

export { PhoneInput }