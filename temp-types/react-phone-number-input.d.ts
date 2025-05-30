
      declare module 'react-phone-number-input' {
        import * as React from 'react';
        export type E164Number = string & { __tag: 'E164Number' };
        export type CountryCode = string;
        
        export interface PhoneInputProps {
          value?: E164Number;
          onChange?: (value?: E164Number) => void;
          defaultCountry?: CountryCode;
          country?: CountryCode;
          international?: boolean;
          withCountryCallingCode?: boolean;
          disabled?: boolean;
          autoComplete?: string;
          inputComponent?: React.ComponentType<any>;
          InputComponent?: React.ComponentType<any>;
          onCountryChange?: (country: any) => void;
        }
        
        export const parsePhoneNumberFromString: (input: string, country?: CountryCode) => {
          country: CountryCode;
          nationalNumber: string;
          number: E164Number;
          isValid: () => boolean;
        } | undefined;
        
        export const getCountryCallingCode: (country: CountryCode) => string;
        
        const PhoneInput: React.FC<PhoneInputProps>;
        export default PhoneInput;
      }
    