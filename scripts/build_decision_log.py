from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "DECISION_LOG.pdf"

navy = colors.HexColor("#071B2F")
blue = colors.HexColor("#1769CF")
cyan = colors.HexColor("#12A8B4")
ink = colors.HexColor("#1D2939")
muted = colors.HexColor("#667085")
line = colors.HexColor("#DCE3EA")
soft = colors.HexColor("#F3F7FA")

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(navy)
    canvas.rect(0, h - 17*mm, w, 17*mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(18*mm, h - 10.7*mm, "SKYLARK  /  INTELLIGENCE")
    canvas.setFillColor(cyan)
    canvas.circle(w - 19*mm, h - 9*mm, 2.2*mm, stroke=0, fill=1)
    canvas.setStrokeColor(line)
    canvas.line(18*mm, 14*mm, w - 18*mm, 14*mm)
    canvas.setFillColor(muted)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18*mm, 9.5*mm, "Monday.com Business Intelligence Agent  |  Decision Log")
    canvas.drawRightString(w - 18*mm, 9.5*mm, f"{doc.page} / 2")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=24*mm, bottomMargin=18*mm, title="Skylark Intelligence Decision Log", author="Madhur Maru")

styles = getSampleStyleSheet()
title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=25, textColor=navy, alignment=TA_LEFT, spaceAfter=5*mm)
deck = ParagraphStyle("Deck", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=muted, spaceAfter=4*mm)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=blue, spaceBefore=2.5*mm, spaceAfter=1.5*mm)
body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.25, leading=11.3, textColor=ink, spaceAfter=1.7*mm)
bullet = ParagraphStyle("Bullet", parent=body, leftIndent=4*mm, firstLineIndent=-3*mm, bulletIndent=0, spaceAfter=1.1*mm)
callout = ParagraphStyle("Callout", parent=body, backColor=soft, borderColor=line, borderWidth=.5, borderPadding=8, leading=11.5, spaceBefore=2*mm, spaceAfter=3*mm)

story = [
    Spacer(1, 2*mm),
    Paragraph("Decision Log", title),
    Paragraph("Skylark Intelligence - a live, read-only executive decision-support layer over Deals and Work Orders in Monday.com.", deck),
    Paragraph("Product interpretation", h2),
    Paragraph("I interpreted the task as an executive decision-support layer rather than a general chatbot. A useful answer must state the result, explain why it matters, reveal its scope, and disclose data limitations. The optional <b>leadership updates</b> requirement became a first-class query intent: headline KPIs, concentration or movement, risks and caveats, and recommended follow-up actions. It uses the same live-board pipeline as ordinary questions; it is not a static report.", body),
    Paragraph("Key assumptions", h2),
]
assumptions = [
    "Monetary values are INR. Work-order headings explicitly say rupees; masked deal values are assumed to share the business reporting currency.",
    "Energy means Powerline + Renewables, and this interpretation is disclosed in the answer scope.",
    "Active pipeline means Open + On Hold. Won and Lost deals are excluded from forward pipeline.",
    "Weighted probability uses High 75%, Medium 50%, Low 25%. Missing probability uses a conservative 30% only for weighted metrics and is always flagged.",
    "This quarter is based on the server date, not the latest date in the dataset. Empty periods produce an honest zero-result answer.",
    "The masked exports lack a reliable universal deal-to-work-order key. Cross-board analysis is aggregate-based by sector, owner and date; no record-level relationship is fabricated.",
    "Imported Monday column titles retain recognizable meaning. Matching tolerates capitalization, punctuation and close aliases.",
]
story += [Paragraph(f"• {x}", bullet) for x in assumptions]
story += [
    Paragraph("Architecture and key decisions", h2),
    Paragraph("I chose <b>Next.js and TypeScript on Vercel</b> for a single deployable UI/API artifact, server-only secret handling and fast evaluation. Monday's GraphQL API was selected over MCP because the hosted prototype needs deterministic authentication and pagination without depending on an evaluator's MCP client. Access is read-only by implementation: only board and item queries exist.", body),
    Paragraph("The hybrid agent separates language from arithmetic. Hugging Face inference turns a question into a typed plan and explains supplied facts. A deterministic engine performs filtering and every financial or operational calculation. This lowers hallucination and token cost while making metrics testable. If inference fails, a heuristic planner and deterministic narrative preserve core BI availability.", callout),
    PageBreak(),
    Spacer(1, 2*mm),
    Paragraph("Data resilience", h2),
    Paragraph("Data is fetched dynamically for every question. The normalizer discovers columns from titles, standardizes dates, statuses and sectors, parses formatted numbers, retains suspicious values instead of silently correcting them, and attaches row-level quality flags. Responses surface the most material caveats plus board-level rows used and available.", body),
    Paragraph("Trade-offs", h2),
]
tradeoffs = [
    "<b>Freshness vs latency:</b> fetching both boards per question adds latency but guarantees current answers. For these small boards, freshness wins over a stale cache.",
    "<b>Transparency vs optimistic cleaning:</b> negative billing and blanks are retained and flagged. Silent imputation would create cleaner-looking but less defensible KPIs.",
    "<b>Personal token vs OAuth:</b> a personal token is fastest for a six-hour private prototype. It inherits the user's permissions, so scoped OAuth is the production path.",
    "<b>Model quality vs cost:</b> gpt-oss-120b via cheapest-provider routing is capable, while deterministic computation protects cost and continuity if credits are exhausted.",
    "<b>Flexible schema vs strict mapping:</b> semantic title matching tolerates messy imports. Production should add an admin mapping screen and persist verified column IDs.",
]
story += [Paragraph(f"• {x}", bullet) for x in tradeoffs]
story += [
    Paragraph("What I would do with more time", h2),
    Paragraph("Add OAuth and per-user authorization; encrypted connection management; a schema-mapping wizard; Redis caching invalidated by Monday webhooks; source-item drill-down links; time-series snapshots; saved questions; exportable leadership briefs; answer feedback and faithfulness evals; and observability for latency, token cost and API complexity. I would validate metric definitions with Finance and Sales leadership and introduce record-level joins once a stable shared deal ID exists.", body),
    Paragraph("Leadership update interpretation", h2),
    Paragraph("A leadership update is a decision artifact, not a longer chat response. It should be brief enough to paste into a weekly founder review and consistently answer four questions: <b>What changed? What is the commercial position? What is at risk? What action is required?</b> The prototype builds it from the same deterministic KPI layer so leadership language cannot drift away from reported numbers.", callout),
    Paragraph("Evaluation focus", h2),
    Paragraph("Judge the prototype on live-data grounding, resilience to missing fields, honest caveats, repeatability of metrics, conversational usefulness, and whether an executive can move from question to decision without asking an analyst to prepare another spreadsheet.", body),
]

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
