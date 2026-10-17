param(
    [string]$RunLabel = ""
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$source = Join-Path $root "workspaces\m2-sympy-20228"
$revision = "c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d"
$seedPython = Join-Path $source ".venv\Scripts\python.exe"
$requirements = Join-Path $root "experiments\tasks\sympy__sympy-20228\evaluator\requirements-windows.txt"
$namePrefix = if ($RunLabel) { "m5-$RunLabel" } else { "m5" }
$targets = @(
    (Join-Path $root "workspaces\$namePrefix-b0-sympy-20228"),
    (Join-Path $root "workspaces\$namePrefix-b1-sympy-20228")
)

if (-not (Test-Path -LiteralPath $seedPython)) {
    throw "M2 seed Python is missing: $seedPython"
}

foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
        throw "Refusing to overwrite existing workspace: $target"
    }
    & git.exe clone --quiet --no-hardlinks $source $target
    if ($LASTEXITCODE -ne 0) { throw "git clone failed for $target" }
    & git.exe -C $target checkout --quiet --detach $revision
    if ($LASTEXITCODE -ne 0) { throw "git checkout failed for $target" }
    & $seedPython -m venv (Join-Path $target ".venv")
    if ($LASTEXITCODE -ne 0) { throw "venv creation failed for $target" }
    $python = Join-Path $target ".venv\Scripts\python.exe"
    & $python -m pip install --disable-pip-version-check --quiet -r $requirements
    if ($LASTEXITCODE -ne 0) { throw "dependency install failed for $target" }
    & $python -m pip install --disable-pip-version-check --quiet -e $target --no-deps
    if ($LASTEXITCODE -ne 0) { throw "editable install failed for $target" }
    $actualRevision = (& git.exe -C $target rev-parse HEAD).Trim()
    $status = & git.exe -C $target status --porcelain
    if ($actualRevision -ne $revision -or $status) {
        throw "Workspace verification failed for $target"
    }
    Write-Output "READY $target $actualRevision"
}
