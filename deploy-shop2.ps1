# Deploy the shared code to SHOP 2 (the "shop" Pages project).
#
# Why this script exists: `wrangler pages deploy` only reads a file literally named
# `wrangler.toml` (it rejects `-c custom.toml`). So to deploy shop 2 with ITS OWN
# D1 / R2 / env bindings, we swap shop 2's config (wrangler_2.toml) in as wrangler.toml
# for the duration of the deploy, then always restore shop 1's wrangler.toml afterwards.
#
# Shop 1 deploys are unchanged:  wrangler pages deploy public --project-name bagshop

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Copy-Item wrangler.toml wrangler.toml.bak -Force
try {
    Copy-Item wrangler_2.toml wrangler.toml -Force
    wrangler pages deploy public --project-name shop
} finally {
    Move-Item wrangler.toml.bak wrangler.toml -Force
    Write-Host "Restored shop 1's wrangler.toml." -ForegroundColor Green
}
