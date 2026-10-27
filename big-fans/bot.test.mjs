import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCourseState } from './course.mjs';
import { resetBotRoute, botRaceDecision } from './bot.mjs';
test('bot heads towards the first section and resumes past its checkpoint', () => {
  const bot = {x:0,z:0,y:0,radius:.8,onGround:true,checkpoint:0};
  const course=createCourseState(); resetBotRoute(bot);
  assert.ok(botRaceDecision(course, bot).z > 0);
  bot.checkpoint=2; bot.x=0; bot.z=76; resetBotRoute(bot);
  assert.ok(botRaceDecision(course,bot).z > 0);
});
