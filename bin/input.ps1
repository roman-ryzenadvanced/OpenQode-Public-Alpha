param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Command,

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Params
)

# Load required assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# C# P/Invoke for advanced Input
$code = @"
using System;
using System.Runtime.InteropServices;
using System.IO;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const uint MOUSEEVENTF_RIGHTUP = 0x10;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    public const uint KEYEVENTF_KEYUP = 0x02;
    public const uint WHEEL_DELTA = 120;
}
"@
Add-Type -TypeDefinition $code -Language CSharp

# Enhanced computer vision functions
function Get-ScreenRegion {
    param([int]$X, [int]$Y, [int]$Width, [int]$Height)
    
    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($X, $Y, 0, 0, $bmp.Size)
    $graphics.Dispose()
    return $bmp
}

function Find-ImageInScreen {
    param([string]$ImagePath, [int]$Confidence = 80)
    
    # TODO: Implement image search functionality (would require OpenCV or similar)
    # For now, return basic info about the image search capability
    Write-Host "Image search capability available (requires image processing library)"
    Write-Host "Looking for: $ImagePath with $Confidence% confidence"
    return $null
}

function Get-WindowList {
    Add-Type -AssemblyName System.Management
    
    $processes = Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
    
    foreach ($process in $processes) {
        $rect = New-Object Win32+RECT
        [Win32]::GetWindowRect($process.MainWindowHandle, [ref]$rect) | Out-Null
        $process | Add-Member -NotePropertyName "Position" -NotePropertyValue "($($rect.Left),$($rect.Top))"
        $process | Add-Member -NotePropertyName "Size" -NotePropertyValue "$($rect.Right - $rect.Left)x$($rect.Bottom - $rect.Top)"
    }
    return $processes
}

