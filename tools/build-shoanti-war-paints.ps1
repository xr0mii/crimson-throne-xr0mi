$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$moduleRoot = (Get-Location).Path
$outputDir = Join-Path $moduleRoot "exports\shoanti-war-paints"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

$publication = [ordered]@{
    title = "Проклятие Багряного Трона — конверсия PF2e Remaster"
    authors = "xr0mi"
    license = "ORC"
    remaster = $true
}

$paints = @(
    [ordered]@{
        key = "black"; adjective = "чёрная"; typeName = "Чёрная"
        itemId = "CtBlackPaintIt01"; effectId = "CtBlackPaintFx01"
        level = 10; price = 180
        img = "icons/magic/perception/silhouette-stealth-shadow.webp"
        effectText = "Тени и дым скрывают очертания существа. Оно получает состояние «скрыт»."
        rules = @(
            [ordered]@{
                key = "GrantItem"
                uuid = "Compendium.pf2e.conditionitems.Item.DmAIPqOBomZ7H95W"
                inMemoryOnly = $true
                onDeleteActions = [ordered]@{ grantee = "restrict" }
            }
        )
    },
    [ordered]@{
        key = "blue"; adjective = "синяя"; typeName = "Синяя"
        itemId = "CtBluePaintIt001"; effectId = "CtBluePaintFx001"
        level = 6; price = 45
        img = "icons/skills/movement/feet-winged-boots-blue.webp"
        effectText = "Существо получает бонус предмета +10 футов к наземной Скорости."
        rules = @(
            [ordered]@{
                key = "FlatModifier"
                selector = "land-speed"
                type = "item"
                value = 10
            }
        )
    },
    [ordered]@{
        key = "green"; adjective = "зелёная"; typeName = "Зелёная"
        itemId = "CtGreenPaintIt01"; effectId = "CtGreenPaintFx01"
        level = 10; price = 180
        img = "icons/magic/sonic/projectile-sound-rings-wave.webp"
        effectText = "Когда владелец использует «Гимн отваги», обычный бонус состояния, который он дарует себе и союзникам, равен +2 вместо +1. Краска не увеличивает бонус, уже равный +2 или выше."
        rules = @(
            [ordered]@{
                key = "Aura"
                radius = 60
                slug = "green-shoanti-war-paint"
                traits = @("auditory", "emotion", "mental")
                predicate = @("self:effect:courageous-anthem")
                effects = @(
                    [ordered]@{
                        affects = "allies"
                        events = @("enter", "turn-start")
                        includesSelf = $true
                        uuid = "Item.CtGreenAnthemFx1"
                    }
                )
            }
        )
    },
    [ordered]@{
        key = "orange"; adjective = "оранжевая"; typeName = "Оранжевая"
        itemId = "CtOrangePaintIt1"; effectId = "CtOrangePaintFx1"
        level = 6; price = 45
        img = "icons/magic/defensive/shield-barrier-flaming-diamond-orange.webp"
        effectText = "Существо получает сопротивление 3 физическому урону."
        rules = @(
            [ordered]@{
                key = "Resistance"
                type = "physical"
                value = 3
            }
        )
    },
    [ordered]@{
        key = "red"; adjective = "красная"; typeName = "Красная"
        itemId = "CtRedPaintIt0001"; effectId = "CtRedPaintFx0001"
        level = 10; price = 180
        img = "icons/magic/defensive/shield-barrier-flaming-pentagon-red.webp"
        effectText = "Существо получает сопротивление огню 10."
        rules = @(
            [ordered]@{
                key = "Resistance"
                type = "fire"
                value = 10
            }
        )
    },
    [ordered]@{
        key = "silver"; adjective = "серебряная"; typeName = "Серебряная"
        itemId = "CtSilverPaintIt1"; effectId = "CtSilverPaintFx1"
        level = 11; price = 400
        img = "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp"
        effectText = "Существо получает бонус состояния +1 к КБ."
        rules = @(
            [ordered]@{
                key = "FlatModifier"
                selector = "ac"
                type = "status"
                value = 1
            }
        )
    },
    [ordered]@{
        key = "white"; adjective = "белая"; typeName = "Белая"
        itemId = "CtWhitePaintIt01"; effectId = "CtWhitePaintFx01"
        level = 12; price = 400
        img = "icons/magic/holy/barrier-shield-winged-cross.webp"
        effectText = "Существо получает бонус предмета +2 к спасброскам против эффектов с признаками «пустота» или «смерть». Когда существо должно получить состояние «истощён», уменьшите его значение на 1, после чего эффект краски немедленно заканчивается."
        rules = @(
            [ordered]@{
                key = "FlatModifier"
                selector = "saving-throw"
                type = "item"
                value = 2
                predicate = @(
                    [ordered]@{
                        or = @(
                            "item:trait:void",
                            "item:trait:death"
                        )
                    }
                )
            },
            [ordered]@{
                key = "Note"
                selector = "saving-throw"
                title = "{item|name}"
                text = "Если эффект накладывает состояние «истощён», уменьшите его значение на 1 и удалите эффект белой боевой краски."
                predicate = @(
                    [ordered]@{
                        or = @(
                            "item:trait:void",
                            "item:trait:death"
                        )
                    }
                )
            }
        )
    },
    [ordered]@{
        key = "yellow"; adjective = "жёлтая"; typeName = "Жёлтая"
        itemId = "CtYellowPaintIt1"; effectId = "CtYellowPaintFx1"
        level = 9; price = 120
        img = "icons/magic/perception/eye-slit-orange.webp"
        effectText = "Существо получает бонус предмета +2 к проверкам Восприятия."
        rules = @(
            [ordered]@{
                key = "FlatModifier"
                selector = "perception"
                type = "item"
                value = 2
            }
        )
    }
)

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [object] $Data
    )

    $json = $Data | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, $utf8)
}

