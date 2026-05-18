<?php
declare(strict_types=1);

const MAX_IMAGE_BYTES = 2097152; // 2 MB

function fail_request(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $message;
    exit;
}

function validate_source_url(string $source): string
{
    if ($source === '' || strlen($source) > 2048) {
        fail_request(400, 'Imagem invalida.');
    }

    $parts = parse_url($source);
    if (!is_array($parts)) {
        fail_request(400, 'URL invalida.');
    }

    $scheme = $parts['scheme'] ?? '';
    $host = $parts['host'] ?? '';
    $path = $parts['path'] ?? '';

    if ($scheme !== 'https' || $host !== 'api.questoes.xtri.online') {
        fail_request(403, 'Origem de imagem nao permitida.');
    }

    if (strncmp($path, '/media/enem/', strlen('/media/enem/')) !== 0) {
        fail_request(403, 'Caminho de imagem nao permitido.');
    }

    if (!preg_match('/\.(png|jpe?g|gif|webp)$/i', $path)) {
        fail_request(403, 'Formato de imagem nao permitido.');
    }

    return $source;
}

function fetch_image(string $source): string
{
    if (function_exists('curl_init')) {
        $buffer = '';
        $handle = curl_init($source);
        if ($handle === false) {
            fail_request(502, 'Falha ao iniciar proxy.');
        }

        curl_setopt_array($handle, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_USERAGENT => 'XTRI-PDF-Image-Proxy/1.0',
            CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$buffer): int {
                if (strlen($buffer) + strlen($chunk) > MAX_IMAGE_BYTES) {
                    return 0;
                }
                $buffer .= $chunk;
                return strlen($chunk);
            },
        ]);

        curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($status !== 200 || $buffer === '') {
            fail_request(502, $error !== '' ? 'Falha ao baixar imagem.' : 'Imagem nao encontrada.');
        }

        return $buffer;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'follow_location' => 0,
            'header' => "User-Agent: XTRI-PDF-Image-Proxy/1.0\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $data = @file_get_contents($source, false, $context, 0, MAX_IMAGE_BYTES + 1);
    if (!is_string($data) || $data === '' || strlen($data) > MAX_IMAGE_BYTES) {
        fail_request(502, 'Falha ao baixar imagem.');
    }

    return $data;
}

$source = validate_source_url((string) ($_GET['url'] ?? ''));
$image = fetch_image($source);
$info = @getimagesizefromstring($image);

if (!is_array($info)) {
    fail_request(415, 'Conteudo retornado nao e imagem.');
}

$mime = (string) ($info['mime'] ?? '');
if ($mime === '' || strncmp($mime, 'image/', strlen('image/')) !== 0) {
    fail_request(415, 'Conteudo retornado nao e imagem.');
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($image));
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=2592000, immutable');
header('X-Content-Type-Options: nosniff');
echo $image;
