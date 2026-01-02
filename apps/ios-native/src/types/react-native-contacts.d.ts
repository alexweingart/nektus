/**
 * Type declarations for react-native-contacts
 * This is a stub - install the actual package when ready to use native contacts
 */

declare module 'react-native-contacts' {
  export interface Contact {
    recordID?: string;
    givenName?: string;
    familyName?: string;
    middleName?: string;
    emailAddresses?: Array<{ label: string; email: string }>;
    phoneNumbers?: Array<{ label: string; number: string }>;
    company?: string;
    jobTitle?: string;
    note?: string;
    thumbnailPath?: string;
    urlAddresses?: Array<{ label: string; url: string }>;
  }

  export type PermissionType = 'authorized' | 'denied' | 'undefined';

  const Contacts: {
    requestPermission(): Promise<PermissionType>;
    checkPermission(): Promise<PermissionType>;
    getAll(): Promise<Contact[]>;
    getContactById(contactId: string): Promise<Contact>;
    addContact(contact: Contact): Promise<Contact>;
    openContactForm(contact: Contact): Promise<Contact>;
    updateContact(contact: Contact): Promise<void>;
    deleteContact(contact: Contact): Promise<void>;
  };

  export default Contacts;
}
