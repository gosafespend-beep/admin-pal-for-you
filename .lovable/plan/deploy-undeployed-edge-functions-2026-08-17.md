# Deploy Undeployed Edge Functions

## Goal
Deploy all edge functions that exist in the project but are not yet deployed to the connected Supabase project.

## Current State
- Edge functions directory contains: `admin-analytics`, `admin-audit-log`, `admin-blog`, `admin-settings`, `admin-stats`, `admin-subscriptions`, `admin-transactions`, `admin-user-actions`, `admin-user-detail`, `admin-user-notes`, `admin-users`, `admin-waitlist`
- All functions are configured in `supabase/config.toml` with `verify_jwt = false`
- Supabase CLI is not available in the sandbox, so deployment will use the Lovable deployment tool

## Plan
1. Verify the list of edge functions in `supabase/functions/`
2. Deploy all project edge functions to the connected Supabase project
3. Confirm deployment completes without errors

## Technical Notes
- Deploying an already-deployed function will update it to the current code version, which is safe
- Functions use the shared `_shared/guard.ts` module for CORS and auth checks
- The Supabase project ref is `qeogqvjqvafbzufanwki`
