# Restaura o fundo interno do escudo na logomarca de impressao,
# removendo apenas o fundo externo (verde/preto).
Add-Type -AssemblyName System.Drawing
$drawingAsm = [System.Drawing.Bitmap].Assembly.Location
Add-Type -ReferencedAssemblies @($drawingAsm, "System.dll", "System.Core.dll") -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Collections.Generic;

public static class LogoShieldFix {
  static bool IsOuterBg(int r, int g, int b, int a) {
    if (a < 8) return true;
    // verde texturizado externo (G alto, R baixo); nao pegar asfalto quase preto
    bool greenish = g >= 32 && (g - r) >= 18 && r <= 55 && b <= 95;
    bool nearBlackGreen = r <= 20 && g >= 40 && g <= 95 && b >= 35 && b <= 90 && (g - r) >= 20;
    return greenish || nearBlackGreen;
  }

  public static Bitmap RemoveOuterBackground(Bitmap src) {
    int w = src.Width, h = src.Height;
    Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.DrawImage(src, 0, 0, w, h);
    }
    BitmapData data = dst.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] px = new byte[Math.Abs(stride) * h];
    System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);

    bool[] vis = new bool[w * h];
    Queue<int> q = new Queue<int>();
    Action<int,int> enq = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      int i = y * w + x;
      if (vis[i]) return;
      int o = y * stride + x * 4;
      int b = px[o], g = px[o + 1], r = px[o + 2], a = px[o + 3];
      if (!IsOuterBg(r, g, b, a)) return;
      vis[i] = true;
      q.Enqueue(i);
    };

    for (int x = 0; x < w; x++) { enq(x, 0); enq(x, h - 1); }
    for (int y = 0; y < h; y++) { enq(0, y); enq(w - 1, y); }

    int[] dx = new int[] { 1, -1, 0, 0, 1, 1, -1, -1 };
    int[] dy = new int[] { 0, 0, 1, -1, 1, -1, 1, -1 };
    while (q.Count > 0) {
      int i = q.Dequeue();
      int x = i % w;
      int y = i / w;
      int o = y * stride + x * 4;
      px[o] = 0; px[o + 1] = 0; px[o + 2] = 0; px[o + 3] = 0;
      for (int k = 0; k < 8; k++) enq(x + dx[k], y + dy[k]);
    }

    System.Runtime.InteropServices.Marshal.Copy(px, 0, data.Scan0, px.Length);
    dst.UnlockBits(data);
    return dst;
  }

  public static Rectangle OpaqueBounds(Bitmap src) {
    int w = src.Width, h = src.Height;
    BitmapData data = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] px = new byte[Math.Abs(stride) * h];
    System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);
    src.UnlockBits(data);
    int minX = w, minY = h, maxX = -1, maxY = -1;
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        if (px[y * stride + x * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return new Rectangle(0, 0, w, h);
    return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }

  public static Bitmap Crop(Bitmap src, Rectangle r) {
    Bitmap dst = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.CompositingMode = CompositingMode.SourceCopy;
      g.DrawImage(src, new Rectangle(0, 0, r.Width, r.Height), r, GraphicsUnit.Pixel);
    }
    return dst;
  }

  public static Bitmap CompositeShield(Bitmap lockup, Bitmap shield) {
    Rectangle lockBounds = OpaqueBounds(lockup);
    // escudo fica no terco esquerdo da logomarca
    int searchW = Math.Max(40, lockup.Width / 3);
    int minX = lockup.Width, minY = lockup.Height, maxX = -1, maxY = -1;
    BitmapData data = lockup.LockBits(new Rectangle(0, 0, lockup.Width, lockup.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] px = new byte[Math.Abs(stride) * lockup.Height];
    System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);
    lockup.UnlockBits(data);
    for (int y = 0; y < lockup.Height; y++) {
      for (int x = 0; x < searchW; x++) {
        if (px[y * stride + x * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      minX = lockBounds.X; minY = lockBounds.Y; maxX = lockBounds.X + Math.Min(searchW, lockBounds.Width) - 1; maxY = lockBounds.Bottom - 1;
    }
    Rectangle dest = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    Bitmap outBmp = new Bitmap(lockup.Width, lockup.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(outBmp)) {
      g.Clear(Color.Transparent);
      g.CompositingMode = CompositingMode.SourceOver;
      g.CompositingQuality = CompositingQuality.HighQuality;
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.DrawImage(shield, dest);
      g.DrawImage(lockup, 0, 0, lockup.Width, lockup.Height);
    }
    return outBmp;
  }
}
"@

$root = Split-Path $PSScriptRoot -Parent
$shieldPath = Join-Path $root "public\assets\ampliguard-shield.png"
$lockupPath = Join-Path $root "public\assets\ampliguard-header-trim.png"
$outPath = Join-Path $root "public\assets\ampliguard-header-trim.png"

$shieldSrc = [System.Drawing.Bitmap]::FromFile($shieldPath)
$cut = [LogoShieldFix]::RemoveOuterBackground($shieldSrc)
$sb = [LogoShieldFix]::OpaqueBounds($cut)
$shieldCrop = [LogoShieldFix]::Crop($cut, $sb)
$lockup = [System.Drawing.Bitmap]::FromFile($lockupPath)
$result = [LogoShieldFix]::CompositeShield($lockup, $shieldCrop)

$tmp = "$outPath.tmp.png"
$result.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$shieldSrc.Dispose(); $cut.Dispose(); $shieldCrop.Dispose(); $lockup.Dispose(); $result.Dispose()
Move-Item -Force $tmp $outPath
Write-Host "OK - escudo interno restaurado: $outPath (crop $($sb.Width)x$($sb.Height))"
