# Remove fundo escuro da logo AMPLIGUARD (PNG transparente)
param(
  [string]$InputPath = "$PSScriptRoot\..\public\assets\ampliguard-header.png"
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
$w = $src.Width
$h = $src.Height

$bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bmp.SetResolution($src.HorizontalResolution, $src.VerticalResolution)

$points = @(
  [System.Drawing.Point]::new(8, 8),
  [System.Drawing.Point]::new($w - 9, 8),
  [System.Drawing.Point]::new(8, $h - 9),
  [System.Drawing.Point]::new($w - 9, $h - 9),
  [System.Drawing.Point]::new([int]($w / 2), 8)
)

$avgR = 0; $avgG = 0; $avgB = 0
foreach ($p in $points) {
  $c = $src.GetPixel($p.X, $p.Y)
  $avgR += $c.R; $avgG += $c.G; $avgB += $c.B
}
$avgR = $avgR / $points.Count
$avgG = $avgG / $points.Count
$avgB = $avgB / $points.Count
$threshold = 52

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $src.GetPixel($x, $y)
    $dr = $c.R - $avgR
    $dg = $c.G - $avgG
    $db = $c.B - $avgB
    $dist = [Math]::Sqrt($dr * $dr + $dg * $dg + $db * $db)
    $isDarkBg = ($c.R -lt 100) -and ($c.G -lt 120) -and ($c.B -lt 110) -and (($c.G - $c.R) -lt 60)
    if (($dist -lt $threshold) -or ($isDarkBg -and $dist -lt ($threshold + 24))) {
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    } else {
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
    }
  }
  if ($y % 80 -eq 0) { Write-Host "..." }
}

$tmp = "$InputPath.tmp.png"
$bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$bmp.Dispose()
Move-Item -Force $tmp $InputPath
Write-Host "OK - fundo removido: $InputPath (${w}x${h})"
