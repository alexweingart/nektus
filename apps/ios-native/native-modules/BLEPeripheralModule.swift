import Foundation
import CoreBluetooth
import React

/// Native module wrapping CBPeripheralManager for BLE advertising + GATT server.
/// react-native-ble-plx is central-only; this module adds peripheral (advertiser) support.
@objc(BLEPeripheral)
class BLEPeripheralModule: RCTEventEmitter, CBPeripheralManagerDelegate {

  private var peripheralManager: CBPeripheralManager?
  private var service: CBMutableService?
  private var profileCharacteristic: CBMutableCharacteristic?
  private var metadataCharacteristic: CBMutableCharacteristic?

  // Profile data chunks for GATT read requests
  private var profileChunks: [Data] = []
  private var metadataData: Data = Data()

  // UUIDs matching ble-manager.ts
  private let serviceUUID = CBUUID(string: "8fa1c2d4-e5f6-4a7b-9c0d-1e2f3a4b5c6d")
  private let profileCharUUID = CBUUID(string: "8fa1c2d5-e5f6-4a7b-9c0d-1e2f3a4b5c6e")
  private let metadataCharUUID = CBUUID(string: "8fa1c2d6-e5f6-4a7b-9c0d-1e2f3a4b5c6f")

  // Pending advertising params (queued if manager not ready yet)
  private var pendingAdvertisement: [String: Any]?
  private var pendingServiceSetup = false

  // Track current read chunk index per central
  private var readChunkIndex: [UUID: Int] = [:]

  // Has listeners flag for RCTEventEmitter
  private var hasListeners = false

  @objc override static func requiresMainQueueSetup() -> Bool { return false }

