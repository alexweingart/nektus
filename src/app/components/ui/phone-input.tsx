"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { CountryCode, E164Number, parsePhoneNumber } from "libphonenumber-js"

import { Button } from "@/app/components/ui/button"
import { cn } from "@/app/utils/cn"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"

export type PhoneInputProps = {
  value?: E164Number | undefined
  defaultCountry?: CountryCode
  onChange?: (value: E164Number | undefined) => void
  onCountryChange?: (country: CountryCode) => void
  className?: string
  autoFocus?: boolean
}

// Simplified list of common countries
const countries = [
  { value: "US", label: "United States", code: "+1", flag: "🇺🇸" },
  { value: "CA", label: "Canada", code: "+1", flag: "🇨🇦" },
  { value: "GB", label: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { value: "AU", label: "Australia", code: "+61", flag: "🇦🇺" },
  { value: "DE", label: "Germany", code: "+49", flag: "🇩🇪" },
  { value: "FR", label: "France", code: "+33", flag: "🇫🇷" },
  { value: "IN", label: "India", code: "+91", flag: "🇮🇳" },
  { value: "JP", label: "Japan", code: "+81", flag: "🇯🇵" },
  { value: "BR", label: "Brazil", code: "+55", flag: "🇧🇷" },
  { value: "MX", label: "Mexico", code: "+52", flag: "🇲🇽" }
]

export function PhoneInput({
  value,
  defaultCountry = "US",
  onChange,
  onCountryChange,
  className,
  autoFocus,
}: PhoneInputProps) {
  const [country, setCountry] = React.useState<{
    value: string
    label: string
    code: string
    flag: string
  }>(countries.find((c) => c.value === defaultCountry) || countries[0])

  const [phoneNumber, setPhoneNumber] = React.useState<string>(
    value?.toString() || ""
  )

  const handleCountryChange = (countryCode: string) => {
    const newCountry = countries.find((c: {value: string}) => c.value === countryCode)
    if (newCountry) {
      setCountry(newCountry)
      onCountryChange?.(newCountry.value as CountryCode)

      // Keep the local part of the phone number but update country code
      if (phoneNumber) {
        try {
          const parsed = parsePhoneNumber(phoneNumber)
          const nationalNumber = parsed.nationalNumber
          // Use the country code from our country object instead of the function
          const newE164 = `${newCountry.code}${nationalNumber}`
          setPhoneNumber(newE164)
          onChange?.(newE164 as E164Number)
        } catch (error) {
          // Just change the country without modifying the number if parsing fails
        }
      }
    }
  }

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.trim()

    // If input is empty, reset the phone number
    if (!input) {
      setPhoneNumber("")
      onChange?.(undefined)
      return
    }

    // Add the + prefix for the country code if it's not already there
    if (!input.startsWith('+')) {
      // Remove any existing country code
      input = input.replace(/^\D+/g, '')
      // Prepend the selected country code
      input = `${country.code}${input}`
    }

    setPhoneNumber(input)

    // Validate and format the number
    try {
      const phoneNumberObj = parsePhoneNumber(input)
      if (phoneNumberObj.isValid()) {
        const formattedNumber = phoneNumberObj.format('E.164') as E164Number
        onChange?.(formattedNumber)

        // If the country has changed, update the country dropdown
        const countryCode = phoneNumberObj.country
        if (countryCode && countryCode !== country.value) {
          const newCountry = countries.find((c: {value: string}) => c.value === countryCode)
          if (newCountry) {
            setCountry(newCountry)
            onCountryChange?.(countryCode as CountryCode)
          }
        }
      } else {
        // Allow partial input but signal it's invalid
        onChange?.(undefined)
      }
    } catch (error) {
      // If parsing fails, it's likely incomplete
      onChange?.(undefined)
    }
  }

  return (
    <div className={cn("flex space-x-2", className)}>
      <Select
        value={country.value}
        onValueChange={handleCountryChange}
      >
        <SelectTrigger
          className="w-[130px] flex items-center space-x-1 pr-1 focus:ring-primary">
          <div className="flex items-center">
            <span className="text-xl mr-2">{country.flag}</span>
            <SelectValue placeholder={country.code} />
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          {countries.map((country: {value: string, label: string, code: string, flag: string}) => (
            <SelectItem key={country.value} value={country.value}>
              <div className="flex items-center space-x-2">
                <span className="text-xl">{country.flag}</span>
                <span className="text-sm">{country.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {country.code}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="tel"
        autoFocus={autoFocus}
        value={phoneNumber}
        onChange={handlePhoneNumberChange}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="(555) 555-5555"
      />
    </div>
  )
}