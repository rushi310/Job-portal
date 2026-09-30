/**
 * charts.js — Hand-drawn charts (Phase 11; UI_SPEC §4 "Charts"). No chart library.
 * - Bar chart: one row per item — an HTML label, an SVG bar and the value as text, so every value is
 *   readable without the colours.
 * - Donut chart: SVG ring for parts of a whole, with an HTML legend (label, count, percentage).
 * - Line chart: SVG drawn at the container's real width (text is never squeezed); it is redrawn after
 *   the window is resized.
 * Every render replaces the container's content, so rendering again never duplicates a chart.
 * The SVG graphics are hidden from screen readers; the text next to them (and the tables pages
 * show) carries the same numbers. Colours come from CSS classes (`chart-tone--<key>`) using tokens.
 */

import { createEmptyState } from './empty-state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LINE_HEIGHT = 220;
const LINE_PADDING = { top: 16, right: 28, bottom: 32, left: 40 }; // right: room for the last date label
const MIN_X_LABEL_SPACING = 64; // px between x-axis labels
const FALLBACK_WIDTH = 600;

const RESIZE_DEBOUNCE_MS = 150;

/**
 * Line-chart containers on the page → the points and width last drawn. One window "resize" listener
 * (added once) redraws them; the chart area only changes width when the window does.
 */
const lineCharts = new Map();
let resizeTimer = 0;
let isListeningForResize = false;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createSvgElement(tag, attributes = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, String(value)));
  return el;
}

function createSvg(attributes) {
  return createSvgElement('svg', { 'aria-hidden': 'true', focusable: 'false', ...attributes });
}

/** Tooltip shown on hover (SVG <title>). */
function addTitle(el, text) {
  const titleEl = createSvgElement('title');
  titleEl.textContent = text;
  el.append(titleEl);
}

/** Non-negative finite number; anything else counts as 0 (never NaN in the drawing). */
export const toChartValue = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

const toneClass = (tone) => (/^[a-z_-]+$/.test(String(tone ?? '')) ? ` chart-tone--${tone}` : ' chart-tone--primary');

const defaultValueText = (item) => (
  Number.isFinite(item.percent) ? `${toChartValue(item.count)} (${item.percent}%)` : String(toChartValue(item.count))
);

function renderEmpty(containerEl, empty) {
  containerEl.replaceChildren(createEmptyState({ icon: 'barChart', ...empty }));
}

/* ---------- Bar chart ---------- */

function createBarRow(item, maxValue, valueText) {
  const value = toChartValue(item.count);
  const rowEl = createElement('li', 'bar-chart__row');

  const labelEl = createElement('span', 'bar-chart__label');
  if (item.href) {
    const linkEl = createElement('a', '', item.label);
    linkEl.href = item.href;
    labelEl.append(linkEl);
  } else {
    labelEl.textContent = item.label;
  }
  if (item.meta) labelEl.append(' ', createElement('span', 'bar-chart__meta', item.meta));

  const svgEl = createSvg({ class: 'bar-chart__track', width: '100%', height: '12' });
  const share = maxValue > 0 ? (value / maxValue) * 100 : 0;
  // Very small non-zero values still get a visible sliver.
  const width = value > 0 ? Math.max(share, 1.5) : 0;
  const barEl = createSvgElement('rect', {
    class: `bar-chart__bar${toneClass(item.tone ?? item.key)}`, x: 0, y: 0, width: `${width}%`, height: '100%', rx: 3,
  });
  addTitle(barEl, `${item.label}: ${valueText(item)}`);
  svgEl.append(barEl);

  rowEl.append(labelEl, svgEl, createElement('span', 'bar-chart__value', valueText(item)));
  return rowEl;
}

/**
 * Horizontal bar chart; bars are scaled to the largest value.
 * @param {HTMLElement} containerEl
 * @param {object} options
 * @param {Array<{ key: string, label: string, count: number, percent?: number, tone?: string,
 *   meta?: string, href?: string }>} options.items
 * @param {(item: object) => string} [options.valueText] text shown after each bar
 * @param {{ title: string, message?: string }} options.empty shown when every value is 0
 */
