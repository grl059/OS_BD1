"""Builds docs/4_BD1_Report.pdf and docs/4_Manual.pdf from the HTML sources.

    pip install playwright && playwright install chromium   (once)
    python3 docs/report_src/build_pdf.py

Edit report.html / manual.html, then run this script again.  The table of
contents page numbers are filled in automatically (two passes, needs
pdftotext from poppler-utils; without it the numbers are left empty).
"""
import os
import re
import shutil
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(HERE)
FOOTER = ('<div style="width:100%;font-size:9pt;text-align:center;font-family:serif;color:#444">'
          '<span class="pageNumber"></span></div>')
JOBS = [('report.html', '4_BD1_Report.pdf', True), ('manual.html', '4_Manual.pdf', False)]


def render(page, html_path, pdf_path):
    page.goto('file://' + html_path)
    page.wait_for_load_state('networkidle')
    page.pdf(path=pdf_path, format='A4', print_background=True, prefer_css_page_size=True,
             display_header_footer=True, header_template='<span></span>', footer_template=FOOTER)


def toc_pages(pdf_path, page, html_path):
    """Return {heading id: page number} by finding each heading's text in the PDF."""
    if not shutil.which('pdftotext'):
        return {}
    heads = page.evaluate("""() => [...document.querySelectorAll('h1[id]')]
        .map(h => [h.id, h.textContent.trim()])""")
    out = subprocess.run(['pdftotext', '-layout', pdf_path, '-'], capture_output=True, text=True).stdout
    pages = out.split('\f')
    found, start = {}, 2          # skip cover and TOC pages
    for hid, text in heads:
        key = re.sub(r'\s+', ' ', text)
        for i in range(start, len(pages)):
            if any(re.sub(r'\s+', ' ', l).strip().startswith(key) for l in pages[i].splitlines()):
                found[hid] = i + 1
                start = i
                break
    return found


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for src, dst, has_toc in JOBS:
            html_path = os.path.join(HERE, src)
            pdf_path = os.path.join(DOCS, dst)
            render(page, html_path, pdf_path)
            if has_toc:
                nums = toc_pages(pdf_path, page, html_path)
                if nums:
                    with open(html_path, encoding='utf-8') as f:
                        html = f.read()
                    for hid, n in nums.items():
                        html = re.sub(rf'(<span data-toc="{hid}">)[^<]*(</span>)', rf'\g<1>{n}\g<2>', html)
                    with tempfile.NamedTemporaryFile('w', suffix='.html', dir=HERE, delete=False, encoding='utf-8') as t:
                        t.write(html)
                    try:
                        render(page, t.name, pdf_path)
                    finally:
                        os.unlink(t.name)
            print('wrote', os.path.relpath(pdf_path, os.path.dirname(DOCS)))
        browser.close()


if __name__ == '__main__':
    main()
