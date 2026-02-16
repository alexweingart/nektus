import Foundation
import Contacts
import React

@objc(MeCardModule)
class MeCardModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  @objc func getMeCard(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    let store = CNContactStore()

    store.requestAccess(for: .contacts) { granted, error in
      guard granted else {
        resolve(nil)
        return
      }

      do {
        let keysToFetch: [CNKeyDescriptor] = [
          CNContactGivenNameKey as CNKeyDescriptor,
          CNContactFamilyNameKey as CNKeyDescriptor,
          CNContactPhoneNumbersKey as CNKeyDescriptor,
          CNContactEmailAddressesKey as CNKeyDescriptor,
          CNContactImageDataAvailableKey as CNKeyDescriptor,
        ]

        guard let meIdentifier = try self.findMeIdentifier(store: store) else {
          resolve(nil)
          return
        }

        let contact = try store.unifiedContact(withIdentifier: meIdentifier, keysToFetch: keysToFetch)

        let phoneNumbers = contact.phoneNumbers.map { $0.value.stringValue }
        let emails = contact.emailAddresses.map { $0.value as String }

        let result: [String: Any] = [
          "firstName": contact.givenName,
          "lastName": contact.familyName,
          "phoneNumbers": phoneNumbers,
          "emails": emails,
          "hasImage": contact.imageDataAvailable,
        ]

        resolve(result)
      } catch {
        reject("ME_CARD_ERROR", "Failed to fetch Me card: \(error.localizedDescription)", error)
      }
    }
  }

  @objc func getMeCardImage(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    let store = CNContactStore()

    store.requestAccess(for: .contacts) { granted, error in
      guard granted else {
        resolve(nil)
        return
      }

      do {
        let keysToFetch: [CNKeyDescriptor] = [
          CNContactImageDataKey as CNKeyDescriptor,
        ]

        guard let meIdentifier = try self.findMeIdentifier(store: store) else {
          resolve(nil)
          return
        }

        let contact = try store.unifiedContact(withIdentifier: meIdentifier, keysToFetch: keysToFetch)

        guard let imageData = contact.imageData else {
          resolve(nil)
          return
        }

        let base64 = imageData.base64EncodedString()
        resolve(base64)
      } catch {
        reject("ME_CARD_IMAGE_ERROR", "Failed to fetch Me card image: \(error.localizedDescription)", error)
      }
    }
  }

  /// Find the "Me" contact identifier from the user's Contacts
  private func findMeIdentifier(store: CNContactStore) throws -> String? {
    let containers = try store.containers(matching: nil)
    for container in containers {
      if let meId = container.value(forKey: "meIdentifier") as? String, !meId.isEmpty {
        return meId
      }
    }
    return nil
  }
}