export function renderBarChart(containerEl, { items = [], valueText = defaultValueText, empty }) {
  const maxValue = Math.max(0, ...items.map((item) => toChartValue(item.count)));
  if (maxValue === 0) {
    renderEmpty(containerEl, empty);
    return;
  }
  const listEl = createElement('ul', 'bar-chart');
  listEl.setAttribute('role', 'list');
  listEl.append(...items.map((item) => createBarRow(item, maxValue, valueText)));
  containerEl.replaceChildren(listEl);
}

/* ---------- Donut chart ---------- */

const DONUT_RADIUS = 46;
const DONUT_GAP = 0.8; // share of the ring (out of 100) left as a gap between segments

function createDonutSvg(items, total, centerLabel) {
  const svgEl = createSvg({ class: 'donut-chart__svg', viewBox: '0 0 120 120' });
  const ringEl = createSvgElement('g', { transform: 'rotate(-90 60 60)' });
  ringEl.append(createSvgElement('circle', {
    class: 'donut-chart__base', cx: 60, cy: 60, r: DONUT_RADIUS, fill: 'none', 'stroke-width': 16,
  }));
  const visible = items.filter((item) => toChartValue(item.count) > 0);
  const gap = visible.length > 1 ? DONUT_GAP : 0;
  let offset = 0;
  visible.forEach((item) => {
    const share = (toChartValue(item.count) / total) * 100;
    const segmentEl = createSvgElement('circle', {
      class: `donut-chart__segment${toneClass(item.tone ?? item.key)}`,
      cx: 60, cy: 60, r: DONUT_RADIUS, fill: 'none', 'stroke-width': 16, pathLength: 100,
      'stroke-dasharray': `${Math.max(share - gap, 0.1)} ${100 - Math.max(share - gap, 0.1)}`,
      'stroke-dashoffset': -offset,
    });
    addTitle(segmentEl, `${item.label}: ${defaultValueText(item)}`);
    ringEl.append(segmentEl);
    offset += share;
  });
  const totalEl = createSvgElement('text', { class: 'donut-chart__total', x: 60, y: 60, 'text-anchor': 'middle' });
  totalEl.textContent = String(total);
  const labelEl = createSvgElement('text', { class: 'donut-chart__label', x: 60, y: 78, 'text-anchor': 'middle' });
  labelEl.textContent = centerLabel;
  svgEl.append(ringEl, totalEl, labelEl);
  return svgEl;
}

function createLegend(items) {
  const listEl = createElement('ul', 'chart-legend');
  listEl.setAttribute('role', 'list');
  listEl.append(...items.map((item) => {
    const itemEl = createElement('li', 'chart-legend__item');
    const swatchEl = createElement('span', `chart-legend__swatch${toneClass(item.tone ?? item.key)}`);
    swatchEl.setAttribute('aria-hidden', 'true');
    itemEl.append(
      swatchEl,
      createElement('span', 'chart-legend__label', item.label),
      createElement('span', 'chart-legend__value', defaultValueText(item)),
    );
    return itemEl;
  }));
  return listEl;
}

/**
 * Donut chart for parts of a whole, with a legend listing every item's count and percentage.
 * @param {HTMLElement} containerEl
 * @param {object} options
 * @param {Array<{ key: string, label: string, count: number, percent?: number, tone?: string }>} options.items
 * @param {string} options.centerLabel word under the total, e.g. "users"
 * @param {{ title: string, message?: string }} options.empty shown when the total is 0
 */
export function renderDonutChart(containerEl, { items = [], centerLabel = '', empty }) {
  const total = items.reduce((sum, item) => sum + toChartValue(item.count), 0);
  if (total === 0) {
    renderEmpty(containerEl, empty);
    return;
  }
  const wrapperEl = createElement('div', 'donut-chart');
  wrapperEl.append(createDonutSvg(items, total, centerLabel), createLegend(items));
  containerEl.replaceChildren(wrapperEl);
}

/* ---------- Line chart ---------- */

/** Round the axis maximum up to 1, 2 or 5 × 10ⁿ, divided into 4 whole-number steps where possible. */
export function getNiceAxis(maxValue) {
  const max = Math.max(toChartValue(maxValue), 1);
  const rawStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep));
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let tick = 0; tick <= top; tick += step) ticks.push(tick);
  return { top, ticks };
}

