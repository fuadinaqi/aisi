# Stop local API (4000) and Vite (5173). Usage: pwsh scripts/dev-stop.ps1
$ErrorActionPreference = 'SilentlyContinue'
$ports = @(4000, 5173)

foreach ($port in $ports) {
  $procIds = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $procIds) {
    if ($procId -and $procId -ne 0) {
      Write-Host "Stopping PID $procId on port $port"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "Ports 4000 & 5173 cleared."
