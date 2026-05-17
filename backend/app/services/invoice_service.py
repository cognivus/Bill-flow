"""
Invoice Service - Business Logic, Calculations & PDF Generation
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from io import BytesIO

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.models import Invoice, InvoiceItem, InvoiceStatus, PaymentStatus, Business, Customer, Product
from app.schemas.schemas import InvoiceCreate, InvoiceUpdate, InvoiceItemCreate


def round_decimal(value: Decimal, places: int = 2) -> Decimal:
    return value.quantize(Decimal(f"0.{'0' * places}"), rounding=ROUND_HALF_UP)


def calculate_item_totals(item: InvoiceItemCreate) -> dict:
    """Calculate all financial values for a single invoice item."""
    qty = Decimal(str(item.quantity))
    price = Decimal(str(item.unit_price))
    discount_pct = Decimal(str(item.discount_percentage))
    gst_pct = Decimal(str(item.gst_percentage))

    gross_amount = qty * price
    discount_amount = round_decimal(gross_amount * discount_pct / 100)
    taxable_amount = gross_amount - discount_amount

    if item.is_igst:
        igst_pct = gst_pct
        cgst_pct = Decimal("0.00")
        sgst_pct = Decimal("0.00")
    else:
        igst_pct = Decimal("0.00")
        cgst_pct = round_decimal(gst_pct / 2, 3)
        sgst_pct = round_decimal(gst_pct / 2, 3)

    igst_amount = round_decimal(taxable_amount * igst_pct / 100)
    cgst_amount = round_decimal(taxable_amount * cgst_pct / 100)
    sgst_amount = round_decimal(taxable_amount * sgst_pct / 100)
    tax_amount = igst_amount + cgst_amount + sgst_amount
    total_amount = taxable_amount + tax_amount

    return {
        "discount_amount": discount_amount,
        "taxable_amount": taxable_amount,
        "cgst_percentage": cgst_pct,
        "sgst_percentage": sgst_pct,
        "igst_percentage": igst_pct,
        "tax_amount": tax_amount,
        "cgst_amount": cgst_amount,
        "sgst_amount": sgst_amount,
        "igst_amount": igst_amount,
        "total_amount": total_amount,
    }


def calculate_invoice_totals(
    items_data: List[dict],
    discount_percentage: Decimal = Decimal("0"),
) -> dict:
    """Calculate invoice-level totals from item data."""
    subtotal = sum(d["taxable_amount"] for d in items_data)
    total_cgst = sum(d["cgst_amount"] for d in items_data)
    total_sgst = sum(d["sgst_amount"] for d in items_data)
    total_igst = sum(d["igst_amount"] for d in items_data)
    total_tax = total_cgst + total_sgst + total_igst

    invoice_discount = round_decimal(subtotal * discount_percentage / 100)
    grand_total = round_decimal(subtotal + total_tax - invoice_discount)

    return {
        "subtotal": round_decimal(subtotal),
        "cgst_amount": round_decimal(total_cgst),
        "sgst_amount": round_decimal(total_sgst),
        "igst_amount": round_decimal(total_igst),
        "total_tax": round_decimal(total_tax),
        "discount_amount": invoice_discount,
        "grand_total": grand_total,
    }


async def generate_invoice_number(db: AsyncSession, business: Business) -> str:
    """
    Generate sequential invoice number for business.
    Uses RETURNING to get the post-increment value atomically — prevents
    duplicate invoice numbers even under concurrent requests.
    """
    result = await db.execute(
        update(Business)
        .where(Business.id == business.id)
        .values(invoice_counter=Business.invoice_counter + 1)
        .returning(Business.invoice_counter)
    )
    counter = result.scalar_one()
    return f"{business.invoice_prefix}-{counter:04d}"


async def create_invoice(
    db: AsyncSession,
    business: Business,
    data: InvoiceCreate,
) -> Invoice:
    """Create invoice with items and calculated totals."""
    invoice_number = await generate_invoice_number(db, business)

    # Build items and calculate
    items_data = []
    for i, item in enumerate(data.items):
        calc = calculate_item_totals(item)
        items_data.append({**item.model_dump(), **calc, "sort_order": i})

    totals = calculate_invoice_totals(
        items_data,
        data.discount_percentage or Decimal("0"),
    )

    # Snapshot customer info
    customer_name = data.customer_name
    customer_email = data.customer_email
    customer_phone = data.customer_phone
    customer_address = data.customer_address
    customer_gst = data.customer_gst
    customer_id = data.customer_id

    if customer_id:
        result = await db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            customer_name = customer_name or customer.name
            customer_email = customer_email or customer.email
            customer_phone = customer_phone or customer.phone
            customer_address = customer_address or (
                ", ".join(filter(None, [customer.address_line1, customer.city, customer.state]))
            )
            customer_gst = customer_gst or customer.gst_number
    elif customer_name:
        # Auto-create customer if name provided but no ID selected
        new_customer = Customer(
            business_id=business.id,
            name=customer_name,
            email=customer_email,
            phone=customer_phone,
            gst_number=customer_gst,
            address_line1=customer_address,
            is_active=True
        )
        db.add(new_customer)
        await db.flush()
        customer_id = new_customer.id

    invoice = Invoice(
        business_id=business.id,
        customer_id=customer_id,
        invoice_number=invoice_number,
        status=data.status,
        payment_status=PaymentStatus.PENDING,
        invoice_date=data.invoice_date or datetime.now(timezone.utc),
        due_date=data.due_date,
        discount_percentage=data.discount_percentage or Decimal("0"),
        notes=data.notes,
        terms=data.terms or business.invoice_terms,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        customer_address=customer_address,
        customer_gst=customer_gst,
        **totals,
        amount_due=totals["grand_total"],
    )
    db.add(invoice)
    await db.flush()

    # Create items
    for item_data in items_data:
        is_igst = item_data.pop("is_igst", False)
        inv_item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item_data.get("product_id"),
            product_name=item_data["product_name"],
            product_description=item_data.get("product_description"),
            hsn_code=item_data.get("hsn_code"),
            unit=item_data.get("unit", "pcs"),
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            discount_percentage=item_data.get("discount_percentage", Decimal("0")),
            discount_amount=item_data["discount_amount"],
            taxable_amount=item_data["taxable_amount"],
            gst_percentage=item_data.get("gst_percentage", Decimal("0")),
            cgst_percentage=item_data["cgst_percentage"],
            sgst_percentage=item_data["sgst_percentage"],
            igst_percentage=item_data["igst_percentage"],
            tax_amount=item_data["tax_amount"],
            total_amount=item_data["total_amount"],
            sort_order=item_data["sort_order"],
        )
        db.add(inv_item)

    # Update customer stats
    if customer_id:
        await db.execute(
            update(Customer)
            .where(Customer.id == customer_id)
            .values(
                total_purchases=Customer.total_purchases + totals["grand_total"],
                invoice_count=Customer.invoice_count + 1,
            )
        )

    await db.flush()
    return invoice


# ─── PDF Generation ────────────────────────────────
def generate_invoice_pdf(invoice: Invoice, business: Business) -> bytes:
    """Generate PDF invoice using ReportLab."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable, Image
        )
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF generation library not installed. Run: pip install reportlab"
        )

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    brand_color = colors.HexColor("#0f172a")
    subtle_color = colors.HexColor("#64748b")
    accent_color = colors.HexColor("#2563eb")

    title_style = ParagraphStyle(
        "Title", parent=styles["Normal"],
        fontSize=20, textColor=brand_color, fontName="Helvetica-Bold",
        spaceAfter=2, leading=22
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=10, textColor=subtle_color, fontName="Helvetica"
    )
    header_label_style = ParagraphStyle(
        "HeaderLabel", parent=styles["Normal"],
        fontSize=8, textColor=subtle_color, fontName="Helvetica-Bold",
        spaceAfter=2
    )
    bold_style = ParagraphStyle(
        "Bold", parent=styles["Normal"],
        fontSize=10, fontName="Helvetica-Bold", textColor=brand_color
    )
    normal_style = ParagraphStyle(
        "Normal2", parent=styles["Normal"],
        fontSize=9, textColor=brand_color
    )
    footer_style = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=8, textColor=subtle_color, alignment=TA_CENTER
    )

    elements = []

    biz_addr = ", ".join(filter(None, [
        business.address_line1, business.city,
        business.state, business.pincode
    ]))

    logo_flowable = None
    if business.logo_url:
        try:
            import httpx
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(business.logo_url)
                if resp.status_code == 200:
                    logo_flowable = Image(BytesIO(resp.content), width=35*mm, height=35*mm)
                    logo_flowable.hAlign = 'LEFT'
        except Exception:
            logo_flowable = None

    biz_info_data = [[
        logo_flowable if logo_flowable else Spacer(1, 1),
        [
            Paragraph(business.name.upper(), title_style),
            Paragraph(biz_addr or "", subtitle_style),
            Paragraph(f"GSTIN: {business.gst_number or 'N/A'}", subtitle_style),
            Paragraph(f"Phone: {business.phone or ''}", subtitle_style),
        ]
    ]]
    biz_info_table = Table(biz_info_data, colWidths=[40*mm, 70*mm])
    biz_info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (1, 0), (1, 0), 10),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
    ]))

    header_data = [[
        biz_info_table,
        [
            Paragraph("TAX INVOICE", ParagraphStyle(
                "InvLabel", parent=styles["Normal"],
                fontSize=16, fontName="Helvetica-Bold",
                textColor=accent_color, alignment=TA_RIGHT,
                spaceAfter=4
            )),
            Paragraph(f"Invoice: {invoice.invoice_number}", ParagraphStyle(
                "InvNum", parent=styles["Normal"],
                fontSize=12, fontName="Helvetica-Bold",
                textColor=brand_color, alignment=TA_RIGHT
            )),
            Paragraph(f"Date: {invoice.invoice_date.strftime('%d %b %Y')}", ParagraphStyle(
                "InvDate", parent=styles["Normal"],
                fontSize=10, textColor=subtle_color, alignment=TA_RIGHT
            ))
        ]
    ]]

    header_table = Table(header_data, colWidths=[110 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
    ]))
    elements.append(header_table)

    invoice_meta = [
        [Paragraph("DATE", header_label_style), Paragraph(invoice.invoice_date.strftime('%d %b %Y'), bold_style)],
        [Paragraph("DUE DATE", header_label_style), Paragraph(invoice.due_date.strftime('%d %b %Y') if invoice.due_date else 'On Receipt', bold_style)],
        [Paragraph("STATUS", header_label_style), Paragraph(str(invoice.payment_status).upper(), bold_style)],
    ]

    meta_table = Table(invoice_meta, colWidths=[30 * mm, 40 * mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    bill_to = []
    if invoice.customer_name:
        bill_to = [
            Paragraph("BILL TO", header_label_style),
            Paragraph(invoice.customer_name, ParagraphStyle("CustName", parent=styles["Normal"], fontSize=14, fontName="Helvetica-Bold", textColor=brand_color)),
            Paragraph(invoice.customer_address or "", subtitle_style),
            Paragraph(f"GST: {invoice.customer_gst}" if invoice.customer_gst else "", subtitle_style),
            Paragraph(invoice.customer_phone or "", subtitle_style),
        ]

    details_data = [[bill_to, meta_table]]
    details_table = Table(details_data, colWidths=[110 * mm, 70 * mm])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
    ]))
    elements.append(details_table)

    col_headers = ["#", "DESCRIPTION", "HSN", "QTY", "RATE", "GST", "AMOUNT"]
    col_widths = [10 * mm, 75 * mm, 20 * mm, 15 * mm, 20 * mm, 15 * mm, 25 * mm]

    table_data = [col_headers]
    for i, item in enumerate(invoice.items, 1):
        table_data.append([
            str(i),
            Paragraph(item.product_name, normal_style),
            item.hsn_code or "-",
            str(item.quantity),
            f"{item.unit_price:,.2f}",
            f"{item.gst_percentage}%",
            f"{item.total_amount:,.2f}",
        ])

    item_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), subtle_color),
        ("LINEBELOW", (0, 0), (-1, 0), 1, brand_color),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
    ]))
    elements.append(item_table)

    totals_rows = [
        ["Subtotal", f"INR {invoice.subtotal:,.2f}"],
    ]
    if invoice.discount_amount > 0:
        totals_rows.append(["Discount", f"-INR {invoice.discount_amount:,.2f}"])

    gst_total = (invoice.cgst_amount or 0) + (invoice.sgst_amount or 0) + (invoice.igst_amount or 0)
    if gst_total > 0:
        totals_rows.append(["Tax (GST)", f"INR {gst_total:,.2f}"])

    totals_rows.append([
        Paragraph("GRAND TOTAL", bold_style),
        Paragraph(f"INR {invoice.grand_total:,.2f}", ParagraphStyle("TotalVal", parent=styles["Normal"], fontSize=18, fontName="Helvetica-Bold", textColor=accent_color, alignment=TA_RIGHT))
    ])

    totals_table = Table(totals_rows, colWidths=[130 * mm, 50 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -2), 9),
        ("TEXTCOLOR", (0, 0), (0, -2), subtle_color),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(Spacer(1, 10 * mm))
    elements.append(totals_table)

    elements.append(Spacer(1, 20 * mm))
    if invoice.notes or invoice.terms:
        elements.append(Paragraph("TERMS & NOTES", header_label_style))
        if invoice.notes:
            elements.append(Paragraph(invoice.notes, subtitle_style))
        if invoice.terms:
            elements.append(Paragraph(invoice.terms, subtitle_style))
        elements.append(Spacer(1, 10 * mm))

    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#f1f5f9")))
    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph("This is a computer generated invoice.", footer_style))
    elements.append(Paragraph("<b>by billflow</b>", footer_style))

    doc.build(elements)
    return buffer.getvalue()
