import Foundation

public enum XTRIPortal: String, CaseIterable, Identifiable, Sendable {
    case admin
    case aluno

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .admin:
            "Admin/Coordenador"
        case .aluno:
            "Aluno"
        }
    }

    public var defaultURL: URL {
        switch self {
        case .admin:
            URL(string: "https://horariodeestudos.com")!
        case .aluno:
            URL(string: "https://aluno.horariodeestudos.com")!
        }
    }
}

public struct AppConfig: Equatable, Sendable {
    public let adminURL: URL
    public let alunoURL: URL
    public let initialPortal: XTRIPortal

    public init(
        adminURL: URL = XTRIPortal.admin.defaultURL,
        alunoURL: URL = XTRIPortal.aluno.defaultURL,
        initialPortal: XTRIPortal = .admin
    ) {
        self.adminURL = adminURL
        self.alunoURL = alunoURL
        self.initialPortal = initialPortal
    }

    public func url(for portal: XTRIPortal) -> URL {
        switch portal {
        case .admin:
            adminURL
        case .aluno:
            alunoURL
        }
    }
}

public extension AppConfig {
    static func fromEnvironment(_ environment: [String: String] = ProcessInfo.processInfo.environment) -> AppConfig {
        let adminURL = environment.urlValue(for: "XTRI_ADMIN_URL") ?? XTRIPortal.admin.defaultURL
        let alunoURL = environment.urlValue(for: "XTRI_ALUNO_URL") ?? XTRIPortal.aluno.defaultURL
        let initialPortal = environment.portalValue(for: "XTRI_INITIAL_PORTAL") ?? .admin

        return AppConfig(adminURL: adminURL, alunoURL: alunoURL, initialPortal: initialPortal)
    }
}

private extension Dictionary where Key == String, Value == String {
    func urlValue(for key: String) -> URL? {
        guard let rawValue = self[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawValue.isEmpty,
              let url = URL(string: rawValue),
              url.scheme == "https" || url.scheme == "http"
        else {
            return nil
        }

        return url
    }

    func portalValue(for key: String) -> XTRIPortal? {
        guard let rawValue = self[key]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() else {
            return nil
        }

        return XTRIPortal(rawValue: rawValue)
    }
}
