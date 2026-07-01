#!/usr/bin/env python3
"""Simple analysis script for the usability CSV template.

Usage: python3 analysis_script.py results.csv

Outputs task success rates, mean/median times and SUS summary.
"""
import csv
import sys
from statistics import mean, median, stdev


def compute_sus(scores):
    # scores: list of 10 ints 1-5
    if len(scores) != 10:
        return None
    total = 0
    for i, s in enumerate(scores, start=1):
        if i % 2 == 1:
            total += (s - 1)
        else:
            total += (5 - s)
    sus = total * 2.5
    return sus


def parse_row(row):
    # return dict with parsed fields
    def maybe_float(x):
        try:
            return float(x)
        except:
            return None

    parsed = {
        'participant_id': row.get('participant_id','').strip(),
        'email': row.get('email','').strip(),
        'device': row.get('device','').strip(),
        'experience': row.get('experience','').strip(),
        'tasks': [],
        'sus_scores': [],
        'comments': row.get('comments','').strip(),
    }
    for t in range(1,5):
        success = row.get(f'task{t}_success','').strip().lower()
        success_bool = success in ('y','yes','sim','true','1')
        time_s = maybe_float(row.get(f'task{t}_time_s','').strip())
        parsed['tasks'].append({'success': success_bool, 'time': time_s})
    for i in range(1,11):
        v = row.get(f'sus{i}','').strip()
        try:
            parsed['sus_scores'].append(int(v))
        except:
            parsed['sus_scores'].append(None)
    return parsed


def analyze(rows):
    participants = [parse_row(r) for r in rows]
    n = len(participants)
    print(f'Participants: {n}')

    # Tasks
    for idx in range(4):
        successes = [p['tasks'][idx]['success'] for p in participants if p['tasks'][idx]['success'] is not None]
        times = [p['tasks'][idx]['time'] for p in participants if p['tasks'][idx]['time'] is not None]
        success_rate = (sum(1 for s in successes if s)/len(successes)*100) if successes else 0
        mean_time = mean(times) if times else None
        median_time = median(times) if times else None
        print(f"Task {idx+1}: success_rate={success_rate:.1f}%; mean_time={mean_time if mean_time is not None else '-'}; median_time={median_time if median_time is not None else '-'}")

    # SUS
    sus_values = []
    for p in participants:
        scores = p['sus_scores']
        if any(s is None for s in scores):
            continue
        sus = compute_sus(scores)
        if sus is not None:
            sus_values.append(sus)
    if sus_values:
        print(f"SUS (N={len(sus_values)}): mean={mean(sus_values):.1f}, std={stdev(sus_values) if len(sus_values)>1 else 0:.1f}")
    else:
        print('SUS: no complete SUS responses')


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 analysis_script.py results.csv')
        sys.exit(1)
    path = sys.argv[1]
    with open(path, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        rows = [r for r in reader]
    analyze(rows)


if __name__ == '__main__':
    main()
