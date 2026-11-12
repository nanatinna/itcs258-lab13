const { randomInt } = require('node:crypto');
const LEGENDARY = Object.freeze([
  { id: 'aurora-dragon', name: 'Aurora Dragon' },
  { id: 'chrono-phoenix', name: 'Chrono Phoenix' },
  { id: 'celestial-tiger', name: 'Celestial Tiger' },
  { id: 'nebula-knight', name: 'Nebula Knight' },
  { id: 'ocean-empress', name: 'Ocean Empress' }
]);
const COMMON = Object.freeze([
  { id: 'forest-slime', name: 'Forest Slime' },
  { id: 'copper-golem', name: 'Copper Golem' },
  { id: 'river-sprite', name: 'River Sprite' },
  { id: 'wind-fox', name: 'Wind Fox' },
  { id: 'stone-knight', name: 'Stone Knight' }
]);
const RULES = Object.freeze({ coinsPerGem: 100, gemsPerDraw: 10, legendaryPercent: 2, maxRecharge: 100000, maxBalance: 1000000 });
function drawOutcome(rng = randomInt) {
  const legendary = rng(100) < 2;
  const pool = legendary ? LEGENDARY : COMMON;
  return { ...pool[rng(pool.length)], rarity: legendary ? 'SSR' : 'COMMON' };
}
function validStudent(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,30}$/.test(value); }
function positiveInteger(value, maximum = RULES.maxRecharge) { return Number.isSafeInteger(value) && value > 0 && value <= maximum; }
module.exports = { LEGENDARY, COMMON, RULES, drawOutcome, validStudent, positiveInteger };
