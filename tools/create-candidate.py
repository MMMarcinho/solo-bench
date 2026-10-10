#!/usr/bin/env python3
"""Create a fresh source-only agent workspace, never copy the grader."""
from pathlib import Path
import argparse, shutil
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--case', default='01-chatbot', choices=['01-chatbot', '02-GPT6 介绍页滚动效果'])
parser.add_argument('destination')
args = parser.parse_args()
destination = Path(args.destination).expanduser().resolve()
if destination.exists():
    raise SystemExit('Refusing to overwrite an existing path: '+str(destination))
if root == destination or root in destination.parents:
    raise SystemExit('Place the candidate outside the benchmark root to prevent grader leakage.')
source = root/'case'/args.case/('source' if args.case == '01-chatbot' else 'starter')
shutil.copytree(source, destination)
print(destination)
