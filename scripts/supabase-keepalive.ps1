# Supabase keep-alive
# Free-tier Supabase projects are paused after ~7 days without activity.
# This makes a tiny REST query every couple of days to keep the project active.
# Run manually:  powershell -ExecutionPolicy Bypass -File scripts\supabase-keepalive.ps1
# Scheduled via Windows Task "SupabaseKeepAlive" (see scripts\register-keepalive-task.ps1).

$ErrorActionPreference = "Stop"

$root    = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
$logFile = Join-Path $PSScriptRoot "supabase-keepalive.log"

function Write-Log($msg) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logFile -Value $line -Encoding utf8
    Write-Output $line
}

if (-not (Test-Path $envFile)) {
    Write-Log "ERROR: .env.local not found at $envFile"
    exit 1
}

# Parse the two keys we need out of .env.local
$url = $null
$key = $null
foreach ($raw in Get-Content $envFile) {
    $l = $raw.Trim()
    if ($l -eq "" -or $l.StartsWith("#")) { continue }
    $i = $l.IndexOf("=")
    if ($i -lt 0) { continue }
    $name = $l.Substring(0, $i).Trim()
    $val  = $l.Substring($i + 1).Trim().Trim('"')
    if ($name -eq "NEXT_PUBLIC_SUPABASE_URL")   { $url = $val }
    if ($name -eq "SUPABASE_SERVICE_ROLE_KEY")  { $key = $val }
}

if (-not $url -or -not $key) {
    Write-Log "ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    exit 1
}

$endpoint = "$url/rest/v1/documents_library?select=id&limit=1"

# Use curl.exe (ships with Windows 10/11). PowerShell 5.1's Invoke-WebRequest
# mangles the auth headers against Supabase and returns a spurious 401.
$code = & curl.exe -s -o NUL -w "%{http_code}" --max-time 30 `
    $endpoint `
    -H "apikey: $key" `
    -H "Authorization: Bearer $key"

if ($code -match "^2\d\d$") {
    Write-Log ("OK  HTTP {0}  keep-alive ping succeeded" -f $code)
    exit 0
} else {
    Write-Log ("ERROR HTTP {0}  keep-alive ping failed" -f $code)
    exit 1
}
