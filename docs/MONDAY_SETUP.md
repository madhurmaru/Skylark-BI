# Monday.com Setup Guide

This prototype reads two boards at query time. The ChatGPT Monday plugin is not used by the hosted application; Vercel needs its own server-side credentials.

## 1. Import the Excel files

In Monday.com, create two separate boards using **Add → Import data → Excel**:

1. Import `Deal funnel Data(1).xlsx` and name the board **Deals**.
2. Import `Work_Order_Tracker Data(1).xlsx` and name the board **Work Orders**.
3. Choose the deal/work-order name as the board's first (item name) column.
4. Remove any imported row that repeats the column headings. The supplied files contain header-like values inside the data; the normalizer ignores obvious header values, but removing these rows improves source quality.

Recommended Deals column types:

| Column | Monday type |
|---|---|
| Deal Name | Item name |
| Owner code, Client Code | Text |
| Deal Status | Status |
| Close Date (A), Tentative Close Date, Created Date | Date |
| Closure Probability, Deal Stage, Product deal, Sector/service | Dropdown or Status |
| Masked Deal value | Numbers |

Recommended Work Orders column types:

| Column group | Monday type |
|---|---|
| Deal name masked | Item name |
| Customer Name Code, Serial #, BD/KAM Personnel code | Text |
| Nature of Work, Execution Status, Document Type, Sector, Type of Work, Invoice/Billing/Collection statuses | Dropdown or Status |
| Data Delivery Date, Date of PO/LOI, Probable Start/End Date, Invoice/Collection Date | Date |
| All monetary amount columns | Numbers |
| Quantity columns | Text (values contain units such as HA and days) |

The application matches columns by normalized titles rather than Monday column IDs, so harmless punctuation/capitalization differences are tolerated. Keep the semantic titles recognizable.

## 2. Get the two board IDs

Open each board. Its URL resembles:

`https://your-account.monday.com/boards/1234567890`

The numeric segment after `/boards/` is the board ID. Record both IDs.

The same board ID format is used by the optional **Analyze your own Monday boards** modal in the app. That modal accepts either the digits or a full Monday URL containing `/boards/{id}`.

## 3. Create a Monday personal API token

1. Click your profile image in Monday.com.
2. Select **Developers**.
3. Open **API token**, choose **Show**, and copy the token.
4. Ensure the same account can view both imported boards. A personal token inherits that user's Monday permissions.

Never commit or share the token. Although this app only sends GraphQL read queries, a personal token may carry the account's broader permissions.

## 4. Configure Vercel

Under **Project → Settings → Environment Variables**, add:

- `MONDAY_API_TOKEN`
- `MONDAY_DEALS_BOARD_ID`
- `MONDAY_WORK_ORDERS_BOARD_ID`
- `HF_TOKEN`
- `HF_MODEL` = `openai/gpt-oss-120b:cheapest` (optional override)

Apply variables to Production, Preview, and Development as needed, then redeploy. The home screen's Integration Setup panel will show whether every variable is present without exposing its value.

## Optional temporary board testing

Users can click **Try your own boards** in the conversational interface to open **Analyze your own Monday boards**. This mode accepts a Monday token and one to ten arbitrary Monday board IDs or URLs without changing the deployment configuration. The server validates the fields, rejects duplicate board IDs, confirms read-only access to every board, and returns only safe board information: board IDs, board names, accessibility status, item counts, and column names.

Unlike default assignment mode, temporary custom mode does not assume Deals or Work Orders. It inspects each board's columns, groups, item names, column types, and values, then infers generic roles such as status, date, amount, percentage, owner, customer, category, quantity, duration, and free text. Generic analysis quality depends on the available schema and data quality, and uncertain mappings or row-limit truncation are disclosed.

Temporary values remain only in the current browser tab's React memory. They are cleared by page refresh, by clicking **Clear temporary configuration**, or by closing the tab. They are not stored in browser storage, cookies, URLs, databases, telemetry, analytics, or persisted chat messages. They also do not mutate Vercel environment variables.

The temporary token is used only for Monday GraphQL read queries. It is never returned in API responses and is never included in Hugging Face prompts. Hugging Face receives the user's business question plus normalized/computed business data only.

Personal Monday tokens inherit the user's permissions. For a production multi-user workflow, prefer Monday OAuth with scoped app permissions and revocable user consent rather than collecting personal API tokens in a form.

## 5. Verify

Ask: `How is our energy sector pipeline looking this quarter?`

The response should show both board sources, rows used/available, computed KPIs, and data-quality notes. Monday.com data remains unchanged.

Sources: [Monday authentication](https://developer.monday.com/api-reference/docs/authentication), [Excel import](https://support.monday.com/hc/en-us/articles/360000219209-Import-files-from-Excel), [items_page pagination](https://developer.monday.com/api-reference/reference/items-page).
