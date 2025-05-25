declare module '@/app/components/ui/phone-input' {
  import * as React from 'react';
  import type { E164Number, CountryCode } from 'react-phone-number-input';

  export interface PhoneInputProps extends React.ComponentPropsWithoutRef<'input'> {
    value?: E164Number;
    onChange?: (value?: E164Number) => void;
    defaultCountry?: CountryCode;
    international?: boolean;
    withCountryCallingCode?: boolean;
    countryCallingCodeEditable?: boolean;
    inputComponent?: React.ComponentType<any>;
    onCountryChange?: (country: CountryCode) => void;
  }

  export const PhoneInput: React.ForwardRefExoticComponent<
    PhoneInputProps & React.RefAttributes<HTMLInputElement>
  >;
}
