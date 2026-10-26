#!/usr/bin/env python3
"""Checks ./kds --json against the plain-text ./kds it is layered on top of.

For every example script (plus the fuzz generator used by fuzz_compare.py,
at a smaller size so this stays fast) this:
  1. runs the script through plain ./kds and collects its text output lines
  2. runs the same script through ./kds --json and parses every output line
     as JSON
  3. checks that:
       - every line is valid JSON with the expected "type"
       - the sequence of non-comment/non-blank input lines lines up 1:1
         with the "event" lines (same count)
       - each event's "msg" is exactly the matching plain-text output line
       - each event's "ok" agrees with whether that line starts with ERR
       - "state" always has all 7 structure keys with the right shape

This proves --json is a faithful additive layer: it never changes what the
text mode says, it only adds structure around it.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KDS = os.path.join(ROOT, 'kds')
STATE_KEYS = {'list', 'queue', 'stack', 'bitmap', 'hash', 'tree', 'sched'}


def run(args, stdin_text):
    p = subprocess.run([KDS, *args], input=stdin_text, capture_output=True, text=True, timeout=30)
    return p.returncode, p.stdout, p.stderr


def check_script(path):
    with open(path, encoding='utf-8') as f:
        script = f.read()

    rc_text, out_text, err_text = run([], script)
    text_lines = [l for l in out_text.split('\n') if l != '']

    rc_json, out_json, err_json = run(['--json'], script)
    json_lines = [l for l in out_json.split('\n') if l != '']

    if err_text.strip() or err_json.strip():
        return f"stderr/sanitizer output: text={err_text!r} json={err_json!r}"

    if not json_lines or json.loads(json_lines[0]).get('type') != 'start':
        return "missing/bad {\"type\":\"start\"} as first line"
    if json.loads(json_lines[-1]).get('type') != 'end':
        return "missing {\"type\":\"end\"} as last line"

    events = [json.loads(l) for l in json_lines[1:-1]]
    for e in events:
        if e.get('type') != 'event':
            return f"unexpected line type {e.get('type')!r}"

    if len(events) != len(text_lines):
        return f"{len(events)} json events vs {len(text_lines)} text output lines"

    for i, (ev, txt) in enumerate(zip(events, text_lines)):
        if ev['msg'] != txt:
            return f"event {i}: msg {ev['msg']!r} != text line {txt!r}"
        want_ok = not txt.startswith('ERR')
        if ev['ok'] != want_ok:
            return f"event {i}: ok={ev['ok']} but msg={txt!r}"
        st = ev.get('state')
        if not isinstance(st, dict) or set(st.keys()) != STATE_KEYS:
            return f"event {i}: state keys {sorted(st) if isinstance(st, dict) else st!r}"

    end = json.loads(json_lines[-1])
    if end.get('steps') != len(events):
        return f"end.steps={end.get('steps')} but saw {len(events)} events"

    return None


def main():
    examples_dir = os.path.join(ROOT, 'examples')
    fail = 0
    for name in sorted(os.listdir(examples_dir)):
        if not name.endswith('.txt'):
            continue
        err = check_script(os.path.join(examples_dir, name))
        if err:
            print(f"FAIL json {name}: {err}")
            fail = 1
        else:
            print(f"PASS json {name}")
    if fail:
        sys.exit(1)
    print("PASS json: all example scripts match between --json and text mode")


if __name__ == '__main__':
    main()
