# SCAN & GET REWARD — Frontend v1

Premium responsive frontend for the Peel & Reveal QR reward experience.

## Files
- `index.html` — public landing page and reward entry UI
- `styles.css` — responsive black / white / gold design system
- `app.js` — navigation and fail-closed coupon form interaction
- `admin.html` — owner/staff console UI preview (not authenticated yet)
- `contact.html`, `privacy.html`, `terms.html` — starter legal/contact pages

## Preview
Open `index.html` in a browser, or run a local static server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Backend status — intentionally not enabled
The coupon form does **not** generate fake coupons. It validates the mobile-number format locally, then stops because no verified backend URL or API contract has been configured. The admin page is a UI preview only; it does not authenticate users or perform coupon actions.

## Before backend integration
The previously supplied project files found in the project history show a Firebase/Firestore implementation (`getOrCreateCoupon`, `lookupCoupon`, `redeemCoupon`, `adminListCoupons`) and Firebase Phone Auth. They do not include a Google Apps Script deployment URL or the Apps Script functions described in the latest brief. Do not point this frontend at an unreviewed URL.

To integrate safely, provide:
1. The existing Google Apps Script `.gs` source (all files),
2. The deployed Web App URL (or deployment details),
3. Exact action names and sample JSON request/response for generate/lookup/redeem/login/report,
4. How phone verification currently works,
5. Owner/staff identity and role rules.

The existing sheet columns can remain unchanged: `Phone, Coupon Code, Status, Created At, Discount, Redeemed At, Redeemed By`. Backend code must enforce one coupon per verified eligible phone and atomic one-time redemption. Secrets must remain server-side.

## Important launch checklist
- Replace partner placeholders with confirmed businesses, logos, offers, locations and redemption rules.
- Add real contact details and approved privacy/terms copy.
- Configure and test SMS/WhatsApp verification and consent language.
- Enforce authentication, role checks, rate limits, duplicate prevention and redemption locking server-side.
- Test QR campaign attribution and expiry rules before printing boards.


ADMIN CONSOLE UPDATE
- admin.html and admin.js now call the Apps Script API.
- Owner login uses the OWNER_EMAIL account initialized in Script Properties.
- Owner can create staff accounts from the dashboard.
- Staff cannot create staff accounts.
- Dashboard stats, records, coupon search, redeem, and CSV export are wired to the API.

IMPORTANT TESTING NOTES
- This is not yet a verified production launch. Test on a hosted HTTPS origin; opening local file:// pages may be blocked by browser cross-origin rules.
- Confirm the Apps Script deployment is set to execute as the script owner and accessible to intended users.
- The Apps Script backend must contain loginAdmin, createStaff, adminListCoupons, getDashboard, redeemCoupon, and doPost handlers.
- Customer phone numbers are not OTP-verified. WhatsApp click-to-chat does not confirm a message was sent.
- Review privacy/terms and spreadsheet access before collecting real customer data.


CUSTOMER API CONNECTION UPDATE
- app.js now sends action=generateCoupon to the provided Apps Script Web App URL.
- The customer flow expects {success:true,data:{phone,code,discount,status,existing}}.
- The business WhatsApp number is intentionally blank in CONFIG.whatsappNumber; add it only after confirming the official number.
- Browser cross-origin restrictions may block reading the Apps Script response. Test from HTTPS hosting; if CORS still blocks it, the Apps Script endpoint/frontend integration needs an approved workaround before production.
- Customer mobile number is not OTP-verified. Do not describe it as verified or use this as proof of number ownership.
