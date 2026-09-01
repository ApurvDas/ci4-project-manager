# Khaata — Indian Expense Tracker

Track income and expenses, by category, in ₹ with `DD-MM-YYYY` dates.

| | Command | Stack | Data |
| --- | --- | --- | --- |
| **Web app** (recommended) | `python webapp.py` → http://127.0.0.1:5000 | Flask + Jinja + Tailwind, dark "Ledger" theme, Cousine mono | multi-user, `data/<username>/` |
| **Desktop app** (original) | `python budget_app.py` | Tkinter + Pandas | the repo-root `budget_data.csv` |

`core.py` holds the shared, UI-agnostic ledger logic. The web app is multi-user,
so it keeps each account's data under `data/<username>/` and is decoupled from the
Tkinter app (which still reads the root `budget_data.csv`).

## Web app

```bash
pip install -r requirements.txt
python webapp.py        # http://127.0.0.1:5000
```

### Accounts

First visit → **/login**, with a **Sign up** link. Each account's transactions,
budgets and categories are private to it, stored in `data/<username>/`. Sessions
last ~30 days; **Log out** is in the sidebar footer.

Optional env vars:

| Var | Effect |
| --- | --- |
| `KHAATA_USER` + `KHAATA_PASSWORD` | On first run, create this account (seeded from the repo-root sample CSV). If unset, use the sign-up page. |
| `KHAATA_SECRET` | Session signing key. If unset, one is generated and saved to `data/secret.key`. |

Passwords are stored as `werkzeug.security` hashes in `data/users.json`. All POST
forms carry a session CSRF token. The whole `data/` folder is git-ignored — never
commit it.

### Screens

- **Dashboard** — net balance + income / expenses / savings-rate cards, spending
  donut, 6-month cash flow, recent transactions, budget progress. Month arrows.
- **Transactions** — full ledger with running balance, search, All/Income/Expenses
  filter, click-to-sort columns, slide-in add/edit panel, per-row delete.
- **Budgets** — per-category budget vs actual with inline editing; over-budget in red.
- **Insights** — income-vs-expense bars (6 / 12 months), category mix over time,
  top spending, stat tiles.
- **Settings** — category manager (name + colour), CSV / XLSX import & export.
  Imports need the four `Date, Description, Category, Amount (₹)` columns with
  `DD-MM-YYYY` dates; a file that fails those checks is rejected whole, leaving
  your existing transactions untouched.

Every flow works without JavaScript (forms + links); a small `static/app.js` adds
toast auto-dismiss, panel focus, and Esc-to-close. Tailwind is vendored at
`static/vendor/tailwind.js` (Play CDN build) — for production, swap in a Tailwind
CLI build. The Cousine font is served from `static/fonts/`.

### Screenshots

| Dashboard | Transactions |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Transactions](docs/screenshots/transactions.png) |

| Budgets | Insights |
| --- | --- |
| ![Budgets](docs/screenshots/budgets.png) | ![Insights](docs/screenshots/insights.png) |

### Tests

```bash
python test_webapp.py       # stdlib unittest -- nothing extra to install
```

Every test signs up into its own throwaway `data/` directory, so your real
accounts are never touched.

## Desktop app — features

- Add income and expense transactions with an **Income/Expense toggle** (no manual negative numbers).
- Input validation for date (DD-MM-YYYY), required fields, and numeric amounts.
- View all transactions in a scrollable table with a **running balance** column.
- **Edit** and **Delete** the selected transaction.
- **Search / filter** transactions by description or category.
- **Sortable columns** — click a header to sort (click again to reverse).
- Summary of total income, expenses, balance, **plus a per-category breakdown**.
- **Category chart** — pie chart of expenses by category.
- Save and load transactions as **CSV or Excel (.xlsx)** files.
- **Auto-save / auto-load** — data is restored between sessions from `budget_data.csv`.
- Dark mode for better visibility.

## Requirements

- Python 3
- `pip install -r requirements.txt` → `pandas`, `openpyxl`, `flask` (+ `matplotlib`
  for the desktop chart)

## Desktop usage

1. Enter the transaction details: Date, Description, Category, and Amount, and pick **Income** or **Expense**.
2. Click **"Add Transaction"** to save it.
3. Select a row and use **Edit** or **Delete** to modify it.
4. Use the **Search** box to filter, or click column headers to sort.
5. View a summary via **Summary**, or a **Chart** of expenses by category.
6. Save your transactions to a CSV/Excel file or load them back. Data also auto-saves on exit.

## Sample ScreenShot
![python_89nFei9CCD](https://github.com/user-attachments/assets/3f53a2cf-d179-4e29-8fe8-2c4e2d75f182)
