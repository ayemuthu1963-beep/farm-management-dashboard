select
    (select count(*) from inventory_products) as product_count,
    (select count(*) from inventory_transactions where transaction_type = 'OPENING_STOCK') as opening_stock_transactions,
    (select count(*) from inventory_products p left join inventory_transactions t on t.product_id = p.id where t.id is null) as zero_stock_products,
    (select count(*) from vw_inventory_stock_balance where has_expired_lot_history = true) as expired_products,
    (select count(*) from inventory_products p where not exists (
        select 1
        from inventory_transactions t
        where t.product_id = p.id
          and t.expiry_date is not null
    )) as products_with_missing_expiry_dates,
    (select count(*) from (
        select source, source_reference, count(*)
        from inventory_products
        where source_reference is not null
        group by source, source_reference
        having count(*) > 1
        union all
        select source, source_reference, count(*)
        from inventory_transactions
        where source_reference is not null
        group by source, source_reference
        having count(*) > 1
    ) d) as duplicate_source_references,
    (select count(*) from vw_inventory_stock_balance where current_stock < 0) as negative_balances,
    (select count(*) from inventory_products where product_name in ('Grosure Insecticide', 'Grosure NPK Fertiliser')) as grosure_product_count,
    (select count(*)
     from inventory_products p
     join inventory_transactions t on t.product_id = p.id
     where p.product_name = 'Grosure NPK Fertiliser'
       and t.expiry_date = date '2031-03-01') as grosure_npk_2031_expiry_count;

select
    p.product_name,
    p.base_unit,
    v.current_stock,
    coalesce(t.quantity, 0) as approved_opening_quantity,
    v.current_stock - coalesce(t.quantity, 0) as difference
from inventory_products p
join vw_inventory_stock_balance v
  on v.product_id = p.id
left join inventory_transactions t
  on t.product_id = p.id
 and t.transaction_type = 'OPENING_STOCK'
where v.current_stock <> coalesce(t.quantity, 0)
order by p.product_name;

select
    p.product_name,
    p.original_product_name,
    c.category_name,
    s.subcategory_name,
    p.base_unit,
    v.current_stock,
    t.expiry_date
from inventory_products p
join inventory_categories c on c.id = p.category_id
join inventory_subcategories s on s.id = p.subcategory_id
left join inventory_transactions t on t.product_id = p.id
left join vw_inventory_stock_balance v on v.product_id = p.id
where p.product_name like 'Grosure%'
order by p.product_name;

