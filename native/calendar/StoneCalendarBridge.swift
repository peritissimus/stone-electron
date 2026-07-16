import EventKit
import Foundation

private struct CalendarEventPayload: Encodable {
    let title: String
    let start: String
    let end: String
    let allDay: Bool
    let calendar: String
    let location: String?
}

private struct BridgeResponse: Encodable {
    let status: String
    let data: [CalendarEventPayload]
    let message: String?
}

@main
private struct StoneCalendarBridge {
    static func main() async {
        guard CommandLine.arguments.count == 2,
              let dayRange = parseLocalDay(CommandLine.arguments[1]) else {
            emit(BridgeResponse(
                status: "error",
                data: [],
                message: "Expected a calendar date in YYYY-MM-DD format."
            ))
            return
        }

        let store = EKEventStore()
        do {
            guard try await requestAccessIfNeeded(store) else {
                emit(BridgeResponse(
                    status: "denied",
                    data: [],
                    message: "Calendar access is blocked in macOS Privacy & Security settings."
                ))
                return
            }

            let predicate = store.predicateForEvents(
                withStart: dayRange.start,
                end: dayRange.end,
                calendars: nil
            )
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let events = store.events(matching: predicate)
                .sorted { $0.startDate < $1.startDate }
                .map { event in
                    CalendarEventPayload(
                        title: event.title ?? "(no title)",
                        start: formatter.string(from: event.startDate),
                        end: formatter.string(from: event.endDate),
                        allDay: event.isAllDay,
                        calendar: event.calendar.title,
                        location: event.location
                    )
                }

            emit(BridgeResponse(status: "connected", data: events, message: nil))
        } catch {
            emit(BridgeResponse(
                status: "error",
                data: [],
                message: "Could not read Calendar: \(error.localizedDescription)"
            ))
        }
    }

    private static func requestAccessIfNeeded(_ store: EKEventStore) async throws -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if hasFullAccess(status) { return true }
        guard status == .notDetermined else { return false }

        if #available(macOS 14.0, *) {
            return try await store.requestFullAccessToEvents()
        }
        return try await store.requestAccess(to: .event)
    }

    private static func hasFullAccess(_ status: EKAuthorizationStatus) -> Bool {
        if #available(macOS 14.0, *) {
            return status == .fullAccess
        }
        return status == .authorized
    }

    private static func parseLocalDay(_ value: String) -> (start: Date, end: Date)? {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }

        var calendar = Calendar.current
        calendar.timeZone = .current
        let components = DateComponents(
            timeZone: .current,
            year: parts[0],
            month: parts[1],
            day: parts[2]
        )
        guard let start = calendar.date(from: components),
              let end = calendar.date(byAdding: .day, value: 1, to: start) else {
            return nil
        }
        return (start, end)
    }

    private static func emit(_ response: BridgeResponse) {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(response),
              let output = String(data: data, encoding: .utf8) else {
            print("{\"status\":\"error\",\"data\":[],\"message\":\"Could not encode Calendar response.\"}")
            return
        }
        print(output)
    }
}