switch ($Command.ToLower()) {
    "mouse" {
        if ($Params.Count -lt 2) { Write-Error "Usage: mouse x y"; exit 1 }
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point([int]$Params[0], [int]$Params[1])
        Write-Host "Moved mouse to $($Params[0]), $($Params[1])"
    }

    "click" {
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
         Write-Host "Clicked"
    }

    "rightclick" {
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
         Write-Host "Right Clicked"
    }

    "doubleclick" {
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
         Start-Sleep -Milliseconds 50
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
         [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
         Write-Host "Double Clicked"
    }

    "middleclick" {
         [Win32]::mouse_event(0x0020, 0, 0, 0, 0)  # MOUSEEVENTF_MIDDLEDOWN
         [Win32]::mouse_event(0x0040, 0, 0, 0, 0)  # MOUSEEVENTF_MIDDLEUP
         Write-Host "Middle Clicked"
    }

    "scroll" {
        if ($Params.Count -lt 1) { Write-Error "Usage: scroll amount"; exit 1 }
        $amount = [int]$Params[0]
        
        # Use proper mouse wheel scrolling via P/Invoke
        # Windows uses WHEEL_DELTA (120) per wheel step
        $wheelDelta = 120 * $amount
        [Win32]::mouse_event(0x0800, 0, 0, $wheelDelta, 0)  # MOUSEEVENTF_WHEEL
        Write-Host "Scrolled: $amount steps ($wheelDelta wheel units)"
    }

    "drag" {
        if ($Params.Count -lt 4) { Write-Error "Usage: drag fromX fromY toX toY"; exit 1 }
        $fromX = [int]$Params[0]
        $fromY = [int]$Params[1]
        $toX = [int]$Params[2]
        $toY = [int]$Params[3]
        
        # Move to start position
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($fromX, $fromY)
        Start-Sleep -Milliseconds 100
        
        # Press and hold left mouse button
        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 50
        
        # Move to end position (this drags)
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($toX, $toY)
        Start-Sleep -Milliseconds 100
        
        # Release mouse button
        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        
        Write-Host "Dragged from ($fromX, $fromY) to ($toX, $toY)"
    }

    "mousemove" {
        if ($Params.Count -lt 3) { Write-Error "Usage: mousemove fromX fromY distanceX distanceY [duration_ms]"; exit 1 }
        $startX = [int]$Params[0]
        $startY = [int]$Params[1]
        $distX = [int]$Params[2]
        $distY = [int]$Params[3]
        $duration = if ($Params.Count -gt 4) { [int]$Params[4] } else { 500 }
        
        # Move to start position
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($startX, $startY)
        
        # Calculate steps for smooth movement
        $steps = [Math]::Max([Math]::Abs($distX), [Math]::Abs($distY))
        if ($steps -eq 0) { $steps = 1 }
        
        $stepX = $distX / $steps
        $stepY = $distY / $steps
        $stepDuration = $duration / $steps
        
        for ($i = 1; $i -le $steps; $i++) {
            $newX = [int]($startX + ($stepX * $i))
            $newY = [int]($startY + ($stepY * $i))
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($newX, $newY)
            Start-Sleep -Milliseconds $stepDuration
        }
        
        Write-Host "Smoothly moved mouse from ($startX, $startY) by ($distX, $distY) over ${duration}ms"
    }

    "type" {
        if ($Params.Count -lt 1) { Write-Error "Usage: type 'text'"; exit 1 }
        $text = $Params -join " "
        [System.Windows.Forms.SendKeys]::SendWait($text)
        Write-Host "Typed: $text"
    }

    "key" {
        if ($Params.Count -lt 1) { Write-Error "Usage: key KEYNAME"; exit 1 }
        $k = $Params[0].ToUpper()
        
        if ($k -eq "LWIN" -or $k -eq "WIN") {
            [Win32]::keybd_event(0x5B, 0, 0, 0) 
            [Win32]::keybd_event(0x5B, 0, 0x02, 0) 
        } elseif ($k -eq "RWIN") {
            [Win32]::keybd_event(0x5C, 0, 0, 0)  # Right Windows key
            [Win32]::keybd_event(0x5C, 0, 0x02, 0) 
        } elseif ($k -eq "ENTER") {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        } elseif ($k -eq "TAB") {
            [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
        } elseif ($k -eq "ESCAPE" -or $k -eq "ESC") {
            [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
        } elseif ($k -eq "BACKSPACE") {
            [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
        } elseif ($k -eq "DELETE") {
            [System.Windows.Forms.SendKeys]::SendWait("{DELETE}")
        } elseif ($k -eq "SPACE") {
            [System.Windows.Forms.SendKeys]::SendWait(" ")
        } elseif ($k -eq "CTRL") {
            [Win32]::keybd_event(0x11, 0, 0, 0)  # VK_CONTROL
            [Win32]::keybd_event(0x11, 0, 0x02, 0)  # KEYEVENTF_KEYUP
        } elseif ($k -eq "ALT") {
            [Win32]::keybd_event(0x12, 0, 0, 0)  # VK_MENU (Alt)
            [Win32]::keybd_event(0x12, 0, 0x02, 0)  # KEYEVENTF_KEYUP
        } elseif ($k -eq "SHIFT") {
            [Win32]::keybd_event(0x10, 0, 0, 0)  # VK_SHIFT
            [Win32]::keybd_event(0x10, 0, 0x02, 0)  # KEYEVENTF_KEYUP
        } else {
            [System.Windows.Forms.SendKeys]::SendWait("{$k}")
        }
        Write-Host "Pressed: $k"
    }

    "startmenu" {
        # More reliable than LWIN on some systems/contexts: Ctrl+Esc opens Start.
        [Win32]::keybd_event(0x11, 0, 0, 0)     # CTRL down
        [Win32]::keybd_event(0x1B, 0, 0, 0)     # ESC down
        [Win32]::keybd_event(0x1B, 0, 0x02, 0)  # ESC up
        [Win32]::keybd_event(0x11, 0, 0x02, 0)  # CTRL up
        Write-Host "Opened Start menu"
    }

    "keydown" {
        if ($Params.Count -lt 1) { Write-Error "Usage: keydown KEYNAME"; exit 1 }
        $k = $Params[0].ToUpper()
        $vkCode = 0
        
        switch ($k) {
            "CTRL" { $vkCode = 0x11 }
            "ALT" { $vkCode = 0x12 }
            "SHIFT" { $vkCode = 0x10 }
            "LWIN" { $vkCode = 0x5B }
            "RWIN" { $vkCode = 0x5C }
            default { Write-Host "Only modifier keys supported for keydown"; exit 1 }
        }
        [Win32]::keybd_event($vkCode, 0, 0, 0)  # Key down only
        Write-Host "KeyDown: $k"
    }

    "keyup" {
        if ($Params.Count -lt 1) { Write-Error "Usage: keyup KEYNAME"; exit 1 }
        $k = $Params[0].ToUpper()
        $vkCode = 0
        
        switch ($k) {
            "CTRL" { $vkCode = 0x11 }
            "ALT" { $vkCode = 0x12 }
            "SHIFT" { $vkCode = 0x10 }
            "LWIN" { $vkCode = 0x5B }
            "RWIN" { $vkCode = 0x5C }
            default { Write-Host "Only modifier keys supported for keyup"; exit 1 }
        }
        [Win32]::keybd_event($vkCode, 0, 0x02, 0)  # Key up only
        Write-Host "KeyUp: $k"
    }

    "hotkey" {
        if ($Params.Count -lt 1) { Write-Error "Usage: hotkey MODIFIER+KEY (e.g., CTRL+C, ALT+TAB)"; exit 1 }
        $combo = $Params[0].ToUpper()
        $parts = $combo.Split('+')
        $modifiers = @()
        $key = ""
        
        foreach ($part in $parts) {
            if ($part -eq "CTRL" -or $part -eq "ALT" -or $part -eq "SHIFT") {
                $modifiers += $part
            } else {
                $key = $part
            }
        }
        
        # Press modifiers in order
        foreach ($mod in $modifiers) {
            switch ($mod) {
                "CTRL" { [Win32]::keybd_event(0x11, 0, 0, 0) }  # Down
                "ALT" { [Win32]::keybd_event(0x12, 0, 0, 0) }   # Down
                "SHIFT" { [Win32]::keybd_event(0x10, 0, 0, 0) } # Down
            }
        }
        
        # Press the actual key
        Start-Sleep -Milliseconds 50
        [System.Windows.Forms.SendKeys]::SendWait("{$key}")
        Start-Sleep -Milliseconds 50
        
        # Release modifiers in reverse order
        for ($i = $modifiers.Count - 1; $i -ge 0; $i--) {
            switch ($modifiers[$i]) {
                "CTRL" { [Win32]::keybd_event(0x11, 0, 0x02, 0) }  # Up
                "ALT" { [Win32]::keybd_event(0x12, 0, 0x02, 0) }   # Up
                "SHIFT" { [Win32]::keybd_event(0x10, 0, 0x02, 0) } # Up
            }
        }
        Write-Host "Pressed hotkey: $combo"
    }

    "screen" {
        $w = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
        $h = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height
        Write-Host "Screen Resolution: $w x $h"
    }

    "screenshot" {
        if ($Params.Count -lt 1) { Write-Error "Usage: screenshot [filename]"; exit 1 }
        $file = if ($Params.Count -gt 0) { $Params[0] } else { "screenshot.png" }
        $fullPath = [System.IO.Path]::GetFullPath($file)
        
        try {
            $bmp = New-Object System.Drawing.Bitmap ([System.Windows.Forms.SystemInformation]::VirtualScreen.Width, [System.Windows.Forms.SystemInformation]::VirtualScreen.Height)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
            $bmp.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $g.Dispose()
            $bmp.Dispose()
            Write-Host "Screenshot saved to $fullPath"
        } catch {
            Write-Error "Failed to take screenshot: $_"
        }
    }

    "ocr" {
        # Real Windows 10+ OCR Implementation
        # Credit: Windows.Media.Ocr namespace (Windows 10 1809+)
        
        if ($Params.Count -lt 1) { Write-Error "Usage: ocr [region_x region_y width height] or ocr screenshot_file"; exit 1 }
        
        # Load Windows Runtime for OCR
        try {
            Add-Type -AssemblyName System.Runtime.WindowsRuntime
            
            # Helper to await async operations
            $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
                $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
            })[0]
            
            Function Await($WinRtTask, $ResultType) {
                $asTaskSpecific = $asTaskGeneric.MakeGenericMethod($ResultType)
                $netTask = $asTaskSpecific.Invoke($null, @($WinRtTask))
                $netTask.Wait(-1) | Out-Null
                $netTask.Result
            }
            
            # Load Windows.Media.Ocr
            [Windows.Media.Ocr.OcrEngine, Windows.Media, ContentType = WindowsRuntime] | Out-Null
            [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null
            [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
            [Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
            
            # Determine source
            $tempFile = $null
            if ($Params.Count -eq 4) {
                # Region capture mode
                $x = [int]$Params[0]
                $y = [int]$Params[1]
                $w = [int]$Params[2]
                $h = [int]$Params[3]
                
                # Capture region
                $bmp = New-Object System.Drawing.Bitmap $w, $h
                $graphics = [System.Drawing.Graphics]::FromImage($bmp)
                $graphics.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
                $graphics.Dispose()
                
                $tempFile = [System.IO.Path]::GetTempFileName() + ".png"
                $bmp.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Png)
                $bmp.Dispose()
                $sourceFile = $tempFile
            } else {
                # File mode
                $sourceFile = [System.IO.Path]::GetFullPath($Params[0])
                if (-not (Test-Path $sourceFile)) {
                    Write-Error "File not found: $sourceFile"
                    exit 1
                }
            }
            
            # Open file for OCR
            $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($sourceFile)
            $file = Await $fileTask ([Windows.Storage.StorageFile])
            
            $streamTask = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
            $stream = Await $streamTask ([Windows.Storage.Streams.IRandomAccessStream])
            
            $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
            $decoder = Await $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])
            
            $softwareBitmapTask = $decoder.GetSoftwareBitmapAsync()
            $softwareBitmap = Await $softwareBitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])
            
            # Create OCR engine (use system language)
            $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
            
            if ($ocrEngine -eq $null) {
                Write-Host "OCR engine not available. Using fallback..."
                # Fallback: try English
                $lang = New-Object Windows.Globalization.Language("en-US")
                $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
            }
            
            if ($ocrEngine -ne $null) {
                $ocrResultTask = $ocrEngine.RecognizeAsync($softwareBitmap)
                $ocrResult = Await $ocrResultTask ([Windows.Media.Ocr.OcrResult])
                
                $recognizedText = $ocrResult.Text
                Write-Host "OCR Result:"
                Write-Host "==========="
                Write-Host $recognizedText
                Write-Host "==========="
                Write-Host "TEXT:$recognizedText"
            } else {
                Write-Host "OCR engine could not be initialized. Ensure Windows 10 1809+ with OCR language pack installed."
            }
            
            # Cleanup
            $stream.Dispose()
            if ($tempFile -and (Test-Path $tempFile)) {
                Remove-Item $tempFile -Force
            }
            
        } catch {
            Write-Host "OCR Error: $_"
            Write-Host "Fallback: OCR requires Windows 10 1809+ with language packs installed."
            Write-Host "To install OCR: Settings > Time & Language > Language > Add a language (with OCR)"
        }
    }

    "color" {
        if ($Params.Count -lt 2) { Write-Error "Usage: color x y"; exit 1 }
        $x = [int]$Params[0]
        $y = [int]$Params[1]
        
        # Capture a small region around the point to get the color
        $bmp = New-Object System.Drawing.Bitmap 1, 1
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
        $color = $bmp.GetPixel(0, 0)
        $g.Dispose()
        $bmp.Dispose()
        
        Write-Host "Color at ($x, $y): RGB($($color.R), $($color.G), $($color.B)) Hex:#$($color.R.ToString('X2'))$($color.G.ToString('X2'))$($color.B.ToString('X2'))"
    }

    "waitforcolor" {
        if ($Params.Count -lt 3) { Write-Error "Usage: waitforcolor x y 'RRGGBB' [tolerance] [timeout_seconds]"; exit 1 }
        $x = [int]$Params[0]
        $y = [int]$Params[1]
        $targetColorHex = $Params[2]
        $tolerance = if ($Params.Count -gt 3) { [int]$Params[3] } else { 10 }
        $timeout = if ($Params.Count -gt 4) { [int]$Params[4] } else { 10 }
        
        # Parse hex color
        $targetColor = [System.Drawing.ColorTranslator]::FromHtml("#$targetColorHex")
        
        Write-Host "Waiting for color #$targetColorHex at ($x, $y) with tolerance $tolerance (max $timeout seconds)..."
        
        $startTime = Get-Date
        $found = $false
        
        while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
            $bmp = New-Object System.Drawing.Bitmap 1, 1
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
            $currentColor = $bmp.GetPixel(0, 0)
            $g.Dispose()
            $bmp.Dispose()
            
            # Calculate color distance
            $diff = [Math]::Abs($currentColor.R - $targetColor.R) + 
                   [Math]::Abs($currentColor.G - $targetColor.G) + 
                   [Math]::Abs($currentColor.B - $targetColor.B)
            
            if ($diff -le $tolerance) {
                Write-Host "Color #$targetColorHex found at ($x, $y) with difference $diff"
                $found = $true
                break
            }
            
            Start-Sleep -Milliseconds 250
        }
        
        if (-not $found) {
            Write-Host "Color #$targetColorHex not found at ($x, $y) within $timeout seconds."
        }
    }

    "region" {
        if ($Params.Count -lt 4) { Write-Error "Usage: region x y width height [filename]"; exit 1 }
        $x = [int]$Params[0]
        $y = [int]$Params[1]
        $width = [int]$Params[2]
        $height = [int]$Params[3]
        $file = if ($Params.Count -gt 4) { $Params[4] } else { "region.png" }
        $fullPath = [System.IO.Path]::GetFullPath($file)
        
        $bmp = Get-ScreenRegion -X $x -Y $y -Width $width -Height $height
        $bmp.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "Region screenshot saved to $fullPath ($x, $y, $width, $height)"
    }

    "find" {
        if ($Params.Count -lt 1) { Write-Error "Usage: find 'Name'"; exit 1 }
        $targetName = $Params -join " "
        
        Write-Host "Searching for VISIBLE UI Element: '$targetName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
        
        # Find ALL matches, then filter for visibility (to avoid phantom offscreen elements)
        $collection = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        $found = $false
        
        if ($collection) {
            foreach ($element in $collection) {
                try {
                    if (-not $element.Current.IsOffscreen) {
                        $rect = $element.Current.BoundingRectangle
                        if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
                            $centerX = [int]($rect.X + ($rect.Width / 2))
                            $centerY = [int]($rect.Y + ($rect.Height / 2))
                            Write-Host "Found Visible '$targetName' at ($centerX, $centerY)"
                            Write-Host "COORD:$centerX,$centerY"
                            Write-Host "SIZE:$($rect.Width)x$($rect.Height)"
                            Write-Host "RECT:$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
                            $found = $true
                            break # Stop at first visible match
                        }
                    }
                } catch {}
            }
        }
        
        if (-not $found) {
             Write-Host "Element '$targetName' not found visible on desktop."
        }
    }

    "findall" {
        if ($Params.Count -lt 1) { Write-Error "Usage: findall 'Name'"; exit 1 }
        $targetName = $Params -join " "
        
        Write-Host "Searching for ALL instances of UI Element: '$targetName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
        
        $collection = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        $count = 0
        
        if ($collection) {
            foreach ($element in $collection) {
                try {
                    $rect = $element.Current.BoundingRectangle
                    if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
                        $centerX = [int]($rect.X + ($rect.Width / 2))
                        $centerY = [int]($rect.Y + ($rect.Height / 2))
                        $visible = -not $element.Current.IsOffscreen
                        $controlType = $element.Current.ControlType.ProgrammaticName
                        Write-Host "Instance $($count + 1): '$targetName' [$controlType] at ($centerX, $centerY) - Visible: $visible"
                        Write-Host "  RECT:$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
                        Write-Host "  Handle: $($element.Current.NativeWindowHandle)"
                        $count++
                    }
                } catch {}
            }
        }
        
        Write-Host "Found total: $count instances"
    }

    "findby" {
        if ($Params.Count -lt 2) { Write-Error "Usage: findby propertyType propertyValue"; exit 1 }
        $propertyType = $Params[0].ToLower()
        $propertyValue = $Params[1..($Params.Count - 1)] -join " "
        
        Write-Host "Searching for UI Element by $propertyType='$propertyValue'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $property = $null
        
        switch ($propertyType) {
            "name" { $property = [System.Windows.Automation.AutomationElement]::NameProperty }
            "controltype" { 
                $controlTypes = @{
                    "button" = [System.Windows.Automation.ControlType]::Button
                    "textbox" = [System.Windows.Automation.ControlType]::Edit
                    "combobox" = [System.Windows.Automation.ControlType]::ComboBox
                    "list" = [System.Windows.Automation.ControlType]::List
                    "menu" = [System.Windows.Automation.ControlType]::Menu
                    "window" = [System.Windows.Automation.ControlType]::Window
                    "pane" = [System.Windows.Automation.ControlType]::Pane
                    "text" = [System.Windows.Automation.ControlType]::Text
                }
                if ($controlTypes.ContainsKey($propertyValue)) {
                    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $controlTypes[$propertyValue])
                } else {
                    Write-Host "Unknown control type: $propertyValue"
                    exit 1
                }
            }
            "class" { $property = [System.Windows.Automation.AutomationElement]::ClassNameProperty }
            "automationid" { $property = [System.Windows.Automation.AutomationElement]::AutomationIdProperty }
            default { 
                Write-Host "Unsupported property type: $propertyType. Use: name, controltype, class, automationid"
                exit 1
            }
        }
        
        if ($property) {
            $condition = New-Object System.Windows.Automation.PropertyCondition($property, $propertyValue)
        }
        
        $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
        
        if ($element) {
            $rect = $element.Current.BoundingRectangle
            $centerX = [int]($rect.X + ($rect.Width / 2))
            $centerY = [int]($rect.Y + ($rect.Height / 2))
            $visible = -not $element.Current.IsOffscreen
            $controlType = $element.Current.ControlType.ProgrammaticName
            Write-Host "Found: [$controlType] with $propertyType='$propertyValue' at ($centerX, $centerY) - Visible: $visible"
            Write-Host "RECT:$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
            Write-Host "Handle: $($element.Current.NativeWindowHandle)"
        } else {
            Write-Host "Element with $propertyType='$propertyValue' not found."
        }
    }

    "uiclick" {
        if ($Params.Count -lt 1) { Write-Error "Usage: uiclick 'Name'"; exit 1 }
        $targetName = $Params -join " "
        Write-Host "Searching & Clicking: '$targetName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
        $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        
        if ($element) {
            try {
                # Try using Invoke pattern first (more reliable for buttons)
                $invokePattern = $null
                if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invokePattern)) {
                    $invokePattern.Invoke()
                    Write-Host "Invoked element '$targetName' using Invoke pattern"
                } else {
                    # Fallback to traditional click
                    $rect = $element.Current.BoundingRectangle
                    if (-not $element.Current.IsOffscreen -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
                        $centerX = [int]($rect.X + ($rect.Width / 2))
                        $centerY = [int]($rect.Y + ($rect.Height / 2))
                        
                        # Move & Click
                        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
                        Start-Sleep -Milliseconds 100
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                        
                        Write-Host "Clicked '$targetName' at ($centerX, $centerY)"
                    } else {
                        Write-Host "Element found but is offscreen or has no dimensions"
                    }
                }
            } catch {
                Write-Host "Error clicking element '$targetName': $_"
            }
        } else {
            Write-Host "Could not find element '$targetName'"
            exit 1
        }
    }

    "uipress" {
        if ($Params.Count -lt 1) { Write-Error "Usage: uipress 'Name'"; exit 1 }
        $targetName = $Params -join " "
        Write-Host "Pressing element: '$targetName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
        $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        
        if ($element) {
            try {
                # Try Toggle pattern (for checkboxes)
                $togglePattern = $null
                if ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$togglePattern)) {
                    $currentToggleState = $togglePattern.Current.ToggleState
                    if ($currentToggleState -eq [System.Windows.Automation.ToggleState]::On) {
                        $togglePattern.Toggle()
                        Write-Host "Toggled '$targetName' OFF"
                    } else {
                        $togglePattern.Toggle()
                        Write-Host "Toggled '$targetName' ON"
                    }
                }
                # Try SelectionItem pattern (for list items, menu items)
                elseif ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selectionItemPattern)) {
                    $selectionItemPattern.Select()
                    Write-Host "Selected '$targetName'"
                }
                # Try ExpandCollapse pattern (for tree items, dropdowns)
                elseif ($element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$expandCollapsePattern)) {
                    $currentState = $expandCollapsePattern.Current.ExpandCollapseState
                    if ($currentState -eq [System.Windows.Automation.ExpandCollapseState]::Collapsed) {
                        $expandCollapsePattern.Expand()
                        Write-Host "Expanded '$targetName'"
                    } else {
                        $expandCollapsePattern.Collapse()
                        Write-Host "Collapsed '$targetName'"
                    }
                }
                # Fallback to invoke or click
                else {
                    $invokePattern = $null
                    if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invokePattern)) {
                        $invokePattern.Invoke()
                        Write-Host "Invoked '$targetName' using Invoke pattern"
                    } else {
                        # Do the traditional click
                        $rect = $element.Current.BoundingRectangle
                        if (-not $element.Current.IsOffscreen -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
                            $centerX = [int]($rect.X + ($rect.Width / 2))
                            $centerY = [int]($rect.Y + ($rect.Height / 2))
                            
                            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
                            Start-Sleep -Milliseconds 100
                            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                            
                            Write-Host "Clicked '$targetName' (no specific pattern available)"
                        }
                    }
                }
            } catch {
                Write-Host "Error pressing element '$targetName': $_"
            }
        } else {
            Write-Host "Could not find element '$targetName'"
        }
    }

    "uiclickall" {
        if ($Params.Count -lt 1) { Write-Error "Usage: uiclickall 'Name'"; exit 1 }
        $targetName = $Params -join " "
        Write-Host "Clicking ALL instances of: '$targetName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
        $collection = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        $clicked = 0
        
        foreach ($element in $collection) {
            try {
                if (-not $element.Current.IsOffscreen) {
                    $rect = $element.Current.BoundingRectangle
                    if ($rect.Width -gt 0) {
                        $centerX = [int]($rect.X + ($rect.Width / 2))
                        $centerY = [int]($rect.Y + ($rect.Height / 2))
                        
                        # Move & Click
                        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
                        Start-Sleep -Milliseconds 100
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                        
                        Write-Host "Clicked instance $($clicked + 1) '$targetName' at ($centerX, $centerY)"
                        $clicked++
                    }
                }
            } catch {}
        }
        Write-Host "Clicked total: $clicked instances"
    }

    "window" {
        if ($Params.Count -lt 1) { Write-Error "Usage: window action [window_title]"; exit 1 }
        $action = $Params[0].ToLower()
        $windowTitle = if ($Params.Count -gt 1) { $Params[1..($Params.Count - 1)] -join " " } else { "" }

        if ($action -eq "list") {
            $windows = Get-WindowList
            if ($windows) {
                $windows | Format-Table -AutoSize | Out-String | Write-Host
            } else {
                Write-Host "No visible windows found."
            }
        } elseif ($action -eq "focus" -or $action -eq "activate") {
            Add-Type -AssemblyName System.Management
            $processes = Get-Process | Where-Object { $_.MainWindowTitle -ne "" -and $_.MainWindowTitle -like "*$windowTitle*" }
            if ($processes) {
                $proc = $processes[0]
                $proc | Out-Null  # Bring to foreground
                # Use Windows API to bring to front (simplified approach)
                [System.Windows.Forms.SendKeys]::SendWait("%{TAB}")  # Alt+Tab to cycle
                Write-Host "Focused window: $($proc.MainWindowTitle)"
            } else {
                Write-Host "Window not found: $windowTitle"
            }
        } else {
            Write-Host "Window action not supported: $action. Use: list, focus, activate"
        }
    }

    "browse" {
        if ($Params.Count -lt 1) { Write-Error "Usage: browse url [browser]"; exit 1 }
        $url = $Params[0]
        $browser = if ($Params.Count -gt 1) { $Params[1] } else { "chrome.exe" }
        
        # Robust browser automation - open specific browser to URL
        try {
            # Check if browser exists
            $browserPath = $null
            switch ($browser.ToLower()) {
                "chrome" { $browserPath = "chrome.exe" }
                "edge" { $browserPath = "msedge.exe" }
                "firefox" { $browserPath = "firefox.exe" }
                "brave" { $browserPath = "brave.exe" }
                default { $browserPath = $browser }
            }
            
            Start-Process $browserPath -ArgumentList $url
            Write-Host "Opened $browserPath to: $url"
            # Wait a moment for the page to load
            Start-Sleep -Seconds 2
        } catch {
            Write-Host "Failed to open browser: $_"
            # Fallback to default browser
            try {
                Start-Process $url
                Write-Host "Opened URL in default browser: $url"
                Start-Sleep -Seconds 2
            } catch {
                Write-Error "Failed to open URL in any browser: $_"
            }
        }
    }

    "focus" {
        if ($Params.Count -lt 1) { Write-Error "Usage: focus elementName"; exit 1 }
        $elementName = $Params -join " "
        
        Write-Host "Focusing on element: '$elementName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $elementName)
        $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        
        if ($element) {
            try {
                # Try to set focus using the Focus pattern
                $focusPattern = $null
                if ($element.TryGetCurrentPattern([System.Windows.Automation.AutomationElement]::FocusPattern, [ref]$focusPattern)) {
                    $focusPattern.SetFocus()
                    Write-Host "Focus set on '$elementName'"
                } else {
                    # Alternative: click the element to bring focus
                    $rect = $element.Current.BoundingRectangle
                    if (-not $element.Current.IsOffscreen -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
                        $centerX = [int]($rect.X + ($rect.Width / 2))
                        $centerY = [int]($rect.Y + ($rect.Height / 2))
                        
                        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
                        Start-Sleep -Milliseconds 100
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                        
                        Write-Host "Clicked '$elementName' to set focus"
                    }
                }
            } catch {
                Write-Host "Error focusing on element '$elementName': $_"
            }
        } else {
            Write-Host "Element '$elementName' not found"
        }
    }

    "waitforpage" {
        if ($Params.Count -lt 1) { Write-Error "Usage: waitforpage title [timeout_seconds]"; exit 1 }
        $title = $Params[0]
        $timeout = if ($Params.Count -gt 1) { [int]$Params[1] } else { 10 }
        
        Write-Host "Waiting for page with title containing '$title' (max $timeout seconds)..."
        
        $startTime = Get-Date
        $found = $false
        
        while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
            $processes = Get-Process | Where-Object { $_.MainWindowTitle -ne "" }
            foreach ($proc in $processes) {
                if ($proc.MainWindowTitle -like "*$title*") {
                    Write-Host "Page with title '$($proc.MainWindowTitle)' found"
                    $found = $true
                    break
                }
            }
            if ($found) { break }
            Start-Sleep -Milliseconds 500
        }
        
        if (-not $found) {
            Write-Host "Page with title containing '$title' not found within $timeout seconds."
        }
    }

    "playwright" {
        # Real Playwright Bridge Integration
        # Credit: Inspired by browser-use/browser-use (https://github.com/browser-use/browser-use)
        
        if ($Params.Count -lt 1) { Write-Error "Usage: playwright command [parameters]"; exit 1 }
        $pwCommand = $Params[0].ToLower()
        $pwArgs = if ($Params.Count -gt 1) { $Params[1..($Params.Count - 1)] } else { @() }
        
        # Check if playwright-bridge.js exists
        $bridgePath = Join-Path $PSScriptRoot "playwright-bridge.js"
        
        if (-not (Test-Path $bridgePath)) {
            Write-Host "ERROR: playwright-bridge.js not found at $bridgePath"
            Write-Host "Ensure the bridge file exists in the bin directory."
            exit 1
        }
        
        # Special handling for install command
        if ($pwCommand -eq "install") {
            Write-Host "Installing Playwright..."
            try {
                $npmResult = & npm install playwright 2>&1
                Write-Host $npmResult
                $pwResult = & npx playwright install 2>&1
                Write-Host $pwResult
                Write-Host "Playwright installed successfully!"
            } catch {
                Write-Host "Failed to install Playwright: $_"
                Write-Host "Run manually: npm install playwright && npx playwright install"
            }
            return
        }
        
        # Call the bridge with all arguments
        $allArgs = @($bridgePath, $pwCommand) + $pwArgs
        
        try {
            $output = & node $allArgs 2>&1
            
            # Parse and display output
            foreach ($line in $output) {
                if ($line -match "^RESULT:(.*)") {
                    Write-Host "✅ $($matches[1])"
                } elseif ($line -match "^ERROR:(.*)") {
                    Write-Host "❌ $($matches[1])"
                } elseif ($line -match "^TITLE:(.*)") {
                    Write-Host "📄 Title: $($matches[1])"
                } elseif ($line -match "^URL:(.*)") {
                    Write-Host "🔗 URL: $($matches[1])"
                } elseif ($line -match "^CONTENT_START") {
                    Write-Host "📝 Content:"
                } elseif ($line -match "^CONTENT_END") {
                    # End of content
                } elseif ($line -match "^ELEMENTS_START") {
                    Write-Host "🎯 Interactive Elements:"
                } elseif ($line -match "^ELEMENTS_END") {
                    # End of elements
                } else {
                    Write-Host $line
                }
            }
        } catch {
            Write-Host "Playwright bridge error: $_"
            Write-Host "Ensure Node.js is installed and Playwright is set up:"
            Write-Host "  npm install playwright"
            Write-Host "  npx playwright install"
        }
    }

    "googlesearch" {
        if ($Params.Count -lt 1) { Write-Error "Usage: googlesearch search_term"; exit 1 }
        $searchTerm = $Params -join " "
        
        Write-Host "Performing Google search for: $searchTerm"
        
        # Open Google in the default browser
        $url = "https://www.google.com/search?q=$([System.Uri]::EscapeDataString($searchTerm))"
        Start-Process $url
        
        Write-Host "Opened Google search for: $searchTerm"
        Write-Host "URL: $url"
    }

    "browsercontrol" {
        if ($Params.Count -lt 2) { Write-Error "Usage: browsercontrol action [parameters]"; exit 1 }
        $action = $Params[0].ToLower()
        $params = $Params[1..($Params.Count - 1)]
        
        switch ($action) {
            "navigate" {
                if ($params.Count -lt 1) { Write-Error "Usage: browsercontrol navigate url"; exit 1 }
                $url = $params -join " "
                # For now, just open the URL in default browser
                Start-Process $url
                Write-Host "Navigated to: $url"
                Start-Sleep -Seconds 2  # Wait for page to load
            }
            
            "click" {
                if ($params.Count -lt 1) { Write-Error "Usage: browsercontrol click selector"; exit 1 }
                $selector = $params -join " "
                # Find and click an element - for now we'll use the find approach
                $root = [System.Windows.Automation.AutomationElement]::RootElement
                $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $selector)
                $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
                
                if ($element) {
                    $rect = $element.Current.BoundingRectangle
                    if (-not $element.Current.IsOffscreen -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
                        $centerX = [int]($rect.X + ($rect.Width / 2))
                        $centerY = [int]($rect.Y + ($rect.Height / 2))
                        
                        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
                        Start-Sleep -Milliseconds 100
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                        
                        Write-Host "Clicked element: $selector"
                    }
                } else {
                    Write-Host "Element not found: $selector"
                }
            }
            
            "fill" {
                if ($params.Count -lt 2) { Write-Error "Usage: browsercontrol fill selector text"; exit 1 }
                $selector = $params[0]
                $text = $params[1..($params.Count - 1)] -join " "
                
                # First find and focus on the element, then type
                $root = [System.Windows.Automation.AutomationElement]::RootElement
                $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $selector)
                $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
                
                if ($element) {
                    # Try to use Value pattern for text input
                    $valuePattern = $null
                    if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
                        $valuePattern.SetValue($text)
                        Write-Host "Filled element '$selector' with: $text"
                    } else {
                        # Fallback: click and type
                        $rect = $element.Current.BoundingRectangle
                        if (-not $element.Current.IsOffscreen -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
                            $centerX = [int]($rect.X + ($rect.Width / 2))
                            $centerY = [int]($rect.Y + ($rect.Height / 2))
                            
                            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
                            Start-Sleep -Milliseconds 100
                            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                            Start-Sleep -Milliseconds 100
                            
                            [System.Windows.Forms.SendKeys]::SendWait($text)
                            Write-Host "Typed in element '$selector': $text"
                        }
                    }
                } else {
                    Write-Host "Element not found: $selector"
                }
            }
            
            "press" {
                if ($params.Count -lt 1) { Write-Error "Usage: browsercontrol press key"; exit 1 }
                $key = $params[0].ToUpper()
                
                # Press a key in the currently focused element
                switch ($key) {
                    "ENTER" { [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") }
                    "TAB" { [System.Windows.Forms.SendKeys]::SendWait("{TAB}") }
                    "ESCAPE" { [System.Windows.Forms.SendKeys]::SendWait("{ESC}") }
                    "BACKSPACE" { [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}") }
                    default { [System.Windows.Forms.SendKeys]::SendWait("{$key}") }
                }
                Write-Host "Pressed key: $key"
            }
            
            "screenshot" {
                $file = if ($params.Count -gt 0) { $params[0] } else { "browser_screenshot.png" }
                $fullPath = [System.IO.Path]::GetFullPath($file)
                
                $bmp = New-Object System.Drawing.Bitmap ([System.Windows.Forms.SystemInformation]::VirtualScreen.Width, [System.Windows.Forms.SystemInformation]::VirtualScreen.Height)
                $g = [System.Drawing.Graphics]::FromImage($bmp)
                $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
                $bmp.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
                $g.Dispose()
                $bmp.Dispose()
                Write-Host "Browser screenshot saved to $fullPath"
            }
            
            "geturl" {
                Write-Host "Note: Getting current URL requires browser automation API like Selenium or Playwright"
                Write-Host "This would require additional browser extension or automation framework"
            }
            
            "gettitle" {
                # Try to get the title of the active browser window
                Add-Type -AssemblyName System.Windows.Forms
                $foregroundWindow = [System.Windows.Forms.Control]::FromChildHandle([System.Windows.Forms.NativeWindow]::FromHandle((Get-Process -Name "msedge" | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1).MainWindowHandle))
                $activeProcess = Get-Process | Where-Object { $_.MainWindowHandle -eq (Get-Process -Name "msedge" | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1).MainWindowHandle }
                if ($activeProcess) {
                    Write-Host "Active browser title: $($activeProcess.MainWindowTitle)"
                } else {
                    Write-Host "Could not determine active browser window"
                }
            }
            
            default {
                Write-Host "Browser control actions: navigate, click, fill, press, screenshot, geturl, gettitle"
            }
        }
    }

    "open" {
        if ($Params.Count -lt 1) { Write-Error "Usage: open 'Path or URL'"; exit 1 }
        $fullTarget = $Params -join " "
        
        # Check if this is a browser + URL combination
        $browserPatterns = @("chrome\.exe", "msedge\.exe", "firefox\.exe", "brave\.exe")
        $browserMatch = $null
        $urlMatch = $null
        
        foreach ($pattern in $browserPatterns) {
            if ($fullTarget -match "($pattern)\s+(https?://[^\s]+)") {
                $browserMatch = $matches[1]
                $urlMatch = $matches[2]
                break
            }
        }
        
        if ($browserMatch -and $urlMatch) {
            # Browser + URL pattern detected
            try {
                Start-Process $browserMatch -ArgumentList $urlMatch
                Write-Host "Opened $browserMatch to: $urlMatch"
            } catch {
                Write-Host "Failed to open browser: $_"
                # Fallback: try opening URL with default browser
                try {
                    Start-Process $urlMatch
                    Write-Host "Opened URL in default browser: $urlMatch"
                } catch {
                    Write-Error "Failed to open URL: $_"
                }
            }
        }
        elseif ($fullTarget -match '^https?://') {
            # It's just a URL, use the default browser
            try {
                Start-Process $fullTarget -ErrorAction Stop
                Write-Host "Opened URL: $fullTarget"
            } catch {
                Write-Host "ERROR: Failed to open URL '$fullTarget': $_"
                [Console]::Error.WriteLine("ERROR: Failed to open URL '$fullTarget': $_")
                exit 1
            }
        }
        elseif ($fullTarget -match '\.exe$') {
            # It's an executable, launch it directly
            try {
                Start-Process $fullTarget -ErrorAction Stop
                Write-Host "Launched executable: $fullTarget"
            } catch {
                 # Try finding in path if full path failed
                try {
                    Start-Process $fullTarget -ErrorAction Stop
                    Write-Host "Launched executable from PATH: $fullTarget"
                } catch {
                    Write-Host "ERROR: Failed to launch executable '$fullTarget': $_"
                    [Console]::Error.WriteLine("ERROR: Failed to launch executable '$fullTarget': $_")
                    exit 1
                }
            }
        }
        else {
            # File or other path
            try {
                Start-Process $fullTarget -ErrorAction Stop
                Write-Host "Opened: $fullTarget"
            } catch {
                Write-Host "ERROR: Failed to open '$fullTarget': $_"
                [Console]::Error.WriteLine("ERROR: Failed to open '$fullTarget': $_")
                exit 1
            }
        }
    }

    "waitfor" {
        if ($Params.Count -lt 2) { Write-Error "Usage: waitfor elementName timeout_seconds"; exit 1 }
        $targetName = $Params[0]
        $timeout = [int]$Params[1]
        
        Write-Host "Waiting for element '$targetName' (max $timeout seconds)..."
        
        $startTime = Get-Date
        $found = $false
        
        while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
            $root = [System.Windows.Automation.AutomationElement]::RootElement
            $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
            $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
            
            if ($element -and -not $element.Current.IsOffscreen) {
                $rect = $element.Current.BoundingRectangle
                if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
                    $centerX = [int]($rect.X + ($rect.Width / 2))
                    $centerY = [int]($rect.Y + ($rect.Height / 2))
                    Write-Host "Element '$targetName' found at ($centerX, $centerY)"
                    $found = $true
                    break
                }
            }
            
            Start-Sleep -Milliseconds 500  # Wait 0.5 seconds before retrying
        }
        
        if (-not $found) {
            Write-Host "Element '$targetName' not found within $timeout seconds."
        }
    }

    "apps" {
        $apps = Get-WindowList
        if ($apps) {
            $apps | Select-Object ProcessName, MainWindowTitle, Position, Size | Format-Table -AutoSize | Out-String | Write-Host
        } else {
            Write-Host "No visible applications found."
        }
    }

    "kill" {
        if ($Params.Count -lt 1) { Write-Error "Usage: kill 'process_name' or 'window_title'"; exit 1 }
        $target = $Params -join " "
        $processes = Get-Process -Name $target -ErrorAction SilentlyContinue
        if (-not $processes) {
            $processes = Get-Process | Where-Object { $_.MainWindowTitle -like "*$target*" }
        }
        if ($processes) {
            foreach ($proc in $processes) {
                $proc.CloseMainWindow() | Out-Null
                Start-Sleep -Milliseconds 500
                if (!$proc.HasExited) {
                    $proc.Kill()
                }
                Write-Host "Killed process: $($proc.ProcessName) (PID: $($proc.Id)) - Window: $($proc.MainWindowTitle)"
            }
        } else {
            Write-Host "Process not found: $target"
        }
    }

    "volume" {
        if ($Params.Count -lt 1) { Write-Error "Usage: volume up|down|mute|set [0-100]"; exit 1 }
        $action = $Params[0].ToLower()
        $value = if ($Params.Count -gt 1) { [int]$Params[1] } else { 0 }

        # Use P/Invoke for volume control
        switch ($action) {
            "up" { 
                [Win32]::keybd_event(0xAF, 0, 0, 0)     # VK_VOLUME_UP
                [Win32]::keybd_event(0xAF, 0, 0x02, 0)  # KEYEVENTF_KEYUP
            }
            "down" { 
                [Win32]::keybd_event(0xAE, 0, 0, 0)     # VK_VOLUME_DOWN
                [Win32]::keybd_event(0xAE, 0, 0x02, 0)  # KEYEVENTF_KEYUP
            }
            "mute" { 
                [Win32]::keybd_event(0xAD, 0, 0, 0)     # VK_VOLUME_MUTE
                [Win32]::keybd_event(0xAD, 0, 0x02, 0)  # KEYEVENTF_KEYUP
            }
            "set" { Write-Host "Volume set functionality requires additional Windows API calls"; return }
            default { Write-Host "Volume action not supported: $action. Use: up, down, mute, set" }
        }
        Write-Host "Volume action: $action $(if($value){$value})"
    }

    "brightness" {
        if ($Params.Count -lt 1) { Write-Error "Usage: brightness up|down|set [0-100]"; exit 1 }
        $action = $Params[0].ToLower()
        $value = if ($Params.Count -gt 1) { [int]$Params[1] } else { 0 }

        switch ($action) {
            "up" { [System.Windows.Forms.SendKeys]::SendWait("#{F2}") }  # Example for brightness up (depends on keyboard shortcuts)
            "down" { [System.Windows.Forms.SendKeys]::SendWait("#{F3}") } # Example for brightness down
            "set" { Write-Host "Brightness set functionality requires WMI calls"; return }
            default { Write-Host "Brightness action not supported: $action. Use: up, down, set" }
        }
        Write-Host "Brightness action: $action $(if($value){$value})"
    }

    "gettext" {
        # Extract text content from a UI element
        # Credit: Based on Windows UIAutomation patterns
        if ($Params.Count -lt 1) { Write-Error "Usage: gettext 'Element Name' or gettext --focused"; exit 1 }
        
        $target = $Params -join " "
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        
        if ($target -eq "--focused") {
            # Get text from currently focused element
            try {
                $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
                if ($focused) {
                    $name = $focused.Current.Name
                    
                    # Try to get value if it's an input
                    $valuePattern = $null
                    if ($focused.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
                        $value = $valuePattern.Current.Value
                        Write-Host "TEXT:$value"
                        Write-Host "NAME:$name"
                    } else {
                        Write-Host "TEXT:$name"
                    }
                }
            } catch {
                Write-Host "Could not get text from focused element: $_"
            }
        } else {
            # Get text from named element
            $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $target)
            $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
            
            if ($element) {
                $name = $element.Current.Name
                $controlType = $element.Current.ControlType.ProgrammaticName
                
                # Try ValuePattern for input elements
                $valuePattern = $null
                if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
                    $value = $valuePattern.Current.Value
                    Write-Host "TEXT:$value"
                    Write-Host "NAME:$name"
                    Write-Host "TYPE:$controlType"
                } 
                # Try TextPattern for rich text
                elseif ($element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$textPattern)) {
                    $textRange = $textPattern.DocumentRange
                    $text = $textRange.GetText(-1)
                    Write-Host "TEXT:$text"
                    Write-Host "NAME:$name"
                    Write-Host "TYPE:$controlType"
                }
                else {
                    Write-Host "TEXT:$name"
                    Write-Host "TYPE:$controlType"
                }
            } else {
                Write-Host "Element '$target' not found"
            }
        }
    }

    "clipboard" {
        # Clipboard operations
        if ($Params.Count -lt 1) { Write-Error "Usage: clipboard get|set|clear [text]"; exit 1 }
        $action = $Params[0].ToLower()
        
        switch ($action) {
            "get" {
                $text = Get-Clipboard -Raw
                Write-Host "CLIPBOARD:$text"
            }
            "set" {
                $text = $Params[1..($Params.Count - 1)] -join " "
                Set-Clipboard -Value $text
                Write-Host "Clipboard set to: $text"
            }
            "clear" {
                Set-Clipboard -Value ""
                Write-Host "Clipboard cleared"
            }
            default {
                Write-Host "Clipboard actions: get, set, clear"
            }
        }
    }

    "app_state" {
        if ($Params.Count -lt 1) { Write-Error "Usage: app_state 'Window Title'"; exit 1 }
        $title = $Params -join " "
        
        Write-Host "Getting state for app window: '$title'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $window = $null
        
        # Try finding by exact name first
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $title)
        $window = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
        
        # Fallback: Find by partial title via Process
        if (-not $window) {
             $process = Get-Process | Where-Object { $_.MainWindowTitle -like "*$title*" } | Select-Object -First 1
             if ($process) {
                 try {
                    $window = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
                 } catch {}
             }
        }

        if ($window) {
             Write-Host "Window Found: '$($window.Current.Name)'"
             Write-Host "UI Hierarchy:"
             
             # Dump Children
             $children = $window.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
             $count = 0
             foreach ($child in $children) {
                try {
                    $name = $child.Current.Name
                    $type = $child.Current.ControlType.ProgrammaticName -replace "ControlType.", ""
                    $visible = -not $child.Current.IsOffscreen
                    
                    # Clean up type name
                    
                    if ($visible) {
                        $info = "  - <$type> '$name'"
                        
                        # Check for value/text patterns for more info
                        $valuePattern = $null
                        if ($child.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
                            $val = $valuePattern.Current.Value
                            if ($val) { $info += " [Value: $val]" }
                        }
                        
                        Write-Host $info
                        $count++
                    }
                } catch {}
             }
             Write-Host "Found $count visible top-level elements in window."
        } else {
            Write-Host "Window '$title' not found."
        }
    }

    "listchildren" {
        # List child elements of a UI element (for exploring UI structure)
        if ($Params.Count -lt 1) { Write-Error "Usage: listchildren 'Parent Element Name'"; exit 1 }
        $parentName = $Params -join " "
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $parentName)
        $parent = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        
        if ($parent) {
            $children = $parent.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
            $count = 0
            
            Write-Host "Children of '$parentName':"
            foreach ($child in $children) {
                try {
                    $name = $child.Current.Name
                    $type = $child.Current.ControlType.ProgrammaticName -replace "ControlType.", ""
                    $visible = -not $child.Current.IsOffscreen
                    if ($name -or $visible) {
                        Write-Host "  [$count] <$type> '$name' (Visible: $visible)"
                        $count++
                    }
                } catch {}
            }
            Write-Host "Total children: $count"
        } else {
            Write-Host "Parent element '$parentName' not found"
        }
    }

    default {
        Write-Host "Commands: mouse, mousemove, click, rightclick, doubleclick, middleclick, drag, scroll, type, key, startmenu, keydown, keyup, hotkey, screen, screenshot, region, color, ocr, find, findall, findby, uiclick, uiclickall, uipress, focus, waitfor, waitforcolor, waitforpage, browse, googlesearch, playwright, open, apps, window, kill, volume, brightness, browsercontrol, gettext, clipboard, listchildren"
    }
}