foreach ($paint in $paints) {
    if ($paint.itemId.Length -ne 16 -or $paint.effectId.Length -ne 16) {
        throw "Foundry ID должен содержать 16 символов: $($paint.key)"
    }

    $effectName = "Эффект: шоантийская боевая краска ($($paint.adjective))"
    $itemName = "Шоантийская боевая краска ($($paint.adjective))"
    $effectLink = "@UUID[Item.$($paint.effectId)]{$effectName}"
    $itemLink = "@UUID[Item.$($paint.itemId)]{$itemName}"

    $commonDescription = @"
<p><strong>Активация</strong> <span class="pf2-icon">3</span> Взаимодействие (воздействие)</p>
<p><strong>Требования</strong> Вы держите дозу краски и можете коснуться себя либо согласного существа в пределах досягаемости.</p>
<hr>
<p>Шоанти создали множество разновидностей магической боевой краски, помогающей охотникам, воинам и героям. Краску наносят на открытый участок тела — обычно на лицо, плечи, руки или ноги.</p>
<p>Существо может получать пользу только от одного цвета шоантийской боевой краски одновременно. Нанесение другого цвета немедленно прекращает предыдущий эффект. Одна доза действует <strong>1 час</strong>.</p>
<hr>
<p><strong>Цвет</strong> $($paint.typeName)</p>
<p>$($paint.effectText)</p>
<p><strong>Foundry</strong> После активации добавьте на окрашенное существо $effectLink. Перед этим удалите с него эффект боевой краски другого цвета.</p>
"@

    $effectDescription = @"
<p>Даруется предметом $itemLink.</p>
<p>$($paint.effectText)</p>
<p>Существо может получать пользу только от одного цвета шоантийской боевой краски одновременно. При нанесении другого цвета удалите этот эффект.</p>
"@

    $item = [ordered]@{
        _id = $paint.itemId
        name = $itemName
        type = "consumable"
        img = $paint.img
        system = [ordered]@{
            description = [ordered]@{
                gm = ""
                value = $commonDescription.Trim()
            }
            rules = @()
            slug = "shoanti-war-paint-$($paint.key)"
            _migration = [ordered]@{
                version = 0.959
                lastMigration = $null
            }
            traits = [ordered]@{
                otherTags = @("shoanti-war-paint")
                value = @("consumable", "magical")
                rarity = "uncommon"
            }
            publication = $publication
            level = [ordered]@{ value = $paint.level }
            quantity = 1
            baseItem = $null
            bulk = [ordered]@{ value = 0.1 }
            hp = [ordered]@{ value = 0; max = 0 }
            hardness = 0
            price = [ordered]@{ value = [ordered]@{ gp = $paint.price } }
            equipped = [ordered]@{ carryType = "worn"; handsHeld = 0 }
            containerId = $null
            size = "med"
            material = [ordered]@{ type = $null; grade = $null }
            identification = [ordered]@{
                status = "identified"
                unidentified = [ordered]@{
                    name = "Необычная краска"
                    img = "systems/pf2e/icons/unidentified_item_icons/other-consumables.webp"
                    data = [ordered]@{
                        description = [ordered]@{ value = "" }
                    }
                }
                misidentified = [ordered]@{}
            }
            category = "other"
            uses = [ordered]@{
                value = 1
                max = 1
                autoDestroy = $true
                per = $null
                autoUse = $true
            }
            damage = $null
            usage = [ordered]@{ value = "held-in-one-hand" }
            spell = $null
            activation = [ordered]@{
                type = "action"
                cost = 3
                condition = "Вы держите дозу краски и можете коснуться цели."
            }
            duration = [ordered]@{ value = 1; units = "hours" }
            target = [ordered]@{ value = 1; units = ""; type = "creature" }
            range = [ordered]@{ value = $null; long = $null; units = "touch" }
        }
        effects = @()
        flags = [ordered]@{
            "crimson-throne-xr0mi" = [ordered]@{
                source = "Shoanti War Paint"
                color = $paint.key
                effectId = $paint.effectId
                translated = $true
                remaster = $true
            }
        }
        folder = $null
        ownership = [ordered]@{ default = 0 }
    }

    $effect = [ordered]@{
        _id = $paint.effectId
        name = $effectName
        type = "effect"
        img = $paint.img
        system = [ordered]@{
            description = [ordered]@{
                gm = ""
                value = $effectDescription.Trim()
            }
            rules = @($paint.rules)
            slug = "effect-shoanti-war-paint-$($paint.key)"
            _migration = [ordered]@{
                version = 0.959
                lastMigration = $null
            }
            traits = [ordered]@{
                otherTags = @("shoanti-war-paint")
                value = @("magical")
                rarity = "uncommon"
            }
            publication = $publication
            level = [ordered]@{ value = $paint.level }
            duration = [ordered]@{
                value = 1
                unit = "hours"
                expiry = "turn-start"
                sustained = $false
            }
            tokenIcon = [ordered]@{ show = $true }
            unidentified = $false
            start = [ordered]@{ value = 0; initiative = $null }
            badge = $null
            fromSpell = $false
            context = $null
        }
        effects = @()
        flags = [ordered]@{
            "crimson-throne-xr0mi" = [ordered]@{
                source = "Shoanti War Paint"
                color = $paint.key
                itemId = $paint.itemId
                translated = $true
                remaster = $true
            }
        }
        folder = $null
        ownership = [ordered]@{ default = 0 }
    }

    Write-JsonFile -Path (Join-Path $outputDir "shoanti-war-paint-$($paint.key).item.json") -Data $item
    Write-JsonFile -Path (Join-Path $outputDir "effect-shoanti-war-paint-$($paint.key).effect.json") -Data $effect
}

