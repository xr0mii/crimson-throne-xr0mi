param(
  [string]$TargetDir = "C:\Users\user\Downloads\журналы на переделку\1 глава"
)

$ErrorActionPreference = "Stop"
$ModuleId = "crimson-throne-xr0mi"

$Files = @(
  "fvtt-JournalEntry-00-predystoriya-tmzBrCBAjvY9dOKB.json",
  "fvtt-JournalEntry-01-chastь_-proklyatye-sudьby-ykPqbJMIKZmXEayo.json",
  "fvtt-JournalEntry-02-chastь_-gorod-soshedshij-s-uma-XXa8bo2jLx70wFIq.json",
  "fvtt-JournalEntry-03-chastь_-krovь-i-kosti-ht8k3qhudwpDcQ94.json",
  "fvtt-JournalEntry-04-zavershenie-glavy-qfD5YRZGTpQ2VqEe.json"
)

function Read-JsonFile {
  param([string]$Path)
  $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  return $raw | ConvertFrom-Json
}

function Write-JsonFile {
  param(
    [string]$Path,
    [object]$Value
  )
  $json = $Value | ConvertTo-Json -Depth 100
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $json, $utf8)
}

function Ensure-ObjectProperty {
  param(
    [object]$Object,
    [string]$Name,
    [object]$DefaultValue
  )

  if (-not $Object.PSObject.Properties[$Name]) {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $DefaultValue
  }

  return $Object.PSObject.Properties[$Name].Value
}

function Enable-CtJournalStyle {
  param([object]$Entry)

  $flags = Ensure-ObjectProperty -Object $Entry -Name "flags" -DefaultValue ([pscustomobject]@{})
  $moduleFlags = Ensure-ObjectProperty -Object $flags -Name $ModuleId -DefaultValue ([pscustomobject]@{})

  if ($moduleFlags.PSObject.Properties["useCtStyle"]) {
    $moduleFlags.PSObject.Properties["useCtStyle"].Value = $true
  } else {
    $moduleFlags | Add-Member -MemberType NoteProperty -Name "useCtStyle" -Value $true
  }
}

function Get-PlainText {
  param([string]$Html)
  return (($Html -replace '(?is)<[^>]+>', ' ') -replace '\s+', ' ').Trim()
}

function Get-HandoutClass {
  param([string]$HeadingText)

  if ($HeadingText -match '^\s*Сокровищ') { return "ct-treasure" }
  if ($HeadingText -match '^\s*Наград') { return "ct-award" }
  if ($HeadingText -match '^\s*(Существ|Существо|Противник|Столкновен|Бой)') { return "ct-encounter" }
  if ($HeadingText -match '^\s*(Ловушк|Опасност|Наваждени|Руна|Обвал)') { return "ct-hazard" }
  if ($HeadingText -match '^\s*(Проверк|КС|Сложност|Улик|Подсказк)') { return "ct-check" }
  if ($HeadingText -match '^\s*(Развитие|Последств|События после|Итог)') { return "ct-development" }

  return $null
}

function Clean-Html {
  param([string]$Html)

  if (-not $Html) {
    return $Html
  }

  $result = $Html

  # Remove ChatGPT/export artifacts while preserving Foundry links and inline rolls.
  $result = $result -replace '\sdata-(?:start|end)="[^"]*"', ''
  $result = $result -replace '\scontenteditable="[^"]*"', ''
  $result = $result -replace '\sstyle="float:\s*right;?"', ' class="float-right"'
  $result = $result -replace '\sstyle="[^"]*"', ''
  $result = $result -replace '<span\b[^>]*>', ''
  $result = $result -replace '</span>', ''
  $result = $result -replace '(?is)<hr\b[^>]*?/?>', '<hr class="ct-break">'

  # Normalize a few typographic scars from early drafts.
  $result = $result -replace '—-', '—'
  $result = $result -replace '“([^”]+)”', '«$1»'
  $result = $result -replace '"Угре́вом Краю"', '«Угрёвом Краю»'
  $result = $result -replace 'Краснае Богомолы', 'Красные Богомолы'
  $result = $result -replace 'страхa', 'страха'

  return $result
}

function Test-InHandout {
  param(
    [string]$Html,
    [int]$Index
  )

  $before = $Html.Substring(0, $Index)
  $lastOpen = $before.LastIndexOf('<div class="ct-handout', [System.StringComparison]::OrdinalIgnoreCase)
  if ($lastOpen -lt 0) {
    return $false
  }

  $lastClose = $before.LastIndexOf('</div>', [System.StringComparison]::OrdinalIgnoreCase)
  return $lastOpen -gt $lastClose
}

