#!/usr/bin/env python3
"""Generate HTML + PDF from a Markdown plan (same pipeline as other Ma Zone docs)."""
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STEM = "PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

STYLE = """
  @page { margin: 16mm 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; max-width: 100%; }
  h1 { font-size: 20pt; border-bottom: 2px solid #0f2d5c; padding-bottom: 8px; color: #0f2d5c; page-break-after: avoid; }
  h2 { font-size: 14pt; margin-top: 22px; color: #0f2d5c; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-size: 11.5pt; margin-top: 14px; color: #1a4a8a; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 8.5pt; }
  pre { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 8pt; line-height: 1.35; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #0f2d5c; margin: 10px 0; padding: 6px 14px; background: #f0f4f8; color: #1e3a5f; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
  ul, ol { padding-left: 22px; }
  li { margin-bottom: 3px; }
  p { margin: 8px 0; }
  .pdf-note { display: none; }
  @media screen {
    .pdf-note { display: block; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; color: #1e3a8a; }
  }
"""


def build_html(md_text: str, title: str, stem: str) -> str:
    body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists"],
    )
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{STYLE}</style>
</head>
<body>
<div class="pdf-note">
  <strong>Lecture dans Cursor / navigateur :</strong> ce fichier HTML est la version lisible du plan.
  Pour le PDF, ouvrez <code>{stem}.pdf</code> depuis le Finder (clic droit → Ouvrir avec Aperçu)
  ou double-cliquez le fichier <code>Ouvrir_*_PDF.command</code> correspondant à la racine du projet.
</div>
{body}
</body>
</html>
"""


def generate_pdf(html_path: Path, pdf_path: Path) -> None:
    if not Path(CHROME).exists():
        print("Chrome introuvable — HTML seulement.", file=sys.stderr)
        return

    html_uri = html_path.resolve().as_uri()
    cmd = [
        CHROME,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        f"--print-to-pdf={pdf_path.resolve()}",
        html_uri,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "Chrome PDF export failed")


def main() -> None:
    stem = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_STEM
    md_file = ROOT / f"{stem}.md"
    html_file = ROOT / f"{stem}.html"
    pdf_file = ROOT / f"{stem}.pdf"

    if not md_file.exists():
        print(f"Missing {md_file}", file=sys.stderr)
        sys.exit(1)

    md_text = md_file.read_text(encoding="utf-8")
    title = md_text.split("\n", 1)[0].lstrip("# ").strip()
    html = build_html(md_text, title, stem)
    html_file.write_text(html, encoding="utf-8")
    print(f"Wrote {html_file}")

    generate_pdf(html_file, pdf_file)
    print(f"Wrote {pdf_file}")


if __name__ == "__main__":
    main()
