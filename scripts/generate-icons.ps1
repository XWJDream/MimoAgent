Add-Type -AssemblyName System.Drawing

$resources = Join-Path $PSScriptRoot '..\resources'
$pngPath = Join-Path $resources 'icon.png'
$icoPath = Join-Path $resources 'icon.ico'

if (!(Test-Path $resources)) {
  New-Item -ItemType Directory -Path $resources | Out-Null
}

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(13, 17, 23))

$rect = New-Object System.Drawing.Rectangle 18, 18, 220, 220
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(59, 130, 246),
  [System.Drawing.Color]::FromArgb(16, 163, 127),
  45
)
$graphics.FillEllipse($brush, $rect)

$innerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(13, 17, 23))
$graphics.FillEllipse($innerBrush, (New-Object System.Drawing.Rectangle 64, 64, 128, 128))

$font = New-Object System.Drawing.Font 'Segoe UI', 76, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('M', $font, $textBrush, (New-Object System.Drawing.RectangleF 0, 0, $size, $size), $format)

$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$graphics.Dispose()
$bitmap.Dispose()
$icon.Dispose()

Write-Host "Generated $pngPath"
Write-Host "Generated $icoPath"
