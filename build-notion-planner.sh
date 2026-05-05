#!/bin/bash

# Bheekun Family Financial Planner - Notion Content Builder
# Adds all sections to the Notion page

set -e

# Check for NOTION_API_KEY
if [ -z "$NOTION_API_KEY" ]; then
    echo "Error: NOTION_API_KEY environment variable not set."
    echo "Add it to ~/.hermes/.env or export it before running this script."
    exit 1
fi

PAGE_ID="34c6ec41-0a4d-8073-901d-f4ff734c9742"

echo "Building Family Financial Planner in Notion..."
echo ""
echo "⚠️  Warning: This script appends content. To avoid duplicates, delete existing blocks first."
echo ""

# Section 1: Family Overview
echo "Adding Family Overview..."
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [
            {"text": {"content": "Created: January 2026 | Status: Planning Phase | Last Updated: January 2026"}}
          ]
        }
      },
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{"text": {"content": "Family Overview"}}]
        }
      },
      {
        "object": "block",
        "type": "table",
        "table": {
          "table_width": 4,
          "has_column_header": true,
          "children": [
            {"type": "table_row", "table_row": {"cells": [["Member"], ["Role"], ["Age"], ["Notes"]]}},
            {"type": "table_row", "table_row": {"cells": [["Yasser Altaf Bheekun"], ["Primary Income"], ["38"], ["MLT at MUHC, OPTMQ #160034"]]}},
            {"type": "table_row", "table_row": {"cells": [["Wife"], ["Secondary Income"], ["TBD"], ["To be updated"]]}},
            {"type": "table_row", "table_row": {"cells": [["Kids"], ["Dependents"], ["TBD"], ["To be updated"]]}}
          ]
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [
            {"text": {"content": "Location: Salaberry-de-Valleyfield, QC | Tax: Quebec (53.31% marginal) | Landed: September 2015"}}
          ]
        }
      }
    ]
  }' > /dev/null

# Section 2: Current Financial Status
echo "Adding Current Financial Status..."
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{"text": {"content": "Current Financial Status"}}]
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Assets"}}]
        }
      },
      {
        "object": "block",
        "type": "table",
        "table": {
          "table_width": 5,
          "has_column_header": true,
          "children": [
            {"type": "table_row", "table_row": {"cells": [["Account"], ["Institution"], ["Balance"], ["Room Used"], ["Notes"]]}},
            {"type": "table_row", "table_row": {"cells": [["TFSA"], ["Not opened"], ["$0"], ["$0 / $78,000"], ["11 years room (2015-2026)"]]}},
            {"type": "table_row", "table_row": {"cells": [["RRSP"], ["Not opened"], ["$0"], ["$0 / ~$130K"], ["Based on income since 2015"]]}},
            {"type": "table_row", "table_row": {"cells": [["Emergency Fund"], ["Not opened"], ["$0"], ["N/A"], ["Target: $25,000"]]}},
            {"type": "table_row", "table_row": {"cells": [["Checking"], ["TBD"], ["TBD"], ["N/A"], ["To be updated"]]}}
          ]
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Insurance Coverage"}}]
        }
      },
      {
        "object": "block",
        "type": "table",
        "table": {
          "table_width": 5,
          "has_column_header": true,
          "children": [
            {"type": "table_row", "table_row": {"cells": [["Type"], ["Provider"], ["Coverage"], ["Premium"], ["Status"]]}},
            {"type": "table_row", "table_row": {"cells": [["Mortgage Life"], ["Mortgage lender"], ["Pays mortgage"], ["Included"], ["Active"]]}},
            {"type": "table_row", "table_row": {"cells": [["Term Life (Personal)"], ["None"], ["$0"], ["$0"], ["Gap identified"]]}},
            {"type": "table_row", "table_row": {"cells": [["Critical Illness"], ["None"], ["$0"], ["$0"], ["Self-insure with TFSA"]]}},
            {"type": "table_row", "table_row": {"cells": [["Disability"], ["MUHC?"], ["?"], ["?"], ["Check benefits"]]}}
          ]
        }
      }
    ]
  }' > /dev/null

