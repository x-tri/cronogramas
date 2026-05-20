# XTRI Cronogramas macOS

Wrapper macOS em SwiftPM para os portais web XTRI.

## Rodar

```bash
cd macos
swift build
swift run XTRICronogramasMac
```

## Pacote interno

```bash
cd macos
chmod +x scripts/package-app.sh scripts/package-internal.sh
scripts/package-internal.sh
```

O pacote interno fica em:

```text
macos/dist/XTRI-Cronogramas-macOS-interno.zip
```

## Notas

- `Recarregar` força `WKWebView.reloadFromOrigin()`.
- `Limpar cache` remove os dados do `WKWebsiteDataStore` e recarrega a URL atual.
- O app usa produção por padrão: `https://horariodeestudos.com` e `https://aluno.horariodeestudos.com`.
