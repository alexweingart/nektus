'use client';

import React from 'react';
import { PhoneInput as ShadcnPhoneInput } from '@/app/components/ui/phone-input';

/**
 * A drop‑in replacement for shadcn `<PhoneInput>` that
 * guarantees the critical autofill attributes reach the
 * _actual_ <input/>.
 */
export const PhoneInputAutofill = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof ShadcnPhoneInput>
>((props, ref) => (
  <ShadcnPhoneInput
    {...props}
    /** forward everything else */
    inputComponent={React.forwardRef<HTMLInputElement, any>(
      (inputProps, inputRef) => (
        <input
          {...inputProps}
          ref={inputRef ?? ref}
          /** 🔑 the four magic attributes */
          type="tel"
          name="tel"
          autoComplete="tel"
          inputMode="tel"
        />
      )
    )}
  />
));

PhoneInputAutofill.displayName = 'PhoneInputAutofill';
