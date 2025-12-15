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

public class Win32 {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const uint MOUSEEVENTF_RIGHTUP = 0x10;
    public const uint KEYEVENTF_KEYUP = 0x02;
}
"@
Add-Type -TypeDefinition $code -Language CSharp

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
        } elseif ($k -eq "ENTER") {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        } elseif ($k -eq "TAB") {
            [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
        } else {
            [System.Windows.Forms.SendKeys]::SendWait("{$k}")
        }
        Write-Host "Pressed: $k"
    }

    "screen" {
        $w = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
        $h = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height
        Write-Host "Screen Resolution: $w x $h"
    }

    "screenshot" {
        if ($Params.Count -lt 1) { $file = "screenshot.png" } else { $file = $Params[0] }
        $fullPath = [System.IO.Path]::GetFullPath($file)
        
        $bmp = New-Object System.Drawing.Bitmap ([System.Windows.Forms.SystemInformation]::VirtualScreen.Width, [System.Windows.Forms.SystemInformation]::VirtualScreen.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
        $bmp.Save($fullPath)
        $g.Dispose()
        $bmp.Dispose()
        Write-Host "Screenshot saved to $fullPath"
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

    "uiclick" {
        if ($Params.Count -lt 1) { Write-Error "Usage: uiclick 'Name'"; exit 1 }
        $targetName = $Params -join " "
        Write-Host "Searching & Clicking: '$targetName'..."
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $targetName)
        $collection = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        
        $found = $false
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
                        
                        Write-Host "Clicked '$targetName' at ($centerX, $centerY)"
                        $found = $true
                        break
                    }
                }
            } catch {}
        }
        
        if (-not $found) { Write-Host "Could not find visible '$targetName' to click." }
    }

    "open" {
        if ($Params.Count -lt 1) { Write-Error "Usage: open 'Path or URL'"; exit 1 }
        $target = $Params -join " "
        try {
            Start-Process $target
            Write-Host "Opened '$target'"
        } catch {
            Write-Error "Failed to open '$target': $_"
        }
    }

    "apps" {
        $apps = Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object Id, MainWindowTitle
        if ($apps) {
            $apps | Format-Table -AutoSize | Out-String | Write-Host
        } else {
            Write-Host "No visible applications found."
        }
    }
    
    default {
        Write-Host "Commands: mouse, click, rightclick, type, key, screen, screenshot, find, apps"
    }
}
