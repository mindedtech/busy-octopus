<#
.SYNOPSIS
Manages workspace-specific editor attention through Windows native APIs.

.DESCRIPTION
Shows clickable notifications and manages attention for the exact editor window.

.PARAMETER Operation
Selects notification delivery, editor window capture, or taskbar flash changes.

.PARAMETER Title
Specifies the notification title.

.PARAMETER Body
Specifies the optional notification details.

.PARAMETER IncludeBody
Controls whether the toast contains a details element.

.PARAMETER Sound
Controls whether Windows plays its default notification sound.

.PARAMETER AppName
Specifies the Start menu application name attributed to the toast.

.PARAMETER ActivationUri
Specifies the editor workspace URI opened when the toast is activated.

.PARAMETER EditorProcessId
Specifies the root editor process used to validate the editor window.

.PARAMETER EditorWindowHandle
Specifies the exact editor window to flash.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet("showNotification", "captureWindow", "startTaskbarFlash", "stopTaskbarFlash")][string]$Operation,
  [Parameter(Mandatory = $false)][ValidateLength(0, 240)][string]$Title = "",
  [Parameter(Mandatory = $false)][ValidateLength(0, 2048)][string]$Body = "",
  [Parameter(Mandatory = $false)][ValidateSet("true", "false")][string]$IncludeBody = "false",
  [Parameter(Mandatory = $false)][ValidateSet("true", "false")][string]$Sound = "false",
  [Parameter(Mandatory = $false)][ValidateLength(0, 256)][string]$AppName = "",
  [Parameter(Mandatory = $false)][AllowEmptyString()][ValidateLength(0, 8192)][string]$ActivationUri = "",
  [Parameter(Mandatory = $false)][ValidateRange(0, 2147483647)][int]$EditorProcessId = 0,
  [Parameter(Mandatory = $false)][ValidateLength(1, 32)][string]$EditorWindowHandle = "0"
)

$ErrorActionPreference = "Stop"

function New-EditorWindowCaptureResult {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("success", "unavailable")][string]$Status,
    [Parameter(Mandatory = $false)][AllowNull()][object]$WindowHandle
  )

  return [PSCustomObject]@{
    status = $Status
    windowHandle = $WindowHandle
  }
}

function New-NativeDeliveryResult {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("success", "unavailable")][string]$Status
  )

  return [PSCustomObject]@{
    status = $Status
  }
}

function Import-EditorWindowApi {
  $win32Source = @"
using System;
using System.Runtime.InteropServices;

public static class BusyOctopusWindow
{
    [StructLayout(LayoutKind.Sequential)]
    public struct FLASHWINFO
    {
        public uint cbSize;
        public IntPtr hwnd;
        public uint dwFlags;
        public uint uCount;
        public uint dwTimeout;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool FlashWindowEx(ref FLASHWINFO flashInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr windowHandle, uint command);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr windowHandle, out uint processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr windowHandle);
}
"@

  Add-Type -TypeDefinition $win32Source -Language CSharp | Out-Null
}

function Get-EditorProcessIdSet {
  $processIdSet = [System.Collections.Generic.HashSet[int]]::new()
  [void]$processIdSet.Add($EditorProcessId)
  $processList = @(Get-CimInstance -ClassName Win32_Process -Property ProcessId, ParentProcessId)

  do {
    $addProcess = $false
    foreach ($process in $processList) {
      if (
        $processIdSet.Contains([int]$process.ParentProcessId) -and
        $processIdSet.Add([int]$process.ProcessId)
      ) {
        $addProcess = $true
      }
    }
  } while ($addProcess)

  return ,$processIdSet
}

function Test-EditorWindow {
  param(
    [Parameter(Mandatory = $true)][IntPtr]$WindowHandle,
    [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[int]]$ProcessIdSet
  )

  if (-not [BusyOctopusWindow]::IsWindow($WindowHandle)) {
    return $false
  }
  if (-not [BusyOctopusWindow]::IsWindowVisible($WindowHandle)) {
    return $false
  }
  if ([BusyOctopusWindow]::GetWindow($WindowHandle, 4) -ne [IntPtr]::Zero) {
    return $false
  }

  [uint32]$ownerProcessId = 0
  [void][BusyOctopusWindow]::GetWindowThreadProcessId($WindowHandle, [ref]$ownerProcessId)
  return $ProcessIdSet.Contains([int]$ownerProcessId)
}

function Stop-EditorTaskbarFlash {
  param(
    [Parameter(Mandatory = $true)][IntPtr]$WindowHandle
  )

  $flashInfo = [BusyOctopusWindow+FLASHWINFO]::new()
  $flashInfo.cbSize = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($flashInfo)
  $flashInfo.hwnd = $WindowHandle
  $flashInfo.dwFlags = 0x00000000
  $flashInfo.uCount = 0
  $flashInfo.dwTimeout = 0
  [void][BusyOctopusWindow]::FlashWindowEx([ref]$flashInfo)
}

function Get-EditorWindowCapture {
  if ($EditorProcessId -le 0) {
    return New-EditorWindowCaptureResult -Status "unavailable" -WindowHandle $null
  }

  try {
    Import-EditorWindowApi
    $windowHandle = [BusyOctopusWindow]::GetForegroundWindow()
    if (-not (Test-EditorWindow -WindowHandle $windowHandle -ProcessIdSet (Get-EditorProcessIdSet))) {
      return New-EditorWindowCaptureResult -Status "unavailable" -WindowHandle $null
    }

    Stop-EditorTaskbarFlash -WindowHandle $windowHandle
    return New-EditorWindowCaptureResult -Status "success" -WindowHandle $windowHandle.ToInt64().ToString([System.Globalization.CultureInfo]::InvariantCulture)
  }
  catch {
    throw "Windows editor window capture failed."
  }
}

