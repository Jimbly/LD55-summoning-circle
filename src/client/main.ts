/* globals CanvasRenderingContext2D, HTMLCanvasElement */
/*eslint global-require:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage');
local_storage.setStoragePrefix('ld55'); // Before requiring anything else that might load from this

import assert from 'assert';
import { autoAtlas } from 'glov/client/autoatlas';
import * as camera2d from 'glov/client/camera2d';
import * as effects from 'glov/client/effects';
import { effectsQueue } from 'glov/client/effects';
import * as engine from 'glov/client/engine';
import {
  ALIGN,
  Font,
  fontStyle,
  fontStyleColored,
  intColorFromVec4Color,
  vec4ColorFromIntColor,
} from 'glov/client/font';
import { framebufferEnd } from 'glov/client/framebuffer';
import {
  KEYS,
  inputClick,
  inputDrag,
  inputTouchMode,
  keyDownEdge,
  longPress,
  mouseOver,
  mousePos,
} from 'glov/client/input';
import { localStorageGetJSON, localStorageSetJSON } from 'glov/client/local_storage';
import { markdownAuto } from 'glov/client/markdown';
import { markdownImageRegister } from 'glov/client/markdown_renderables';
import { netInit } from 'glov/client/net';
import {
  ScoreSystem,
  scoreAlloc,
} from 'glov/client/score';
import { scoresDraw } from 'glov/client/score_ui';
import {
  BLEND_ADDITIVE,
  Sprite,
  Texture,
  blendModeReset,
  blendModeSet,
  spriteCreate,
  spriteQueueFn,
} from 'glov/client/sprites';
import {
  TEXTURE_FORMAT,
  textureLoad,
  textureWhite,
} from 'glov/client/textures';
import {
  LINE_CAP_ROUND,
  buttonText,
  drawCircle,
  drawHBox,
  drawLine,
  drawRect,
  modalDialog,
  playUISound,
  scaleSizes,
  setButtonHeight,
  setFontHeight,
  uiTextHeight,
} from 'glov/client/ui';
import { randCreate } from 'glov/common/rand_alea';
import { DataObject, TSMap, VoidFunc } from 'glov/common/types';
import { clamp, nop, ridx } from 'glov/common/util';
import {
  Vec4,
  v2dist,
  v2distSq,
  v2same,
  v3iScale,
  v4same,
  vec2,
  vec4,
} from 'glov/common/vmath';
import { randomDemonName } from './demon_names';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { PI, abs, atan2, cos, floor, max, min, round, sin, sqrt } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.CIRCLES = 10;
Z.LINES = 9;
Z.POWER = 11;
Z.POSTPROCESS = 15;
Z.DEMON = 50;
Z.POSTPROCESS_LATE = Z.DEMON + 4.5;
Z.HOVER = 60;
Z.UI = 100;
Z.RUNES = 100; // Z.POWER;

// Virtual viewport for our game logic
const game_width = 1920;
const game_height = 1080;

const palette = [
  vec4(1, 1, 1, 1),
  vec4(0, 1, 0.2, 1),
  vec4(0, 0, 0, 1),
  vec4(1, 0.25, 0.25, 1),
  vec4(0, 0, 1, 1),
  vec4(196/255, 17/255, 255/255, 1),
  v3iScale(vec4(196/255, 17/255, 255/255, 1), 0.35) as Vec4,
  vec4ColorFromIntColor(vec4(), 0x1b0326ff),
  vec4ColorFromIntColor(vec4(), 0x7a1c4bff),
  vec4ColorFromIntColor(vec4(), 0x45ba7fff),
  vec4ColorFromIntColor(vec4(), 0xba5044ff),
  vec4ColorFromIntColor(vec4(), 0xd7c4b3ff),
];
const font_palette = palette.map(intColorFromVec4Color);
const PALETTE_CIRCLE = 0;
const PALETTE_LINE = 0;
const PALETTE_POWER = 1;
const PALETTE_BG = 2;
const PALETTE_HOVER = 4;
const PALETTE_HOVER_DELETE = 3;
const PALETTE_GLOW = 5;
const PALETTE_GLOW_SUBDUED = 6;
const PALETTE_SYMERROR = 3;
const PALETTE_CRIM_BG = 7;
const PALETTE_CRIM_TEXT = 7;
const PALETTE_CRIM_BAR = 8;
const PALETTE_CRIM_KNOWLEDGE_BAR = 9;
const PALETTE_CRIM_BORDER = 10;
const PALETTE_CRIM_CARD = 11;

const style_eval = fontStyle(null, {
  color: 0xFFFFFFff,
  glow_color: intColorFromVec4Color(palette[PALETTE_GLOW]),
  glow_inner: 0,
  glow_outer: 2.5,
});
const style_help = style_eval;

const MC_X0 = 560;
const MC_Y0 = 120;
const MC_W = 800;
const MC_R = MC_W / 2;
const MC_XC = MC_X0 + MC_W/2;
const MC_YC = MC_Y0 + MC_W/2;
const LINE_W = 8;
const LINE_W_DELETE = 4;
const POWER_R = 40;

const VIS_MAXR = MC_R + POWER_R + LINE_W/2;
const AREA_CANVAS_W = 512;
const VIS_TO_CANVAS_SCALE = 1 / VIS_MAXR * AREA_CANVAS_W / 2;

const CIRCLE_STEPS = 12;
const ANGLE_STEPS = 48;
const CIRCLE_MIN = 4;

function canonicalLine(line: [number, number, number, number]): void {
  if (line[1] < 0) {
    line[1] += ANGLE_STEPS;
  }
  if (line[3] < 0) {
    line[3] += ANGLE_STEPS;
  }
  if (line[0] > line[2]) {
    let t = line[0];
    line[0] = line[2];
    line[2] = t;
    t = line[1];
    line[1] = line[3];
    line[3] = t;
  } else if (line[0] === line[2] && line[1] > line[3]) {
    let t = line[1];
    line[1] = line[3];
    line[3] = t;
  }
}

function mirror(a: number): number {
  return (ANGLE_STEPS - a) % ANGLE_STEPS;
}

const area_buf = new Uint8Array(AREA_CANVAS_W * AREA_CANVAS_W);
const power_buf = new Uint8Array(AREA_CANVAS_W * AREA_CANVAS_W);
const power_buf2 = new Uint8Array(AREA_CANVAS_W * AREA_CANVAS_W);
const power_todo = new Uint32Array(AREA_CANVAS_W * AREA_CANVAS_W);

let rand = randCreate(1);

type EvalType = 'components' | 'ink' | 'symmetry' | 'cells' | 'power';
type Evaluation = Record<EvalType, number>;
type DemonTarget = {
  // gen-time
  color: Vec4;
  name: string;
  seed: number;
} & Record<EvalType, number>;
let ranges: Record<EvalType, [number, number]> = {
  components: [3, 40],
  ink: [25, 450],
  cells: [2, 50],
  symmetry: [0, 100],
  power: [5, 100],
};
function randFromRange(range: [number, number], normalize: number): number {
  if (normalize <= 1) {
    return range[0] + rand.range(range[1] - range[0] + 1);
  }
  let ret = 0;
  for (let ii = 0; ii < normalize; ii++) {
    ret += randFromRange(range, 0);
  }

  return round(ret / normalize);
}
function randomDemonTarget(existing: DemonTarget[]): DemonTarget {

  let components = randFromRange(ranges.components, 2);
  let ink = randFromRange(ranges.ink, 0);
  let cells = randFromRange(ranges.cells, 0);
  let symmetry = randFromRange(ranges.symmetry, 0);
  let power = randFromRange(ranges.power, 0);

  //let knowledge_points = [0.2, 0.4, 0.6, 0.8, 1];
  let seed = rand.range(10000);

  let name;
  while (true) {
    name = randomDemonName(rand);
    let found = false;
    for (let ii = 0; ii < existing.length; ++ii) {
      if (existing[ii].color === name[1] && ii > existing.length - 3) {
        found = true;
      } else if (existing[ii].name.endsWith(name[0].split(' ')[1])) {
        found = true;
      }
    }
    if (!found) {
      break;
    }
  }

  return {
    name: name[0],
    color: name[1],
    components,
    ink,
    cells,
    symmetry,
    power,
    seed,
  };
}

export type Score = {
  match: number;
};
let score_system: ScoreSystem<Score>;

const MATCH_PERFECT = 0.05;

const EVALS: [EvalType, string][] = [
  ['components', 'Components'],
  ['cells', 'Cells'],
  // ['ink', 'Ink'],
  ['power', 'Power'],
  ['symmetry', 'Symmetry'],
];

function evalMatch(evaluation: Evaluation, demon: DemonTarget): number {
  let match_sum = 0;
  let num_evals = EVALS.length;
  for (let ii = 0; ii < num_evals; ++ii) {
    let eval_type = EVALS[ii][0];
    let range = ranges[eval_type];
    let my_v = clamp((evaluation[eval_type] - range[0]) / (range[1] - range[0]), 0, 1);
    let desired_v = (demon[eval_type] - range[0]) / (range[1] - range[0]);
    let match = abs(my_v - desired_v); // 0...1
    if (match < MATCH_PERFECT) {
      match = 1000;
    } else {
      match = (match - MATCH_PERFECT) / (1 - MATCH_PERFECT); // 0...1 again
      match = max(0, 1 - match * 2);
      match = clamp(round(match * match * 1000), 0, 999);
    }
    match_sum += match;
  }
  let ret = round(match_sum / num_evals);
  if (match_sum !== num_evals * 1000) {
    ret = min(ret, 999);
  }
  return ret;
}

rand.reseed(1234);
let fixed_targets: DemonTarget[] = [];
for (let ii = 0; ii < 10; ++ii) {
  fixed_targets.push(randomDemonTarget(fixed_targets));
}

class GameState {
  circles: number[] = [8];
  lines: [number, number, number, number][] = [[0, 5, 0, 20]];
  power: [number, number][] = [[0, 15]];
  placing: null | [number, number] = null;
  symmap!: {
    lines: boolean[];
    power: boolean[];
    symcount: number;
    symmax: number;
  };
  target: DemonTarget;
  best_score: number = 0;
  cur_score: number = 0;
  did_anything = false;
  constructor(public level_idx: number) {
    rand.reseed(level_idx * 1007);
    let saved = localStorageGetJSON<DataObject>(`save.${level_idx}`);
    if (saved) {
      this.circles = saved.circles as number[];
      this.lines = saved.lines as [number, number, number, number][];
      this.power = saved.power as [number, number][];
      this.best_score = saved.best_score as number || 0;
      // fixup bad debug data
      for (let ii = 0; ii < this.lines.length; ++ii) {
        canonicalLine(this.lines[ii]);
      }
      for (let ii = 0; ii < this.power.length; ++ii) {
        this.power[ii][1] = (this.power[ii][1] + ANGLE_STEPS) % ANGLE_STEPS;
      }
    }

    this.target = fixed_targets[level_idx] || randomDemonTarget([]);

    this.evaluate();
  }
  commit(): void {
    this.did_anything = true;
    this.evaluate();
    localStorageSetJSON(`save.${this.level_idx}`, this.toJSON());
  }
  toJSON(): DataObject {
    return {
      best_score: this.best_score,
      circles: this.circles,
      lines: this.lines,
      power: this.power,
    };
  }

  area_canvas: HTMLCanvasElement | null = null;
  area_ctx: CanvasRenderingContext2D | null = null;
  area_tex_dirty = false;
  power_tex_dirty = false;
  area_tex: Texture | null = null;
  power_tex: Texture | null = null;
  area_sprite: Sprite | null = null;
  power_sprite: Sprite | null = null;
  evaluateAreas(): [number, number] {
    let canvas = this.area_canvas;
    const w = AREA_CANVAS_W;
    const center = w / 2;
    const CANVAS_R = VIS_TO_CANVAS_SCALE * MC_R;
    if (!canvas) {
      canvas = this.area_canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = w;
      this.area_ctx = canvas.getContext('2d');
    }
    let ctx = this.area_ctx;
    assert(ctx);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = VIS_TO_CANVAS_SCALE * LINE_W / 2;

    let { circles, lines, power } = this;
    for (let ii = 0; ii < circles.length; ++ii) {
      let r = circles[ii];
      ctx.beginPath();
      ctx.arc(center, center, CANVAS_R * r / CIRCLE_STEPS, 0, 2 * PI);
      ctx.stroke();
    }

    function circAngleToXY2(circ: number, ang: number): [number, number] {
      let r = circles[circ] / CIRCLE_STEPS;
      ang = ang / ANGLE_STEPS * 2 * PI;
      return [
        center + sin(ang) * r * CANVAS_R,
        center + cos(ang) * r * CANVAS_R,
      ];
    }

    for (let ii = 0; ii < lines.length; ++ii) {
      let line = lines[ii];
      let [x0, y0] = circAngleToXY2(line[0], line[1]);
      let [x1, y1] = circAngleToXY2(line[2], line[3]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    ctx.fillStyle = '#ff0';
    for (let ii = 0; ii < power.length; ++ii) {
      let pow = power[ii];
      let [x, y] = circAngleToXY2(pow[0], pow[1]);
      ctx.beginPath();
      ctx.arc(x, y, POWER_R * VIS_TO_CANVAS_SCALE, 0, PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    let img_data = ctx.getImageData(0, 0, w, w).data;
    let power_todo_len = 0;
    for (let yy = 0, outi=0, ini=0; yy < w; ++yy) {
      for (let xx = 0; xx < w; ++xx, ++outi, ini+=4) {
        let v = img_data[ini] > 127 ? 255 : 0;
        if (!xx || !yy || xx === w - 1 || yy === w - 1) {
          v = 255;
        }
        area_buf[outi] = v;

        let is_any = img_data[ini] > 0;
        let is_power = v && img_data[ini + 2] < 127;
        power_buf[outi] = is_power ? 255 : is_any ? 1 : 0;
        if (is_power) {
          power_todo[power_todo_len++] = outi;
        }
      }
    }

    // count areas
    function fill(x: number, y: number, oldv: number, v: number): number {
      let count = 0;
      let todo: number[] = [];
      function queue(idx: number): void {
        if (area_buf[idx] === oldv) {
          ++count;
          area_buf[idx] = v;
          todo.push(idx);
        }
      }
      queue(x + y * w);
      while (todo.length) {
        let idx = todo.pop()!;
        queue(idx - 1);
        queue(idx + 1);
        queue(idx - w);
        queue(idx + w);
      }
      return count;
    }
    // fill outside
    fill(1,1, 0, 16);
    fill(1,w-2, 0, 16);
    fill(w-2,w-2, 0, 16);
    fill(w-2,1, 0, 16);
    let ret = 0;
    for (let yy = 0, idx=0; yy < w; ++yy) {
      for (let xx = 0; xx < w; ++xx, ++idx) {
        if (!area_buf[idx]) {
          let v = 32 + ((ret * 77) % (256 - 64));
          let count = fill(xx, yy, 0, v);
          if (count > 3) {
            ++ret;
          } else {
            fill(xx, yy, v, 255);
          }
        }
      }
    }

    let power_todo_walk = 0;
    while (power_todo_walk < power_todo_len) {
      let next = power_todo[power_todo_walk++];
      let v = power_buf[next] - 2;
      if (v <= 1) {
        continue;
      }
      if (power_buf[next - 1] && power_buf[next - 1] < v) {
        power_buf[next - 1] = v;
        power_todo[power_todo_len++] = next - 1;
      }
      if (power_buf[next + 1] && power_buf[next + 1] < v) {
        power_buf[next + 1] = v;
        power_todo[power_todo_len++] = next + 1;
      }
      if (power_buf[next + w] && power_buf[next + w] < v) {
        power_buf[next + w] = v;
        power_todo[power_todo_len++] = next + w;
      }
      if (power_buf[next - w] && power_buf[next - w] < v) {
        power_buf[next - w] = v;
        power_todo[power_todo_len++] = next - w;
      }
    }
    // calc totals, and adjust image for rendering
    let powered = 0;
    let unpowered = 0;
    for (let yy = 0, idx=0; yy < w; ++yy) {
      for (let xx = 0; xx < w; ++xx, ++idx) {
        let v = power_buf[idx];
        if (!xx || !yy || xx === w - 1 || yy === w - 1) {
          power_buf[idx] = 0;
          v = 0;
        }
        if (v) {
          if (v === 1) {
            unpowered++;
          } else if (v !== 255) {
            powered++;
          }
        }
      }
    }

    // expand for rendering
    const N = [0, -1, 1, -w, w];
    function expand(from: Uint8Array, to: Uint8Array): void {
      for (let idx = 0; idx < w * w; ++idx) {
        let v = 0;
        for (let ii = 0; ii < N.length; ++ii) {
          let idx2 = idx + N[ii];
          if (idx2 >= 0 && idx2 < w * w) {
            v = max(v, from[idx2]);
          }
        }
        to[idx] = v;
      }
    }
    expand(power_buf, power_buf2);
    expand(power_buf2, power_buf);

    this.area_tex_dirty = true;
    this.power_tex_dirty = true;

    return [ret, powered ? powered/(powered + unpowered) * 100 : 0];
  }

  getCellSprite(): Sprite | null {
    if (this.area_tex_dirty) {
      this.area_tex_dirty = false;

      const w = AREA_CANVAS_W;
      if (!this.area_tex) {
        this.area_tex = textureLoad({
          width: w,
          height: w,
          format: TEXTURE_FORMAT.R8,
          name: 'area_eval',
          data: area_buf,
          filter_min: gl.NEAREST,
          filter_mag: gl.NEAREST,
        });
      } else {
        // @ts-expect-error TODO!
        this.area_tex.updateData(w, w, area_buf);
      }

      if (!this.area_sprite) {
        this.area_sprite = spriteCreate({
          texs: [this.area_tex!],
        });
      }

    }
    return this.area_sprite;
  }

  getPowerSprite(): Sprite | null {
    if (this.power_tex_dirty) {
      this.power_tex_dirty = false;

      const w = AREA_CANVAS_W;
      if (!this.power_tex) {
        this.power_tex = textureLoad({
          width: w,
          height: w,
          format: TEXTURE_FORMAT.R8,
          name: 'power_eval',
          data: power_buf,
          wrap_s: gl.CLAMP_TO_EDGE,
          wrap_t: gl.CLAMP_TO_EDGE,
          filter_min: gl.LINEAR,
          filter_mag: gl.LINEAR,
        });
      } else {
        // @ts-expect-error TODO!
        this.power_tex.updateData(w, w, power_buf);
      }

      if (!this.power_sprite) {
        this.power_sprite = spriteCreate({
          texs: [this.power_tex!],
        });
      }
    }
    return this.power_sprite;
  }

  evaluation!: Evaluation;
  evaluate(): void {
    let components = 0;
    let { circles, lines, power } = this;
    this.symmap = {
      lines: [],
      power: [],
      symmax: 0,
      symcount: 0,
    };
    let symmap = this.symmap;
    let ink = 0;
    let symmetry = 0;
    let symmax = 0;
    for (let ii = 0; ii < circles.length; ++ii) {
      let r = circles[ii];
      ++components;
      ink += 2 * PI * r;
    }
    let all_lines: TSMap<true> = {};
    for (let ii = 0; ii < lines.length; ++ii) {
      all_lines[lines[ii].join(',')] = true;
    }
    for (let ii = 0; ii < lines.length; ++ii) {
      let [c0, a0, c1, a1] = lines[ii];
      ++components;
      let r0 = circles[c0];
      let r1 = circles[c1];
      let a0r = a0 / ANGLE_STEPS * 2 * PI;
      let a1r = a1 / ANGLE_STEPS * 2 * PI;
      let x0 = sin(a0r) * r0;
      let y0 = cos(a0r) * r0;
      let x1 = sin(a1r) * r1;
      let y1 = cos(a1r) * r1;
      ink += sqrt((x1 - x0)*(x1 - x0) + (y1 - y0) * (y1 - y0));

      // check for symmetry
      let is_sym = false;
      // radial symmetry
      for (let offs = 1; offs <= ANGLE_STEPS / 2; ++offs) {
        let test1 = [c0, (a0 + offs) % ANGLE_STEPS, c1, (a1 + offs) % ANGLE_STEPS];
        if (c0 === c1 && test1[1] > test1[3]) {
          let t = test1[1];
          test1[1] = test1[3];
          test1[3] = t;
        }
        if (!all_lines[test1.join(',')]) {
          continue;
        }
        test1[1] = (a0 - offs + ANGLE_STEPS) % ANGLE_STEPS;
        test1[3] = (a1 - offs + ANGLE_STEPS) % ANGLE_STEPS;
        if (c0 === c1 && test1[1] > test1[3]) {
          let t = test1[1];
          test1[1] = test1[3];
          test1[3] = t;
        }
        if (!all_lines[test1.join(',')]) {
          continue;
        }
        is_sym = true;
        break;
      }
      if (!is_sym) {
        // horizontal symmetry
        let test1: [number, number, number, number] = [c0, mirror(a0), c1, mirror(a1)];
        canonicalLine(test1);
        if (all_lines[test1.join(',')]) {
          is_sym = true;
        }
      }
      ++symmax;
      if (is_sym) {
        ++symmetry;
      }
      symmap.lines.push(is_sym);
    }
    let all_power: TSMap<true> = {};
    for (let ii = 0; ii < power.length; ++ii) {
      all_power[power[ii].join(',')] = true;
    }
    for (let ii = 0; ii < power.length; ++ii) {
      ++components;
      ink += 3; // plus symbol?

      // check for symmetry
      let [c0, a0] = power[ii];
      let is_sym = false;
      // radial symmetry
      for (let offs = 1; offs <= ANGLE_STEPS / 2; ++offs) {
        let test1 = [c0, (a0 + offs) % ANGLE_STEPS];
        if (!all_power[test1.join(',')]) {
          continue;
        }
        test1[1] = (a0 - offs + ANGLE_STEPS) % ANGLE_STEPS;
        if (!all_power[test1.join(',')]) {
          continue;
        }
        is_sym = true;
        break;
      }
      if (!is_sym && a0 !== mirror(a0)) {
        // horizontal symmetry
        let test1 = [c0, mirror(a0)];
        if (all_power[test1.join(',')]) {
          is_sym = true;
        }
      }
      ++symmax;
      if (is_sym) {
        ++symmetry;
      }
      symmap.power.push(is_sym);
    }
    symmap.symcount = symmetry;
    symmap.symmax = symmax;

    let [cells, power_eval] = this.evaluateAreas();

    this.evaluation = {
      components,
      ink,
      cells,
      power: power_eval,
      symmetry: (symmax ? symmetry / symmax : 1) * 100,
    };

    this.cur_score = evalMatch(this.evaluation, this.target);
    if (this.cur_score > this.best_score) {
      this.best_score = this.cur_score;
      let score: Score = {
        match: this.best_score,
      };
      score_system.setScore(this.level_idx, score);
    }
  }
}

let font: Font;

let game_state: GameState;
let sprite_runes: Sprite;
let sprite_bar_border: Sprite;
let sprite_bar_fill: Sprite;
let sprite_bar_marker: Sprite;
let level_idx = 0;
const MAX_LEVEL = 1000;
function init(): void {
  score_system = scoreAlloc({
    score_to_value: (score: Score): number => score.match,
    value_to_score: (value: number): Score => ({ match: value }),
    level_defs: MAX_LEVEL,
    score_key: 'LD55',
    ls_key: 'ld55',
    asc: false,
    rel: 8,
    num_names: 3,
    histogram: false,
  });
  game_state = new GameState(level_idx);
  sprite_runes = autoAtlas('runes', 'def');
  sprite_bar_border = autoAtlas('misc', 'bar_border');
  sprite_bar_fill = autoAtlas('misc', 'bar_fill');
  sprite_bar_marker = autoAtlas('misc', 'marker').withOrigin(vec2(0.5, 0));
  markdownImageRegister('gp', {
    sprite: autoAtlas('misc', 'gp'),
    frame: 0,
  });
}

function circAngleToXY(circ: number, ang: number): [number, number] {
  let r = game_state.circles[circ] / CIRCLE_STEPS;
  ang = ang / ANGLE_STEPS * 2 * PI;
  return [
    MC_XC + sin(ang) * r * MC_R,
    MC_YC + cos(ang) * r * MC_R,
  ];
}

function drawCircleAA(x: number, y: number, z: number, r: number, line_w: number, precise: number, color: Vec4): void {
  let segments = max(50, round(r / 2));
  let dr = PI * 2 / segments;
  let angle = 0;
  let xx = x + sin(angle) * r;
  let yy = y + cos(angle) * r;
  for (let ii = 0; ii < segments; ++ii) {
    angle += dr;
    let x2 = x + sin(angle) * r;
    let y2 = y + cos(angle) * r;
    drawLine(xx, yy, x2, y2, z, line_w, precise, color, LINE_CAP_ROUND);
    xx = x2;
    yy = y2;
  }
}

function angleDiff(a: number, b: number): number {
  let d = abs(a - b);
  if (d > ANGLE_STEPS / 2) {
    d = ANGLE_STEPS - d;
  }
  return d;
}

let this_frame_source: unknown;
function doBlurEffect(factor: number): void {
  let params = {
    blur: factor,
    glow: 1,
    max_size: 1024,
    min_size: 256,
    framebuffer_source: null as unknown,
  };
  effects.applyGaussianBlur(params);
  this_frame_source = params.framebuffer_source;
}

let tex2_transform = vec4(1, 1, 0, 0);
let this_frame_glow_buf: Texture;
function doColorEffectEarly(highlight_symmetry: boolean): void {
  this_frame_glow_buf = framebufferEnd({ filter_linear: false, need_depth: false });
  effects.applyCopy({
    source: textureWhite(),
    shader: 'clear',
  });
}
function doColorEffectLate(highlight_symmetry: boolean): void {
  let params = {
    color: palette[highlight_symmetry ? PALETTE_GLOW_SUBDUED : PALETTE_GLOW],
    tex2_transform,
  };
  let source = [
    this_frame_source,
    this_frame_glow_buf,
    game_state.getPowerSprite()!.texs[0],
  ];
  blendModeSet(BLEND_ADDITIVE);
  effects.applyCopy({
    shader: highlight_symmetry ? 'glow_merge_no_power' : 'glow_merge',
    source,
    params,
    no_framebuffer: true,
  });
  blendModeReset(false);
}

function queuePostprocess(highlight_symmetry: boolean): void {
  let blur_factor = 1;
  effectsQueue(Z.POSTPROCESS, doBlurEffect.bind(null, blur_factor));
  effectsQueue(Z.POSTPROCESS + 1, doColorEffectEarly.bind(null, highlight_symmetry));
  spriteQueueFn(Z.POSTPROCESS_LATE, doColorEffectLate.bind(null, highlight_symmetry));
}

function drawTriangle(x: number, y: number, z: number, rh: number, rv: number, up: boolean, color: Vec4): void {
  let y0 = y + (up ? rv : -rv);
  let y1 = y + (up ? -rv : rv);
  drawLine(x - rh, y0, x + rh, y0, z, LINE_W, 1, color, LINE_CAP_ROUND);
  drawLine(x - rh, y0, x, y1, z, LINE_W, 1, color, LINE_CAP_ROUND);
  drawLine(x + rh, y0, x, y1, z, LINE_W, 1, color, LINE_CAP_ROUND);
}

function drawDemonPortrait(target: DemonTarget, x: number, y: number, w: number): void {
  let xmid = x + w / 2;
  let ymid = y + w / 2;
  let maxr = w * 0.35 * (0.9 + 0.1 * Math.random());
  drawTriangle(xmid, ymid, Z.LINES, maxr, maxr, false, target.color);
}

const RUNE_W = POWER_R * 1.5;

function formatMatch(v: number): string {
  if (v === 1000) {
    return '100%';
  }
  v = round(v/10);
  if (v === 100) {
    v = 99;
  }
  return `${v}%`;
}

const EVAL_W = 200;
const PAD = 8;
const DEMON_W = 364;
const DEMON_H = 203;
const DEMON_BORDER = 3;
const DEMON_PORTRAIT_W = 138;
const DEMON_PORTRAIT_X = 8;
const DEMON_PORTRAIT_Y = 37;
const EVAL_BAR_H = 26;
const EVAL_BAR_W = 160;
const EVAL_BAR_PAD = 9;
const style_crim_text = fontStyle(null, {
  color: font_palette[PALETTE_CRIM_TEXT],
  glow_color: font_palette[PALETTE_CRIM_BG] & 0xFFFFFF00 | 0x50,
  glow_xoffs: 2.5,
  glow_yoffs: 2.5,
  glow_inner: 0,
  glow_outer: 4,
});
const style_eval_target = fontStyle(null, {
  color: font_palette[PALETTE_CRIM_TEXT],
  glow_color: font_palette[PALETTE_CRIM_CARD],
  glow_inner: 0,
  glow_outer: 5,
});
function drawDemons(): void {
  const { target } = game_state;
  const x0 = game_width - PAD - DEMON_W;
  let y = (game_height - DEMON_H) / 2;
  // for (let ii = 0; ii < targets.length; ++ii) {
  if (true) {
    let z = Z.DEMON;
    // border
    drawRect(x0, y, x0 + DEMON_W, y + DEMON_H, z, palette[PALETTE_CRIM_BORDER]);
    z++;
    // light bg
    drawRect(x0 + DEMON_BORDER, y + DEMON_BORDER, x0 + DEMON_W - DEMON_BORDER,
      y + DEMON_H - DEMON_BORDER,
      z, palette[PALETTE_CRIM_CARD]);
    z++;

    markdownAuto({
      x: x0 + 10,
      y: y + 10,
      z,
      text_height: 20,
      font_style: style_crim_text,
      text: target.name,
    });

    drawRect(x0 + DEMON_PORTRAIT_X, y + DEMON_PORTRAIT_Y,
      x0 + DEMON_PORTRAIT_X + DEMON_PORTRAIT_W,
      y + DEMON_PORTRAIT_Y + DEMON_PORTRAIT_W,
      z - 0.5,
      [0,0,0,1]);

    drawDemonPortrait(target,
      x0 + DEMON_PORTRAIT_X, y + DEMON_PORTRAIT_Y,
      DEMON_PORTRAIT_W);

    let match = evalMatch(game_state.evaluation, target);
    if (match) {
      font.draw({
        x: x0 + DEMON_PORTRAIT_X,
        y: y + DEMON_PORTRAIT_Y,
        z: z,
        w: DEMON_PORTRAIT_W,
        h: DEMON_PORTRAIT_W - 2,
        size: 16,
        align: ALIGN.HCENTER | ALIGN.VBOTTOM,
        text: `${formatMatch(match)} match`,
      });
    }

    let yy = y + 32 + EVAL_BAR_PAD;
    let bar_x = x0 + DEMON_W - DEMON_BORDER - 2 - EVAL_BAR_W;
    let text_x = x0 + 148;

    for (let jj = 0; jj < EVALS.length; ++jj) {
      let eval_type = EVALS[jj][0];
      let label = EVALS[jj][1];
      font.draw({
        style: style_crim_text,
        x: text_x,
        y: yy,
        z,
        size: 20,
        h: EVAL_BAR_H,
        align: ALIGN.VCENTER,
        text: label === 'Cells' ? 'Cell' : label.slice(0, 3),
      });
      let range = ranges[eval_type];
      let my_p = clamp((game_state.evaluation[eval_type] - range[0]) / (range[1] - range[0]), 0, 1);
      let am_close = false;
      let value_str = '?';
      let value = target[eval_type];
      let p = (value - range[0]) / (range[1] - range[0]);
      if (p) {
        drawHBox({
          x: bar_x - 1,
          y: yy - 1,
          z: z - 0.5,
          w: (EVAL_BAR_W) * p + 3,
          h: EVAL_BAR_H + 2,
          no_min_width: true,
        }, sprite_bar_fill, palette[PALETTE_CRIM_BAR]);
      }
      value_str = `${value}`;
      am_close = abs(p - my_p) < MATCH_PERFECT;
      font.draw({
        style: style_eval_target,
        x: bar_x,
        y: yy,
        z: z + 0.5,
        w: EVAL_BAR_W,
        h: EVAL_BAR_H,
        size: 18,
        alpha: value_str === '?' ? 0.25 : 1,
        align: ALIGN.HVCENTER,
        text: value_str,
      });
      let my_marker_x = clamp(bar_x + EVAL_BAR_W * my_p, bar_x + 3, bar_x + EVAL_BAR_W - 3);
      let marker_pal = am_close ? PALETTE_CRIM_KNOWLEDGE_BAR : PALETTE_CRIM_BORDER;
      sprite_bar_marker.draw({
        x: my_marker_x,
        y: yy,
        z: z + 0.75,
        w: 11/2,
        h: 10/2,
        color: palette[marker_pal],
      });
      drawLine(my_marker_x, yy, my_marker_x, yy + EVAL_BAR_H, z + 0.75, 2, 1, palette[marker_pal], 0);

      drawHBox({
        x: bar_x - 1,
        y: yy - 1,
        z,
        w: EVAL_BAR_W + 2,
        h: EVAL_BAR_H + 2,
      }, sprite_bar_border, palette[PALETTE_CRIM_BG]);
      yy += EVAL_BAR_H + EVAL_BAR_PAD;
    }

    y += DEMON_H + PAD;
  }
}

const FIXED_LEVELS = 10;
let did_win = false;

const SCORE_COLUMNS = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 12, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: 'Name', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER },
  { name: 'Score', width: 20 },
];
const style_score = fontStyleColored(style_eval, 0xFFFFFFff);
const style_me = fontStyleColored(style_eval, 0xffd541ff);
const style_header = fontStyleColored(style_eval, 0x80FFFFff);
function myScoreToRow(row: unknown[], score: Score): void {
  row.push(formatMatch(score.match));
}

function drawLevel(): void {
  let x = PAD;
  let y = 80;
  let w = MC_X0 - POWER_R - x - PAD;
  let { target } = game_state;

  let text_height = uiTextHeight();
  font.draw({
    style: style_eval,
    x, y, w,
    size: text_height,
    align: ALIGN.HCENTER,
    text: `Target #${level_idx+1}:`,
  });

  y += text_height + PAD;
  font.draw({
    style: style_eval,
    x, y, w,
    color: intColorFromVec4Color(target.color),
    size: text_height * 1.5,
    align: ALIGN.HCENTERFIT,
    text: target.name,
  });
  y += text_height * 1.5 + PAD;
  drawDemonPortrait(target, x + w/4, y, w/2);
  y += w / 2 + PAD;
  font.draw({
    style: style_eval,
    x, y, w,
    size: text_height,
    align: ALIGN.HCENTER,
    text: `Your best: ${formatMatch(game_state.best_score)}`,
  });
  y += text_height + PAD * 2;

  let show_high_scores = level_idx > 0 || game_state.best_score > 800;
  if (!show_high_scores) {
    font.draw({
      style: style_eval,
      x, y, w,
      size: text_height,
      align: ALIGN.HCENTER,
      text: `Goal: ${formatMatch(800)}`,
    });
    y += text_height + PAD * 2;
  }

  let button_h = 64;
  let button_w = (w - PAD) / 2;
  if (level_idx !== 0) {
    if (buttonText({
      x,
      y,
      w: button_w,
      h: button_h,
      text: '←',
      font_height: button_h,
    })) {
      level_idx--;
      game_state = new GameState(level_idx);
    }
  }
  if (level_idx >= FIXED_LEVELS || game_state.best_score > 800 || engine.DEBUG) {
    if (buttonText({
      x: x + w - button_w,
      y,
      w: button_w,
      h: button_h,
      text: '→',
      font_height: button_h,
      disabled: level_idx === MAX_LEVEL - 1,
    })) {
      level_idx++;
      if (level_idx === FIXED_LEVELS && !did_win && !localStorageGetJSON(`save.${level_idx}`)) {
        did_win = true;
        modalDialog({
          title: 'Well done!',
          text: `You've adequately summoned ${FIXED_LEVELS} demons, you should be proud.  Thanks for playing!\n\n`+
            'From here on out, there\'s an endless set of levels to play.',
          buttons: {
            Ok: null,
          },
        });
      }
      game_state = new GameState(level_idx);

    }
  }
  y += button_h + PAD;

  if (!show_high_scores) {
    // no high scores
    return;
  }
  scoresDraw<Score>({
    score_system,
    allow_rename: true,
    x,
    width: w,
    y,
    height: game_height - y,
    z: Z.UI,
    size: text_height,
    line_height: text_height + 2,
    level_index: level_idx,
    columns: SCORE_COLUMNS,
    scoreToRow: myScoreToRow,
    style_score,
    style_me,
    style_header,
    color_line: [1,1,1,1],
    color_me_background: [0.2,0.2,0.2,1],
  });
}

let mouse_pos = vec2();
let was_drag = false;
let highlight_symmetry_toggle = false;
function statePlay(dt: number): void {
  gl.clearColor(palette[PALETTE_BG][0], palette[PALETTE_BG][1], palette[PALETTE_BG][2], 0);
  let { circles, lines, power, placing } = game_state;

  let highlight_symmetry = highlight_symmetry_toggle;
  let highlight_cells = false;
  let highlight_power = false;
  let xx = (game_width - EVALS.length * (EVAL_W + PAD) - PAD) / 2;
  for (let ii = 0; ii < EVALS.length; ++ii) {
    let pair = EVALS[ii];
    let v = game_state.evaluation[pair[0]];
    let extra = '';
    let label = pair[1];
    if (pair[0] === 'symmetry') {
      extra = `\n${game_state.symmap.symcount}/${game_state.symmap.symmax}`;
      if (inputClick({
        x: xx,
        y: 10,
        w: EVAL_W,
        h: uiTextHeight() * 3,
      })) {
        playUISound('button_click');
        highlight_symmetry_toggle = !highlight_symmetry_toggle;
      }
      if (highlight_symmetry_toggle) {
        label = `[${label}]`;
      }
    }
    let text_h = font.draw({
      style: style_eval,
      x: xx - EVAL_W * 0.5,
      y: 10,
      w: EVAL_W * 2,
      align: ALIGN.HCENTER | ALIGN.HWRAP,
      text: `${label}\n${round(v)}${extra}`,
    });
    if ((pair[0] === 'symmetry' || pair[0] === 'cells' || pair[0] === 'power') && mouseOver({
      x: xx,
      y: 10,
      w: EVAL_W,
      h: text_h,
    })) {
      if (pair[0] === 'symmetry') {
        highlight_symmetry = true;
      } else if (pair[0] === 'cells') {
        highlight_cells = !highlight_cells;
      } else if (pair[0] === 'power') {
        highlight_power = !highlight_power;
      }
    }
    xx += EVAL_W + PAD;
  }

  queuePostprocess(highlight_symmetry);

  let area_canvas_size = AREA_CANVAS_W / VIS_TO_CANVAS_SCALE;
  if (highlight_cells) {
    let area_sprite = game_state.getCellSprite();
    if (area_sprite) {
      area_sprite.draw({
        x: MC_XC - area_canvas_size / 2,
        y: MC_YC - area_canvas_size / 2,
        w: area_canvas_size,
        h: area_canvas_size,
      });
    }
  }
  if (highlight_power) {
    let power_sprite = game_state.getPowerSprite();
    if (power_sprite) {
      power_sprite.draw({
        x: MC_XC - area_canvas_size / 2,
        y: MC_YC - area_canvas_size / 2,
        w: area_canvas_size,
        h: area_canvas_size,
      });
    }
  }
  tex2_transform[0] = camera2d.wReal() / area_canvas_size;
  tex2_transform[1] = -camera2d.hReal() / area_canvas_size;
  tex2_transform[2] = -((MC_XC - area_canvas_size / 2) - camera2d.x0Real()) / area_canvas_size;
  tex2_transform[3] = 1 + ((camera2d.y1Real() - (MC_YC + area_canvas_size / 2)) / area_canvas_size);

  drawDemons();
  drawLevel();

  let do_hover = mouseOver({
    x: MC_X0 - PAD*4, y: MC_Y0 - PAD*4,
    w: MC_W + PAD*8, h: MC_W + PAD*8,
    peek: true,
  });
  mousePos(mouse_pos);
  let drag;
  if (do_hover) {
    drag = inputDrag({
      //min_dist: MC_R / CIRCLE_STEPS * 0.75,
    });
  }

  const CIRCLE_INTERACT_DIST = MC_R / CIRCLE_STEPS / 2;

  let center_cursor_dist = v2dist(mouse_pos, [MC_XC, MC_YC]);
  let cursor_angle = round(atan2(mouse_pos[0] - MC_XC, mouse_pos[1] - MC_YC) * ANGLE_STEPS / (2 * PI));
  if (cursor_angle < 0) {
    cursor_angle += ANGLE_STEPS;
  }
  let cursor_circle = -1;
  let cursor_circle_dist = Infinity;
  let drag_start_center_cursor_dist = 0;
  let drag_start_angle = 0;
  let drag_start_circle = -1;
  let drag_start_circle_dist = Infinity;
  if (drag) {
    drag_start_center_cursor_dist = v2dist(drag.start_pos, [MC_XC, MC_YC]);
    drag_start_angle = round(atan2(drag.start_pos[0] - MC_XC, drag.start_pos[1] - MC_YC) * ANGLE_STEPS / (2 * PI));
    if (drag_start_angle < 0) {
      drag_start_angle += ANGLE_STEPS;
    }
  }
  for (let ii = 0; ii < circles.length; ++ii) {
    let r = circles[ii] / CIRCLE_STEPS * MC_R;
    drawCircleAA(MC_XC, MC_YC, Z.CIRCLES, r, LINE_W, 1, palette[PALETTE_CIRCLE]);

    let circle_cursor_dist = abs(center_cursor_dist - r);
    if (circle_cursor_dist < cursor_circle_dist &&
      circle_cursor_dist < CIRCLE_INTERACT_DIST
    ) {
      cursor_circle_dist = circle_cursor_dist;
      cursor_circle = ii;
    }

    if (drag) {
      let drag_start_circle_cursor_dist = abs(drag_start_center_cursor_dist - r);
      if (drag_start_circle_cursor_dist < drag_start_circle_dist &&
        drag_start_circle_cursor_dist < CIRCLE_INTERACT_DIST
      ) {
        drag_start_circle_dist = drag_start_circle_cursor_dist;
        drag_start_circle = ii;
      }
    }
  }

  if (drag) {
    if (drag_start_circle === cursor_circle && drag_start_angle === cursor_angle && !was_drag) {
      drag = null;
      drag_start_circle = -1;
    }
  }


  for (let ii = 0; ii < lines.length; ++ii) {
    let line = lines[ii];
    let [x0, y0] = circAngleToXY(line[0], line[1]);
    let [x1, y1] = circAngleToXY(line[2], line[3]);
    let pal = highlight_symmetry && !game_state.symmap.lines[ii] ? PALETTE_SYMERROR : PALETTE_LINE;
    drawLine(x0, y0, x1, y1, Z.LINES, LINE_W, 1, palette[pal]);
  }
  for (let ii = 0; ii < power.length; ++ii) {
    let pow = power[ii];
    let [x, y] = circAngleToXY(pow[0], pow[1]);
    drawCircle(x, y, Z.POWER, POWER_R, 1, palette[PALETTE_BG]);
    let symerror = highlight_symmetry && !game_state.symmap.power[ii];
    let pal = symerror ? PALETTE_SYMERROR : PALETTE_POWER;
    drawCircleAA(x, y, Z.POWER + (symerror ? 0.15 : 0.1), POWER_R, LINE_W, 1, palette[pal]);
    if (!highlight_cells) {
      sprite_runes.draw({
        x: x - RUNE_W/2,
        y: y - RUNE_W/2,
        z: Z.RUNES,
        w: RUNE_W,
        h: RUNE_W,
        frame: (circles[pow[0]] * ANGLE_STEPS + pow[1]) % (sprite_runes.uidata!.rects as Array<Vec4>).length,
        color: palette[pal],
      });
    }
  }

  let right_click: [string, VoidFunc] | null = null;
  let left_click: [string, VoidFunc] | null = null;
  let drag_start: [string, VoidFunc] | null = null;
  let drag_stop: [string, VoidFunc] | null = null;
  if (do_hover && !drag) {
    // CIRCLE logic
    if (cursor_circle !== -1 && cursor_circle_dist < CIRCLE_INTERACT_DIST) {
      // near existing
      // drawCircleAA(MC_XC, MC_YC, Z.HOVER, circles[cursor_circle] / CIRCLE_STEPS * MC_R,
      //   LINE_W_DELETE, 1, palette[PALETTE_HOVER_DELETE]);
      right_click = [
        'Erase circle',
        function () {
          let tail = circles.length - 1;
          for (let ii = lines.length - 1; ii >= 0; --ii) {
            let line = lines[ii];
            if (line[0] === cursor_circle || line[2] === cursor_circle) {
              lines.splice(ii, 1);
            } else {
              if (line[0] === tail) {
                line[0] = cursor_circle;
              }
              if (line[2] === tail) {
                line[2] = cursor_circle;
              }
            }
          }
          for (let ii = power.length - 1; ii >= 0; --ii) {
            if (power[ii][0] === cursor_circle) {
              power.splice(ii, 1);
            } else if (power[ii][0] === tail) {
              power[ii][0] = cursor_circle;
            }
          }
          ridx(circles, cursor_circle);
        },
      ];
    } else {
      let circle_r = round(center_cursor_dist / MC_R * CIRCLE_STEPS);
      if (circle_r > CIRCLE_STEPS && circle_r < CIRCLE_STEPS + 4) {
        circle_r = CIRCLE_STEPS;
      }
      if (circle_r >= CIRCLE_MIN && circle_r <= CIRCLE_STEPS && !circles.includes(circle_r)) {
        drawCircleAA(MC_XC, MC_YC, Z.HOVER, circle_r / CIRCLE_STEPS * MC_R,
          LINE_W / 2, 1, palette[PALETTE_HOVER]);
        left_click = [
          'Draw circle',
          function () {
            circles.push(circle_r);
          },
        ];
      }
    }
  }
  if (do_hover && drag_start_circle === -1) {
    // POWER logic
    if (cursor_circle_dist < CIRCLE_INTERACT_DIST) {
      // do rollover
      let screen_pos = circAngleToXY(cursor_circle, cursor_angle);
      let [tx, ty] = screen_pos;
      let pos: [number, number] = [cursor_circle, cursor_angle];
      let valid = true;
      for (let ii = 0; ii < power.length; ++ii) {
        let test = power[ii];
        let opos = circAngleToXY(test[0], test[1]);
        if (v2distSq(screen_pos, opos) < POWER_R * 2 * POWER_R * 2 && (
          screen_pos[0] !== opos[0] || screen_pos[1] !== opos[1]
        )) {
          valid = false;
        }
      }
      let would_remove = false;
      for (let ii = 0; ii < power.length; ++ii) {
        if (v2same(power[ii], pos)) {
          would_remove = true;
          break;
        }
      }
      if (would_remove) {
        drawCircle(tx, ty, Z.HOVER, POWER_R * 0.75, 0.5,
          palette[(would_remove || !valid) ? PALETTE_HOVER_DELETE : PALETTE_HOVER]);
      }
      if (valid) {
        left_click = [
          would_remove ? 'Erase Power Node' : 'Draw Power Node',
          function () {
            let removed = false;
            for (let ii = 0; ii < power.length; ++ii) {
              if (v2same(power[ii], pos)) {
                power.splice(ii, 1);
                removed = true;
                break;
              }
            }
            if (!removed) {
              power.push(pos);
            }
          },
        ];
      }
    }
  }
  if (do_hover) {
    // LINE logic
    if (drag_start_circle !== -1) {
      placing = game_state.placing = [drag_start_circle, drag_start_angle];
      let [sx, sy] = circAngleToXY(drag_start_circle, drag_start_angle);
      drawCircle(sx, sy, Z.HOVER, LINE_W * 2, 0.5, palette[PALETTE_HOVER]);
    }
    if (cursor_circle_dist < CIRCLE_INTERACT_DIST) {
      // do rollover
      let line: [number, number, number, number] = [0,0,0,0];
      let valid = true;
      if (placing) {
        line = [placing[0], placing[1], cursor_circle, cursor_angle];
        canonicalLine(line);
        if (cursor_circle === placing[0] && angleDiff(cursor_angle, placing[1]) < 5) {
          valid = false;
        }
      }
      let [tx, ty] = circAngleToXY(cursor_circle, cursor_angle);
      if (valid) {
        drawCircle(tx, ty, Z.HOVER, LINE_W * 2, 0.5, palette[PALETTE_HOVER]);
        if (placing) {
          let [sx, sy] = circAngleToXY(placing[0], placing[1]);
          let would_remove = false;
          for (let ii = 0; ii < lines.length; ++ii) {
            if (v4same(lines[ii], line)) {
              would_remove = true;
              break;
            }
          }
          drawLine(sx, sy, tx, ty, Z.HOVER, LINE_W_DELETE, 0.5,
            palette[would_remove ? PALETTE_HOVER_DELETE : PALETTE_HOVER]);
        }

        if (placing) {
          let would_remove = false;
          for (let ii = 0; ii < lines.length; ++ii) {
            if (v4same(lines[ii], line)) {
              would_remove = true;
              break;
            }
          }
          drag_stop = [
            would_remove ? 'Erase line' : 'Draw line',
            function () {
              let removed = false;
              for (let ii = 0; ii < lines.length; ++ii) {
                if (v4same(lines[ii], line)) {
                  lines.splice(ii, 1);
                  removed = true;
                  break;
                }
              }
              if (!removed) {
                lines.push(line);
              }
              placing = game_state.placing = null;
            },
          ];
        } else {
          drag_start = [
            'Draw/Erase line',
            nop,
          ];
        }
      } else {
        assert(placing);
        drawCircle(tx, ty, Z.HOVER, LINE_W * 2, 0.5, palette[PALETTE_HOVER_DELETE]);
        let [sx, sy] = circAngleToXY(placing[0], placing[1]);
        drawLine(sx, sy, tx, ty, Z.HOVER, LINE_W_DELETE, 0.5,
          palette[PALETTE_HOVER_DELETE]);
        drag_stop = [
          'Draw line (too short)',
          nop,
        ];
      }
    } else if (placing) {
      drag_stop = [
        'Draw line',
        nop,
      ];
    }
  }

  let text_height = uiTextHeight();
  if (left_click) {
    font.draw({
      style: style_help,
      x: game_width / 2,
      y: game_height - (text_height + PAD) * 3,
      align: ALIGN.HCENTER,
      text: `Left-click: ${left_click[0]}`,
    });
    if (inputClick({ button: 0 })) {
      if (left_click[1] !== nop) {
        playUISound('button_click');
        left_click[1]();
      }
      game_state.commit();
    }
  }
  if (drag_start || drag_stop) {
    font.draw({
      style: style_help,
      x: game_width / 2,
      y: game_height - (text_height + PAD) * 2,
      align: ALIGN.HCENTER,
      text: `Drag: ${drag_start ? drag_start[0] : drag_stop![0]}`,
    });
    if (drag && !was_drag && drag_start) {
      // playUISound('button_click');
      drag_start[1]();
      // game_state.commit();
    }
    if (was_drag && !drag && drag_stop) {
      if (drag_stop[1] !== nop) {
        playUISound('button_click');
        drag_stop[1]();
      }
      game_state.commit();
    }
  }
  if (right_click) {
    font.draw({
      style: style_help,
      x: game_width / 2,
      y: game_height - (text_height + PAD),
      align: ALIGN.HCENTER,
      text: `Right-click: ${right_click[0]}`,
    });
    if (inputClick({ button: 2 }) || inputTouchMode() && longPress({ min_time: 1000 }) || keyDownEdge(KEYS.DEL)) {
      playUISound('button_click');
      right_click[1]();
      game_state.commit();
    }
  }

  was_drag = Boolean(drag);
  if (!drag) {
    game_state.placing = null;
  }
}

export function main(): void {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    netInit({ engine });
  }

  const font_info_ld55 = require('./img/font/ld55.json');
  let pixely = 'off';
  let font_def = { info: font_info_ld55, texture: 'font/ld55' };
  let ui_sprites;
  let pixel_perfect = 0;

  effects.registerShader('glow_merge', {
    fp: 'shaders/effects_glow_merge.fp',
  });
  effects.registerShader('glow_merge_no_power', {
    fp: 'shaders/effects_glow_merge_no_power.fp',
  });
  effects.registerShader('clear', {
    fp: 'shaders/effects_clear.fp',
  });

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font: font_def,
    viewport_postprocess: false,
    antialias: false,
    ui_sprites,
    pixel_perfect,
    line_mode: 0,
  })) {
    return;
  }
  font = engine.font;

  // Perfect sizes for pixely modes
  scaleSizes(32 / 32);
  setFontHeight(32);
  setButtonHeight(48);
  if (engine.DEBUG) {
    engine.border_color[0] = 0.1;
    engine.border_color[2] = 0.1;
  }

  init();

  engine.setState(statePlay);
}
