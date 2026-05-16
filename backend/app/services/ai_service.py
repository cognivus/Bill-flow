"""
AI Service — Future Integration Layer
Prepared for: LangChain, LangGraph, OCR, WhatsApp

To activate:
    1. pip install langchain langchain-openai langgraph
    2. Set OPENAI_API_KEY in .env
    3. Uncomment the implementations below
"""
from typing import Optional, Dict, Any
from app.core.config import settings


# ─── OCR Invoice Scanning ─────────────────────────────────
async def extract_invoice_from_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    OCR + LLM to extract invoice data from uploaded image.
    
    Future implementation:
        from langchain_openai import ChatOpenAI
        from langchain.schema import HumanMessage
        import base64
        
        model = ChatOpenAI(model="gpt-4-vision-preview", api_key=settings.OPENAI_API_KEY)
        b64 = base64.b64encode(image_bytes).decode()
        
        response = await model.ainvoke([
            HumanMessage(content=[
                {"type": "text", "text": "Extract invoice data as JSON: {items, customer, total, date}"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ])
        ])
        return parse_invoice_json(response.content)
    """
    return {"status": "not_implemented", "message": "OCR coming soon"}


# ─── Smart Payment Reminders ──────────────────────────────
async def generate_payment_reminder(
    customer_name: str,
    invoice_number: str,
    amount_due: str,
    days_overdue: int,
    business_name: str,
) -> str:
    """
    Generate personalized payment reminder using LLM.
    
    Future implementation:
        from langchain_openai import ChatOpenAI
        from langchain.prompts import ChatPromptTemplate
        
        prompt = ChatPromptTemplate.from_template(
            "Write a professional but friendly payment reminder for {customer_name}. "
            "Invoice: {invoice_number}, Amount: ₹{amount_due}, {days_overdue} days overdue. "
            "Business: {business_name}. Keep it under 100 words."
        )
        chain = prompt | ChatOpenAI(model="gpt-3.5-turbo", api_key=settings.OPENAI_API_KEY)
        result = await chain.ainvoke({...})
        return result.content
    """
    return (
        f"Dear {customer_name},\n\n"
        f"This is a friendly reminder that invoice {invoice_number} "
        f"for ₹{amount_due} is {days_overdue} days overdue.\n\n"
        f"Please arrange payment at your earliest convenience.\n\n"
        f"Regards,\n{business_name}"
    )


# ─── Invoice Insights (LangGraph Agent) ──────────────────
async def analyze_business_performance(
    revenue_data: list,
    invoice_data: list,
) -> Dict[str, Any]:
    """
    LangGraph agent for business insights.
    
    Future implementation using LangGraph:
        from langgraph.graph import StateGraph
        # Multi-step analysis: trend detection → anomaly detection → recommendations
    """
    return {
        "status": "not_implemented",
        "message": "AI analytics coming in next release",
        "roadmap": [
            "Revenue trend analysis",
            "Customer churn prediction",
            "Seasonal demand forecasting",
            "Smart pricing suggestions",
        ]
    }


# ─── WhatsApp Integration ─────────────────────────────────
async def send_whatsapp_invoice(
    phone_number: str,
    customer_name: str,
    invoice_number: str,
    amount: str,
    pdf_url: str,
    business_name: str,
) -> bool:
    """
    Send invoice via WhatsApp Business API.
    
    Future implementation:
        import httpx
        
        headers = {"Authorization": f"Bearer {settings.WHATSAPP_API_KEY}"}
        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "template",
            "template": {
                "name": "invoice_notification",
                "language": {"code": "en"},
                "components": [
                    {"type": "body", "parameters": [
                        {"type": "text", "text": customer_name},
                        {"type": "text", "text": invoice_number},
                        {"type": "text", "text": f"₹{amount}"},
                        {"type": "text", "text": business_name},
                    ]},
                    {"type": "button", "sub_type": "url", "index": "0",
                     "parameters": [{"type": "text", "text": pdf_url}]},
                ]
            }
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://graph.facebook.com/v17.0/YOUR_PHONE_ID/messages",
                json=payload, headers=headers
            )
            return res.status_code == 200
    """
    if not settings.WHATSAPP_API_KEY:
        return False
    # Placeholder
    return False
