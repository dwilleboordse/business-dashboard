#!/usr/bin/env python3
"""
Convert a ClickUp CSV export into the dashboard's leads JSON.

Usage:
    python3 scripts/clickup_to_json.py [path-to-csv] [output.json]

Defaults:
    path-to-csv = ./clickup export.csv
    output.json = ./leads-import.json

Then in the dashboard click "Import leads" on the Leads tab and select the JSON.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# ClickUp status (lowercased) -> dashboard status
STATUS_MAP = {
    "closed": "Won",
    "lost": "Lost",
    "check in later": "Check in later",
    "proposal sent": "Proposal sent",
    "negotiating": "Negotiating",
}

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_clickup_date(s: str) -> str | None:
    """Parse ClickUp's verbose date strings into ISO yyyy-mm-dd.

    Examples handled:
      'Monday, April 20th 2026'
      'Tuesday, September 9th 2025, 11:38:00 am +04:00'
    """
    if not s:
        return None
    s = s.strip()
    # Strip ordinal suffix from day (1st, 2nd, 3rd, 4th -> 1, 2, 3, 4)
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", s, flags=re.IGNORECASE)

    # Pattern: 'Weekday, Month DD YYYY' (everything after that ignored)
    m = re.search(
        r"(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})",
        cleaned,
    )
    if not m:
        return None
    month_name, day_str, year_str = m.group(1).lower(), m.group(2), m.group(3)
    month = MONTHS.get(month_name)
    if not month:
        return None
    try:
        d = datetime(int(year_str), month, int(day_str))
        return d.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_number(s: str) -> float | None:
    if not s:
        return None
    try:
        return float(s.replace(",", "").strip())
    except ValueError:
        return None


def parse_labels(s: str) -> list[str]:
    """ClickUp serialises label fields as '[A, B, C]' or just 'A, B'."""
    if not s:
        return []
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    return [x.strip() for x in s.split(",") if x.strip()]


def parse_probability(s: str) -> float | None:
    """Probability % (number) — values like '50' or '50%'. Stored as 0..1."""
    if not s:
        return None
    s = s.strip().rstrip("%").strip()
    n = parse_number(s)
    if n is None:
        return None
    return n / 100 if n > 1 else n  # tolerate either '0.5' or '50'


def main():
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("clickup export.csv")
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("leads-import.json")

    if not csv_path.exists():
        print(f"Could not find {csv_path}", file=sys.stderr)
        sys.exit(1)

    leads: list[dict] = []

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        raw_rows = list(csv.reader(f))
    headers = raw_rows[0]
    # Find ALL indices for each header so duplicate headers (e.g. "Service/Product (labels)") merge.
    header_indices: dict[str, list[int]] = {}
    for i, h in enumerate(headers):
        header_indices.setdefault(h, []).append(i)

    def first_value(raw_row: list[str], header: str) -> str:
        for i in header_indices.get(header, []):
            v = raw_row[i] if i < len(raw_row) else ""
            if v and v.strip():
                return v
        return ""

    for raw_row in raw_rows[1:]:
        if not raw_row:
            continue
        row = {h: first_value(raw_row, h) for h in header_indices}
        raw_status = (row.get("Status") or "").strip().lower()
        status = STATUS_MAP.get(raw_status, "Check in later")

        name = (row.get("Task Name") or "").strip()
        if not name:
            continue

        # Notes: combine Latest Comment + Task Content (Task Content is usually just whitespace)
        note_parts = []
        lc = (row.get("Latest Comment") or "").strip()
        if lc:
            note_parts.append(lc)
        tc = (row.get("Task Content") or "").strip()
        if tc and tc not in ("\\n", ""):
            note_parts.append(tc)
        notes = "\n\n".join(note_parts)

        lead = {
            "id": (row.get("Task ID") or name).strip(),
            "name": name,
            "status": status,
            "value": parse_number(row.get("Deal Value (currency)") or ""),
            "probability": parse_probability(row.get("Probability % (number)") or ""),
            "source": (row.get("Deal Source (drop down)") or "").strip(),
            "contactName": (row.get("Contact Name (short text)") or "").strip(),
            "email": (row.get("Email (email)") or "").strip(),
            "phone": (row.get("Phone (phone)") or "").strip(),
            "performanceModel": (row.get("Performance model (short text)") or "").strip(),
            "services": parse_labels(row.get("Service/Product (labels)") or ""),
            "createdAt": parse_clickup_date(row.get("Date Created") or ""),
            "updatedAt": parse_clickup_date(row.get("Date Updated") or ""),
            "nextFollowUp": parse_clickup_date(row.get("Due Date") or ""),
            "closedAt": parse_clickup_date(row.get("Date Done") or "") or parse_clickup_date(row.get("Date Closed") or ""),
            "notes": notes,
        }
        leads.append(lead)

    # Output a payload the dashboard can import directly.
    payload = {"leads": leads}
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    # Summary
    print(f"Wrote {out_path}  ({len(leads)} leads)")
    from collections import Counter
    status_counts = Counter(l["status"] for l in leads)
    for s, c in status_counts.most_common():
        print(f"  {c:3d}  {s}")
    total_value = sum(l["value"] or 0 for l in leads if l["status"] not in ("Won", "Lost"))
    won_value = sum(l["value"] or 0 for l in leads if l["status"] == "Won")
    print(f"  Open pipeline: {total_value:,.0f} USD")
    print(f"  Won total:     {won_value:,.0f} USD")


if __name__ == "__main__":
    main()
