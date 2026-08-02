# monitor.ps1 - wrapper da tarefa agendada do DJEN.
#
# ASCII PURO, sem acento e sem travessao: o arquivo nao tem BOM e o PowerShell 5.1
# le arquivo sem BOM como ANSI. O byte final do travessao "-" vira aspa curva, que
# o PS aceita como delimitador de string e o parser quebra no meio de um literal.
#
# Roda o monitor, alerta se houver intimacao nova e registra falha quando o DJEN
# esta fora do ar. A fonte da verdade e a fila em monitor/PENDENTES.md, NAO este
# popup: popup so aparece com sessao interativa aberta e some ao ser fechado.
#
# RETENTATIVA: a tarefa agendada dispara de 30 em 30 min ao longo do dia, mas o
# trabalho e UMA vez por dia. Quem decide se ha o que fazer e o last_ok.json, nao
# o agendador: se ja houve sucesso hoje, o tique sai sem tocar em nada; se nao
# houve, este tique E a retentativa da falha anterior. Insistir ate recuperar so
# funciona porque a execucao do monitor.js e atomica - em caso de erro nada e
# gravado, entao a execucao seguinte refaz a janela inteira sem perder intimacao.
#
# Caminhos derivados de $PSScriptRoot - nao ha caminho absoluto (PRD F7).
# Codigos do monitor.js: 0 = nada novo | 10 = ha novas | 1 = erro.
#
#   -Forcar  ignora o sucesso do dia e roda assim mesmo (teste manual).

param([switch]$Forcar)

$ErrorActionPreference = "Continue"
$Monitor   = Join-Path $PSScriptRoot "monitor.js"
$DirEstado = Join-Path (Split-Path $PSScriptRoot -Parent) "monitor"
$Fila      = Join-Path $DirEstado "PENDENTES.md"
$LogErros  = Join-Path $DirEstado "erros.log"
$LastOk    = Join-Path $DirEstado "last_ok.json"
$Falhas    = Join-Path $DirEstado "falhas.json"

function Registrar($texto) {
    Add-Content -Path $LogErros -Encoding utf8 -Value "[$(Get-Date -Format o)] $texto"
}

# --- Ja houve sucesso hoje? --------------------------------------------------
# RoundtripKind para o "Z" do ISO ser lido como UTC em qualquer cultura; sem isso
# a comparacao de data erraria por fuso e a retentativa nunca dispararia.
$UltimoSucesso = $null
if (Test-Path $LastOk) {
    try {
        $ts = (Get-Content $LastOk -Raw | ConvertFrom-Json).timestamp
        $UltimoSucesso = [datetime]::Parse(
            $ts, [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind).ToLocalTime()
    } catch { $UltimoSucesso = $null }
}

if (-not $Forcar -and $UltimoSucesso -and $UltimoSucesso.Date -eq (Get-Date).Date) {
    exit 0   # ja recuperado hoje - tique de retentativa nao tem o que fazer
}

# Estado de falha: escrito so quando ha falha em aberto. E ele, e nao a existencia
# do erros.log (que guarda historico), que diz se este tique e uma retentativa.
$FalhaAberta = $null
if (Test-Path $Falhas) {
    try { $FalhaAberta = Get-Content $Falhas -Raw | ConvertFrom-Json } catch { $FalhaAberta = $null }
}

# --- Execucao ----------------------------------------------------------------
$saida = & node $Monitor --dias 10 2>&1 | Out-String
$codigo = $LASTEXITCODE

if ($codigo -eq 0 -or $codigo -eq 10) {
    if ($FalhaAberta) {
        Registrar "RECUPERADO apos $($FalhaAberta.tentativas) tentativa(s) - primeira falha em $($FalhaAberta.desde)."
        Remove-Item $Falhas -Force -ErrorAction SilentlyContinue
    }
}
else {
    $tentativas = 1
    $desde = (Get-Date -Format o)
    if ($FalhaAberta) {
        $tentativas = [int]$FalhaAberta.tentativas + 1
        $desde = $FalhaAberta.desde
    }
    @{ desde = $desde; tentativas = $tentativas; ultimo_erro = $saida.Trim() } |
        ConvertTo-Json | Set-Content -Path $Falhas -Encoding utf8

    Registrar "exit=$codigo (tentativa $tentativas) $saida"
    Registrar "Sem sucesso hoje - nova tentativa no proximo tique (30 min)."
    # Sem escrita em last_ok.json, o hook SessionStart avisa na proxima sessao
    # que o monitor esta parado ha mais de 36 h.
    exit 1
}

if ($codigo -eq 10) {
    $abertas = 0
    if (Test-Path $Fila) {
        $abertas = @(Select-String -Path $Fila -Pattern '^\| ABERTA ').Count
    }
    $msg = "Ha INTIMACOES NOVAS no DJEN.`n`n" +
           "Fila com $abertas item(ns) em aberto:`n$Fila`n`n" +
           "A data fatal na fila e REFERENCIA (15 dias uteis). Confira o prazo do ato " +
           "e o calendario do tribunal antes de protocolar."
    # Timeout de 5 min: popup sem timeout trava o processo ate alguem fechar, e a
    # tarefa acaba morta pelo ExecutionTimeLimit - o que polui o LastTaskResult e
    # esconde falha de verdade no diagnostico. A fila continua sendo o registro.
    $wsh = New-Object -ComObject WScript.Shell
    [void]$wsh.Popup($msg, 300, "PMA - Monitor DJEN", 48)
}

exit 0
