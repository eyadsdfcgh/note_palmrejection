# NotePalm 🖊️

> Smart Note-Taking & Digital Canvas — Built for stylus users.

**Live Demo:** *(your Render URL here after deploy)*

---

## 🚀 Deploy to Render (Static Site)

### Method 1 — Via GitHub (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: NotePalm app"
   git remote add origin https://github.com/YOUR_USERNAME/note_palm.git
   git push -u origin main
   ```

2. **Go to [render.com](https://render.com) → New → Static Site**

3. **Connect your GitHub repo**

4. **Settings:**
   | Field | Value |
   |---|---|
   | Name | `notepalm` |
   | Branch | `main` |
   | Root Directory | *(leave empty)* |
   | Build Command | *(leave empty)* |
   | Publish Directory | `.` |

5. **Click "Create Static Site"** — Deploy takes ~30 seconds ✅

---

### Method 2 — Manual Deploy via Render Dashboard

1. Go to [render.com](https://render.com) → **New → Static Site**
2. Choose **"Deploy from a Git repository"** or **"Upload files"**
3. Upload the entire `note_palm` folder
4. Publish directory: `.` (root)
5. No build command needed

---

## 📁 Project Structure

```
note_palm/
├── index.html          ← App entry point
├── render.yaml         ← Render deployment config
├── _headers            ← Custom HTTP headers (MIME types)
├── css/
│   └── styles.css      ← Design system & animations
└── js/
    ├── main.js         ← App entry point (ES Module)
    ├── canvas.js       ← Drawing engine
    ├── palmRejection.js← Palm rejection filter
    ├── calculator.js   ← Floating calculator
    ├── toolbar.js      ← Toolbar bindings
    ├── persistence.js  ← localStorage auto-save
    └── utils.js        ← Shared utilities
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `P` | Pen tool |
| `E` | Eraser tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+K` | Toggle calculator |

---

## 🛠️ Run Locally

```bash
# Python (no install needed)
python -m http.server 8765

# Then open: http://localhost:8765
```

> ⚠️ Must use an HTTP server (not `file://`) due to ES Modules.