function Invoke-EditorTaskbarFlashStop {
  if ($EditorProcessId -le 0) {
    return New-NativeDeliveryResult -Status "unavailable"
  }

  [long]$windowHandleValue = 0
  if (-not [long]::TryParse($EditorWindowHandle, [ref]$windowHandleValue) -or $windowHandleValue -le 0) {
    return New-NativeDeliveryResult -Status "unavailable"
  }

  try {
    Import-EditorWindowApi
    $windowHandle = [IntPtr]::new($windowHandleValue)
    if (-not (Test-EditorWindow -WindowHandle $windowHandle -ProcessIdSet (Get-EditorProcessIdSet))) {
      return New-NativeDeliveryResult -Status "unavailable"
    }

    Stop-EditorTaskbarFlash -WindowHandle $windowHandle
    return New-NativeDeliveryResult -Status "success"
  }
  catch {
    throw "Windows taskbar attention stop failed."
  }
}

function Send-WindowsNotification {
  if ([string]::IsNullOrWhiteSpace($ActivationUri)) {
    return New-NativeDeliveryResult -Status "unavailable"
  }

  try {
    [Uri]$activation = $null
    if (-not [Uri]::TryCreate($ActivationUri, [UriKind]::Absolute, [ref]$activation)) {
      return New-NativeDeliveryResult -Status "unavailable"
    }

    # Load the WinRT notification types in Windows PowerShell without external modules.
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

    # Remove XML-invalid controls and escape notification text before building the toast document.
    $invalidControlPattern = "[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF]"
    $xmlTitle = [System.Security.SecurityElement]::Escape(
      [regex]::Replace($Title, $invalidControlPattern, " ")
    )
    $xmlBody = [System.Security.SecurityElement]::Escape(
      [regex]::Replace($Body, $invalidControlPattern, " ")
    )
    $bodyElement = if ($IncludeBody -eq "true") { "<text>$xmlBody</text>" } else { "" }
    $xmlActivationUri = [System.Security.SecurityElement]::Escape($activation.AbsoluteUri)
    $audio = switch ($Sound) {
      "true" { '<audio src="ms-winsoundevent:Notification.Default"/>' }
      "false" { '<audio silent="true"/>' }
    }

    # Windows silently discards desktop toasts that do not use the Start menu shortcut's registered identity.
    $startApp = Get-StartApps | Where-Object { $_.Name -eq $AppName } | Select-Object -First 1
    if ($null -eq $startApp) {
      throw "Unable to resolve the Windows application identifier for $AppName"
    }

    $xml = @"
<toast activationType="protocol" launch="$xmlActivationUri">
  <visual>
    <binding template="ToastGeneric">
      <text>$xmlTitle</text>
      $bodyElement
    </binding>
  </visual>
  $audio
</toast>
"@

    $document = [Windows.Data.Xml.Dom.XmlDocument]::new()
    $document.LoadXml($xml)
    $notification = [Windows.UI.Notifications.ToastNotification]::new($document)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($startApp.AppID).Show($notification)

    return New-NativeDeliveryResult -Status "success"
  }
  catch {
    throw "Windows notification delivery failed."
  }
}

function Start-EditorTaskbarFlash {
  if ($EditorProcessId -le 0) {
    return New-NativeDeliveryResult -Status "unavailable"
  }

  [long]$windowHandleValue = 0
  if (-not [long]::TryParse($EditorWindowHandle, [ref]$windowHandleValue) -or $windowHandleValue -le 0) {
    return New-NativeDeliveryResult -Status "unavailable"
  }

  try {
    Import-EditorWindowApi
    $windowHandle = [IntPtr]::new($windowHandleValue)
    if (-not (Test-EditorWindow -WindowHandle $windowHandle -ProcessIdSet (Get-EditorProcessIdSet))) {
      return New-NativeDeliveryResult -Status "unavailable"
    }
    if ([BusyOctopusWindow]::GetForegroundWindow() -eq $windowHandle) {
      return New-NativeDeliveryResult -Status "unavailable"
    }

    $flashInfo = [BusyOctopusWindow+FLASHWINFO]::new()
    $flashInfo.cbSize = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($flashInfo)
    $flashInfo.hwnd = $windowHandle
    $flashInfo.dwFlags = 0x00000002 -bor 0x00000004
    $flashInfo.uCount = [uint32]::MaxValue
    $flashInfo.dwTimeout = 0
    [void][BusyOctopusWindow]::FlashWindowEx([ref]$flashInfo)
    if ([BusyOctopusWindow]::GetForegroundWindow() -eq $windowHandle) {
      Stop-EditorTaskbarFlash -WindowHandle $windowHandle
      return New-NativeDeliveryResult -Status "unavailable"
    }

    return New-NativeDeliveryResult -Status "success"
  }
  catch {
    throw "Windows taskbar attention delivery failed."
  }
}

switch ($Operation) {
  "showNotification" {
    Send-WindowsNotification | ConvertTo-Json -Compress
  }
  "captureWindow" {
    Get-EditorWindowCapture | ConvertTo-Json -Compress
  }
  "startTaskbarFlash" {
    Start-EditorTaskbarFlash | ConvertTo-Json -Compress
  }
  "stopTaskbarFlash" {
    Invoke-EditorTaskbarFlashStop | ConvertTo-Json -Compress
  }
}
