#!/usr/bin/env python3
"""Extract Canon title data from index.html → functions/data/canon-titles.json.

Mirrors the JS score() and lg() functions at index.html:2563-2611.
Re-run whenever the data in index.html changes; redeploy the function after.
"""
import json
import re
from pathlib import Path

INDEX = Path('/home/gespinavelosa/TheCanon/index.html')
OUT = Path('/home/gespinavelosa/TheCanon/functions/data/canon-titles.json')


def find_all_entries(text):
    """Yield (start, end) byte indices of each {id:N,type:'film'|'tv',...} block."""
    pos = 0
    while True:
        idx = text.find('{id:', pos)
        if idx < 0:
            return
        if not re.match(r"\{id:\d+,type:'(film|tv)'", text[idx:idx+40]):
            pos = idx + 1
            continue
        depth, i, in_str = 0, idx, False
        while i < len(text):
            c = text[i]
            if in_str:
                if c == '\\':
                    i += 2
                    continue
                if c == "'":
                    in_str = False
            else:
                if c == "'":
                    in_str = True
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        yield (idx, i + 1)
                        pos = i + 1
                        break
            i += 1
        else:
            return


def _unescape(s):
    return (s.replace("\\'", "'")
             .replace('\\"', '"')
             .replace("\\\\", "\\")
             .replace("\\n", "\n")
             .replace("\\t", "\t"))


def get_str(block, key):
    m = re.search(rf"(?:^|[,{{ ]){re.escape(key)}:'((?:\\.|[^'\\])*)'", block)
    return _unescape(m.group(1)) if m else None


def get_num(block, key, as_int=False):
    m = re.search(rf"(?:^|[,{{ ]){re.escape(key)}:(-?\d+(?:\.\d+)?)", block)
    if not m:
        return None
    v = m.group(1)
    return int(float(v)) if as_int else float(v)


def era_of(y):
    if y < 1930: return '1920s'
    if y < 1940: return '1930s'
    if y < 1950: return '1940s'
    if y < 1960: return '1950s'
    if y < 1970: return '1960s'
    if y < 1980: return '1970s'
    if y < 1990: return '1980s'
    if y < 2000: return '1990s'
    if y < 2010: return '2000s'
    if y < 2020: return '2010s'
    return '2020s'


def score(d):
    """Mirror of score() in index.html:2563."""
    if d['type'] == 'tv':
        return round(
            d['institutional'] * 0.30
            + d['awards']      * 0.27
            + d['meta']        * 0.23
            + d['rt']          * 0.10
            + d['imdb']
        )
    if d.get('lb') is not None:
        return round(
            d['institutional'] * 0.23
            + d['awards']      * 0.22
            + d['meta']        * 0.16
            + d['lb']          * 0.14
            + d['rt']          * 0.05
            + d['imdb']        * 0.5
            + d['bo']          * 0.15
        )
    return round(
        d['institutional'] * 0.23
        + d['meta']        * 0.20
        + d['rt']          * 0.10
        + d['imdb']
        + d['awards']      * 0.22
        + d['bo']          * 0.15
    )


def grade(s):
    """Mirror of lg() in index.html:2597. Uses U+2212 MINUS SIGN, not hyphen."""
    if s >= 95: return 'A+'
    if s >= 90: return 'A'
    if s >= 87: return 'A−'
    if s >= 83: return 'B+'
    if s >= 80: return 'B'
    if s >= 77: return 'B−'
    if s >= 73: return 'C+'
    if s >= 70: return 'C'
    if s >= 67: return 'C−'
    if s >= 60: return 'D+'
    if s >= 55: return 'D'
    return 'F'


def main():
    html = INDEX.read_text(encoding='utf-8')
    entries = []
    skipped = []

    for start, end in find_all_entries(html):
        block = html[start:end]

        tid = get_num(block, 'id', as_int=True)
        ttype = get_str(block, 'type')
        title = get_str(block, 'title')
        year = get_num(block, 'year', as_int=True)
        director = get_str(block, 'dir')
        country = get_str(block, 'country')
        synopsis = get_str(block, 'synopsis')

        # Score inputs
        d = {
            'type': ttype,
            'institutional': get_num(block, 'institutional'),
            'meta': get_num(block, 'meta'),
            'rt': get_num(block, 'rt'),
            'imdb': get_num(block, 'imdb'),
            'awards': get_num(block, 'awards'),
            'lb': get_num(block, 'lb'),
            'bo': get_num(block, 'bo'),
        }

        missing = [k for k in ('institutional', 'meta', 'rt', 'imdb', 'awards') if d[k] is None]
        if ttype == 'film':
            missing += [k for k in ('bo',) if d[k] is None]
        if missing:
            skipped.append((tid, title, f"missing fields: {missing}"))
            continue
        if not title or not year:
            skipped.append((tid, title, 'missing title or year'))
            continue

        s = score(d)
        out = {
            'id': tid,
            'type': ttype,
            'title': title,
            'year': year,
            'dir': director or '',
            'country': country or '',
            'era': era_of(year),
            'synopsis': synopsis or '',
            's': s,
            'g': grade(s),
        }
        entries.append(out)

    entries.sort(key=lambda e: e['id'])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')))

    films = sum(1 for e in entries if e['type'] == 'film')
    tvs = sum(1 for e in entries if e['type'] == 'tv')
    print(f"✓ Extracted {len(entries)} titles ({films} films, {tvs} TV)")
    print(f"  → {OUT}  ({OUT.stat().st_size:,} bytes)")
    if skipped:
        print(f"\n⚠ Skipped {len(skipped)}:")
        for tid, t, reason in skipped[:10]:
            print(f"    id:{tid} '{t}' — {reason}")

    # Spot checks
    by_id = {e['id']: e for e in entries}
    print("\n=== spot checks ===")
    for tid in (1, 42, 100, 200, 500):
        if tid in by_id:
            e = by_id[tid]
            print(f"  id={e['id']:>3}  {e['g']:<3}  {e['s']:>3}/100  {e['year']}  {e['title']}")


if __name__ == '__main__':
    main()
