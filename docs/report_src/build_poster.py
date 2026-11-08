"""Builds docs/V-1-4_BD1_Poster.pdf (A3 landscape) from poster.html.

    pip install playwright && playwright install chromium   (once)
    python3 docs/report_src/build_poster.py

If no bundled Playwright browser is installed, set PW_CHANNEL=chrome to use
the system Chrome instead.
"""
import os

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "V-1-4_BD1_Poster.pdf")

with sync_playwright() as pw:
    channel = os.environ.get("PW_CHANNEL")
    browser = pw.chromium.launch(channel=channel) if channel else pw.chromium.launch()
    page = browser.new_page()
    page.goto("file://" + os.path.join(HERE, "poster.html"))
    page.wait_for_load_state("networkidle")
    page.pdf(path=OUT, prefer_css_page_size=True, print_background=True)
    browser.close()
print("OK", OUT)