# Recorta bordas transparentes da logo (PNG)
param(
  [string]$InputPath = "$PSScriptRoot\..\public\assets\ampliguard-header.png",
  [string]$OutputPath = "$PSScriptRoot\..\public\assets\ampliguard-header-trim.png"
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
$w = $src.Width
$h = $src.Height
$minX = $w; $minY = $h; $maxX = 0; $maxY = 0
$found = $false

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $src.GetPixel($x, $y)
    if ($c.A -gt 8) {
      $found = $true
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

if (-not $found) {
  Write-Error "Nenhum pixel visivel encontrado."
  exit 1
}

$pad = 2
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($w - 1, $maxX + $pad)
$maxY = [Math]::Min($h - 1, $maxY + $pad)
$cw = $maxX - $minX + 1
$ch = $maxY - $minY + 1

$bmp = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bmp.SetResolution($src.HorizontalResolution, $src.VerticalResolution)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, (New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$bmp.Dispose()
Write-Host "OK - recortado: ${cw}x${ch} -> $OutputPath"