function Wrap-StrongMarkerParagraphs {
  param([string]$Html)

  if (-not $Html) {
    return $Html
  }

  $markerRegex = [regex]'(?is)<p><strong>\s*(Существо|Существа|Сокровище|Сокровища|Награда|Развитие|Ловушка|Опасность)\.?\s*</strong>\s*(.*?)</p>'
  $matches = $markerRegex.Matches($Html)
  if ($matches.Count -eq 0) {
    return $Html
  }

  $output = New-Object System.Text.StringBuilder
  $cursor = 0
  $i = 0

  while ($i -lt $matches.Count) {
    $match = $matches[$i]

    if ($match.Index -lt $cursor -or (Test-InHandout -Html $Html -Index $match.Index)) {
      $i++
      continue
    }

    $label = $match.Groups[1].Value.Trim()
    $className = Get-HandoutClass -HeadingText $label
    if (-not $className) {
      $i++
      continue
    }

    $bodyStart = $match.Index + $match.Length
    $end = $Html.Length

    $nextCandidates = New-Object System.Collections.Generic.List[int]
    if ($i + 1 -lt $matches.Count) {
      [void]$nextCandidates.Add($matches[$i + 1].Index)
    }

    foreach ($pattern in @('(?is)<h[2-4]\b', '(?is)<div class="ct-handout')) {
      $boundary = [regex]::Match($Html.Substring($bodyStart), $pattern)
      if ($boundary.Success) {
        [void]$nextCandidates.Add($bodyStart + $boundary.Index)
      }
    }

    if ($nextCandidates.Count -gt 0) {
      $end = ($nextCandidates | Measure-Object -Minimum).Minimum
    }

    $firstBody = $match.Groups[2].Value.Trim()
    $body = $Html.Substring($bodyStart, $end - $bodyStart).Trim()

    [void]$output.Append($Html.Substring($cursor, $match.Index - $cursor))
    [void]$output.Append("<div class=""ct-handout $className"">")
    [void]$output.Append("<h4>$label</h4>")
    if ($firstBody.Length -gt 0) {
      [void]$output.Append("<p>$firstBody</p>")
    }
    if ($body.Length -gt 0) {
      [void]$output.Append($body)
    }
    [void]$output.Append("</div>")

    $cursor = $end
    $i++
  }

  if ($cursor -lt $Html.Length) {
    [void]$output.Append($Html.Substring($cursor))
  }

  return $output.ToString()
}

function Wrap-BlockHeadings {
  param([string]$Html)

  if (-not $Html) {
    return $Html
  }

  $headingRegex = [regex]'(?is)<h([3-4])\b[^>]*>.*?</h\1>'
  $matches = $headingRegex.Matches($Html)
  if ($matches.Count -eq 0) {
    return $Html
  }

  $output = New-Object System.Text.StringBuilder
  $cursor = 0
  $i = 0

  while ($i -lt $matches.Count) {
    $match = $matches[$i]

    if ($match.Index -lt $cursor) {
      $i++
      continue
    }

    $headingText = Get-PlainText -Html $match.Value
    $className = Get-HandoutClass -HeadingText $headingText

    if (-not $className -or (Test-InHandout -Html $Html -Index $match.Index)) {
      [void]$output.Append($Html.Substring($cursor, $match.Index - $cursor))
      [void]$output.Append($match.Value)
      $cursor = $match.Index + $match.Length
      $i++
      continue
    }

    $end = $Html.Length
    if ($i + 1 -lt $matches.Count) {
      $end = $matches[$i + 1].Index
    }

    $bodyStart = $match.Index + $match.Length
    $body = $Html.Substring($bodyStart, $end - $bodyStart).Trim()
    $headingInner = [regex]::Match($match.Value, '(?is)<h[3-4]\b[^>]*>(.*?)</h[3-4]>').Groups[1].Value.Trim()

    [void]$output.Append($Html.Substring($cursor, $match.Index - $cursor))
    [void]$output.Append("<div class=""ct-handout $className"">")
    [void]$output.Append("<h4>$headingInner</h4>")
    if ($body.Length -gt 0) {
      [void]$output.Append($body)
    }
    [void]$output.Append("</div>")

    $cursor = $end
    $i++
  }

  if ($cursor -lt $Html.Length) {
    [void]$output.Append($Html.Substring($cursor))
  }

  return $output.ToString()
}

function Polish-Handouts {
  param([string]$Html)

  if (-not $Html) {
    return $Html
  }

  $result = $Html

  $result = $result -replace '(?is)<div class="ct-handout ct-encounter"><h4>(Существа?|Существо)</h4><p>\s*((?:@UUID\[[^\]]+\]\{[^}]+\}(?:\s*x?\d+)?\s*)+)(.*?)</p>', '<div class="ct-handout ct-encounter"><h4>$1 $2</h4><p>$3</p>'

  $result = $result -replace '(?is)<p>\s*</p><p><strong>\s*(Сокровище[^<]*?(?:@UUID\[[^\]]+\]\{[^}]+\})?)\s*<br\s*/?>\s*</strong>\s*(.*?)</p></div>', '</div><div class="ct-handout ct-treasure"><h4>$1</h4><p>$2</p></div>'

  return $result
}

function Update-ChapterPageHtml {
  param([string]$Html)
  $clean = Clean-Html -Html $Html
  $strongBlocks = Wrap-StrongMarkerParagraphs -Html $clean
  $blockHeadings = Wrap-BlockHeadings -Html $strongBlocks
  return Polish-Handouts -Html $blockHeadings
}

$updated = @()

foreach ($file in $Files) {
  $path = Join-Path $TargetDir $file
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Warning "File not found: $path"
    continue
  }

  $entry = Read-JsonFile -Path $path
  Enable-CtJournalStyle -Entry $entry

  foreach ($page in $entry.pages) {
    if ($page.text -and $page.text.content) {
      $page.text.content = Update-ChapterPageHtml -Html $page.text.content
    }
  }

  Write-JsonFile -Path $path -Value $entry
  $updated += $entry.name
}

Write-Host "Updated chapter 1 journals:"
$updated | ForEach-Object { Write-Host "- $_" }
