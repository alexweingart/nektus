"use client";

import React from 'react';
import EditFieldRow from './EditFieldRow';
import CustomPhoneInput from './CustomPhoneInput';
import SocialIcon from './SocialIcon';

interface EditPhoneRowProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Phone number row (icon + custom phone input)
 */
const EditPhoneRow: React.FC<EditPhoneRowProps> = ({ value, onChange }) => {
  return (
    <EditFieldRow icon={<SocialIcon platform="phone" size="md" />} label="Phone number">
      <CustomPhoneInput
        value={value}
        onChange={onChange}
        placeholder="Phone number"
        className="w-full"
        inputProps={{
          id: 'phone-input',
          autoComplete: 'tel',
          className: 'w-full bg-transparent focus:outline-none text-gray-800 font-medium text-base',
        }}
      />
    </EditFieldRow>
  );
};

export default EditPhoneRow;
