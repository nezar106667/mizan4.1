/*
# Revoke anon role CRUD grants and EXECUTE on SECURITY DEFINER functions

## Purpose
The anon role had full INSERT/UPDATE/DELETE grants on every table.
If an RLS policy ever failed, an unauthenticated request could modify data.
This migration revokes all write privileges from anon on application tables.
It also revokes EXECUTE on all SECURITY DEFINER functions from anon, then
re-grants only email_for_username (needed for the login flow).

## Changes
1. REVOKE INSERT, UPDATE, DELETE on all application tables from anon.
2. REVOKE EXECUTE on all SECURITY DEFINER functions from anon.
3. GRANT EXECUTE on email_for_username to anon (login flow needs it).

## Security Impact
- anon can still SELECT (RLS policies control row visibility).
- anon can no longer INSERT/UPDATE/DELETE on any table.
- anon can no longer call SECURITY DEFINER functions except email_for_username.
- authenticated role privileges are unchanged.
*/

REVOKE INSERT, UPDATE, DELETE ON tenants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON customers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON device_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON water_readings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON water_bills FROM anon;
REVOKE INSERT, UPDATE, DELETE ON payments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON production_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON tenancy_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON tariffs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON tariff_tiers FROM anon;

-- Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION email_for_username(text) FROM anon;
REVOKE EXECUTE ON FUNCTION reject_reading(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION approve_reading(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION approve_payment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION reject_payment(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION issue_bill_for_reading(water_readings) FROM anon;
REVOKE EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION recalc_customer_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION price_consumption(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION register_device_slot(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION has_tenant_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon;

-- Re-grant email_for_username to anon: login page resolves username -> email
-- before calling supabase.auth.signInWithPassword. Returns only email string.
GRANT EXECUTE ON FUNCTION email_for_username(text) TO anon;
