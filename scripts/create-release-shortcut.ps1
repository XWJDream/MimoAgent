$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$release = Join-Path $root 'release'
$exe = Join-Path $release 'win-unpacked\MimoAgent.exe'
$shortcut = Join-Path $release 'MimoAgent.lnk'
$icon = Join-Path $root 'resources\icon.ico'

if (!(Test-Path $exe)) {
  throw "Missing $exe. Run npm run package:dir first."
}

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $exe
$link.WorkingDirectory = Split-Path $exe
$link.Description = 'Launch MimoAgent'
if (Test-Path $icon) {
  $link.IconLocation = $icon
}
$link.Save()

Write-Host "Created $shortcut"
