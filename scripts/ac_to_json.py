#!/usr/bin/env python3
"""
Convert an ActiveCampaign 'All Campaigns Performance Report' CSV into a JSON
file that the dashboard's Emails tab can import.

Usage:
    python3 scripts/ac_to_json.py [path-to-csv] [output.json]

Defaults:
    path-to-csv = ./Campaign performance ytd.csv
    output.json = ./email-campaigns-import.json

The output is a list of EmailEntry-shaped objects; the in-app importer accepts
this format. (Direct CSV upload also works — this script is mainly for
inspection / scripted workflows.)
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def num(s):
    if s is None:
        return None
    s = s.strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main():
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("Campaign performance ytd.csv")
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("email-campaigns-import.json")

    if not csv_path.exists():
        print(f"Could not find {csv_path}", file=sys.stderr)
        sys.exit(1)

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    # Find the campaign data header.
    header_idx = next((i for i, r in enumerate(rows) if r and r[0].strip() == "Campaign Name"), None)
    if header_idx is None:
        print("Could not find 'Campaign Name' header — is this an AC campaign report export?", file=sys.stderr)
        sys.exit(1)

    headers = rows[header_idx]
    col = {h.strip().lower(): i for i, h in enumerate(headers)}

    def get(row, header):
        i = col.get(header.lower())
        return row[i] if i is not None and i < len(row) else ""

    entries = []
    for row in rows[header_idx + 1:]:
        if not row or not row[0].strip():
            continue

        subject = get(row, "Subject").strip() or get(row, "Campaign Name").strip()
        if not subject:
            continue

        sent = get(row, "Sent Date").strip()
        date = sent[:10]
        if len(date) != 10 or date[4] != "-" or date[7] != "-":
            continue

        open_pct = num(get(row, "Open Rate"))
        click_pct = num(get(row, "Click Rate"))
        unsubs = num(get(row, "Unsubscribes"))

        entries.append({
            "date": date,
            "name": subject,
            # AC reports rates as percentage numbers; store as 0..1.
            "openPct": open_pct / 100 if open_pct is not None else None,
            "clickPct": click_pct / 100 if click_pct is not None else None,
            "unsubs": unsubs,
            "revenue": None,
            "link": "",
        })

    out_path.write_text(json.dumps({"entries": entries}, indent=2, ensure_ascii=False))

    by_month = Counter(MONTHS[int(e["date"][5:7]) - 1] for e in entries)
    print(f"Wrote {out_path}  ({len(entries)} campaigns)")
    for m in MONTHS:
        if by_month[m]:
            print(f"  {m}: {by_month[m]}")


if __name__ == "__main__":
    main()
