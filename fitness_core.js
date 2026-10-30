/* Pure calculations shared by the self-contained HTML and Node checks. */
(function (global) {
  const trainerColors = {
    'Анна': '#0057D9', 'Богдана': '#7025B9', 'Виталия': '#00786A',
    'Галина': '#B1008D', 'Диана': '#18222E',
  };
  const palette = {high: '#BE9024', low: '#7B8D9B', unrated: '#D0D7DC', remainder: '#E34D21'};
  const types = ['Разминка', 'Кардио', 'Силовая', 'Интенсив', 'Дэнс', 'Йога'];
  function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
  function filter(rows, type, trainer) {
    return rows.filter(r => (type === 'all' || r.type === type) && (trainer === 'all' || r.trainer === trainer));
  }
  function group(rows) {
    const result = new Map();
    rows.forEach(r => {
      if (!result.has(r.code)) result.set(r.code, {...r, events: []});
      result.get(r.code).events.push(r);
    });
    return [...result.values()];
  }
  function order(workouts, mode, fixedTypes = types) {
    return [...workouts].sort((a, b) => a.week - b.week ||
      (mode === 'ranked' ? b.events.length - a.events.length :
        mode === 'types' ? fixedTypes.indexOf(a.type) - fixedTypes.indexOf(b.type) : 0) || a.code.localeCompare(b.code));
  }
  function stats(rows) {
    const ratings = rows.filter(r => r.rating !== null).map(r => r.rating);
    return {
      views: rows.length, workouts: new Set(rows.map(r => r.code)).size,
      users: new Set(rows.map(r => r.user)).size, rated: ratings.length,
      rating: mean(ratings), depth: mean(rows.map(r => r.depth)),
      viewsPerWorkout: rows.length ? rows.length / new Set(rows.map(r => r.code)).size : null,
      high: rows.filter(r => r.rating !== null && r.rating >= 4).length,
      low: rows.filter(r => r.rating !== null && r.rating <= 3).length,
      unrated: rows.length - ratings.length,
    };
  }
  function retention(rows) {
    const firstWeek = Math.min(...rows.map(r => r.week));
    const lastWeek = Math.max(...rows.map(r => r.week));
    const first = rows.filter(r => r.week === firstWeek);
    const last = rows.filter(r => r.week === lastWeek);
    const cohort = new Set(last.map(r => r.user));
    return {
      first: stats(first), last: stats(last), cohortUsers: cohort.size,
      cohortFirst: first.filter(r => cohort.has(r.user)).length,
      cohortLast: last.filter(r => cohort.has(r.user)).length,
      firstWeek, lastWeek,
    };
  }
  function color(row) { return row.rating === null ? palette.unrated : row.rating <= 3 ? palette.low : palette.high; }
  function ratingGroup(row) { return row.rating === null ? 0 : row.rating <= 3 ? 1 : 2; }
  function orderViews(events) {
    return [...events].sort((a, b) => ratingGroup(a) - ratingGroup(b) || a.depth - b.depth || a.id - b.id);
  }
  function typeOrder(rows) {
    return types.map((type, index) => ({type, index, average: stats(rows.filter(r => r.type === type)).viewsPerWorkout}))
      .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.index - b.index)
      .map(item => item.type);
  }
  function weeklyTypeSeries(rows, type, trainer = 'all') {
    const selected = filter(rows, type, trainer);
    return Array.from({length: 10}, (_, i) => stats(selected.filter(r => r.week === i + 1)).viewsPerWorkout);
  }
  function trainerCounts(rows) {
    return Object.fromEntries(Object.keys(trainerColors).map(name =>
      [name, new Set(rows.filter(r => r.trainer === name).map(r => r.code)).size]));
  }
  function calendarWeeks(rows) {
    const start = Math.min(...rows.map(r => r.opened));
    const last = Math.max(...rows.map(r => r.viewed));
    return Array.from({length: Math.floor((last - start) / 7) + 1}, (_, i) => {
      const from = start + i * 7, to = Math.min(from + 6, last);
      return {week: i + 1, from, to, days: to - from + 1, partial: to < from + 6,
        views: rows.filter(r => r.viewed >= from && r.viewed <= to).length};
    });
  }
  function trainerComparison(rows) {
    return Object.keys(trainerColors).map(trainer => {
      const selected = filter(rows, 'all', trainer);
      return {trainer, ...stats(selected), byType: Object.fromEntries(types.map(type =>
        [type, stats(selected.filter(r => r.type === type))]))};
    }).sort((a, b) => b.viewsPerWorkout - a.viewsPerWorkout);
  }
  function rewriteCandidates(rows, threshold = .8) {
    return group(rows).map(workout => ({...workout, ...stats(workout.events),
      lowDepth: workout.events.filter(r => r.depth < threshold).length}))
      .filter(workout => workout.depth < threshold).sort((a, b) => a.depth - b.depth);
  }
  function activityGroups(rows) {
    const byUser = new Map();
    rows.forEach(r => {
      if (!byUser.has(r.user)) byUser.set(r.user, new Set());
      byUser.get(r.user).add(r.code);
    });
    const counts = [...byUser.values()].map(codes => codes.size).sort((a, b) => a - b);
    const lower = counts[Math.ceil(counts.length / 3) - 1];
    const upper = counts[Math.ceil(counts.length * 2 / 3) - 1];
    const make = predicate => {
      const entries = [...byUser].filter(([, codes]) => predicate(codes.size));
      return {ids: entries.map(([id]) => id), users: entries.length,
        min: entries.length ? Math.min(...entries.map(([, codes]) => codes.size)) : null,
        max: entries.length ? Math.max(...entries.map(([, codes]) => codes.size)) : null};
    };
    return {low: make(n => n <= lower), middle: make(n => n > lower && n <= upper),
      high: make(n => n > upper), minimum: make(n => n <= 5), lower, upper};
  }
  function typePreferences(rows, userIds) {
    const ids = new Set(userIds), totalUsers = new Set(rows.map(r => r.user)).size;
    return types.map(type => {
      const all = filter(rows, type, 'all'), selected = all.filter(r => ids.has(r.user));
      const offered = new Set(all.map(r => r.code)).size;
      return {type, offered, views: selected.length, participants: new Set(selected.map(r => r.user)).size,
        users: ids.size, fraction: ids.size && offered ? selected.length / (ids.size * offered) : null,
        reference: totalUsers && offered ? all.length / (totalUsers * offered) : null};
    }).sort((a, b) => (b.fraction ?? -1) - (a.fraction ?? -1));
  }
  global.Fitness = {trainerColors, palette, types, filter, group, order, stats, retention, color, trainerCounts,
    ratingGroup, orderViews, typeOrder, weeklyTypeSeries, calendarWeeks, trainerComparison,
    rewriteCandidates, activityGroups, typePreferences};
})(globalThis);
