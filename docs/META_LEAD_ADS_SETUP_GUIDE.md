# Meta (Facebook/Instagram) Lead Ads Integration Guide

Complete step-by-step guide to connect your Meta (Facebook/Instagram) Lead Forms directly to your server and MongoDB database using the latest Meta Developer Graph API (v19.0+).

---

## Architecture Overview

```
1. Meta User Submits Lead Form
             │
             ▼
2. Meta Webhook Engine POSTs leadgen_id to server
   POST /api/meta/webhook
             │
             ▼
3. Server responds 200 OK & fetches full lead data via Meta Graph API
   GET https://graph.facebook.com/v19.0/{leadgen_id}?access_token={PAGE_ACCESS_TOKEN}
             │
             ▼
4. Server parses field_data & creates Lead in MongoDB (Lead.create)
             │
             ▼
5. Server emits real-time Socket.IO notification (newLead / leadAdded)
```

---

## Environment Configuration

Configure the following environment variables in your `server/.env` file:

```env
# Meta Webhook Verification Token (Any custom secret string you choose)
META_VERIFY_TOKEN=your_custom_meta_verify_token_123

# Meta App Secret (From Meta App Dashboard -> Basic Settings)
META_APP_SECRET=your_meta_app_secret

# Long-Lived Page Access Token with `leads_retrieval` permission
META_PAGE_ACCESS_TOKEN=EAAG...your_long_lived_page_token

# Meta Graph API Version
META_GRAPH_API_VERSION=v19.0

# Optional: Default Organization ID & Default System User ID for lead assignment
META_DEFAULT_ORG_ID=
META_DEFAULT_USER_ID=
```

---

## Step-by-Step Setup Instructions

### Phase 1: Public HTTPS Callback URL

Meta requires a secure, publicly accessible **HTTPS** callback URL.

- **Production URL**: `https://olivialms.cloud/api/meta/webhook`
- **Local Development URL**: Use `ngrok` to expose port 5000:
  ```bash
  ngrok http 5000
  ```
  Copy the HTTPS forwarding URL (e.g., `https://xyz.ngrok-free.app/api/meta/webhook`).

---

### Phase 2: Create & Configure Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** → **Create App**.
3. Select **Other** or **Business** → Click **Next**.
4. Set App Name (e.g. `LEADSYSTEM Meta Lead Sync`).
5. Navigate to **App Settings** → **Basic**.
   - Copy your **App Secret** and set `META_APP_SECRET` in `server/.env`.

---

### Phase 3: Configure Webhooks Product

1. In your App Dashboard, click **Add Product** in the left sidebar.
2. Find **Webhooks** and click **Set Up**.
3. Select **Page** from the dropdown → Click **Subscribe to this object**.
4. In the configuration modal:
   - **Callback URL**: `https://olivialms.cloud/api/meta/webhook` (or your ngrok URL).
   - **Verify Token**: Enter the exact string set in `META_VERIFY_TOKEN`.
5. Click **Verify and Save**.
   - Meta will send a `GET` challenge request to your endpoint. Your server will automatically verify the token and return `hub.challenge`.
6. Under Page subscriptions, locate the **`leadgen`** field and click **Subscribe**.

---

### Phase 4: Generate Long-Lived Page Access Token

1. Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Select your App from the top-right dropdown menu.
3. Under **User or Page**, select your target **Facebook Page**.
4. Under **Permissions**, add the following required permissions:
   - `leads_retrieval` *(Required for reading lead form responses)*
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `pages_show_list`
   - `ads_management`
5. Click **Generate Access Token** and approve page permissions.
6. Open [Access Token Tool](https://developers.facebook.com/tools/accesstoken/) to exchange the token for a **Long-Lived Page Access Token**.
7. Copy the token and set `META_PAGE_ACCESS_TOKEN` in `server/.env`.

---

### Phase 5: Subscribe App to Facebook Page

Even after setting up webhooks in the App Dashboard, you must explicitly link your App to your Facebook Page's lead generation edge.

Run this cURL command (replace `{PAGE_ID}` and `{META_PAGE_ACCESS_TOKEN}`):

```bash
curl -i -X POST "https://graph.facebook.com/v19.0/{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen&access_token={META_PAGE_ACCESS_TOKEN}"
```

**Expected Response**:
```json
{
  "success": true
}
```

---

### Phase 6: Test Real Lead Ingestion

Use Meta's official Lead Ads Testing Tool to generate test leads without spending ad budget:

1. Open [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).
2. Select your **Page** and **Lead Form**.
3. Click **Create Lead**.
4. **Verification**:
   - Check your server console logs:
     `[MetaLeadService] Successfully processed Meta Lead RED25092200001 (Leadgen ID: ...)`
   - Open your LEADSYSTEM Dashboard: The new lead will appear live via Socket.IO!
   - Inspect administrative logs at: `GET https://olivialms.cloud/api/meta/logs`
