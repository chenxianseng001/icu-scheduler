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

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.AbsolutePath.TrimStart('/')
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
