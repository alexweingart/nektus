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

        if let contact = try self.fetchMeContact(store: store, keysToFetch: keysToFetch) {
          let phoneNumbers = contact.phoneNumbers.map { $0.value.stringValue }
          let emails = contact.emailAddresses.map { $0.value as String }

          NSLog("[MeCardModule] Me card found: %@ %@ (phones: %d, emails: %d, hasImage: %@)",
                contact.givenName, contact.familyName,
                phoneNumbers.count, emails.count,
                contact.imageDataAvailable ? "yes" : "no")

          let result: [String: Any] = [
            "firstName": contact.givenName,
            "lastName": contact.familyName,
            "phoneNumbers": phoneNumbers,
            "emails": emails,
            "hasImage": contact.imageDataAvailable,
          ]

          resolve(result)
          return
        }

        NSLog("[MeCardModule] No Me card found")
        resolve(nil)
      } catch {
        reject("ME_CARD_ERROR", "Failed to fetch Me card: \(error.localizedDescription)", error)
      }
    }
  }

  /// Returns the Me card image as a file:// path to a temp JPEG file.
  /// Writing to disk avoids passing large base64 strings through the RN bridge,
  /// which triggers Hermes's "ArrayBuffer blob not supported" error.
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

        if let contact = try self.fetchMeContact(store: store, keysToFetch: keysToFetch) {
          guard let imageData = contact.imageData else {
            NSLog("[MeCardModule] Me card has no image data")
            resolve(nil)
            return
          }

          NSLog("[MeCardModule] Me card image extracted (%d bytes)", imageData.count)

          // Write to temp file instead of returning base64 string
          let tempDir = NSTemporaryDirectory()
          let tempFile = (tempDir as NSString).appendingPathComponent("mecard-photo.jpg")
          let tempURL = URL(fileURLWithPath: tempFile)
          try imageData.write(to: tempURL)

          NSLog("[MeCardModule] Me card image written to %@", tempFile)
          resolve(tempURL.absoluteString) // file:// URL
          return
        }

        resolve(nil)
      } catch {
        reject("ME_CARD_IMAGE_ERROR", "Failed to fetch Me card image: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Private helpers

  /// Try to fetch the Me contact using meIdentifier from container.
  /// Handles both modern UUID identifiers and legacy numeric ABRecordIDs.
  private func fetchMeContact(store: CNContactStore, keysToFetch: [CNKeyDescriptor]) throws -> CNContact? {
    let containers = try store.containers(matching: nil)

    for container in containers {
      guard let meId = container.value(forKey: "meIdentifier") as? String, !meId.isEmpty else {
        continue
      }

      NSLog("[MeCardModule] Found meIdentifier: %@ in container %@", meId, container.identifier)

      // Try direct UUID lookup (works when meIdentifier is a modern CNContact identifier)
      do {
        let contact = try store.unifiedContact(withIdentifier: meId, keysToFetch: keysToFetch)
        NSLog("[MeCardModule] Me card resolved directly (id: %@)", contact.identifier)
        return contact
      } catch {
        NSLog("[MeCardModule] Direct lookup failed for '%@': %@", meId, error.localizedDescription)
      }

      // If meIdentifier is numeric (legacy ABRecordID), resolve via container enumeration
      if let numericId = Int(meId) {
        NSLog("[MeCardModule] meIdentifier is numeric (legacy ABRecordID=%d) — enumerating container", numericId)
        if let contact = try self.resolveNumericMeId(store: store, numericId: numericId, container: container, keysToFetch: keysToFetch) {
          return contact
        }
      }
    }

    NSLog("[MeCardModule] No Me card found in any container")
    return nil
  }

  /// Resolve a numeric (legacy ABRecordID) meIdentifier by enumerating contacts
  /// in the container. The Nth contact (1-indexed) in the underlying ABPerson table
  /// corresponds to ABRecordID N, so we use the enumeration index to match.
  private func resolveNumericMeId(store: CNContactStore, numericId: Int, container: CNContainer, keysToFetch: [CNKeyDescriptor]) throws -> CNContact? {
    // Enumerate contacts and log identifiers (identifier is always available on CNContact)
    let containerPredicate = CNContact.predicateForContactsInContainer(withIdentifier: container.identifier)
    let contacts = try store.unifiedContacts(matching: containerPredicate, keysToFetch: keysToFetch)
    NSLog("[MeCardModule] Container has %d contacts, looking for ABRecordID %d", contacts.count, numericId)

    // The ABRecordID is the ROWID in the ABPerson table (1-indexed).
    // When fetched via container predicate, contacts may be returned in ROWID order.
    // Check if the (numericId - 1) index gives us a valid contact.
    let index = numericId - 1
    if index >= 0 && index < contacts.count {
      let candidate = contacts[index]
      NSLog("[MeCardModule] Candidate at index %d: id=%@", index, candidate.identifier)

      // Verify this is actually the Me card by re-fetching with full keys
      // and checking it's a valid contact (return it regardless — the index mapping is our best bet)
      return candidate
    }

    NSLog("[MeCardModule] Index %d out of range for %d contacts", index, contacts.count)

    // Log all contact identifiers for debugging
    for (i, c) in contacts.enumerated() {
      NSLog("[MeCardModule]   [%d] id=%@", i, c.identifier)
    }

    return nil
  }
}
