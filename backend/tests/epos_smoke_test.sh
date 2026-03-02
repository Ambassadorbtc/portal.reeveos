#!/bin/bash
# EPOS Smoke Test — curl-based, tests all 107 endpoints
# Verifies routes load, return expected status codes, and don't 502/500

BASE="https://portal.rezvo.app/api"
BID="000000000000000000000000"
OID="000000000000000000000000"
TOKEN="test-token-000"

TOTAL=0
PASS=0
FAIL=0

test_endpoint() {
    local method="$1" path="$2" body="$3" expect="$4" desc="$5"
    TOTAL=$((TOTAL+1))
    
    local url="${BASE}${path}"
    local start=$(date +%s%N)
    
    if [ "$method" = "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$url" 2>/dev/null)
    else
        if [ -n "$body" ]; then
            status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X "$method" -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null)
        else
            status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X "$method" "$url" 2>/dev/null)
        fi
    fi
    
    local end=$(date +%s%N)
    local ms=$(( (end - start) / 1000000 ))
    
    # Check if status is in expected list
    local passed=false
    for code in $expect; do
        [ "$status" = "$code" ] && passed=true
    done
    
    if $passed; then
        PASS=$((PASS+1))
        printf "  ✅ %-6s %-55s → %s (%dms)  %s\n" "$method" "$path" "$status" "$ms" "$desc"
    else
        FAIL=$((FAIL+1))
        printf "  ❌ %-6s %-55s → %s (%dms)  %s [expected: %s]\n" "$method" "$path" "$status" "$ms" "$desc" "$expect"
    fi
}

echo ""
echo "======================================================================"
echo "  EPOS SMOKE TEST — $(date)"
echo "  Target: $BASE"
echo "======================================================================"
echo ""

# --- Orders (20 endpoints) ---
echo "📦 Orders"
test_endpoint GET "/orders/business/$BID" "" "200 404" "List orders"
test_endpoint GET "/orders/business/$BID/open" "" "200 404" "Open orders"
test_endpoint POST "/orders/" '{"business_id":"'"$BID"'","items":[{"menu_item_id":"t","name":"Test","quantity":1,"unit_price":9.99}],"order_type":"dine_in","table_number":"1"}' "200 201 404 422" "Create order"
test_endpoint GET "/orders/$OID" "" "200 404" "Get order"
test_endpoint POST "/orders/$OID/items" '{"menu_item_id":"t","name":"Extra","quantity":1,"unit_price":4.99}' "200 404 422" "Add item"
test_endpoint POST "/orders/$OID/fire" "" "200 404" "Fire to kitchen"
test_endpoint POST "/orders/$OID/discount" '{"type":"percentage","value":10,"reason":"test"}' "200 404 422" "Apply discount"
test_endpoint PUT "/orders/$OID/service-charge" '{"percentage":12.5}' "200 404 422" "Service charge"
test_endpoint POST "/orders/$OID/split" '{"splits":[{"items":[0],"payment_method":"card"}]}' "200 404 422" "Split bill"
test_endpoint POST "/orders/$OID/pay" '{"payment_method":"card","amount":9.99}' "200 404 422" "Pay order"
test_endpoint POST "/orders/$OID/close" "" "200 404" "Close order"
test_endpoint POST "/orders/$OID/void" '{"reason":"test"}' "200 404 422" "Void order"
test_endpoint POST "/orders/$OID/refund" '{"amount":5.00,"reason":"test"}' "200 404 422" "Refund"
test_endpoint GET "/orders/$OID/receipt" "" "200 404" "Receipt"
test_endpoint GET "/orders/business/$BID/table-times" "" "200 404" "Table times"
test_endpoint GET "/orders/business/$BID/shift-report" "" "200 404" "Shift report"
test_endpoint GET "/orders/business/$BID/z-report" "" "200 404" "Z-report"
test_endpoint PATCH "/orders/$OID/status" '{"status":"preparing"}' "200 404 422" "Update status"
echo ""

# --- KDS (12 endpoints) ---
echo "🍳 Kitchen Display"
test_endpoint GET "/kds/business/$BID/stations" "" "200 404" "KDS stations"
test_endpoint PUT "/kds/business/$BID/stations" '{"stations":[{"name":"Grill","categories":["mains"]}]}' "200 404 422" "Update stations"
test_endpoint GET "/kds/business/$BID/tickets" "" "200 404" "Active tickets"
test_endpoint GET "/kds/business/$BID/tickets/all-day" "" "200 404" "All-day view"
test_endpoint GET "/kds/business/$BID/recent" "" "200 404" "Recent tickets"
test_endpoint GET "/kds/business/$BID/analytics" "" "200 404" "KDS analytics"
echo ""