  override func supportedEvents() -> [String] {
    return ["BLEPeripheralWriteReceived"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // MARK: - JS API

  /// Start advertising with userId, sharing category, and button press timestamp.
  /// Manufacturer data: userId (8 bytes) + category (1 byte) + timestamp (4 bytes LE)
  @objc func startAdvertising(
    _ userId: String,
    sharingCategory: String,
    buttonPressTimestamp: NSNumber
  ) {
    // Initialize peripheral manager if needed
    if peripheralManager == nil {
      peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
    }

    // Build manufacturer data (13 bytes)
    var mfgData = Data()

    // userId: first 8 chars, padded with null bytes
    let userIdBytes = Array(userId.prefix(8).utf8)
    mfgData.append(contentsOf: userIdBytes)
    if userIdBytes.count < 8 {
      mfgData.append(contentsOf: [UInt8](repeating: 0, count: 8 - userIdBytes.count))
    }

    // sharingCategory: 1 char ('P' or 'W')
    let catChar: UInt8 = sharingCategory == "W" ? 0x57 : 0x50 // 'W' or 'P'
    mfgData.append(catChar)

    // buttonPressTimestamp: 4 bytes little-endian
    var ts = buttonPressTimestamp.uint32Value
    mfgData.append(Data(bytes: &ts, count: 4))

    let advertisementData: [String: Any] = [
      CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
      CBAdvertisementDataLocalNameKey: "Nekt"
    ]

    // Store manufacturer data for service data (iOS doesn't support manufacturer data
    // in peripheral advertising, so we put it in the GATT metadata characteristic instead)
    if let metadataChar = metadataCharacteristic {
      metadataChar.value = mfgData
    }

    if peripheralManager?.state == .poweredOn {
      peripheralManager?.startAdvertising(advertisementData)
      NSLog("[BLEPeripheral] Started advertising")
    } else {
      // Queue until manager is ready
      pendingAdvertisement = advertisementData
      NSLog("[BLEPeripheral] Queued advertising (waiting for PoweredOn)")
    }
  }

  /// Stop advertising
  @objc func stopAdvertising() {
    peripheralManager?.stopAdvertising()
    peripheralManager?.removeAllServices()
    profileChunks = []
    metadataData = Data()
    readChunkIndex.removeAll()
    NSLog("[BLEPeripheral] Stopped advertising")
  }

  /// Set profile data for GATT read requests. Chunks the JSON for BLE transmission.
  @objc func setProfileData(_ profileJson: String) {
    let data = Data(profileJson.utf8)
    let chunkSize = 512

    profileChunks = []
    var offset = 0
    while offset < data.count {
      let end = min(offset + chunkSize, data.count)
      profileChunks.append(data.subdata(in: offset..<end))
      offset = end
    }

    // Build metadata
    let metadata: [String: Any] = [
      "totalChunks": profileChunks.count,
      "version": 1
    ]
    if let metaJson = try? JSONSerialization.data(withJSONObject: metadata) {
      metadataData = metaJson
    }

    NSLog("[BLEPeripheral] Set profile data: \(data.count) bytes, \(profileChunks.count) chunks")
  }

  /// Set up the GATT service with profile + metadata characteristics
  @objc func setupGATTServer() {
    if peripheralManager == nil {
      peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
    }

    if peripheralManager?.state == .poweredOn {
      addGATTService()
    } else {
      pendingServiceSetup = true
      NSLog("[BLEPeripheral] Queued GATT setup (waiting for PoweredOn)")
    }
  }

  // MARK: - Internal

  private func addGATTService() {
    // Remove any existing services first
    peripheralManager?.removeAllServices()

    // Profile characteristic: read + write (central reads our profile, writes theirs)
    profileCharacteristic = CBMutableCharacteristic(
      type: profileCharUUID,
      properties: [.read, .write],
      value: nil, // Dynamic value via delegate
      permissions: [.readable, .writeable]
    )

    // Metadata characteristic: read (chunk count + advertisement data)
    metadataCharacteristic = CBMutableCharacteristic(
      type: metadataCharUUID,
      properties: [.read],
      value: nil, // Dynamic value via delegate
      permissions: [.readable]
    )

    service = CBMutableService(type: serviceUUID, primary: true)
    service?.characteristics = [profileCharacteristic!, metadataCharacteristic!]

    peripheralManager?.add(service!)
    NSLog("[BLEPeripheral] GATT service added")
  }

  // MARK: - CBPeripheralManagerDelegate

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    NSLog("[BLEPeripheral] State changed: \(peripheral.state.rawValue)")

    if peripheral.state == .poweredOn {
      // Process queued operations
      if pendingServiceSetup {
        pendingServiceSetup = false
        addGATTService()
      }
      if let adData = pendingAdvertisement {
        pendingAdvertisement = nil
        peripheral.startAdvertising(adData)
        NSLog("[BLEPeripheral] Started queued advertising")
      }
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    if let error = error {
      NSLog("[BLEPeripheral] Failed to add service: \(error.localizedDescription)")
    } else {
      NSLog("[BLEPeripheral] Service added successfully")
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
      NSLog("[BLEPeripheral] Failed to start advertising: \(error.localizedDescription)")
    } else {
      NSLog("[BLEPeripheral] Advertising started successfully")
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    NSLog("[BLEPeripheral] Read request for characteristic: \(request.characteristic.uuid)")

    if request.characteristic.uuid == metadataCharUUID {
      // Serve metadata (chunk count)
      let responseData = metadataData
      if request.offset > responseData.count {
        peripheral.respond(to: request, withResult: .invalidOffset)
        return
      }
      request.value = responseData.subdata(in: request.offset..<responseData.count)
      peripheral.respond(to: request, withResult: .success)

    } else if request.characteristic.uuid == profileCharUUID {
      // Serve profile chunks sequentially
      let centralId = request.central.identifier
      let chunkIdx = readChunkIndex[centralId] ?? 0

      if chunkIdx < profileChunks.count {
        // Wrap chunk in JSON envelope matching ble-manager.ts format
        let chunkData = profileChunks[chunkIdx]
        let chunkString = String(data: chunkData, encoding: .utf8) ?? ""
        let envelope: [String: Any] = ["index": chunkIdx, "data": chunkString]

        if let envelopeData = try? JSONSerialization.data(withJSONObject: envelope) {
          if request.offset > envelopeData.count {
            peripheral.respond(to: request, withResult: .invalidOffset)
            return
          }
          request.value = envelopeData.subdata(in: request.offset..<envelopeData.count)
          readChunkIndex[centralId] = chunkIdx + 1
          peripheral.respond(to: request, withResult: .success)
          NSLog("[BLEPeripheral] Served chunk \(chunkIdx + 1)/\(profileChunks.count)")
        } else {
          peripheral.respond(to: request, withResult: .unlikelyError)
        }
      } else {
        // All chunks served, reset for potential re-reads
        readChunkIndex[centralId] = 0
        peripheral.respond(to: request, withResult: .invalidOffset)
      }

    } else {
      peripheral.respond(to: request, withResult: .attributeNotFound)
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    for request in requests {
      NSLog("[BLEPeripheral] Write request for characteristic: \(request.characteristic.uuid)")

      if request.characteristic.uuid == profileCharUUID {
        if let data = request.value, let json = String(data: data, encoding: .utf8) {
          NSLog("[BLEPeripheral] Received write data: \(data.count) bytes")

          // Emit event to JS with the written profile data
          if hasListeners {
            sendEvent(withName: "BLEPeripheralWriteReceived", body: [
              "data": json,
              "centralId": request.central.identifier.uuidString
            ])
          }
        }
        peripheral.respond(to: request, withResult: .success)

      } else if request.characteristic.uuid == metadataCharUUID {
        // Accept metadata writes (header with chunk count from initiator)
        peripheral.respond(to: request, withResult: .success)

      } else {
        peripheral.respond(to: request, withResult: .attributeNotFound)
      }
    }
  }
}