# Section 3: Financial Goals
echo "Adding Financial Goals..."
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{"text": {"content": "Financial Goals"}}]
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Short-Term (0-12 months)"}}]
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Emergency Fund: $10,000"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Open TFSA: $15,000 contribution"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Open RRSP: $10,000 contribution"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Verify CRA contribution room"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Review MUHC employee benefits"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Long-Term (5+ years)"}}]
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Retirement savings (TFSA): $500,000+"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Retirement savings (RRSP): $500,000+"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Mortgage payoff"}}],
          "checked": false
        }
      }
    ]
  }' > /dev/null

# Section 4: Investment Strategy
echo "Adding Investment Strategy..."
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{"text": {"content": "Investment Strategy"}}]
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [
            {"text": {"content": "Recommended ETF: "}},
            {"text": {"content": "XEQT (Vanguard All-Equity)", "annotations": {"bold": true}}},
            {"text": {"content": " | MER: 0.22% | Expected Return: 7%/year"}}
          ]
        }
      },
      {
        "object": "block",
        "type": "table",
        "table": {
          "table_width": 4,
          "has_column_header": true,
          "children": [
            {"type": "table_row", "table_row": {"cells": [["Account"], ["ETF"], ["Allocation"], ["Rationale"]]}},
            {"type": "table_row", "table_row": {"cells": [["TFSA"], ["XEQT"], ["100%"], ["Tax-free growth"]]}},
            {"type": "table_row", "table_row": {"cells": [["RRSP"], ["XEQT"], ["100%"], ["Tax-deferred growth"]]}}
          ]
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [
            {"text": {"content": "Projection: $78,000 TFSA @ 7% for 27 years = "}},
            {"text": {"content": "$488,000", "annotations": {"bold": true}}},
            {"text": {"content": " (all tax-free)"}}
          ]
        }
      }
    ]
  }' > /dev/null

# Section 5: Insurance Decision Log
echo "Adding Insurance Decision Log..."
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{"text": {"content": "Insurance Decision Log"}}]
        }
      },
      {
        "object": "block",
        "type": "callout",
        "callout": {
          "rich_text": [{"text": {"content": "iA Groupe Financier Policy - DECLINED (Pending)"}}],
          "color": "red_background"
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [
            {"text": {"content": "Reviewed: January 2026 | Premium: $94.01/month | Coverage: $500K term + $50K critical illness"}}
          ]
        }
      },
      {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
          "rich_text": [{"text": {"content": "Already have mortgage life insurance"}}]
        }
      },
      {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
          "rich_text": [{"text": {"content": "$78K TFSA room allows self-insuring"}}]
        }
      },
      {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
          "rich_text": [{"text": {"content": "RRSP tax refund (53%) is superior wealth builder"}}]
        }
      },
      {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
          "rich_text": [{"text": {"content": "Critical illness has 3-5% claim rate"}}]
        }
      },
      {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
          "rich_text": [{"text": {"content": "$94/month invested in TFSA = $76K+ after 25 years vs $28K paid in premiums"}}]
        }
      }
    ]
  }' > /dev/null

# Section 6: Action Plan
echo "Adding Action Plan..."
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{"text": {"content": "Action Plan"}}]
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Week 1: Foundation"}}]
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Register for CRA My Account"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Verify TFSA contribution room (expected: ~$78K)"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Verify RRSP deduction limit (expected: ~$100-130K)"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Review MUHC employee benefits"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Week 2: Account Setup"}}]
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Open Wealthsimple Trade account (TFSA + RRSP)"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Open EQ Bank savings account (Emergency fund)"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Set up automatic monthly contributions"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "heading_3",
        "heading_3": {
          "rich_text": [{"text": {"content": "Month 1: Initial Funding"}}]
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Fund emergency fund: $5,000-10,000"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Fund TFSA: $5,000-15,000 (buy XEQT)"}}],
          "checked": false
        }
      },
      {
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{"text": {"content": "Fund RRSP: $5,000-10,000 (buy XEQT)"}}],
          "checked": false
        }
      }
    ]
  }' > /dev/null

echo ""
echo "Financial Planner created successfully!"
echo ""
echo "Open your Notion page to see:"
echo "https://www.notion.so/Bheekun-s-Family-34c6ec410a4d8073901df4ff734c9742"
