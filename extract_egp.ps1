# Extracts SAS code from every .egp into $OutputDir/<egp-name>/<label>.sas
#
# Primary source: project.xml inside the .egp (a ZIP). Each
#   <Element Type="SAS.EG.ProjectElements.Code"> has:
#     - Element/InputIDs -> e.g. "CodeTask-abc123"
#     - TextElement/Text -> the current SAS source
#   We map InputIDs -> human label via the matching
#   <Element Type="SAS.EG.ProjectElements.CodeTask"> elements.
#
# Fallback: when project.xml is missing or has no inline code, we
# extract top-level CodeTask-XXX/code.sas entries from the zip.

param(
    [string]$InputDir  = "C:\Code\Cogna_sas_projects\all_egps",
    [string]$OutputDir = "C:\Code\Cogna_sas_projects\sas_by_egp",
    [int]$Limit = 0,
    [switch]$Force,
    [switch]$KeepExisting
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$invalidChars = [System.IO.Path]::GetInvalidFileNameChars() + @(':','*','?','"','<','>','|')

function Sanitize-Name([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return '_' }
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $name.ToCharArray()) {
        if ($invalidChars -contains $ch) { [void]$sb.Append('_') }
        else { [void]$sb.Append($ch) }
    }
    $s = $sb.ToString().Trim().TrimEnd('.')
    if ($s.Length -gt 120) { $s = $s.Substring(0,120).TrimEnd() }
    if ([string]::IsNullOrWhiteSpace($s)) { return '_' }
    return $s
}

function Get-UniqueName($writtenNames, $base, $ext) {
    $candidate = "$base$ext"
    $key = $candidate.ToLowerInvariant()
    if (-not $writtenNames.ContainsKey($key)) { return $candidate }
    $n = 2
    while ($writtenNames.ContainsKey(("$base ($n)$ext").ToLowerInvariant())) { $n++ }
    return "$base ($n)$ext"
}

$rxRootCode = [regex]'^CodeTask-(?<id>[^/]+)/code\.sas$'

$egps = Get-ChildItem -Path $InputDir -Filter *.egp -File
if ($Limit -gt 0) { $egps = $egps | Select-Object -First $Limit }

$total       = $egps.Count
$processed   = 0
$skipped     = 0
$errors      = 0
$sasWritten  = 0
$emptyEgps   = 0
$xmlEgps     = 0
$zipFallback = 0
$logPath     = Join-Path $OutputDir "_extract_log.txt"
$errorPath   = Join-Path $OutputDir "_extract_errors.txt"
"Run started: $(Get-Date -Format o)`tInputDir=$InputDir`tCount=$total" | Out-File -FilePath $logPath -Encoding utf8

