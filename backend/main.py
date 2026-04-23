from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="LoanLens API", version="1.0")

# ✅ Allow your frontend (localhost:3000) to call backend (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoanInput(BaseModel):
    principal: float = Field(..., ge=0)
    annual_interest_rate: float = Field(..., ge=0)
    tenure_months: int = Field(..., ge=1)
    processing_fee: float = Field(0, ge=0)
    monthly_income: float = Field(..., ge=0)
    existing_emi: float = Field(0, ge=0)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
def analyze(data: LoanInput):
    # Simple EMI formula: r = monthly rate, n = months
    P = data.principal
    r = (data.annual_interest_rate / 100) / 12
    n = data.tenure_months

    if r == 0:
        emi = P / n if n else 0
    else:
        emi = P * r * (1 + r) ** n / (((1 + r) ** n) - 1)

    total_payable = emi * n
    total_interest = max(0, total_payable - P)

    # Effective APR (very simple approximation including fee)
    # cost = principal + fee, repay = total_payable
    effective_apr = round(data.annual_interest_rate + (data.processing_fee / max(P, 1)) * 100, 2)

    # Basic risk rules (demo)
    total_emi_burden = emi + data.existing_emi
    dti = (total_emi_burden / data.monthly_income) if data.monthly_income > 0 else 1.0

    risk = "LOW"
    if dti > 0.5 or data.annual_interest_rate > 30:
        risk = "HIGH"
    elif dti > 0.35 or data.processing_fee > 0.05 * P:
        risk = "MEDIUM"

    flags = []
    flags.append({"type": "INFO", "msg": f"Debt-to-income is {round(dti*100,1)}% (includes existing EMI)."})
    if data.processing_fee > 0.05 * P:
        flags.append({"type": "MEDIUM", "msg": f"Processing fee is {round((data.processing_fee/P)*100,1)}% (seems high)."})
    if data.annual_interest_rate > 30:
        flags.append({"type": "HIGH", "msg": "Interest rate is very high for most retail loans."})

    return {
        "emi": round(emi, 2),
        "total_payable": round(total_payable, 2),
        "total_interest": round(total_interest, 2),
        "effective_apr": effective_apr,
        "risk": risk,
        "flags": flags,
    }
