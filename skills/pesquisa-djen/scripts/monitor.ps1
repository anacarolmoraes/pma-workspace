# monitor.ps1 — wrapper da tarefa agendada do DJEN.
#
# Roda o monitor, alerta se houver intimacao nova e registra falha quando o DJEN
# esta fora do ar. A fonte da verdade e a fila em monitor/PENDENTES.md, NAO este
# popup: popup so aparece com sessao interativa aberta e some ao ser fechado.
#
# Caminhos derivados de $PSScriptRoot — nao ha caminho absoluto (PRD F7).
# Codigos do monitor.js: 0 = nada novo | 10 = ha novas | 1 = erro.

$ErrorActionPreference = "Continue"
$Monitor   = Join-Path $PSScriptRoot "monitor.js"
$DirEstado = Join-Path (Split-Path $PSScriptRoot -Parent) "monitor"
$Fila      = Join-Path $DirEstado "PENDENTES.md"
$LogErros  = Join-Path $DirEstado "erros.log"

$saida = & node $Monitor --dias 10 2>&1 | Out-String
$codigo = $LASTEXITCODE

if ($codigo -eq 10) {
    $abertas = 0
    if (Test-Path $Fila) {
        $abertas = @(Select-String -Path $Fila -Pattern '^\| ABERTA ').Count
    }
    $msg = "Ha INTIMACOES NOVAS no DJEN.`n`n" +
           "Fila com $abertas item(ns) em aberto:`n$Fila`n`n" +
           "A data fatal na fila e REFERENCIA (15 dias uteis). Confira o prazo do ato " +
           "e o calendario do tribunal antes de protocolar."
    $wsh = New-Object -ComObject WScript.Shell
    [void]$wsh.Popup($msg, 0, "PMA - Monitor DJEN", 48)
}
elseif ($codigo -ne 0) {
    Add-Content -Path $LogErros -Value "[$(Get-Date -Format o)] exit=$codigo $saida" -Encoding utf8
    # Sem escrita em last_ok.json, o hook SessionStart avisa na proxima sessao
    # que o monitor esta parado ha mais de 36 h.
}
