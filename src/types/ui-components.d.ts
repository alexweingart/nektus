declare module '@/app/components/ui/phone-input' {
  import * as React from 'react';
  import type { E164Number, CountryCode } from 'react-phone-number-input';

  export interface PhoneInputProps extends React.ComponentPropsWithoutRef<'input'> {
    value?: E164Number;
    onChange?: (value?: E164Number) => void;
    defaultCountry?: CountryCode;
    country?: CountryCode;              // Pin the flag to a specific country
    international?: boolean;
    withCountryCallingCode?: boolean;
    countryCallingCodeEditable?: boolean;
    inputComponent?: React.ComponentType<any>;
    limitMaxLength?: boolean;           // Built-in length guard
    // The library provides a country string that may or may not be a valid CountryCode
    onCountryChange?: (country: any) => void;
  }

  export const PhoneInput: React.ForwardRefExoticComponent<
    PhoneInputProps & React.RefAttributes<HTMLInputElement>
  >;
}
