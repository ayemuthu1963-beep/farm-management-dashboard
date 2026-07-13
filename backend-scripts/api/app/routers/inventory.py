from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg import Connection
from psycopg.errors import CheckViolation, ForeignKeyViolation, UniqueViolation

from app.auth import require_admin
from app.db import fetch_all, fetch_one, get_conn


router = APIRouter(dependencies=[Depends(require_admin)])


class CategoryCreate(BaseModel):
    category_name: str = Field(min_length=1)
    description: str | None = None


class SubcategoryCreate(BaseModel):
    category_id: int
    subcategory_name: str = Field(min_length=1)
    description: str | None = None


class ProductCreate(BaseModel):
    product_name: str = Field(min_length=1)
    original_product_name: str | None = None
    category_id: int
    subcategory_id: int
    base_unit: str
    reorder_level: Decimal | None = None
    expiry_required: bool = False
    remarks: str | None = None


class TransactionCreate(BaseModel):
    product_id: int
    transaction_date: date
    transaction_type: str
    quantity: Decimal = Field(gt=0)
    unit: str
    expiry_date: date | None = None
    batch_no: str | None = None
    supplier: str | None = None
    reference_no: str | None = None
    invoice_no: str | None = None
    purpose: str | None = None
    plot_zone: str | None = None
    crop: str | None = None
    remarks: str | None = None
    entered_by: str | None = None


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _handle_db_error(error: Exception) -> None:
    if isinstance(error, UniqueViolation):
        raise HTTPException(status_code=409, detail="Duplicate inventory record") from error
    if isinstance(error, CheckViolation):
        raise HTTPException(status_code=400, detail=str(error).splitlines()[0]) from error
    if isinstance(error, ForeignKeyViolation):
        raise HTTPException(status_code=400, detail="Invalid category, subcategory or product reference") from error
    raise error


@router.get("/dashboard")
def dashboard(
    limit: int = Query(200, ge=1, le=1000),
    conn: Connection = Depends(get_conn),
) -> dict:
    stock = fetch_all(
        conn,
        """
        select
          product_id,
          product_name,
          original_product_name,
          category_name,
          subcategory_name,
          base_unit,
          opening_stock,
          purchased,
          returned_in,
          used,
          wasted_expired,
          adjustment_in,
          adjustment_out,
          current_stock,
          latest_transaction_date,
          latest_transaction_created_at,
          nearest_unexpired_expiry_date,
          has_expired_lot_history,
          active
        from vw_inventory_stock_balance
        order by category_name, subcategory_name, product_name
        """,
    )
    transactions = fetch_all(
        conn,
        """
        select
          t.id,
          t.transaction_date,
          t.transaction_type,
          p.product_name,
          c.category_name,
          s.subcategory_name,
          t.quantity,
          t.unit,
          t.expiry_date,
          t.invoice_no,
          t.purpose,
          t.plot_zone,
          t.crop,
          t.remarks,
          t.source,
          t.created_at
        from inventory_transactions t
        join inventory_products p on p.id = t.product_id
        join inventory_categories c on c.id = p.category_id
        join inventory_subcategories s on s.id = p.subcategory_id
        order by t.transaction_date desc, t.created_at desc, t.id desc
        limit %s
        """,
        (limit,),
    )
    summary = fetch_one(
        conn,
        """
        select
          (select count(*)::integer from inventory_products where active = true) as total_products,
          (select count(*)::integer from inventory_transactions where transaction_type = 'OPENING_STOCK') as total_opening_stock_items,
          (select count(*)::integer from vw_inventory_stock_balance where has_expired_lot_history = true) as expired_products,
          (select count(*)::integer from vw_inventory_stock_balance where current_stock <= 0) as low_stock_items,
          (select count(*)::integer from inventory_transactions where transaction_type in ('PURCHASE', 'RETURN_IN', 'ADJUSTMENT_INCREASE')) as total_received_transactions,
          (select count(*)::integer from inventory_transactions where transaction_type in ('USAGE', 'WASTE_EXPIRED', 'ADJUSTMENT_DECREASE')) as total_used_transactions
        """,
    )
    return {"summary": summary, "stock": stock, "transactions": transactions}