foreach ($egp in $egps) {
    $processed++
    $egpStem = [System.IO.Path]::GetFileNameWithoutExtension($egp.Name)
    $folderName = Sanitize-Name $egpStem
    $egpOut = Join-Path $OutputDir $folderName

    if (Test-Path $egpOut) {
        if ($KeepExisting) {
            $existing = Get-ChildItem -Path $egpOut -Filter *.sas -File -ErrorAction SilentlyContinue
            if ($existing -and $existing.Count -gt 0) {
                $skipped++
                continue
            }
        } elseif ($Force) {
            Get-ChildItem -Path $egpOut -Filter *.sas -File -ErrorAction SilentlyContinue |
                Remove-Item -Force -ErrorAction SilentlyContinue
        }
    } else {
        New-Item -ItemType Directory -Path $egpOut -Force | Out-Null
    }

    $writtenNames = @{}
    $writtenCount = 0

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($egp.FullName)
        try {
            # ---- Primary path: parse project.xml ----
            $projEntry = $zip.Entries | Where-Object { $_.FullName -eq 'project.xml' } | Select-Object -First 1
            $doc = $null
            if ($projEntry) {
                try {
                    $es = $projEntry.Open()
                    $ms = New-Object System.IO.MemoryStream
                    $es.CopyTo($ms); $es.Close()
                    $ms.Position = 0
                    $doc = New-Object System.Xml.XmlDocument
                    $doc.Load($ms)
                    $ms.Dispose()
                } catch {
                    $doc = $null
                }
            }

            if ($doc) {
                # Build CodeTask ID -> Label
                $labelMap = @{}
                $ctNodes = $doc.SelectNodes("//*[@Type='SAS.EG.ProjectElements.CodeTask']")
                foreach ($n in $ctNodes) {
                    $idNode = $n.SelectSingleNode("Element/ID")
                    $lbNode = $n.SelectSingleNode("Element/Label")
                    if ($idNode -and $lbNode) {
                        $id = $idNode.InnerText
                        if (-not $labelMap.ContainsKey($id)) {
                            $labelMap[$id] = $lbNode.InnerText
                        }
                    }
                }

                # Each Code element: write its Text using its InputIDs->label
                $codeNodes = $doc.SelectNodes("//*[@Type='SAS.EG.ProjectElements.Code']")
                foreach ($c in $codeNodes) {
                    $text = $c.SelectSingleNode("TextElement/Text")
                    if (-not $text) { continue }
                    $code = $text.InnerText
                    if ([string]::IsNullOrWhiteSpace($code)) { continue }

                    $inputs = $c.SelectSingleNode("Element/InputIDs")
                    $inputId = if ($inputs) { $inputs.InnerText.Trim() } else { '' }
                    $label = $null
                    if ($inputId -and $labelMap.ContainsKey($inputId)) {
                        $label = $labelMap[$inputId]
                    }
                    if ([string]::IsNullOrWhiteSpace($label)) {
                        # Try Code element's own label, falling back to InputID or Code ID
                        $cLabel = $c.SelectSingleNode("Element/Label")
                        if ($cLabel) { $label = $cLabel.InnerText }
                    }
                    if ([string]::IsNullOrWhiteSpace($label) -or $label -eq 'Last Submitted Code') {
                        if ($inputId) { $label = $inputId }
                        else {
                            $cid = $c.SelectSingleNode("Element/ID")
                            $label = if ($cid) { $cid.InnerText } else { 'code' }
                        }
                    }

                    $base = Sanitize-Name $label
                    $name = Get-UniqueName $writtenNames $base '.sas'
                    $writtenNames[$name.ToLowerInvariant()] = $true
                    $outPath = Join-Path $egpOut $name
                    [System.IO.File]::WriteAllText($outPath, $code, [System.Text.UTF8Encoding]::new($false))
                    $writtenCount++
                    $sasWritten++
                }
                if ($writtenCount -gt 0) { $xmlEgps++ }
            }

            # ---- Fallback: top-level CodeTask-XXX/code.sas from the zip ----
            if ($writtenCount -eq 0) {
                # Top-level only
                $byId = @{}
                foreach ($e in $zip.Entries) {
                    $m = $rxRootCode.Match($e.FullName)
                    if (-not $m.Success) { continue }
                    $id = 'CodeTask-' + $m.Groups['id'].Value
                    if (-not $byId.ContainsKey($id)) { $byId[$id] = $e }
                }
                # If still none, accept any CodeTask-*/code.sas path (deduped by id, prefer largest)
                if ($byId.Count -eq 0) {
                    $rxAny = [regex]'(?:^|/)CodeTask-(?<id>[^/]+)/code\.sas$'
                    foreach ($e in $zip.Entries) {
                        $m = $rxAny.Match($e.FullName)
                        if (-not $m.Success) { continue }
                        $id = 'CodeTask-' + $m.Groups['id'].Value
                        if (-not $byId.ContainsKey($id) -or $byId[$id].Length -lt $e.Length) {
                            $byId[$id] = $e
                        }
                    }
                }
                if ($byId.Count -gt 0) {
                    # Try to use labels from XML if we have it
                    $labelMap = @{}
                    if ($doc) {
                        $ctNodes2 = $doc.SelectNodes("//*[@Type='SAS.EG.ProjectElements.CodeTask']")
                        foreach ($n in $ctNodes2) {
                            $idNode = $n.SelectSingleNode("Element/ID")
                            $lbNode = $n.SelectSingleNode("Element/Label")
                            if ($idNode -and $lbNode) { $labelMap[$idNode.InnerText] = $lbNode.InnerText }
                        }
                    }
                    foreach ($id in $byId.Keys) {
                        $entry = $byId[$id]
                        $label = $labelMap[$id]
                        if ([string]::IsNullOrWhiteSpace($label)) { $label = $id }
                        $base = Sanitize-Name $label
                        $name = Get-UniqueName $writtenNames $base '.sas'
                        $writtenNames[$name.ToLowerInvariant()] = $true
                        $outPath = Join-Path $egpOut $name
                        $es = $entry.Open()
                        $ms = New-Object System.IO.MemoryStream
                        $es.CopyTo($ms); $es.Close()
                        $bytes = $ms.ToArray(); $ms.Dispose()
                        [System.IO.File]::WriteAllBytes($outPath, $bytes)
                        $writtenCount++
                        $sasWritten++
                    }
                    $zipFallback++
                }
            }

            if ($writtenCount -eq 0) { $emptyEgps++ }
        } finally {
            $zip.Dispose()
        }
    } catch {
        $errors++
        $msg = "[$($egp.Name)] $($_.Exception.Message)"
        Add-Content -Path $errorPath -Value $msg -Encoding utf8
    }

    if (($processed % 100) -eq 0) {
        $line = "[{0}/{1}] sas={2} xml={3} zipFallback={4} empty={5} errors={6} skipped={7}" -f `
            $processed, $total, $sasWritten, $xmlEgps, $zipFallback, $emptyEgps, $errors, $skipped
        Add-Content -Path $logPath -Value $line -Encoding utf8
    }
}

$summary = "Done at $(Get-Date -Format o). processed=$processed sas=$sasWritten xmlEgps=$xmlEgps zipFallback=$zipFallback empty=$emptyEgps skipped=$skipped errors=$errors"
Add-Content -Path $logPath -Value $summary -Encoding utf8
Write-Output $summary
