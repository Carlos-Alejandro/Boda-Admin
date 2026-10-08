$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$publicDirectory = Join-Path $PSScriptRoot '..\public'
$publicDirectory = [System.IO.Path]::GetFullPath($publicDirectory)
$canvasSize = 512.0
$backgroundColor = [System.Drawing.ColorTranslator]::FromHtml('#10392E')
$goldColor = [System.Drawing.ColorTranslator]::FromHtml('#E7C98B')
$cornerRadius = 76.0
$circleRadius = 184.0
$circleStroke = 10.0

$fontFamily = [System.Drawing.FontFamily]::new('Georgia')
$glyph = [System.Drawing.Drawing2D.GraphicsPath]::new()
$glyph.AddString(
	'B',
	$fontFamily,
	[int][System.Drawing.FontStyle]::Bold,
	300.0,
	[System.Drawing.PointF]::new(0, 0),
	[System.Drawing.StringFormat]::GenericTypographic
)
$glyphBounds = $glyph.GetBounds()
$glyphHeight = 250.0
$scale = $glyphHeight / $glyphBounds.Height
$offsetX = ($canvasSize - $glyphBounds.Width * $scale) / 2.0 - $glyphBounds.X * $scale
$offsetY = ($canvasSize - $glyphBounds.Height * $scale) / 2.0 - $glyphBounds.Y * $scale
$glyph.Transform([System.Drawing.Drawing2D.Matrix]::new([single]$scale, 0, 0, [single]$scale, [single]$offsetX, [single]$offsetY))

$pathPoints = $glyph.PathPoints
$pathTypes = $glyph.PathTypes
$pathData = [System.Text.StringBuilder]::new()
$culture = [System.Globalization.CultureInfo]::InvariantCulture
for ($index = 0; $index -lt $pathPoints.Length; $index++) {
	$type = [int]$pathTypes[$index]
	$segmentType = $type -band 0x07
	$point = $pathPoints[$index]
	if ($segmentType -eq 0) {
		[void]$pathData.AppendFormat($culture, 'M{0:0.###},{1:0.###}', $point.X, $point.Y)
	} elseif ($segmentType -eq 1) {
		[void]$pathData.AppendFormat($culture, 'L{0:0.###},{1:0.###}', $point.X, $point.Y)
	} elseif ($segmentType -eq 3) {
		$controlOne = $pathPoints[$index]
		$controlTwo = $pathPoints[$index + 1]
		$endPoint = $pathPoints[$index + 2]
		[void]$pathData.AppendFormat($culture, 'C{0:0.###},{1:0.###} {2:0.###},{3:0.###} {4:0.###},{5:0.###}', $controlOne.X, $controlOne.Y, $controlTwo.X, $controlTwo.Y, $endPoint.X, $endPoint.Y)
		$type = [int]$pathTypes[$index + 2]
		$index += 2
	} else {
		throw "Unsupported glyph path segment type: $segmentType"
	}
	if (($type -band 0x80) -ne 0) { [void]$pathData.Append('Z') }
}

$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="$($cornerRadius.ToString('0', $culture))" fill="#10392E"/>
  <circle cx="256" cy="256" r="$($circleRadius.ToString('0', $culture))" fill="none" stroke="#E7C98B" stroke-width="$($circleStroke.ToString('0', $culture))"/>
  <path fill="#E7C98B" d="$($pathData.ToString())"/>
</svg>
"@.Trim()
[System.IO.File]::WriteAllText((Join-Path $publicDirectory 'favicon.svg'), $svg, [System.Text.UTF8Encoding]::new($false))

$sizes = @(
	@{ Name = 'favicon-16x16.png'; Size = 16 },
	@{ Name = 'favicon-32x32.png'; Size = 32 },
	@{ Name = 'apple-touch-icon.png'; Size = 180 }
)
foreach ($item in $sizes) {
	$size = [int]$item.Size
	$renderSize = $size * 8
	$renderBitmap = [System.Drawing.Bitmap]::new($renderSize, $renderSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$renderGraphics = [System.Drawing.Graphics]::FromImage($renderBitmap)
	$renderGraphics.Clear([System.Drawing.Color]::Transparent)
	$renderGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
	$renderGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$renderGraphics.ScaleTransform([single]($renderSize / $canvasSize), [single]($renderSize / $canvasSize))

	$roundedSquare = [System.Drawing.Drawing2D.GraphicsPath]::new()
	$diameter = $cornerRadius * 2
	$roundedSquare.AddArc(0, 0, $diameter, $diameter, 180, 90)
	$roundedSquare.AddArc($canvasSize - $diameter, 0, $diameter, $diameter, 270, 90)
	$roundedSquare.AddArc($canvasSize - $diameter, $canvasSize - $diameter, $diameter, $diameter, 0, 90)
	$roundedSquare.AddArc(0, $canvasSize - $diameter, $diameter, $diameter, 90, 90)
	$roundedSquare.CloseFigure()
	$renderGraphics.FillPath([System.Drawing.SolidBrush]::new($backgroundColor), $roundedSquare)
	$pen = [System.Drawing.Pen]::new($goldColor, [single]$circleStroke)
	$pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
	$renderGraphics.DrawEllipse($pen, [single](256 - $circleRadius), [single](256 - $circleRadius), [single]($circleRadius * 2), [single]($circleRadius * 2))
	$renderGraphics.FillPath([System.Drawing.SolidBrush]::new($goldColor), $glyph)
	$renderGraphics.Dispose()
	$roundedSquare.Dispose()
	$pen.Dispose()

	$outputBitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$outputGraphics = [System.Drawing.Graphics]::FromImage($outputBitmap)
	$outputGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
	$outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$outputGraphics.DrawImage($renderBitmap, [System.Drawing.Rectangle]::new(0, 0, $size, $size), 0, 0, $renderSize, $renderSize, [System.Drawing.GraphicsUnit]::Pixel)
	$outputBitmap.Save((Join-Path $publicDirectory $item.Name), [System.Drawing.Imaging.ImageFormat]::Png)
	$outputGraphics.Dispose()
	$outputBitmap.Dispose()
	$renderBitmap.Dispose()
}

$glyph.Dispose()
$fontFamily.Dispose()