@router.get("/master-data")
def master_data(conn: Connection = Depends(get_conn)) -> dict:
    categories = fetch_all(
        conn,
        """
        select id, category_name, active
        from inventory_categories
        where active = true
        order by category_name
        """,
    )
    subcategories = fetch_all(
        conn,
        """
        select
          s.id,
          s.category_id,
          c.category_name,
          s.subcategory_name,
          s.active
        from inventory_subcategories s
        join inventory_categories c on c.id = s.category_id
        where s.active = true
        order by c.category_name, s.subcategory_name
        """,
    )
    products = fetch_all(
        conn,
        """
        select
          p.id,
          p.product_name,
          p.original_product_name,
          p.category_id,
          c.category_name,
          p.subcategory_id,
          s.subcategory_name,
          p.base_unit,
          p.active,
          v.current_stock
        from inventory_products p
        join inventory_categories c on c.id = p.category_id
        join inventory_subcategories s on s.id = p.subcategory_id
        left join vw_inventory_stock_balance v on v.product_id = p.id
        where p.active = true
        order by c.category_name, s.subcategory_name, p.product_name
        """,
    )
    return {"categories": categories, "subcategories": subcategories, "products": products}


@router.post("/categories")
def create_category(payload: CategoryCreate, conn: Connection = Depends(get_conn)) -> dict:
    try:
        row = fetch_one(
            conn,
            """
            insert into inventory_categories (
              category_name,
              description,
              created_by,
              updated_by
            )
            values (%s, %s, %s, %s)
            returning id, category_name, active
            """,
            (_clean(payload.category_name), _clean(payload.description), "MFMS Web Admin", "MFMS Web Admin"),
        )
        conn.commit()
        return row
    except Exception as error:
        conn.rollback()
        _handle_db_error(error)
        raise


@router.post("/subcategories")
def create_subcategory(payload: SubcategoryCreate, conn: Connection = Depends(get_conn)) -> dict:
    try:
        row = fetch_one(
            conn,
            """
            insert into inventory_subcategories (
              category_id,
              subcategory_name,
              description,
              created_by,
              updated_by
            )
            values (%s, %s, %s, %s, %s)
            returning id, category_id, subcategory_name, active
            """,
            (
                payload.category_id,
                _clean(payload.subcategory_name),
                _clean(payload.description),
                "MFMS Web Admin",
                "MFMS Web Admin",
            ),
        )
        conn.commit()
        return row
    except Exception as error:
        conn.rollback()
        _handle_db_error(error)
        raise


@router.post("/products")
def create_product(payload: ProductCreate, conn: Connection = Depends(get_conn)) -> dict:
    try:
        row = fetch_one(
            conn,
            """
            insert into inventory_products (
              product_name,
              original_product_name,
              category_id,
              subcategory_id,
              base_unit,
              reorder_level,
              expiry_required,
              remarks,
              source,
              created_by,
              updated_by
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, 'Manual_Admin', %s, %s)
            returning id, product_name, category_id, subcategory_id, base_unit, active
            """,
            (
                _clean(payload.product_name),
                _clean(payload.original_product_name),
                payload.category_id,
                payload.subcategory_id,
                payload.base_unit,
                payload.reorder_level,
                payload.expiry_required,
                _clean(payload.remarks),
                "MFMS Web Admin",
                "MFMS Web Admin",
            ),
        )
        conn.commit()
        return row
    except Exception as error:
        conn.rollback()
        _handle_db_error(error)
        raise


@router.post("/transactions")
def create_transaction(payload: TransactionCreate, conn: Connection = Depends(get_conn)) -> dict:
    transaction_type = payload.transaction_type
    if transaction_type == "ADJUSTMENT":
        raise HTTPException(status_code=400, detail="Choose Adjustment In or Adjustment Out")

    try:
        row = fetch_one(
            conn,
            """
            insert into inventory_transactions (
              product_id,
              transaction_date,
              transaction_type,
              quantity,
              unit,
              expiry_date,
              batch_no,
              supplier,
              reference_no,
              invoice_no,
              purpose,
              plot_zone,
              crop,
              source,
              entered_by,
              remarks,
              created_by,
              updated_by
            )
            values (
              %s, %s, %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, 'Manual_Admin', %s, %s, %s, %s
            )
            returning id, product_id, transaction_date, transaction_type, quantity, unit
            """,
            (
                payload.product_id,
                payload.transaction_date,
                transaction_type,
                payload.quantity,
                payload.unit,
                payload.expiry_date,
                _clean(payload.batch_no),
                _clean(payload.supplier),
                _clean(payload.reference_no),
                _clean(payload.invoice_no),
                _clean(payload.purpose),
                _clean(payload.plot_zone),
                _clean(payload.crop),
                _clean(payload.entered_by) or "MFMS Web Admin",
                _clean(payload.remarks),
                "MFMS Web Admin",
                "MFMS Web Admin",
            ),
        )
        conn.commit()
        return row
    except Exception as error:
        conn.rollback()
        _handle_db_error(error)
        raise