function drawAxes(svgEl, { width, plotWidth, plotHeight, ticks, top, points, xFor }) {
  const { left, top: padTop } = LINE_PADDING;
  ticks.forEach((tick) => {
    const y = padTop + plotHeight - (tick / top) * plotHeight;
    svgEl.append(createSvgElement('line', {
      class: tick === 0 ? 'line-chart__baseline' : 'line-chart__grid', x1: left, x2: width - LINE_PADDING.right, y1: y, y2: y,
    }));
    const labelEl = createSvgElement('text', { class: 'line-chart__tick', x: left - 8, y: y + 4, 'text-anchor': 'end' });
    labelEl.textContent = String(tick);
    svgEl.append(labelEl);
  });
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / MIN_X_LABEL_SPACING))));
  points.forEach((point, index) => {
    if (index % every !== 0) return;
    const labelEl = createSvgElement('text', {
      class: 'line-chart__tick', x: xFor(index), y: padTop + plotHeight + 20, 'text-anchor': 'middle',
    });
    labelEl.textContent = point.shortLabel;
    svgEl.append(labelEl);
  });
}

function drawLine(containerEl, points) {
  const width = Math.max(containerEl.clientWidth || FALLBACK_WIDTH, 240);
  const plotWidth = width - LINE_PADDING.left - LINE_PADDING.right;
  const plotHeight = LINE_HEIGHT - LINE_PADDING.top - LINE_PADDING.bottom;
  const { top, ticks } = getNiceAxis(Math.max(...points.map((point) => toChartValue(point.count))));
  const xFor = (index) => LINE_PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value) => LINE_PADDING.top + plotHeight - (toChartValue(value) / top) * plotHeight;

  const svgEl = createSvg({ class: 'line-chart__svg', viewBox: `0 0 ${width} ${LINE_HEIGHT}`, width, height: LINE_HEIGHT });
  drawAxes(svgEl, { width, plotWidth, plotHeight, ticks, top, points, xFor });
  if (points.length > 1) {
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xFor(index)} ${yFor(point.count)}`).join(' ');
    svgEl.append(createSvgElement('path', { class: 'line-chart__line', d: path, fill: 'none' }));
  }
  points.forEach((point, index) => {
    const dotEl = createSvgElement('circle', { class: 'line-chart__dot', cx: xFor(index), cy: yFor(point.count), r: 4 });
    addTitle(dotEl, `${point.label}: ${toChartValue(point.count)}`);
    svgEl.append(dotEl);
  });
  containerEl.replaceChildren(svgEl);
  return width;
}

/** Redraw line charts whose container width changed; forget charts no longer on the page. */
function redrawLineCharts() {
  lineCharts.forEach((state, containerEl) => {
    if (!containerEl.isConnected) {
      lineCharts.delete(containerEl);
      return;
    }
    const width = containerEl.clientWidth;
    if (width === 0 || width === state.width) return;
    state.width = drawLine(containerEl, state.points);
  });
}

function handleWindowResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(redrawLineCharts, RESIZE_DEBOUNCE_MS);
}

/**
 * Line chart of counts over time (one series). Rendering again replaces the chart; there is only ever
 * one resize listener for all line charts.
 * @param {HTMLElement} containerEl
 * @param {object} options
 * @param {Array<{ label: string, shortLabel: string, count: number }>} options.points in time order
 * @param {{ title: string, message?: string }} options.empty shown when there are no points
 */
export function renderLineChart(containerEl, { points = [], empty }) {
  if (points.length === 0 || points.every((point) => toChartValue(point.count) === 0)) {
    lineCharts.delete(containerEl);
    containerEl.classList.remove('line-chart');
    renderEmpty(containerEl, empty);
    return;
  }
  containerEl.classList.add('line-chart');
  lineCharts.set(containerEl, { points, width: drawLine(containerEl, points) });
  if (!isListeningForResize) {
    window.addEventListener('resize', handleWindowResize);
    isListeningForResize = true;
  }
}
