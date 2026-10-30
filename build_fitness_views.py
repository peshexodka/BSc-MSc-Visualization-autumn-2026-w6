"""Build an SVG/HTML chart from individual Excel viewing records (stdlib only)."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from html import escape
from pathlib import Path
from zipfile import ZipFile
import json
import xml.etree.ElementTree as ET

SOURCE = Path(__file__).resolve().parents[2] / 'week 5' / 'Онлайн-тренировки, 10 недель.xlsx'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
BASE = datetime(1899, 12, 30)
COLORS = {'Анна': '#7154BF', 'Богдана': '#137E89', 'Виталия': '#BB7613', 'Галина': '#3376C8', 'Диана': '#BE467A'}


def cell_value(cell):
    value = cell.find('m:v', NS)
    inline = cell.find('m:is/m:t', NS)
    raw = value.text if value is not None else (inline.text if inline is not None else None)
    return float(raw) if cell.get('t') == 'n' and raw is not None else raw


with ZipFile(SOURCE) as archive:
    sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
rows = []
for row in sheet.findall('.//m:sheetData/m:row', NS)[1:]:
    cells = {''.join(filter(str.isalpha, c.get('r', ''))): cell_value(c) for c in row}
    rows.append({
        'id': int(cells['A']), 'user': int(cells['B']), 'week': int(cells['C']),
        'day': cells['D'], 'code': cells['E'], 'type': cells['F'], 'trainer': cells['G'],
        'duration': cells['H'], 'watched': cells['I'], 'depth': cells['J'],
        'rating': cells['K'], 'opened': int(cells['L']), 'viewed': int(cells['M']),
    })
assert len(rows) == len({d['id'] for d in rows}) == 3755
start = min(d['opened'] for d in rows)
weekly = Counter((d['viewed'] - start) // 7 + 1 for d in rows)
groups = defaultdict(list)
for d in rows:
    d['delay'] = d['viewed'] - d['opened']
    groups[d['code']].append(d)
assert len(groups) == 80
assert all(0 <= d['depth'] <= 1 and 0 <= d['delay'] <= 5 for d in rows)
max_bucket = max(Counter((d['code'], d['delay']) for d in rows).values())
assert max_bucket <= 24

W, H, LEFT, CW = 1510, 1450, 190, 129
parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="Каждая из 3755 полосок — отдельный просмотр пользователем" style="display:block;width:100%;font-family:Arial,sans-serif;background:#fbfcfe">']


def text(x, y, value, size=13, color='#566174', weight=400, anchor='start'):
    parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(str(value))}</text>')


def line(x1, y1, x2, y2, color='#e3e8ef', width=1, dash=''):
    parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}" stroke-dasharray="{dash}"/>')


text(25, 39, 'Пульс просмотров: от пользователя к программе', 29, '#1b283e', 700)
text(25, 65, 'Каждая полоска ниже — один просмотр конкретной видеотренировки конкретным пользователем', 15)
stats = [(25, '3 755', 'отдельных просмотров'), (290, '101', 'пользователь'), (520, '80', 'видеотренировок'), (760, '454', 'пик: 2-я неделя'), (1030, '81', 'просмотр после 10-й недели')]
for x, value, label in stats:
    text(x, 111, value, 28, '#1b283e', 700)
    text(x, 134, label, 13)

text(25, 178, '01  КОГДА ПОЛЬЗОВАТЕЛИ СМОТРЕЛИ', 15, '#1b283e', 700)
text(25, 200, 'По фактической дате просмотра; неделя 1 начинается 20.07.2026. Последняя точка — неполная неделя.', 13)
tx = lambda w: LEFT + (w - 1) * 122
ty = lambda count: 355 - count / 500 * 119
for value in (0, 250, 500):
    line(LEFT, ty(value), 1470, ty(value))
    text(LEFT - 14, ty(value) + 4, value, 11, anchor='end')
path = ' '.join(('M' if i == 0 else 'L') + f' {tx(w)} {ty(weekly[w])}' for i, w in enumerate(range(1, 12)))
parts.append(f'<path d="{path}" fill="none" stroke="#29394f" stroke-width="3"/>')
for week in range(1, 12):
    x, y = tx(week), ty(weekly[week])
    parts.append(f'<circle cx="{x}" cy="{y}" r="4" fill="#29394f"/>')
    text(x, y - 13, weekly[week], 15, '#1b283e', 700, 'middle')
    label = str(week) if week <= 10 else '11*'
    text(x, 378, 'Нед. ' + label, 11, anchor='middle')
    date = BASE + timedelta(days=start + (week - 1) * 7)
    text(x, 395, date.strftime('%d.%m'), 10, anchor='middle')
text(25, 424, '* Неделя 11: 28.09–02.10, только 5 наблюдаемых дней. Её падение нельзя трактовать как отток.', 12, '#956113')

text(25, 463, '02  КАКИЕ ПРОСМОТРЫ СЛОЖИЛИСЬ В ЭТУ ДИНАМИКУ', 15, '#1b283e', 700)
text(25, 485, 'Каркас: неделя выхода × слот тренировки. Внутри ячейки — шесть колонок задержки: 0, 1, 2, 3, 4, 5 дней после открытия.', 13)
for i, (name, color) in enumerate(COLORS.items()):
    x = 30 + i * 138
    parts.append(f'<rect x="{x}" y="504" width="17" height="6" rx="2" fill="{color}"/>')
    text(x + 25, 512, name, 12)
text(760, 512, 'Цвет — тренер; заполнение полоски — доля просмотренного видео', 12)
parts.append('<rect x="30" y="529" width="20" height="7" fill="#e6ebf2"/><rect x="30" y="529" width="12" height="7" fill="#7154BF"/>')
text(61, 537, '60% видео', 12)
parts.append('<circle cx="232" cy="532" r="3" fill="#24364f"/>')
text(244, 537, 'есть оценка', 12)
parts.append('<circle cx="395" cy="532" r="3" fill="none" stroke="#94a3b8"/>')
text(407, 537, 'без оценки', 12)
parts.append('<circle cx="558" cy="532" r="3" fill="#cb3f4e"/>')
text(570, 537, 'оценка ≤3', 12)
text(760, 537, 'Одна полоска = один просмотр. Никаких усреднённых «частиц».', 12, '#1b283e', 600)

labels = ['Пн · Разминка', 'Пн · Кардио', 'Ср · Разминка', 'Ср · Силовая', 'Пт · Разминка', 'Пт · Интенсив', 'Сб · Дэнс', 'Вс · Йога']
grid_top, row_height = 595, 87
for week in range(1, 11):
    center = LEFT + (week - 1) * CW + CW / 2
    text(center, 574, f'Неделя {week}', 13, '#1b283e', 700, 'middle')
for slot, label in enumerate(labels, 1):
    y = grid_top + (slot - 1) * row_height
    parts.append(f'<rect x="18" y="{y-13}" width="1472" height="85" rx="7" fill="{"#eef3f8" if slot % 2 == 0 else "#ffffff"}"/>')
    text(29, y + 17, label, 13, '#28384e', 600)
    text(29, y + 37, f'слот {slot:02}', 10)
    for week in range(1, 11):
        code = f'{week:02}-{slot:02}'
        events = groups[code]
        x = LEFT + (week - 1) * CW
        text(x + 4, y - 2, f'{code} · {len(events)} просм.', 10, '#566174')
        buckets = defaultdict(list)
        for event in events:
            buckets[event['delay']].append(event)
        for delay in range(6):
            bx = x + 6 + delay * 19
            text(bx + 5, y + 67, delay, 8, '#7c8798', anchor='middle')
            for index, event in enumerate(sorted(buckets[delay], key=lambda d: (d['viewed'], d['user'], d['id']))):
                ex = bx + (index // 12) * 8
                ey = y + 5 + (11 - index % 12) * 4.1
                color = COLORS[event['trainer']]
                rating = event['rating']
                title = (f"Просмотр {event['id']} · пользователь {event['user']}\n"
                         f"{code} · {event['type']} · {event['trainer']}\n"
                         f"Дата просмотра: {(BASE + timedelta(days=event['viewed'])).strftime('%d.%m.%Y')}\n"
                         f"Через {event['delay']} дн. после открытия\n"
                         f"Просмотрено {event['watched']:.2f} из {event['duration']:.2f} мин ({event['depth']:.1%})\n"
                         f"Оценка: {int(rating) if rating is not None else 'не поставлена'}")
                parts.append(f'<g class="view" data-id="{event["id"]}"><title>{escape(title)}</title>')
                parts.append(f'<rect x="{ex}" y="{ey}" width="5.1" height="2.8" rx="0.6" fill="#dce3ed"/>')
                parts.append(f'<rect x="{ex}" y="{ey}" width="{5.1*event["depth"]:.3f}" height="2.8" rx="0.6" fill="{color}"/>')
                mark = '#94a3b8' if rating is None else ('#cb3f4e' if rating <= 3 else '#24364f')
                fill = 'none' if rating is None else mark
                parts.append(f'<circle cx="{ex+6.4}" cy="{ey+1.4}" r="0.65" fill="{fill}" stroke="{mark}" stroke-width="0.45"/></g>')

text(25, 1334, 'Что видно', 16, '#1b283e', 700)
text(145, 1334, 'Пик фактических просмотров — неделя 2 (454). На неделе 5 — рост до 412, на неделе 6 — снижение до 331.', 13)
text(145, 1357, 'В контенте недели 5 разминка 05-01 и кардио 05-02 дали по +19 просмотров к тем же слотам недели 4.', 13)
text(145, 1380, 'Неполные полоски у 02-06, 03-08, 06-04 и 08-07 показывают проблемные просмотры, скрытые средним объёмом.', 13)
text(25, 1413, 'Две временные оси различаются: сверху — когда смотрели; снизу — когда вышла тренировка. Связь не доказывает причинность.', 12)
text(25, 1436, 'Источник: Excel «Онлайн-тренировки, 10 недель», лист «Просмотры». Статический снимок, 3755 уникальных ID просмотра.', 11)
parts.append('</svg>')
svg = ''.join(parts)
assert svg.count('class="view"') == len(rows)
Path('fitness-views.svg').write_text(svg)
html = ('<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Неделя 6. Валерия Юнусова — просмотры</title><style>body{margin:0;background:#fbfcfe}main{max-width:1650px;margin:auto;padding:16px}.view:hover{filter:brightness(.6)}</style>'
        '</head><body><main>' + svg + '</main></body></html>')
Path('fitness-views.html').write_text(html)
Path('fitness-views-summary.json').write_text(json.dumps({'views': len(rows), 'users': len({d['user'] for d in rows}), 'workouts': len(groups), 'weekly_actual': dict(sorted(weekly.items())), 'max_per_day': max_bucket}, ensure_ascii=False, indent=2))
print(Path('fitness-views.html').resolve())
print('Particle count:', svg.count('class="view"'))
print('Actual weekly views:', sorted(weekly.items()))
