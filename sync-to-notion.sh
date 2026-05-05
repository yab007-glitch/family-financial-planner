#!/bin/bash

# Bheekun Family Financial Planner - Notion Sync Script
# This script creates/updates the financial planner in Notion
# Requires: NOTION_API_KEY environment variable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🏠 Bheekun Family Financial Planner - Notion Sync"
echo "=================================================="
echo ""

# Check for NOTION_API_KEY
if [ -z "$NOTION_API_KEY" ]; then
    echo -e "${RED}❌ Error: NOTION_API_KEY not found${NC}"
    echo ""
    echo "Please set up your Notion API key:"
    echo "1. Go to https://notion.so/my-integrations"
    echo "2. Create a new integration (or use existing)"
    echo "3. Copy the API key (starts with 'ntn_' or 'secret_')"
    echo "4. Add it to ~/.hermes/.env:"
    echo ""
    echo "   echo 'NOTION_API_KEY=ntn_your_key_here' >> ~/.hermes/.env"
    echo ""
    echo "5. Share your target Notion page with the integration"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ NOTION_API_KEY found${NC}"
echo ""

# Notion API headers
HEADERS="-H \"Authorization: Bearer $NOTION_API_KEY\" -H \"Notion-Version: 2025-09-03\" -H \"Content-Type: application/json\""

# Search for existing Financial Planner page
echo "🔍 Searching for existing Financial Planner page..."
SEARCH_RESULT=$(curl -s -X POST "https://api.notion.com/v1/search" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"query": "Bheekun Family Financial Planner"}')

PAGE_ID=$(echo "$SEARCH_RESULT" | jq -r '.results[] | select(.object=="page") | .id' | head -1)

if [ -n "$PAGE_ID" ]; then
    echo -e "${GREEN}✅ Found existing page: $PAGE_ID${NC}"
    # Update existing page
    echo "📝 Updating page content..."
    
    # Add content as blocks
    curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
      -H "Authorization: Bearer $NOTION_API_KEY" \
      -H "Notion-Version: 2025-09-03" \
      -H "Content-Type: application/json" \
      -d '{
        "children": [
          {
            "object": "block",
            "type": "heading_1",
            "heading_1": {
              "rich_text": [{"text": {"content": "🏠 Bheekun Family Financial Planner"}}]
            }
          },
          {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
              "rich_text": [
                {"text": {"content": "Created: January 2026 | "}},
                {"text": {"content": "Status: 🟡 Planning Phase", "annotations": {"bold": true}}}
              ]
            }
          }
        ]
      }' | jq '.'
    
    echo -e "${GREEN}✅ Page updated successfully${NC}"
else
    echo -e "${YELLOW}⚠️  No existing page found. Creating new page...${NC}"
    
    # Need a parent page ID to create new page
    echo ""
    echo "To create a new page, you need to specify a parent page ID."
    echo "You can either:"
    echo "1. Create a page manually in Notion and share it with the integration"
    echo "2. Provide a parent page ID below"
    echo ""
    read -p "Enter parent page ID (or press Enter to skip): " PARENT_PAGE_ID
    
    if [ -n "$PARENT_PAGE_ID" ]; then
        # Create new page
        echo "📝 Creating new Financial Planner page..."
        
        CREATE_RESULT=$(curl -s -X POST "https://api.notion.com/v1/pages" \
          -H "Authorization: Bearer $NOTION_API_KEY" \
          -H "Notion-Version: 2025-09-03" \
          -H "Content-Type: application/json" \
          -d "{
            \"parent\": {\"page_id\": \"$PARENT_PAGE_ID\"},
            \"properties\": {
              \"title\": [{\"text\": {\"content\": \"🏠 Bheekun Family Financial Planner\"}}]
            },
            \"children\": [
              {
                \"object\": \"block\",
                \"type\": \"heading_1\",
                \"heading_1\": {
                  \"rich_text\": [{\"text\": {\"content\": \"Family Overview\"}}]
                }
              },
              {
                \"object\": \"block\",
                \"type\": \"paragraph\",
                \"paragraph\": {
                  \"rich_text\": [{\"text\": {\"content\": \"Primary: Yasser Altaf Bheekun, Age 38, MLT at MUHC\"}}]
                }
              },
              {
                \"object\": \"block\",
                \"type\": \"heading_2\",
                \"heading_2\": {
                  \"rich_text\": [{\"text\": {\"content\": \"📊 Current Status\"}}]
                }
              },
              {
                \"object\": \"block\",
                \"type\": \"bulleted_list_item\",
                \"bulleted_list_item\": {
                  \"rich_text\": [{\"text\": {\"content\": \"TFSA Room: ~$78,000 (unused since 2015)\"}}]
                }
              },
              {
                \"object\": \"block\",
                \"type\": \"bulleted_list_item\",
                \"bulleted_list_item\": {
                  \"rich_text\": [{\"text\": {\"content\": \"RRSP Room: ~$100-130K (estimated)\"}}]
                }
              },
              {
                \"object\": \"block\",
                \"type\": \"bulleted_list_item\",
                \"bulleted_list_item\": {
                  \"rich_text\": [{\"text\": {\"content\": \"Emergency Fund: $0 (Target: $25,000)\"}}]
                }
              },
              {
                \"object\": \"block\",
                \"type\": \"bulleted_list_item\",
                \"bulleted_list_item\": {
                  \"rich_text\": [{\"text\": {\"content\": \"Insurance: Mortgage life only\"}}]
                }
              }
            ]
          }")
        
        NEW_PAGE_ID=$(echo "$CREATE_RESULT" | jq -r '.id')
        
        if [ -n "$NEW_PAGE_ID" ] && [ "$NEW_PAGE_ID" != "null" ]; then
            echo -e "${GREEN}✅ Page created successfully: $NEW_PAGE_ID${NC}"
            echo ""
            echo "📝 Next steps:"
            echo "1. Open the page in Notion"
            echo "2. Add more details (wife info, kids info, budget details)"
            echo "3. Run this script again to update with new data"
        else
            echo -e "${RED}❌ Failed to create page${NC}"
            echo "Error: $(echo "$CREATE_RESULT" | jq '.')"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping page creation${NC}"
        echo ""
        echo "Manual setup instructions:"
        echo "1. Create a new page in Notion called '🏠 Bheekun Family Financial Planner'"
        echo "2. Click '...' → 'Connect to' → Select your integration"
        echo "3. Copy the page ID from the URL (between '/' and '?')"
        echo "4. Update this script with the page ID and re-run"
        exit 0
    fi
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "1. Open your Notion workspace"
echo "2. Review the Financial Planner page"
echo "3. Fill in missing information (wife details, kids details, budget)"
echo "4. Run this script again after making updates"
echo ""
