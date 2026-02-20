import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Lock Screen Widget (accessoryCircular, below the time)

struct NektWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> NektWidgetEntry {
        NektWidgetEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (NektWidgetEntry) -> Void) {
        completion(NektWidgetEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NektWidgetEntry>) -> Void) {
        let entry = NektWidgetEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct NektWidgetEntry: TimelineEntry {
    let date: Date
}

struct NektWidgetEntryView: View {
    var entry: NektWidgetProvider.Entry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Text("N")
                .font(.system(size: 28, weight: .black, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        stops: [
                            .init(color: .white, location: 0.0),
                            .init(color: .white.opacity(0.55), location: 1.0),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
        .widgetURL(URL(string: "nekt://profile?autoNekt=true"))
    }
}

struct NektWidget: Widget {
    let kind: String = "NektWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NektWidgetProvider()) { entry in
            NektWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Nekt")
        .description("Quick-start a Nekt exchange")
        .supportedFamilies([.accessoryCircular])
    }
}

// MARK: - Lock Screen Control (bottom strip, next to flashlight/camera)

struct OpenNektIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Nekt Exchange"
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct NektControl: ControlWidget {
    static let kind = "com.nektus.app.NektControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenNektIntent()) {
                Label("Nekt", systemImage: "person.line.dotted.person")
            }
        }
        .displayName("Nekt")
        .description("Quick-start a Nekt exchange")
    }
}

// MARK: - Bundle (provides both widget and control)

@main
struct NektWidgetBundle: WidgetBundle {
    var body: some Widget {
        NektWidget()
        NektControl()
    }
}
