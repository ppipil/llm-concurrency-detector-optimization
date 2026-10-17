$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repository = "https://github.com/sympy/sympy.git"
$revision = "8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6"
$seed = Join-Path $root "workspaces\m5d-seed-sympy-21391"
$requirements = Join-Path $root "experiments\tasks\sympy__sympy-21391\evaluator\requirements-windows.txt"
$bootstrapPython = Join-Path $root "workspaces\m2-sympy-20228\.venv\Scripts\python.exe"
$targets = @(
    (Join-Path $root "workspaces\m5d-b0-sympy-21391"),
    (Join-Path $root "workspaces\m5d-b1-sympy-21391")
)

if (-not (Test-Path -LiteralPath $seed)) {
    & git.exe clone --quiet --filter=blob:none --no-checkout $repository $seed
    if ($LASTEXITCODE -ne 0) { throw "git clone failed for $seed" }
    & git.exe -C $seed fetch --quiet --depth 1 origin $revision
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed for $revision" }
    & git.exe -C $seed checkout --quiet --detach $revision
    if ($LASTEXITCODE -ne 0) { throw "git checkout failed for $seed" }
}

$seedRevision = (& git.exe -C $seed rev-parse HEAD).Trim()
if ($seedRevision -ne $revision) { throw "Unexpected seed revision: $seedRevision" }

foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
        $existingRevision = (& git.exe -C $target rev-parse HEAD).Trim()
        $existingStatus = & git.exe -C $target status --porcelain
        if ($existingRevision -ne $revision -or $existingStatus) {
            throw "Refusing to reuse non-clean or unexpected workspace: $target"
        }
    }
    else {
        & git.exe -C $seed worktree add --quiet --detach $target $revision
        if ($LASTEXITCODE -ne 0) { throw "git worktree creation failed for $target" }
    }
    $python = Join-Path $target ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        & $bootstrapPython -m venv (Join-Path $target ".venv")
        if ($LASTEXITCODE -ne 0) { throw "venv creation failed for $target" }
    }
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
