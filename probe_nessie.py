"""One-off check of what this Nessie server supports (safe to delete afterwards).

Uses only the leftover "Test User" customer with no accounts. Creates two probe
accounts on it, tries each transaction type, checks whether balances change,
tries deleting, and writes the results to probe_results.json.
"""
import json
from datetime import date

import nessie

PROBE_CUSTOMER = "00962230-1bfc-4cde-bee0-53baa6b01ba1"
results = {"steps": []}


def step(name, fn):
    try:
        value = fn()
        results["steps"].append({"step": name, "ok": True, "result": value})
        print("OK  ", name, "->", json.dumps(value)[:200])
        return value
    except Exception as e:  # noqa: BLE001 - we want to record every failure
        results["steps"].append({"step": name, "ok": False, "error": str(e)[:500]})
        print("FAIL", name, "->", str(e)[:200])
        return None


def balance(aid):
    return nessie.get_account(aid).get("balance")


today = date.today().isoformat()
a = step("create probe account A (balance 1000)", lambda: nessie.create_account(PROBE_CUSTOMER, "Checking", "Probe A", balance=1000))
b = step("create probe account B (balance 0)", lambda: nessie.create_account(PROBE_CUSTOMER, "Savings", "Probe B", balance=0))
if a and b:
    step("account A raw", lambda: nessie.get_account(a))
    step("balance A at start", lambda: balance(a))

    dep = step("POST deposit 10", lambda: nessie._created_id(nessie._request("POST", f"/accounts/{a}/deposits", {
        "medium": "balance", "transaction_date": today, "status": "completed", "amount": 10, "description": "probe deposit"})))
    step("balance A after deposit", lambda: balance(a))

    wd = step("POST withdrawal 5", lambda: nessie._created_id(nessie._request("POST", f"/accounts/{a}/withdrawals", {
        "medium": "balance", "transaction_date": today, "status": "completed", "amount": 5, "description": "probe withdrawal"})))
    step("balance A after withdrawal", lambda: balance(a))

    merchants = json.load(open("merchants.json")) if __import__("os").path.exists("merchants.json") else {}
    mid = next(iter(merchants.values()), None)
    pur = step("POST purchase 3", lambda: nessie._created_id(nessie._request("POST", f"/accounts/{a}/purchases", {
        "merchant_id": mid, "medium": "balance", "purchase_date": today, "amount": 3, "status": "completed", "description": "probe purchase"})))
    step("balance A after purchase", lambda: balance(a))

    tr = step("POST transfer 7 A->B", lambda: nessie._created_id(nessie._request("POST", f"/accounts/{a}/transfers", {
        "medium": "balance", "payee_id": b, "amount": 7, "transaction_date": today, "status": "completed", "description": "probe transfer"})))
    step("balance A after transfer", lambda: balance(a))
    step("balance B after transfer", lambda: balance(b))

    bill = step("POST bill 2", lambda: nessie._created_id(nessie._request("POST", f"/accounts/{a}/bills", {
        "status": "completed", "payee": "Probe Utility", "nickname": "Probe bill", "payment_date": today,
        "recurring_date": 1, "payment_amount": 2})))
    step("balance A after bill", lambda: balance(a))

    for kind in ("deposits", "withdrawals", "purchases", "transfers", "bills"):
        step(f"GET {kind} on A (shape)", lambda kind=kind: (nessie._request("GET", f"/accounts/{a}/{kind}") or [])[:1])
    step("GET transfers on B (shape)", lambda: (nessie._request("GET", f"/accounts/{b}/transfers") or [])[:1])

    for kind, tid in (("deposits", dep), ("withdrawals", wd), ("purchases", pur), ("transfers", tr), ("bills", bill)):
        if tid:
            step(f"DELETE /{kind}/{{id}}", lambda kind=kind, tid=tid: nessie._request("DELETE", f"/{kind}/{tid}"))
    step("balance A after deletes", lambda: balance(a))
    step("GET withdrawals on A after delete", lambda: len(nessie._request("GET", f"/accounts/{a}/withdrawals") or []))

    step("PUT account A balance 1234 (can we set balances?)", lambda: nessie._request("PUT", f"/accounts/{a}", {"nickname": "Probe A", "balance": 1234}))
    step("balance A after PUT", lambda: balance(a))

    step("DELETE account A", lambda: nessie._request("DELETE", f"/accounts/{a}"))
    step("DELETE account B", lambda: nessie._request("DELETE", f"/accounts/{b}"))

json.dump(results, open("probe_results.json", "w"), indent=2, default=str)
print("\nDone. Results saved to probe_results.json")