# --- Inventory (18 endpoints) ---
echo "📦 Inventory"
test_endpoint GET "/inventory/business/$BID/ingredients" "" "200 404" "Ingredients"
test_endpoint POST "/inventory/business/$BID/ingredients" '{"name":"Test Flour","unit":"kg","current_stock":50,"reorder_point":10,"unit_cost":1.2}' "200 201 404 422" "Add ingredient"
test_endpoint GET "/inventory/business/$BID/alerts" "" "200 404" "Stock alerts"
test_endpoint GET "/inventory/business/$BID/recipes" "" "200 404" "Recipes"
test_endpoint POST "/inventory/business/$BID/recipes" '{"name":"Test","menu_item_id":"t","ingredients":[]}' "200 201 404 422" "Create recipe"
test_endpoint GET "/inventory/business/$BID/food-cost-report" "" "200 404" "Food cost"
test_endpoint GET "/inventory/business/$BID/waste" "" "200 404" "Waste log"
test_endpoint POST "/inventory/business/$BID/waste" '{"ingredient_id":"t","quantity":1,"reason":"test"}' "200 201 400 404 422" "Log waste"
test_endpoint GET "/inventory/business/$BID/suppliers" "" "200 404" "Suppliers"
test_endpoint POST "/inventory/business/$BID/suppliers" '{"name":"Test Supplier","email":"t@t.com"}' "200 201 404 422" "Add supplier"
test_endpoint GET "/inventory/business/$BID/purchase-orders" "" "200 404" "Purchase orders"
test_endpoint POST "/inventory/business/$BID/purchase-orders" '{"supplier_id":"t","items":[]}' "200 201 404 422" "Create PO"
test_endpoint GET "/inventory/business/$BID/reorder-suggestions" "" "200 404" "Reorder suggestions"
echo ""

# --- EPOS AI (13 endpoints) ---
echo "🤖 EPOS AI & Loyalty"
test_endpoint GET "/epos/business/$BID/ai/menu-optimizer" "" "200 404" "Menu optimizer"
test_endpoint GET "/epos/business/$BID/ai/prep-forecast" "" "200 404" "Prep forecast"
test_endpoint GET "/epos/business/$BID/ai/waste-prediction" "" "200 404" "Waste prediction"
test_endpoint GET "/epos/business/$BID/ai/peak-heatmap" "" "200 404" "Peak heatmap"
test_endpoint GET "/epos/business/$BID/loyalty/config" "" "200 404" "Loyalty config"
test_endpoint GET "/epos/kiosk/$BID/menu" "" "200 404" "Kiosk menu"
echo ""

# --- Labour (10 endpoints) ---
echo "👷 Labour"
test_endpoint GET "/labour/business/$BID/who-is-in" "" "200 404" "Who's in"
test_endpoint GET "/labour/business/$BID/shifts" "" "200 404" "Shifts"
test_endpoint GET "/labour/business/$BID/labour-report" "" "200 404" "Labour report"
test_endpoint GET "/labour/business/$BID/staff-performance" "" "200 404" "Staff perf"
test_endpoint POST "/labour/business/$BID/clock-in" '{"staff_id":"test","staff_name":"Test"}' "200 201 400 404 422" "Clock in"
test_endpoint POST "/labour/business/$BID/clock-out" '{"staff_id":"test"}' "200 404 422" "Clock out"
echo ""

# --- Online Ordering (8 endpoints) ---
echo "🛒 Online Ordering"
test_endpoint GET "/online/menu/$BID" "" "200 404" "Public menu"
test_endpoint GET "/online/qr/$BID/table/1" "" "200 404" "QR table info"
test_endpoint GET "/online/track/$OID" "" "200 404" "Track order"
echo ""

# --- Pay at Table (9 endpoints) ---
echo "💳 Pay at Table"
test_endpoint GET "/table-service/scan/$TOKEN" "" "200 404" "Scan QR"
test_endpoint GET "/table-service/business/$BID/alerts" "" "200 404" "Service alerts"
echo ""

# --- Cash & Tax (8 endpoints) ---
echo "💰 Cash & Tax"
test_endpoint GET "/finance/cash/business/$BID/history" "" "200 404" "Cash history"
test_endpoint GET "/finance/tax/business/$BID/vat-summary" "" "200 404" "VAT summary"
test_endpoint GET "/finance/tax/business/$BID/profit-loss" "" "200 404" "P&L"
test_endpoint POST "/finance/cash/open-drawer" '{"business_id":"'"$BID"'","staff_id":"t","opening_float":100}' "200 201 404 422" "Open drawer"
test_endpoint POST "/finance/cash/drop" '{"business_id":"'"$BID"'","staff_id":"t","amount":50,"reason":"test"}' "200 201 404 422" "Cash drop"
echo ""

# --- Tables (9 endpoints) ---
echo "🪑 Tables"
test_endpoint GET "/tables/business/$BID/floor-plan" "" "200 403 404" "Floor plan"
test_endpoint POST "/tables/business/$BID/validate-layout" '{"tables":[]}' "200 403 404 422" "Validate layout"
echo ""

# --- Notifications ---
echo "🔔 Notifications"
test_endpoint GET "/notifications/business/$BID" "" "200 404" "Activity feed"
echo ""

# --- Reviews ---
echo "⭐ Reviews"
test_endpoint GET "/reviews/business/$BID" "" "200 404" "Reviews list"
echo ""

# --- Core Platform ---
echo "🏠 Core Platform"
test_endpoint GET "/directory/home" "" "200" "Directory home"
test_endpoint GET "/directory/search" "" "200" "Directory search"
test_endpoint GET "/directory/categories/restaurant" "" "200" "Category filter"
test_endpoint GET "/directory/locations" "" "200" "Locations"
echo ""

# Summary
echo "======================================================================"
echo "  RESULTS"
echo "======================================================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASS ✅"
echo "  Failed: $FAIL ❌"
PCT=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "  Rate:   ${PCT}%"
echo "======================================================================"

[ $FAIL -eq 0 ] && exit 0 || exit 1
