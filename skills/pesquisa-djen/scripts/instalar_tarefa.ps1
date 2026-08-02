# instalar_tarefa.ps1 — registra (ou reinstala) a vigília diária do DJEN.
#
# PRD F5.2. Usa Register-ScheduledTask e NÃO schtasks: só assim se consegue
# -StartWhenAvailable, sem o qual a tarefa é simplesmente PERDIDA quando a
# máquina está desligada no horário — que é o modo normal de uma máquina pessoal.
#
# Idempotente: rodar de novo substitui o registro. Reinstalável após formatação.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File instalar_tarefa.ps1
#   powershell ... -File instalar_tarefa.ps1 -Hora 08:10
#   powershell ... -File instalar_tarefa.ps1 -Remover

param(
    [string]$Hora = "08:10",
    [int]$RetentativaMin = 30,
    [int]$RetentativaHoras = 12,
    [switch]$Remover
)

$ErrorActionPreference = "Stop"
$NomeTarefa = "PMA_DJEN_Monitor"
$Wrapper = Join-Path $PSScriptRoot "monitor.ps1"

if ($Remover) {
    try {
        Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false -ErrorAction Stop
        "Tarefa '$NomeTarefa' removida."
    } catch {
        "Tarefa '$NomeTarefa' nao estava registrada."
    }
    exit 0
}

if (-not (Test-Path $Wrapper)) { throw "Wrapper nao encontrado: $Wrapper" }

$acao = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Wrapper`""

# O gatilho e diario, mas repete de $RetentativaMin em $RetentativaMin minutos por
# $RetentativaHoras. Nao e para consultar o DJEN varias vezes ao dia: o wrapper sai
# na hora quando ja houve sucesso hoje. E para que a falha de rede das 08:10 tenha
# uma nova chance as 08:40, e assim ate recuperar — sem isso, DJEN fora do ar de
# manha significava fila desatualizada o dia inteiro, com prazo correndo.
#
# Repetition e copiado de um gatilho -Once porque New-ScheduledTaskTrigger nao
# aceita -RepetitionInterval junto com -Daily.
$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
$modelo  = New-ScheduledTaskTrigger -Once -At $Hora `
    -RepetitionInterval (New-TimeSpan -Minutes $RetentativaMin) `
    -RepetitionDuration (New-TimeSpan -Hours $RetentativaHoras)
$gatilho.Repetition = $modelo.Repetition

# O ponto inteiro desta frente: StartWhenAvailable faz a tarefa rodar assim que a
# maquina liga, se o horario passou com ela desligada. DontStopIfGoingOnBatteries
# e AllowStartIfOnBatteries evitam que o notebook na bateria pule a execucao.
$config = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $NomeTarefa `
    -Action $acao `
    -Trigger $gatilho `
    -Settings $config `
    -Description "Vigia de intimacoes no DJEN para as OABs em perfil/advogados.json. Escreve a fila em skills/pesquisa-djen/monitor/PENDENTES.md." `
    -Force | Out-Null

$t = Get-ScheduledTask -TaskName $NomeTarefa
"Tarefa registrada: $($t.TaskName)"
"  estado          : $($t.State)"
"  horario         : $Hora (diario)"
"  retentativa     : a cada $RetentativaMin min por ate $RetentativaHoras h (so age se o dia ainda nao teve sucesso)"
"  roda se atrasada: $($t.Settings.StartWhenAvailable)"
"  na bateria      : $($t.Settings.DontStopIfGoingOnBatteries)"
""
"Testar agora:  Start-ScheduledTask -TaskName $NomeTarefa"
"Remover:       powershell -File instalar_tarefa.ps1 -Remover"