$greenAnthemEffect = [ordered]@{
    _id = "CtGreenAnthemFx1"
    name = "Эффект: усиленный Гимн отваги"
    type = "effect"
    img = "icons/magic/sonic/projectile-sound-rings-wave.webp"
    system = [ordered]@{
        description = [ordered]@{
            gm = ""
            value = "<p>Даруется аурой зелёной шоантийской боевой краски, пока её владелец использует «Гимн отваги».</p><p>Обычный бонус состояния «Гимна отваги» равен +2 вместо +1. Более высокий бонус не изменяется.</p>"
        }
        rules = @(
            [ordered]@{
                key = "FlatModifier"
                selector = "attack-roll"
                type = "status"
                value = 2
            },
            [ordered]@{
                key = "FlatModifier"
                selector = "damage"
                type = "status"
                value = 2
            },
            [ordered]@{
                key = "FlatModifier"
                selector = "saving-throw"
                type = "status"
                value = 2
                predicate = @("item:trait:fear")
            }
        )
        slug = "effect-green-shoanti-war-paint-anthem"
        _migration = [ordered]@{
            version = 0.959
            lastMigration = $null
        }
        traits = [ordered]@{
            otherTags = @("shoanti-war-paint")
            value = @("auditory", "emotion", "mental", "magical")
            rarity = "uncommon"
        }
        publication = $publication
        level = [ordered]@{ value = 10 }
        duration = [ordered]@{
            value = -1
            unit = "unlimited"
            expiry = $null
            sustained = $false
        }
        tokenIcon = [ordered]@{ show = $true }
        unidentified = $false
        start = [ordered]@{ value = 0; initiative = $null }
        badge = $null
        fromSpell = $false
        context = $null
    }
    effects = @()
    flags = [ordered]@{
        "crimson-throne-xr0mi" = [ordered]@{
            source = "Shoanti War Paint"
            color = "green"
            auxiliary = $true
            translated = $true
            remaster = $true
        }
    }
    folder = $null
    ownership = [ordered]@{ default = 0 }
}
Write-JsonFile -Path (Join-Path $outputDir "effect-shoanti-war-paint-green-anthem.effect.json") -Data $greenAnthemEffect

$manifest = [ordered]@{
    name = "Шоантийские боевые краски"
    system = "PF2e Remaster"
    consumables = 8
    effects = 9
    notes = @(
        "Сначала импортируйте девять файлов эффектов, затем восемь расходуемых предметов.",
        "Каждая банка содержит одну дозу.",
        "Ссылка на основной эффект находится в описании соответствующего предмета.",
        "Дополнительный эффект усиленного Гимна отваги используется автоматизацией зелёной краски."
    )
}
Write-JsonFile -Path (Join-Path $outputDir "manifest.json") -Data $manifest

Write-Output "Создано 18 JSON-файлов в $outputDir"
