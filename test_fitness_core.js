const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./fitness_core.js');
const F = globalThis.Fitness;
const rows = JSON.parse(fs.readFileSync('fitness-overview-data.json', 'utf8'));
assert.equal(rows.length, 3755);
assert.equal(new Set(rows.map(r => r.id)).size, 3755);
assert.equal(F.group(rows).length, 80);
assert.deepEqual(F.trainerCounts(rows), {Анна: 19, Богдана: 14, Виталия: 12, Галина: 18, Диана: 17});
const retention = F.retention(rows);
assert.equal(retention.first.users, 101);
assert.equal(retention.last.users, 60);
assert.equal(retention.first.views, 484);
assert.equal(retention.last.views, 324);
assert.equal(retention.cohortFirst, 322);
assert.equal(retention.cohortLast, 324);
const all = F.stats(rows);
assert.equal(all.rated, 1853);
assert.equal(all.unrated, 1902);
assert.equal(all.high, 1724);
assert.equal(all.low, 129);
const means = {Кардио: 58.7, Силовая: 54.1, Разминка: 1408 / 30, Йога: 45.4, Дэнс: 43.3, Интенсив: 33.2};
const fixedTypes = F.typeOrder(rows);
assert.deepEqual(fixedTypes, ['Кардио', 'Силовая', 'Разминка', 'Йога', 'Дэнс', 'Интенсив']);
assert.deepEqual(F.weeklyTypeSeries(rows, 'Кардио'), [76, 69, 64, 49, 68, 62, 52, 56, 46, 45]);
assert.deepEqual(F.weeklyTypeSeries(rows, 'Йога', 'Анна'), Array(10).fill(null));
assert.equal(F.weeklyTypeSeries(rows, 'Разминка')[0], 67);
for (const [type, value] of Object.entries(means)) {
  assert.equal(F.stats(F.filter(rows, type, 'all')).viewsPerWorkout, value);
}
for (const type of ['all', ...F.types]) {
  for (const trainer of ['all', ...Object.keys(F.trainerColors)]) {
    const filtered = F.filter(rows, type, trainer);
    const s = F.stats(filtered);
    assert.equal(s.high + s.low + s.unrated, s.views);
    const workouts = F.order(F.group(filtered), 'ranked');
    for (let week = 1; week <= 10; week++) {
      const counts = workouts.filter(w => w.week === week).map(w => w.events.length);
      assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
    }
    const typed = F.order(F.group(filtered), 'types', fixedTypes);
    for (let week = 1; week <= 10; week++) {
      const indices = typed.filter(w => w.week === week).map(w => fixedTypes.indexOf(w.type));
      assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
    }
  }
}
const orderedTypes = F.order(F.group(rows), 'types', fixedTypes);
for (let week = 1; week <= 10; week++) {
  assert.deepEqual(orderedTypes.filter(w => w.week === week).map(w => w.type),
    ['Кардио', 'Силовая', 'Разминка', 'Разминка', 'Разминка', 'Йога', 'Дэнс', 'Интенсив']);
}
for (const workout of F.group(rows)) {
  const original = workout.events.map(r => r.id);
  const ordered = F.orderViews(workout.events);
  const bands = ordered.map(F.ratingGroup);
  assert.deepEqual(bands, [...bands].sort((a, b) => a - b));
  assert.deepEqual(workout.events.map(r => r.id), original);
  assert.deepEqual(new Set(ordered.map(r => r.id)), new Set(original));
}
assert.equal(F.filter(rows, 'Йога', 'Анна').length, 0);
const selected = F.stats(rows.filter(r => r.code === '06-04'));
assert.equal(selected.views, 53);
assert.equal(selected.rated, 6);
assert.equal(selected.rating, 4.5);
assert.equal(new Set(Object.values(F.trainerColors)).size, 5);
assert.ok(Object.values(F.trainerColors).every(color => !Object.values(F.palette).includes(color)));
function linear(value) {
  value /= 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const rgb = [1, 3, 5].map(start => linear(parseInt(hex.slice(start, start + 2), 16)));
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
const background = luminance('#FCFBF8');
for (const [name, color] of Object.entries(F.trainerColors)) {
  const contrast = (background + .05) / (luminance(color) + .05);
  assert.ok(contrast >= 4.5, `${name}: insufficient contrast for small letters`);
}
assert.equal(F.color({rating: null}), '#D0D7DC');
assert.equal(F.color({rating: 3}), '#7B8D9B');
assert.equal(F.color({rating: 4}), '#BE9024');
assert.equal(new Set(rows.map(r=>r.user+'/'+r.code)).size, rows.length);
const calendar = F.calendarWeeks(rows);
assert.deepEqual(calendar.map(w=>w.views), [367,454,435,342,412,331,324,364,320,325,81]);
assert.equal(calendar.at(-1).partial, true);
assert.equal(calendar.at(-1).days, 5);
assert.equal(calendar.reduce((sum,w)=>sum+w.views,0),3755);
const trainers = F.trainerComparison(rows);
assert.equal(trainers[0].trainer,'Богдана');
assert.equal(trainers[0].viewsPerWorkout,710/14);
assert.equal(trainers.find(t=>t.trainer==='Анна').byType['Кардио'].viewsPerWorkout,194/3);
assert.equal(trainers.find(t=>t.trainer==='Диана').rated,396);
const candidates = F.rewriteCandidates(rows);
assert.deepEqual(candidates.map(w=>w.code),['02-06','06-04','03-08','08-07']);
assert.deepEqual(candidates.map(w=>w.lowDepth),[30,43,43,30]);
assert.deepEqual(candidates.map(w=>w.rated),[2,6,1,7]);
const activity = F.activityGroups(rows);
assert.equal(activity.lower,21);assert.equal(activity.upper,48);
assert.equal(activity.low.users,34);assert.equal(activity.middle.users,34);assert.equal(activity.high.users,33);
assert.equal(activity.minimum.users,4);
assert.equal(new Set([...activity.low.ids,...activity.middle.ids,...activity.high.ids]).size,101);
const lowPreferences = F.typePreferences(rows,activity.low.ids);
assert.equal(lowPreferences[0].type,'Разминка');
assert.equal(lowPreferences[0].views,250);
assert.equal(lowPreferences[0].fraction,250/(34*30));
const minimum = F.typePreferences(rows,activity.minimum.ids);
assert.equal(minimum[0].type,'Силовая');assert.equal(minimum[0].participants,4);
assert.ok(lowPreferences.every(p=>p.fraction>=0&&p.fraction<=1));
console.log('PASS: all five question panels; actual calendar weeks and partial period; trainer/type normalization and rating n; four candidates; activity groups and opportunity-adjusted preferences; cohort; 42 filter combinations; all 3755 view IDs.');
