(function () {
  const rows = JSON.parse(document.getElementById('fitness-data').textContent);
  const F = globalThis.Fitness;
  const state = {type: 'all', trainer: 'all', order: 'types', selected: '06-04', view: 'content', showValues: false};
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = (value, digits = 0) => value === null ? '—' : value.toLocaleString('ru-RU', {minimumFractionDigits: digits, maximumFractionDigits: digits});
  const pct = value => value === null ? '—' : fmt(value * 100, 1) + '%';
  const date = serial => new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toLocaleDateString('ru-RU');
  const lessonWord = n => n % 10 === 1 && n % 100 !== 11 ? 'занятие' : [2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100) ? 'занятия' : 'занятий';
  const totals = F.stats(rows);
  const cohort = F.retention(rows);
  const counts = F.trainerCounts(rows);
  const fixedTypes = F.typeOrder(rows);
  const allWorkouts = F.group(rows);
  const typeCodes = {'Кардио': 'Кр', 'Силовая': 'Сл', 'Разминка': 'Рз', 'Йога': 'Йг', 'Дэнс': 'Дн', 'Интенсив': 'Ин'};
  $('type-legend').innerHTML = fixedTypes.map(type => `<span><b>${typeCodes[type]}</b> — ${esc(type)}</span>`).join('');
  $('audience').textContent = `${cohort.first.users} → ${cohort.last.users}`;
  $('program-views').textContent = `${fmt(cohort.first.views)} → ${fmt(cohort.last.views)}`;
  $('same-users').textContent = `${fmt(cohort.cohortFirst)} → ${fmt(cohort.cohortLast)}`;
  $('cohort-label').textContent = `просмотры тех же ${cohort.cohortUsers} пользователей`;
  $('cohort-note').textContent = `Группа сравнения — ${cohort.cohortUsers} пользователей, смотревших занятия ${cohort.lastWeek}-й недели. Считаются их просмотры контента ${cohort.firstWeek}-й и ${cohort.lastWeek}-й недель, включая более поздние даты просмотра. Это не доказательство причин ухода остальных пользователей.`;
  $('coverage-note').textContent = `Во всём файле ${fmt(totals.views)} просмотров; без оценки — ${fmt(totals.unrated)} (${pct(totals.unrated / totals.views)}). Отсутствие оценки не означает недовольство.`;
  $('type-filter').innerHTML = '<option value="all">Все типы</option>' + F.types.map(t => `<option>${esc(t)}</option>`).join('');
  $('trainer-filters').innerHTML = '<button type="button" class="trainer-filter" data-trainer="all" aria-pressed="true">Все тренеры</button>' +
    Object.entries(F.trainerColors).map(([name, color]) => `<button type="button" class="trainer-filter" data-trainer="${esc(name)}" aria-pressed="false" style="--trainer-color:${color}" title="Количество разных занятий за всю программу"><span class="trainer-initial">${name[0]}</span> ${esc(name)} <span class="frequency">${counts[name]} занятий</span></button>`).join('');

  function renderCalendar() {
    const weeks = F.calendarWeeks(rows), width = 1080, height = 540;
    const x = i => 58 + i * (width - 105) / (weeks.length - 1);
    const y = n => 420 - n / 500 * 340;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Фактические просмотры по календарным неделям">`;
    [0, 250, 500].forEach(value => { svg += `<line x1="58" y1="${y(value)}" x2="${width-42}" y2="${y(value)}" stroke="#E1E5E0"/><text x="45" y="${y(value)+4}" text-anchor="end" font-size="10" fill="#78858C">${value}</text>`; });
    const complete = weeks.filter(w => !w.partial);
    svg += `<path d="${complete.map((w,i)=>(i?'L':'M')+x(i)+','+y(w.views)).join(' ')}" fill="none" stroke="#435A68" stroke-width="2.5"/>`;
    weeks.forEach((week, i) => {
      if (week.partial && i) svg += `<path d="M${x(i-1)},${y(weeks[i-1].views)}L${x(i)},${y(week.views)}" fill="none" stroke="#78858C" stroke-width="2" stroke-dasharray="4,4"/>`;
      svg += `<circle cx="${x(i)}" cy="${y(week.views)}" r="3" fill="#435A68"><title>${esc(date(week.from)+'–'+date(week.to)+': '+week.views+' просмотров')}</title></circle><text x="${x(i)}" y="${y(week.views)-11}" text-anchor="middle" font-size="13" font-weight="600" fill="#233A48">${week.views}</text><text x="${x(i)}" y="455" text-anchor="middle" font-size="11" fill="#64737B">Нед. ${week.week}${week.partial?'*':''}</text><text x="${x(i)}" y="477" text-anchor="middle" font-size="10" fill="#78858C">${esc(date(week.from).slice(0,5))}</text>`;
    });
    $('calendar-chart').innerHTML = svg + '</svg>';
    $('calendar-note').textContent = '*11-я неделя: 5 дней (28.09–02.10), не полный период. Пунктир не означает отток.';
    const views = code => rows.filter(r => r.code === code).length;
    $('weekly-content-note').textContent = `Вклад конкретных занятий в просмотры контента: 4→5-я неделя — 330→403 (+73), в том числе разминка 05-01 и кардио 05-02 — по +${views('05-01')-views('04-01')}. На 6-й неделе — 311 просмотров; разминка 06-05 потеряла ${views('05-05')-views('06-05')}, дэнс 06-07 — ${views('05-07')-views('06-07')} к тем же слотам пятой недели. Это вклад в сумму, не доказательство причинности.`;
  }

  function renderTrainers() {
    const trainers = F.trainerComparison(rows);
    $('trainer-summary').textContent = 'По наблюдаемым просмотрам на занятие выше Богдана (50,7) и Анна (49,9). По средним оценкам — Диана (4,80; 396 оценок) и Анна (4,66; 467). Для интерпретации смотрите типы, число занятий и недели, а не только общий показатель.';
    $('trainer-table-head').innerHTML = '<tr><th scope="col">Тренер</th><th scope="col">Все занятия</th>' + fixedTypes.map(type=>`<th scope="col" class="type-cell">${esc(type)}</th>`).join('') + '<th scope="col">Оценка (n)</th></tr>';
    $('trainer-table-body').innerHTML = trainers.map(trainer=>`<tr><th scope="row"><span class="name-mark" style="border-color:${F.trainerColors[trainer.trainer]}">${esc(trainer.trainer)}</span></th><td><b>${fmt(trainer.viewsPerWorkout,1)}</b><span class="cell-count">${trainer.workouts} занятий</span></td>` + fixedTypes.map(type=>{
      const s=trainer.byType[type]; return `<td>${s.workouts?fmt(s.viewsPerWorkout,1):'—'}<span class="cell-count${s.workouts===1?' sample-warning':''}">${s.workouts?s.workouts+' '+lessonWord(s.workouts):''}</span></td>`;
    }).join('') + `<td>${fmt(trainer.rating,2)}<span class="cell-count">n=${trainer.rated}</span></td></tr>`).join('');
  }

  function renderCandidates() {
    $('rewrite-shortlist').innerHTML = '<span>Проверить · глубина &lt;80%:</span>' + F.rewriteCandidates(rows).map(w=>`<button type="button" class="analysis-button" data-open-workout="${w.code}" title="${esc(w.type+' · '+w.trainer+' · '+pct(w.depth))}">${w.code}</button>`).join('') + '<button type="button" class="text-link" data-open-panel="rewrite-panel">Все 4 занятия</button>';
    $('rewrite-body').innerHTML = F.rewriteCandidates(rows).map(workout=>`<tr><th scope="row"><button type="button" class="analysis-button" data-open-workout="${workout.code}">${workout.code}</button> ${esc(workout.type)}</th><td>${esc(workout.trainer)}</td><td>${workout.views}</td><td><b>${pct(workout.depth)}</b></td><td>${workout.lowDepth} из ${workout.views}</td><td>${fmt(workout.rating,2)} <span class="muted">(n=${workout.rated})</span></td></tr>`).join('');
  }

  const groups = F.activityGroups(rows);
  const activityLabels = {low:'Низкая',middle:'Средняя',high:'Высокая',minimum:'Минимальная (дополнительный срез)'};
  $('activity-filter').innerHTML = ['low','middle','high','minimum'].map(key=>{
    const group=groups[key]; return `<option value="${key}">${key==='minimum'?'Минимальная':activityLabels[key]} · ${group.min}–${group.max} занятий</option>`;
  }).join('');
  function renderActivity() {
    const key=$('activity-filter').value, group=groups[key], preferences=F.typePreferences(rows,group.ids);
    $('activity-summary').textContent = `Пользователей: ${group.users} · занятий: ${group.min}–${group.max}`;
    $('activity-body').innerHTML = preferences.map(s=>`<tr title="${esc('Попробовали '+s.participants+' из '+s.users+'; вся аудитория: '+pct(s.reference))}"><th scope="row">${esc(s.type)}</th><td class="activity-value"><span class="mini-track"><span class="mini-fill" style="width:${(s.fraction||0)*100}%"></span><i class="reference-marker" style="left:${(s.reference||0)*100}%"></i></span><b>${pct(s.fraction)}</b></td></tr>`).join('');
    $('activity-warning').hidden = key!=='minimum';
    $('activity-warning').textContent = 'Всего 4 пользователя: результат предварительный, не обобщаем на всех.';
  }

  function renderChart(workouts) {
    const W = 1080, H = 540, left = 74, right = 1050, top = 62, bottom = 442;
    const gap = 14, weekWidth = (right - left - gap * 9) / 10;
    const step = weekWidth / 8, dy = (bottom - top) / 80;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" data-baseline="${bottom}" role="group" aria-label="Просмотры выбранных тренировок по неделе выхода">`;
    function text(x, y, value, size = 12, color = '#64737B', weight = 400, anchor = 'start', className = '') {
      svg += `<text${className ? ` class="${className}"` : ''} x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
    }
    for (let week = 1; week <= 10; week++) {
      const x = left + (week - 1) * (weekWidth + gap);
      const list = workouts.filter(w => w.week === week);
      if (week % 2 === 0) svg += `<rect x="${x}" y="${top - 10}" width="${weekWidth}" height="${bottom - top + 23}" rx="7" fill="#F1F2EE"/>`;
      text(x + weekWidth / 2, 19, `Неделя ${week}`, 11, '#435A68', 600, 'middle');
      text(x + weekWidth / 2, 521, list.length ? fmt(list.reduce((sum, w) => sum + w.events.length, 0)) : '—', 15, '#233A48', 700, 'middle');
    }
    [0, 20, 40, 60, 80].forEach(value => {
      const y = bottom - value * dy;
      svg += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#E1E5E0" stroke-dasharray="2,5"/>`;
      text(left - 12, y + 4, value, 11, '#64737B', 400, 'end');
    });
    text(left, 43, 'Просмотры занятия', 11, '#435A68', 600);
    text(left - 8, 475, 'Тип', 9, '#64737B', 400, 'end');
    text(left - 8, 496, 'Тренер', 9, '#64737B', 400, 'end');
    text(left - 8, 521, 'За неделю', 9, '#64737B', 400, 'end');
    for (let week = 1; week <= 10; week++) {
      const list = workouts.filter(w => w.week === week);
      const center = left + (week - 1) * (weekWidth + gap) + weekWidth / 2;
      // Keep type/schedule slots fixed, including when a filter leaves gaps.
      const reference = state.order === 'ranked' ? list : F.order(allWorkouts.filter(w => w.week === week), state.order, fixedTypes);
      const peak = list.reduce((best, workout) => !best || workout.events.length > best.events.length ? workout : best, null);
      list.forEach((workout, position) => {
        const slot = reference.findIndex(w => w.code === workout.code);
        const x = center + (slot - (reference.length - 1) / 2) * step;
        const color = F.trainerColors[workout.trainer];
        const selected = workout.code === state.selected;
        svg += `<g class="workout${selected ? ' selected' : ''}" data-workout="${workout.code}" role="button" tabindex="0" aria-label="${esc(workout.code + ', ' + workout.type + ', ' + workout.trainer + ', просмотров ' + workout.events.length)}">`;
        svg += `<rect class="selection" x="${x - 4.8}" y="${bottom - workout.events.length * dy - 5}" width="9.6" height="${workout.events.length * dy + 12}" rx="3" fill="transparent" stroke="${selected ? '#435A68' : 'transparent'}"/>`;
        F.orderViews(workout.events).forEach((event, i) => {
          // The first mark is at one view, not on the zero baseline.
          const y = bottom - (i + 1) * dy;
          const width = 7.4 * event.depth;
          const title = `${event.code} · ${event.type} · ${event.trainer}\nПросмотр ${event.id} · пользователь ${event.user}\n${date(event.viewed)} · ${pct(event.depth)} видео\nОценка: ${event.rating === null ? 'не поставлена' : event.rating}`;
          svg += `<path class="view" data-view-id="${event.id}" data-rating-group="${F.ratingGroup(event)}" d="M${(x - 3.7).toFixed(2)} ${y.toFixed(2)}h${width.toFixed(3)}" stroke="${F.color(event)}" stroke-width="2.6"><title>${esc(title)}</title></path>`;
          if (event.depth < .8) svg += `<path class="remainder" d="M${(x - 3.7 + width).toFixed(3)} ${y.toFixed(2)}h${(7.4 - width).toFixed(3)}" stroke="${F.palette.remainder}" stroke-width="2.6"/>`;
        });
        if (workout.events.some(e => e.depth < .8)) svg += `<circle cx="${x}" cy="${bottom + 13}" r="2.5" fill="${F.palette.remainder}"/>`;
        const labelClass = 'workout-total' + (!state.showValues && !selected && workout.code !== peak?.code ? ' secondary-total' : '');
        text(x, bottom - workout.events.length * dy - 10, workout.events.length, 9, '#435A68', 600, 'middle', labelClass);
        text(x, 475, typeCodes[workout.type], 8, '#64737B', 500, 'middle', 'workout-type');
        text(x, 496, workout.trainer[0], 10, color, 700, 'middle', 'trainer-label');
        svg += '</g>';
      });
    }
    if (!workouts.length) text(W / 2, 245, 'Нет занятий по выбранным фильтрам', 17, '#435A68', 600, 'middle');
    return svg + '</svg>';
  }

  function renderDetail(workouts) {
    const workout = workouts.find(w => w.code === state.selected);
    $('workout-detail').hidden = !workout;
    if (!workout) return;
    const s = F.stats(workout.events);
    $('detail-title').textContent = `${workout.type} · ${workout.trainer} · ${workout.code}`;
    $('detail-context').textContent = `Неделя ${workout.week} · ${workout.day} · ${fmt(workout.duration, 1)} мин`;
    $('detail-title').style.borderColor = F.trainerColors[workout.trainer];
    $('detail-views').textContent = fmt(s.views);
    $('detail-rating').textContent = s.rating === null ? 'Нет оценок' : `${fmt(s.rating, 2)} / 5`;
    $('detail-rated').textContent = `${s.rated} оценок из ${s.views} просмотров`;
    $('detail-depth').textContent = pct(s.depth);
    $('detail-warning').hidden = s.rated === 0 || s.rated >= 10;
    $('detail-warning').textContent = `Мало оценок (${s.rated}): средний балл интерпретируем осторожно.`;
  }

  function renderComparison() {
    const comparisonRows = F.filter(rows, 'all', state.trainer);
    const items = fixedTypes.map(type => ({type, ...F.stats(comparisonRows.filter(r => r.type === type))}));
    $('type-comparison-note').textContent = `Просмотров / занятие · ${state.trainer === 'all' ? 'все тренеры' : state.trainer}`;
    function sparkline(type) {
      const values = F.weeklyTypeSeries(rows, type, state.trainer);
      let drawing = '<svg class="sparkline" viewBox="0 0 174 40" role="img" aria-label="Просмотры на занятие по неделям 1–10, шкала 0–80"><line x1="6" y1="34" x2="168" y2="34" stroke="#DDE3DE"/>';
      let path = '', previous = null;
      values.forEach((value, i) => {
        if (value === null) { previous = null; return; }
        const x = 6 + i * 18, y = 34 - value / 80 * 28;
        path += `${previous === null ? 'M' : 'L'}${x},${y.toFixed(2)}`;
        previous = i;
      });
      drawing += `<path d="${path}" fill="none" stroke="#435A68" stroke-width="1.8"/>`;
      values.forEach((value, i) => {
        if (value !== null) drawing += `<circle cx="${6 + i * 18}" cy="${(34 - value / 80 * 28).toFixed(2)}" r="2" fill="#435A68"><title>Неделя ${i + 1}: ${fmt(value, 1)} просмотра на занятие</title></circle>`;
      });
      return drawing + '</svg>';
    }
    $('type-comparison-body').innerHTML = items.map(s => `<tr data-type="${s.type}" tabindex="0" role="button" aria-pressed="${state.type===s.type}" aria-label="${esc(s.type+': '+fmt(s.viewsPerWorkout,1)+' просмотра на занятие')}" title="${s.workouts} ${lessonWord(s.workouts)}; оценка ${fmt(s.rating,2)}, n=${s.rated}"><th scope="row">${esc(s.type)}</th><td>${sparkline(s.type)}</td><td class="type-value">${fmt(s.viewsPerWorkout, 1)}</td></tr>`).join('');
  }

  function renderCoachSummary() {
    const metric=$('coach-metric').value;
    const trainers=F.trainerComparison(F.filter(rows,state.type,'all'));
    trainers.sort((a,b)=>(metric==='rating'?(b.rating??-1)-(a.rating??-1):(b.viewsPerWorkout??-1)-(a.viewsPerWorkout??-1)));
    $('coach-scope').textContent=state.type==='all'?'Все типы':state.type;
    $('coach-summary').innerHTML=trainers.map(trainer=>{
      const value=metric==='rating'?trainer.rating:trainer.viewsPerWorkout;
      const n=metric==='rating'?trainer.rated:trainer.workouts;
      return `<button type="button" class="coach-row" data-trainer="${esc(trainer.trainer)}" aria-pressed="${state.trainer===trainer.trainer}" title="${metric==='rating'?'Средняя оценка; n — число оценок':'Просмотров на занятие; n — число занятий'}"><span class="coach-name"><b style="color:${F.trainerColors[trainer.trainer]}">${trainer.trainer[0]}</b>${esc(trainer.trainer)}</span><span class="coach-track"><span class="coach-fill" style="width:${value===null?0:value/(metric==='rating'?5:80)*100}%"></span></span><span class="coach-value">${fmt(value,metric==='rating'?2:1)}<small>n=${n}</small></span></button>`;
    }).join('');
  }

  function renderView() {
    const calendar=state.view==='calendar';
    $('content-view').hidden=calendar;
    $('calendar-panel').hidden=!calendar;
    $('view-caption').textContent=calendar?'Фактическая дата просмотра · вся программа':'Неделя выхода видео · поздние просмотры включены';
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===state.view)));
  }

  function render() {
    const filtered = F.filter(rows, state.type, state.trainer);
    const workouts = F.order(F.group(filtered), state.order, fixedTypes);
    if (!workouts.some(w => w.code === state.selected)) state.selected = workouts[0]?.code || null;
    const s = F.stats(filtered);
    $('filtered-views').textContent = fmt(s.views);
    $('filtered-workouts').textContent = fmt(s.workouts);
    $('filtered-per-workout').textContent = fmt(s.viewsPerWorkout, 1);
    $('filtered-rating').textContent = s.rating === null ? '—' : `${fmt(s.rating, 2)} / 5`;
    $('filtered-rated').textContent = `(n=${fmt(s.rated)})`;
    $('filtered-rated').title = `${fmt(s.rated)} оценок из ${fmt(s.views)} просмотров`;
    $('filter-status').textContent = `${state.type === 'all' ? 'Все типы' : state.type} · ${state.trainer === 'all' ? 'все тренеры' : state.trainer} · ${s.workouts} занятий, ${s.views} просмотров`;
    $('mode-note').textContent = state.order === 'types'
      ? 'Типы идут в одном порядке во всех неделях — по просмотрам на занятие за всю программу. Три разминки рядом.'
      : state.order === 'schedule'
        ? 'Порядок по расписанию. Так сравниваются одинаковые этапы недели.'
        : 'Сначала больше просмотров внутри недели. Это популярность, а не рейтинг качества.';
    $('chart').innerHTML = renderChart(workouts);
    document.querySelectorAll('[data-trainer]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.trainer === state.trainer)));
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.order)));
    renderDetail(workouts);
    renderComparison();
    renderCoachSummary();
    renderView();
  }

  $('type-filter').addEventListener('change', event => { state.type = event.target.value; render(); });
  $('trainer-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-trainer]');
    if (button) { state.trainer = button.dataset.trainer; render(); }
  });
  $('coach-summary').addEventListener('click',event=>{const button=event.target.closest('[data-trainer]');if(button){state.view='content';state.trainer=button.dataset.trainer;render();}});
  $('coach-metric').addEventListener('change',renderCoachSummary);
  $('show-values').addEventListener('change',event=>{state.showValues=event.target.checked;render();});
  function selectType(event) {
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    const row=event.target.closest('[data-type]');
    if(row){if(event.type==='keydown')event.preventDefault();state.view='content';state.type=state.type===row.dataset.type?'all':row.dataset.type;$('type-filter').value=state.type;render();}
  }
  $('type-comparison-body').addEventListener('click',selectType);
  $('type-comparison-body').addEventListener('keydown',selectType);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.view;renderView();}));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { state.order = button.dataset.mode; render(); }));
  function selectWorkout(event) {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest('[data-workout]');
    if (target) {
      if (event.type === 'keydown') event.preventDefault();
      state.selected = target.dataset.workout;
      render();
      if (event.type === 'keydown') document.querySelector(`[data-workout="${state.selected}"]`)?.focus();
    }
  }
  $('chart').addEventListener('click', selectWorkout);
  $('chart').addEventListener('keydown', selectWorkout);
  $('reset-filters').addEventListener('click', () => { state.type = 'all'; state.trainer = 'all'; $('type-filter').value = 'all'; render(); });
  $('activity-filter').addEventListener('change', renderActivity);
  document.addEventListener('click', event => {
    const opener=event.target.closest('[data-open-panel]');
    if(opener){let panel=$(opener.dataset.openPanel);for(let p=panel;p;p=p.parentElement){if(p.tagName==='DETAILS')p.open=true;}panel.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const button=event.target.closest('[data-open-workout]');
    if (button) {
      state.type='all';state.trainer='all';state.view='content';state.selected=button.dataset.openWorkout;$('type-filter').value='all';render();
      $('workout-detail').scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
  renderCalendar();
  renderTrainers();
  renderCandidates();
  renderActivity();
  render();
  globalThis.fitnessState = state;
})();
