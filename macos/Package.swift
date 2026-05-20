// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "XTRICronogramasMac",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .executable(name: "XTRICronogramasMac", targets: ["XTRICronogramasMac"]),
        .executable(name: "XTRICronogramasCoreSmokeTests", targets: ["XTRICronogramasCoreSmokeTests"]),
        .library(name: "XTRICronogramasCore", targets: ["XTRICronogramasCore"]),
    ],
    targets: [
        .target(name: "XTRICronogramasCore"),
        .executableTarget(
            name: "XTRICronogramasMac",
            dependencies: ["XTRICronogramasCore"],
            linkerSettings: [
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit"),
            ]
        ),
        .executableTarget(
            name: "XTRICronogramasCoreSmokeTests",
            dependencies: ["XTRICronogramasCore"]
        ),
    ]
)
