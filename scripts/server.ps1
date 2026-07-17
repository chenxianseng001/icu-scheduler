$port = 8765
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
}

$root = $PSScriptRoot
$dataFile = Join-Path $root "排班数据.json"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.AbsolutePath.TrimStart('/')

    # API: load data
    if ($urlPath -eq "api/load") {
        $response.ContentType = "application/json; charset=utf-8"
        if (Test-Path $dataFile) {
            $content = [IO.File]::ReadAllBytes($dataFile)
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 204
        }
        $response.Close()
        continue
    }

    # API: save data
    if ($urlPath -eq "api/save" -and $request.HttpMethod -eq "POST") {
        $reader = New-Object System.IO.StreamReader($request.InputStream, [Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
        $reader.Close()
        try {
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [IO.File]::WriteAllText($dataFile, $body, $utf8NoBom)
            $response.StatusCode = 200
        } catch {
            $response.StatusCode = 500
        }
        $response.Close()
        continue
    }

    # Static files
    if ($urlPath -eq "") { $urlPath = "index.html" }

    $filePath = Join-Path $root $urlPath
    $resolved = Resolve-Path $filePath -ErrorAction SilentlyContinue

    if ($resolved -and (Test-Path $resolved -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($resolved)
        $mime = $mimeTypes[$ext]
        if (-not $mime) { $mime = "application/octet-stream" }
        $response.ContentType = $mime
        $content = [IO.File]::ReadAllBytes($resolved)
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
