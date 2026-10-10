#!/usr/bin/env python3
"""Verify the immutable source; no network and no writes."""
from pathlib import Path
import argparse, hashlib, json, sys
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--case', default='01-chatbot', choices=['01-chatbot', '02-GPT6 介绍页滚动效果'])
args = parser.parse_args()
case = root / 'case' / args.case
expected = json.loads((case / 'source.sha256.json').read_text())
source = case / ('source' if args.case == '01-chatbot' else 'starter')
actual = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
          for p in sorted(source.rglob('*')) if p.is_file()}
changed = [p for p in expected if expected[p] != actual.get(p)]
extra = sorted(set(actual)-set(expected))
print(json.dumps({'ok': not changed and not extra, 'verified_files':len(expected),
                  'missing_or_changed':changed, 'unexpected':extra}, indent=2))
sys.exit(0 if not changed and not extra else 1)
