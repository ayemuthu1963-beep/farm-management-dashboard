-- Rollback for MFMS Inventory schema foundation.
--
-- This removes only objects created by create_inventory_schema.sql.
-- Run only if the inventory migration has been applied and must be reversed.
-- It will drop inventory ledger/master data if data exists.

begin;

drop view if exists vw_inventory_stock_balance;

drop trigger if exists trg_inventory_transactions_no_negative_stock
    on inventory_transactions;

drop trigger if exists trg_inventory_transactions_validate_master_data
    on inventory_transactions;

drop trigger if exists trg_inventory_transactions_set_updated_at
    on inventory_transactions;

drop trigger if exists trg_inventory_products_set_updated_at
    on inventory_products;

drop trigger if exists trg_inventory_subcategories_set_updated_at
    on inventory_subcategories;

drop trigger if exists trg_inventory_categories_set_updated_at
    on inventory_categories;

drop function if exists inventory_prevent_negative_stock();
drop function if exists inventory_validate_transaction_master_data();
drop function if exists inventory_set_updated_at();

drop table if exists inventory_transactions;
drop table if exists inventory_products;
drop table if exists inventory_subcategories;
drop table if exists inventory_categories;

commit;
