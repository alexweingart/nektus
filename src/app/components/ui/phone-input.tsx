"use client"

import * as React from "react"
import { CountryCode, E164Number, parsePhoneNumber } from "libphonenumber-js"
import * as SelectPrimitive from "@radix-ui/react-select"

import { cn } from "@/app/utils/cn"
import { FaChevronDown } from 'react-icons/fa'

export interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCountryChange?: (country: CountryCode) => void
  onPhoneChange?: (phone: E164Number | undefined) => void
  defaultCountry?: CountryCode
  defaultValue?: string
}

export const countries = [
  {
    value: "US",
    label: "United States",
    placeholder: "(555) 555-5555",
    code: "+1",
    flag: "🇺🇸",
  },
  {
    value: "CA",
    label: "Canada",
    placeholder: "(555) 555-5555",
    code: "+1",
    flag: "🇨🇦",
  },
  {
    value: "GB",
    label: "United Kingdom",
    placeholder: "7700 900123",
    code: "+44",
    flag: "🇬🇧",
  },
  {
    value: "MX",
    label: "Mexico",
    placeholder: "555 123 4567",
    code: "+52",
    flag: "🇲🇽",
  },
  {
    value: "IN",
    label: "India",
    placeholder: "91234 56789",
    code: "+91",
    flag: "🇮🇳",
  },
  {
    value: "DE",
    label: "Germany",
    placeholder: "1512 3456789",
    code: "+49",
    flag: "🇩🇪",
  },
  {
    value: "FR",
    label: "France",
    placeholder: "06 12 34 56 78",
    code: "+33",
    flag: "🇫🇷",
  },
]

type Country = (typeof countries)[number]

const findCountryByValue = (value: CountryCode): Country | undefined => {
  return countries.find(country => country.value === value)
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      onCountryChange,
      onPhoneChange,
      defaultCountry = "US",
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    // Get default value based on phone number
    const getDefaultValue = React.useCallback(() => {
      if (!defaultValue) return defaultCountry
      try {
        return parsePhoneNumber(defaultValue as string).country || defaultCountry
      } catch (error) {
        return defaultCountry
      }
    }, [defaultCountry, defaultValue])

    const [country, setCountry] = React.useState<Country | undefined>(() => {
      const countryValue = getDefaultValue()
      return findCountryByValue(countryValue as CountryCode)
    })

    const [phoneValue, setPhoneValue] = React.useState<string>(() => {
      if (!defaultValue) return ""
      try {
        const parsedNumber = parsePhoneNumber(defaultValue as string)
        return parsedNumber.nationalNumber
      } catch (error) {
        return ""
      }
    })

    // Update country state when defaultCountry changes
    React.useEffect(() => {
      const foundCountry = findCountryByValue(defaultCountry)
      if (foundCountry) {
        setCountry(foundCountry)
        onCountryChange?.(foundCountry.value as CountryCode)
      }
    }, [defaultCountry, onCountryChange])

    // Handle value updates from parent
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        try {
          const parsedNumber = parsePhoneNumber(value.toString())
          setPhoneValue(parsedNumber.nationalNumber)
          const countryValue = parsedNumber.country as CountryCode
          if (countryValue) {
            const newCountry = findCountryByValue(countryValue)
            if (newCountry) {
              setCountry(newCountry)
            }
          }
        } catch (error) {
          setPhoneValue(value.toString().replace(/[^0-9]/g, ""))
        }
      }
    }, [value])

    // Combine country code and phone value to E164 format
    React.useEffect(() => {
      if (!country || !phoneValue) {
        onPhoneChange?.(undefined)
        return
      }
      
      try {
        const formattedNumber = parsePhoneNumber(
          `${country.code}${phoneValue}`,
          country.value as CountryCode
        )
        
        if (formattedNumber.isValid()) {
          onPhoneChange?.(formattedNumber.number as E164Number)
        } else {
          onPhoneChange?.(undefined)
        }
      } catch (error) {
        onPhoneChange?.(undefined)
      }
    }, [country, phoneValue, onPhoneChange])

    // Controlled input change handler
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow numbers and filter out non-numeric characters
      const onlyNumbers = e.target.value.replace(/[^0-9]/g, "")
      
      // Limit to 10 digits max
      const limitedNumbers = onlyNumbers.substring(0, 10)
      
      setPhoneValue(limitedNumbers)
      
      onChange?.(e)
    }

    // Handle country change
    const handleCountryChange = (value: string) => {
      const newCountry = findCountryByValue(value as CountryCode)
      if (newCountry) {
        setCountry(newCountry)
        onCountryChange?.(newCountry.value as CountryCode)
      }
    }

    // Format phone number for display (based on country)
    const formatPhoneNumber = (value: string, country?: Country) => {
      if (!value || !country) return ""
      
      try {
        const formattedNumber = parsePhoneNumber(
          `${country.code}${value}`,
          country.value as CountryCode
        )
        
        return formattedNumber.formatNational()
      } catch (error) {
        // Simple formatting fallback
        if (country.value === "US" || country.value === "CA") {
          // Format as (XXX) XXX-XXXX
          if (value.length > 0) {
            // Always start with an open parenthesis
            let formatted = "("
            
            // Area code with placeholder underscores
            for (let i = 0; i < 3; i++) {
              formatted += i < value.length ? value[i] : "_"
            }
            
            // Always add closing parenthesis and space after the area code
            formatted += ") "
            
            // Next 3 digits with placeholder underscores
            for (let i = 3; i < 6; i++) {
              formatted += i < value.length ? value[i] : "_"
            }
            
            // Always add the hyphen
            formatted += "-"
            
            // Last 4 digits with placeholder underscores
            for (let i = 6; i < 10; i++) {
              formatted += i < value.length ? value[i] : "_"
            }
            
            return formatted
          }
        }
        
        return value
      }
    }

    return (
      <div className="flex w-full">
        {/* Country selector */}
        <SelectPrimitive.Root
          defaultValue={defaultCountry}
          value={country?.value}
          onValueChange={handleCountryChange}
        >
          <SelectPrimitive.Trigger
            className={cn(
              "flex items-center justify-between rounded-l-md border border-r-0 bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
              "data-[placeholder]:text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{country?.flag}</span>
              <span className="text-sm font-medium">{country?.code}</span>
            </div>
            <SelectPrimitive.Icon>
              <FaChevronDown className="h-3 w-3 opacity-50" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Content 
            position="popper"
            className={cn(
              "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white text-sm shadow-md animate-in fade-in-80",
              "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1",
              "data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1"
            )}
          >
            <SelectPrimitive.Viewport className="max-h-[var(--radix-select-content-available-height)] overflow-y-auto p-1">
              {countries.map((country) => (
                <SelectPrimitive.Item
                  key={country.value}
                  value={country.value}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                    "focus:bg-green-100 focus:text-green-900",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-base">
                    {country.flag}
                  </span>
                  <SelectPrimitive.ItemText>
                    <div className="flex items-center gap-2">
                      <span>{country.label}</span>
                      <span className="text-xs text-gray-500">{country.code}</span>
                    </div>
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Root>

        {/* Phone input */}
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatPhoneNumber(phoneValue, country)}
          onChange={handleChange}
          placeholder={country?.placeholder}
          className={cn(
            "flex w-full rounded-r-md border px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
            "placeholder:text-muted-foreground",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

PhoneInput.displayName = "PhoneInput"

export { PhoneInput }
