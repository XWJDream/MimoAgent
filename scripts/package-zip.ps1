$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$release = Join-Path $root 'release'
$source = Join-Path $release 'win-unpacked'
$target = Join-Path $release 'MimoAgent-win-unpacked.zip'

if (!(Test-Path $source)) {
  throw "Missing $source. Run npm run package:dir first."
}

if (Test-Path $target) {
  Remove-Item $target -Force
}

Compress-Archive -Path (Join-Path $source '*') -DestinationPath $target -Force
Write-Host "Created $target"
