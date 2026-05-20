import Foundation
import XTRICronogramasCore

@discardableResult
func expect(_ condition: @autoclosure () -> Bool, _ message: String) -> Bool {
    if condition() {
        return true
    }

    FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
    exit(1)
}

let defaultConfig = AppConfig.fromEnvironment([:])
expect(defaultConfig.adminURL.absoluteString == "https://horariodeestudos.com", "admin default URL")
expect(defaultConfig.alunoURL.absoluteString == "https://aluno.horariodeestudos.com", "aluno default URL")
expect(defaultConfig.initialPortal == .admin, "default initial portal")

let localConfig = AppConfig.fromEnvironment([
    "XTRI_ADMIN_URL": "http://localhost:5173",
    "XTRI_ALUNO_URL": "http://localhost:8080",
    "XTRI_INITIAL_PORTAL": "aluno",
])
expect(localConfig.adminURL.absoluteString == "http://localhost:5173", "admin local URL override")
expect(localConfig.alunoURL.absoluteString == "http://localhost:8080", "aluno local URL override")
expect(localConfig.initialPortal == .aluno, "initial portal override")

let invalidConfig = AppConfig.fromEnvironment([
    "XTRI_ADMIN_URL": "file:///tmp/index.html",
    "XTRI_ALUNO_URL": "not a url",
    "XTRI_INITIAL_PORTAL": "mentor",
])
expect(invalidConfig.adminURL == XTRIPortal.admin.defaultURL, "invalid admin URL fallback")
expect(invalidConfig.alunoURL == XTRIPortal.aluno.defaultURL, "invalid aluno URL fallback")
expect(invalidConfig.initialPortal == .admin, "invalid initial portal fallback")

print("XTRICronogramasCoreSmokeTests: OK")
