param(
  [string]$TargetDir = "C:\Users\user\Downloads\журналы на переделку"
)

$ErrorActionPreference = "Stop"
$ModuleId = "crimson-throne-xr0mi"

$Files = @(
  "fvtt-JournalEntry-rukovodstvo-igroka-EoZ4Q7K7viIGUKUI.json",
  "fvtt-JournalEntry-07-bestiarij-korvosy-kCNeujlrXR4JveBX.json",
  "fvtt-JournalEntry-06-kodeks-npc-AlOQVCeEoHZG5ueT.json",
  "fvtt-JournalEntry-04-boleyut-vse-anC2Ibvovv6wqs6t.json",
  "fvtt-JournalEntry-03.2-gadanie-v-korvose-dkm2PImHRSX7RNyq.json",
  "fvtt-JournalEntry-03.1-gadanie-harro-N2Kjl14TyPQU4HLd.json",
  "fvtt-JournalEntry-02-korvosa-i-okrestnosti-gVGOIo3pjTB32nvP.json",
  "fvtt-JournalEntry-00-vstuplenie-pQYO7XmGYIRftH1F.json",
  "fvtt-JournalEntry-!kommentarij-avtora-zPm5Me0Bqk14X9rF.json"
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

function Set-PageContent {
  param(
    [object]$Entry,
    [string]$PageName,
    [string]$Content
  )

  $page = $Entry.pages | Where-Object { $_.name -eq $PageName } | Select-Object -First 1
  if (-not $page) {
    Write-Warning "Page '$PageName' not found in '$($Entry.name)'"
    return
  }

  if (-not $page.text) {
    $page | Add-Member -MemberType NoteProperty -Name "text" -Value ([pscustomobject]@{})
  }

  if ($page.text.PSObject.Properties["content"]) {
    $page.text.PSObject.Properties["content"].Value = $Content
  } else {
    $page.text | Add-Member -MemberType NoteProperty -Name "content" -Value $Content
  }
}

function Convert-LegacyServiceHtml {
  param([string]$Html)

  if (-not $Html) {
    return $Html
  }

  $result = $Html
  $result = $result -replace '(?is)<article\b[^>]*>', ''
  $result = $result -replace '(?is)</article>', ''
  $result = $result -replace '(?is)<header\b[^>]*>', ''
  $result = $result -replace '(?is)</header>', ''
  $result = $result -replace '(?is)<aside\b[^>]*class="[^"]*\bsidebar\b[^"]*"[^>]*>', '<div class="ct-handout">'
  $result = $result -replace '(?is)</aside>', '</div>'
  $result = $result -replace '(?is)<p\b[^>]*class="[^"]*\bsubtitle\b[^"]*"[^>]*>(.*?)</p>', '<p><em>$1</em></p>'
  $result = $result -replace '(?is)<p\b[^>]*class="[^"]*\bnote\b[^"]*"[^>]*>(.*?)</p>', '<div class="ct-handout"><p>$1</p></div>'
  $result = $result -replace '(?is)<table\b[^>]*class="[^"]*\bpf2-table\b[^"]*"([^>]*)>', '<table$1>'
  $result = $result -replace '(?is)\s+id="cotct-[^"]*"', ''
  $result = $result -replace '(?is)\s+class="players-guide[^"]*"', ''

  return $result.Trim()
}

function Clean-LegacyServicePages {
  param([object]$Entry)

  foreach ($page in $Entry.pages) {
    if (-not $page.text -or -not $page.text.content) {
      continue
    }

    $page.text.content = Convert-LegacyServiceHtml -Html $page.text.content
  }
}

function Wrap-WipPage {
  param(
    [object]$Entry,
    [string]$PageName,
    [string]$Note
  )

  $page = $Entry.pages | Where-Object { $_.name -eq $PageName } | Select-Object -First 1
  if (-not $page -or -not $page.text -or -not $page.text.content) {
    return
  }

  if ($page.text.content -match "<h2>\s*WIP\s*</h2>") {
    $page.text.content = @"
<div class="ct-handout ct-development">
<h4>В работе</h4>
<p>$Note</p>
</div>
"@
  }
}

$AuthorPreface = @"
<p>Добро пожаловать в <strong>«Проклятие Багряного Трона»</strong> — русскую адаптацию кампании для Pathfinder 2e и Foundry VTT.</p>
<p><img src="modules/crimson-throne-xr0mi/assets/illustr/korvosaart.webp" /></p>
<p>Модуль собирает переведённые и оформленные материалы кампании: журналы, сцены, актёров, предметы, справочники, таблицы и вспомогательные инструменты для игры за столом. Текст и оформление постепенно приводятся к единому стилю, чтобы журналами было удобно пользоваться прямо во время сессии.</p>
<div class="ct-handout ct-development">
<h4>Текущий статус</h4>
<ul>
<li><strong>Глава 1:</strong> материалы подготовлены и оформлены.</li>
<li><strong>Глава 2:</strong> материалы подготовлены и оформлены.</li>
<li><strong>Глава 3:</strong> материалы подготовлены и оформлены.</li>
<li><strong>Мини-арка 3.5:</strong> <strong>«Кошмары Бриджфронта»</strong> добавлены в модуль и оформлены в общем стиле.</li>
</ul>
</div>
<div class="ct-handout">
<h4>От автора</h4>
<p>Это фанатская русская адаптация, созданная для личного использования и удобного ведения кампании в Foundry VTT. Материалы могут дорабатываться: где-то будет улучшаться перевод, где-то — структура журналов, оформление сцен, подсказки для мастера и служебные справочники.</p>
</div>
"@

$AuthorAddon = @"
<h3>Foundry VTT V14</h3>
<p>Модуль обновлён под Foundry VTT V14. Внешняя зависимость для многоуровневых сцен удалена: новые и обновлённые сцены ориентированы на штатные возможности V14 там, где это уместно. Если у вас остались старые импортированные сцены из прежних версий, проверьте их вручную после обновления.</p>
<h3>Гадание Харро</h3>
<p>Для удобной работы с Харро по-прежнему рекомендуется модуль <strong>PF2E Decks Harrow</strong>. Он закрывает большую часть практических задач с колодой, а журналы модуля дают русское описание раскладов, толкований и сюжетных эффектов.</p>
<h3>NPC и бестиарий</h3>
<p>Служебные справочники по NPC, существам и Корвосе предназначены как быстрые рабочие материалы для мастера. Они будут расширяться и вычищаться по мере подготовки следующих глав.</p>
<p><img src="modules/crimson-throne-xr0mi/assets/icons/npcguide1.png" /></p>
<h3>Что уже есть в модуле</h3>
<ul>
<li><strong>Главы 1-3</strong> основной кампании с оформленными журналами и игровыми материалами.</li>
<li><strong>Мини-арка 3.5 «Кошмары Бриджфронта»</strong> с отдельными журналами, сценами и служебными заметками.</li>
<li><strong>Справочники</strong> по Корвосе, NPC, бестиарию, гаданию Харро и дополнительным материалам для игроков.</li>
<li><strong>Оформление журналов</strong> в стиле «Багряного Трона»: рамка окна, бумажные страницы, читаемые цитаты и выделенные блоки для проверок, опасностей, существ, сокровищ и последствий.</li>
</ul>
<h3>Важно</h3>
<p>Материалы остаются живой версией модуля. Перед важной сессией лучше открыть нужные журналы заранее и проверить сцены, ссылки, актёров и предметы после импорта в ваш мир.</p>
"@

$KorvosaStatblock = @"
<div class="ct-handout ct-development">
<h4>В работе</h4>
<p>Статблок Корвосы пока оставлен как рабочий справочный раздел. Перед использованием проверьте актуальную версию данных в вашем мире. Пока что используйте этот вариант:</p>
</div>
<img src="modules/crimson-throne-xr0mi/assets/icons/Korvosa_statblock.jpg" />
"@

$updated = @()

foreach ($file in $Files) {
  $path = Join-Path $TargetDir $file
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Warning "File not found: $path"
    continue
  }

  $entry = Read-JsonFile -Path $path
  Enable-CtJournalStyle -Entry $entry
  Clean-LegacyServicePages -Entry $entry

  if ($file -like "*kommentarij-avtora*") {
    Set-PageContent -Entry $entry -PageName "Предисловие" -Content $AuthorPreface
    Set-PageContent -Entry $entry -PageName "Дополнение" -Content $AuthorAddon
  }

  if ($file -like "*07-bestiarij-korvosy*") {
    Wrap-WipPage -Entry $entry -PageName "Случайные столкновения" -Note "Раздел подготовлен как служебная заготовка и будет заполнен после финальной вычитки таблиц случайных столкновений."
  }

  if ($file -like "*06-kodeks-npc*") {
    Wrap-WipPage -Entry $entry -PageName "Таблица NPC" -Note "Здесь будет краткая рабочая таблица NPC для быстрого поиска имён, ролей, локаций и связей."
  }

  if ($file -like "*02-korvosa-i-okrestnosti*") {
    Set-PageContent -Entry $entry -PageName "Статблок Корвосы" -Content $KorvosaStatblock
  }

  Write-JsonFile -Path $path -Value $entry
  $updated += $entry.name
}

Write-Host "Updated service journals:"
$updated | ForEach-Object { Write-Host "- $_" }
