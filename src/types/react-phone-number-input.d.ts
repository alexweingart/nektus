declare module 'react-phone-number-input' {
  import * as React from 'react';
  
  export type E164Number = string & { __tag: 'E164Number' };
  export type CountryCode = string;
  export type NationalNumber = string & { __tag: 'NationalNumber' };
  
  export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: E164Number;
    onChange?: (value?: E164Number) => void;
    defaultCountry?: CountryCode;
    country?: CountryCode;              // Pin the flag to a specific country
    international?: boolean;
    withCountryCallingCode?: boolean;
    countryCallingCodeEditable?: boolean;
    inputComponent?: React.ComponentType<any>;
    InputComponent?: React.ComponentType<any>;
    limitMaxLength?: boolean;           // Built-in length guard
    // Using any type to handle all possible country values from the library
    onCountryChange?: (country: any) => void;
  }
  
  export const parsePhoneNumberFromString: (input: string, country?: CountryCode) => {
    country: CountryCode;
    nationalNumber: NationalNumber;
    number: E164Number;
    isValid: () => boolean;
  } | undefined;
  
  export const getCountryCallingCode: (country: CountryCode) => string;
  
  declare const PhoneInput: React.FC<PhoneInputProps>;
  export default PhoneInput;
}
