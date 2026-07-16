import EventKit
import Foundation

private struct CalendarDescriptorPayload: Encodable {
    let id: String
    let title: String
    let source: String
}

private struct CalendarEventPayload: Encodable {
    let title: String
    let start: String
    let end: String
    let allDay: Bool
    let calendar: String
    let location: String?
}

private struct BridgeResponse<Payload: Encodable>: Encodable {
    let status: String
    let data: [Payload]
    let message: String?
}

@main
private struct StoneCalendarBridge {
    static func main() async {
        let arguments = Array(CommandLine.arguments.dropFirst())
        guard let command = arguments.first, command == "list" || command == "events" else {
            emitError("Expected 'list' or 'events YYYY-MM-DD [--all|calendar-id …]'.")
            return
        }

        let store = EKEventStore()
        do {
            guard try await requestAccessIfNeeded(store) else {
                emit(BridgeResponse<CalendarDescriptorPayload>(
                    status: "denied",
                    data: [],
                    message: "Calendar access is blocked in macOS Privacy & Security settings."
                ))
                return
            }

            if command == "list" {
                let calendars = store.calendars(for: .event)
                    .map { calendar in
                        CalendarDescriptorPayload(
                            id: calendar.calendarIdentifier,
                            title: calendar.title,
                            source: calendar.source.title
                        )
                    }
                    .sorted {
                        let titleOrder = $0.title.localizedCaseInsensitiveCompare($1.title)
                        return titleOrder == .orderedSame
                            ? $0.source.localizedCaseInsensitiveCompare($1.source) == .orderedAscending
                            : titleOrder == .orderedAscending
                    }
                emit(BridgeResponse(status: "connected", data: calendars, message: nil))
                return
            }

            guard arguments.count >= 2, let dayRange = parseLocalDay(arguments[1]) else {
                emitError("Expected a calendar date in YYYY-MM-DD format.")
                return
            }

            let requestedIds = Set(arguments.dropFirst(2))
            let calendars: [EKCalendar]?
            if requestedIds.contains("--all") {
                calendars = nil
            } else {
                calendars = store.calendars(for: .event).filter {
                    requestedIds.contains($0.calendarIdentifier)
                }
            }

            if calendars?.isEmpty == true {
                emit(BridgeResponse<CalendarEventPayload>(status: "connected", data: [], message: nil))
                return
            }

            let predicate = store.predicateForEvents(
                withStart: dayRange.start,
                end: dayRange.end,
                calendars: calendars
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
            emitError("Could not read Calendar: \(error.localizedDescription)")
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

    private static func emitError(_ message: String) {
        emit(BridgeResponse<CalendarDescriptorPayload>(status: "error", data: [], message: message))
    }

    private static func emit<Payload>(_ response: BridgeResponse<Payload>) {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(response),
              let output = String(data: data, encoding: .utf8) else {
            print("{\"status\":\"error\",\"data\":[],\"message\":\"Could not encode Calendar response.\"}")
            return
        }
        print(output)
    }
}
