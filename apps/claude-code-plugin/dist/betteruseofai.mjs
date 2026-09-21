#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../cli-ts/src/args.ts
var VALUE_FLAGS, SWITCH_FLAGS, parseArgs, resolveSince, flagString, flagBool;
var init_args = __esm({
  "../cli-ts/src/args.ts"() {
    "use strict";
    VALUE_FLAGS = /* @__PURE__ */ new Set([
      "since",
      "until",
      "by",
      "region",
      "format",
      "source",
      "dir",
      "now",
      "water-scope",
      "carbon-basis",
      "limit",
      "interval",
      "model",
      "depth",
      "log",
      "out",
      "before"
    ]);
    SWITCH_FLAGS = /* @__PURE__ */ new Set([
      "json",
      "no-color",
      "help",
      "version",
      "ascii",
      "cheap",
      "all",
      "verbose",
      "local",
      "brief",
      "no-log",
      "with-projects",
      "no-open",
      "dry-run"
    ]);
    parseArgs = (argv) => {
      const flags = {};
      const positional = [];
      const errors = [];
      let index = 0;
      while (index < argv.length) {
        const token = argv[index];
        index += 1;
        if (token === "--") {
          positional.push(...argv.slice(index));
          break;
        }
        if (token.startsWith("--")) {
          const body = token.slice(2);
          const equals = body.indexOf("=");
          const name = equals === -1 ? body : body.slice(0, equals);
          const inline = equals === -1 ? null : body.slice(equals + 1);
          if (VALUE_FLAGS.has(name)) {
            if (inline !== null) {
              flags[name] = inline;
            } else if (index < argv.length && !argv[index].startsWith("--")) {
              flags[name] = argv[index];
              index += 1;
            } else {
              errors.push(`--${name} needs a value.`);
            }
          } else if (SWITCH_FLAGS.has(name)) {
            if (inline !== null) errors.push(`--${name} does not take a value.`);
            flags[name] = true;
          } else {
            errors.push(`No such option: --${name}`);
          }
          continue;
        }
        if (token === "-h") {
          flags["help"] = true;
          continue;
        }
        if (token === "-v") {
          flags["version"] = true;
          continue;
        }
        positional.push(token);
      }
      const command = positional.shift() ?? "";
      return { command, positional, flags, errors };
    };
    resolveSince = (value, now) => {
      if (!value) return void 0;
      const relative = /^(\d+)([dhwm])$/.exec(value.trim());
      if (!relative) return value;
      const amount = Number.parseInt(relative[1], 10);
      const unit = relative[2];
      const hours = unit === "h" ? amount : unit === "d" ? amount * 24 : unit === "w" ? amount * 168 : amount * 720;
      return new Date(now.getTime() - hours * 36e5).toISOString();
    };
    flagString = (flags, name) => {
      const value = flags[name];
      return typeof value === "string" ? value : void 0;
    };
    flagBool = (flags, name) => flags[name] === true;
  }
});

// ../../packages/core/dist/types.js
var init_types = __esm({
  "../../packages/core/dist/types.js"() {
    "use strict";
  }
});

// ../../packages/core/dist/range.js
var exact, ZERO, add, mul, scale, order, clampNonNegative;
var init_range = __esm({
  "../../packages/core/dist/range.js"() {
    "use strict";
    exact = (value) => ({ low: value, central: value, high: value });
    ZERO = exact(0);
    add = (a, b) => ({
      low: a.low + b.low,
      central: a.central + b.central,
      high: a.high + b.high
    });
    mul = (a, b) => ({
      low: a.low * b.low,
      central: a.central * b.central,
      high: a.high * b.high
    });
    scale = (a, factor) => ({
      low: a.low * factor,
      central: a.central * factor,
      high: a.high * factor
    });
    order = (r) => {
      const [low, central, high] = [r.low, r.central, r.high].sort((a, b) => a - b);
      return { low, central, high };
    };
    clampNonNegative = (r) => ({
      low: Math.max(0, r.low),
      central: Math.max(0, r.central),
      high: Math.max(0, r.high)
    });
  }
});

// ../../packages/core/dist/resolve.js
var normalise, indexes, aliasIndex, resolveModel, getModel, downgradeTarget, SHAPE_RANK, METHODOLOGY_RANK, selectBenchmark, getRegion;
var init_resolve = __esm({
  "../../packages/core/dist/resolve.js"() {
    "use strict";
    normalise = (raw) => raw.trim().toLowerCase();
    indexes = /* @__PURE__ */ new WeakMap();
    aliasIndex = (dataset2) => {
      let index = indexes.get(dataset2);
      if (index)
        return index;
      index = /* @__PURE__ */ new Map();
      for (const model of dataset2.models) {
        index.set(normalise(model.id), model);
        for (const alias of model.aliases)
          index.set(normalise(alias), model);
      }
      indexes.set(dataset2, index);
      return index;
    };
    resolveModel = (raw, dataset2) => {
      if (!raw)
        return null;
      const key = normalise(raw);
      if (key === "<synthetic>" || key === "synthetic")
        return null;
      return aliasIndex(dataset2).get(key) ?? null;
    };
    getModel = (id, dataset2) => id ? dataset2.models.find((model) => model.id === id) ?? null : null;
    downgradeTarget = (model, dataset2) => dataset2.models.find((candidate) => candidate.family === model.family && candidate.ordinal === model.ordinal + 1 && candidate.deprecated === void 0) ?? null;
    SHAPE_RANK = {
      "per-query-set": 0,
      "per-token": 1,
      parametric: 2,
      "per-prompt": 3,
      proxy: 4
    };
    METHODOLOGY_RANK = {
      "provider-measured": 0,
      "independent-benchmark": 1,
      "provider-statement": 2,
      "parametric-model": 3,
      proxy: 4
    };
    selectBenchmark = (model, dataset2, options = {}) => {
      const at = options.at;
      let candidates = dataset2.benchmarks.filter((row) => {
        if (!row.modelIds.includes(model.id))
          return false;
        if (at && row.validFrom > at)
          return false;
        if (at && row.validTo && row.validTo < at)
          return false;
        return true;
      });
      if (candidates.length === 0)
        return null;
      const wanted = options.hosting ?? "cloud";
      const matching = candidates.filter((row) => (row.hosting ?? "cloud") === wanted);
      if (matching.length > 0)
        candidates = matching;
      const sorted = [...candidates].sort((a, b) => {
        if (a.qualityScore !== b.qualityScore)
          return b.qualityScore - a.qualityScore;
        if (SHAPE_RANK[a.shape] !== SHAPE_RANK[b.shape])
          return SHAPE_RANK[a.shape] - SHAPE_RANK[b.shape];
        if (METHODOLOGY_RANK[a.methodology] !== METHODOLOGY_RANK[b.methodology]) {
          return METHODOLOGY_RANK[a.methodology] - METHODOLOGY_RANK[b.methodology];
        }
        if (a.validFrom !== b.validFrom)
          return a.validFrom < b.validFrom ? 1 : -1;
        return a.id < b.id ? -1 : 1;
      });
      return sorted[0] ?? null;
    };
    getRegion = (dataset2, code) => dataset2.regions.find((region) => region.code === code) ?? null;
  }
});

// ../../packages/core/dist/normalize.js
var widen, fitQuerySet, ecologitsWhPerOutputToken, normalizeToPerToken;
var init_normalize = __esm({
  "../../packages/core/dist/normalize.js"() {
    "use strict";
    init_range();
    widen = (rate, factor) => order({
      low: rate.low * factor.low,
      central: rate.central * factor.central,
      high: rate.high * factor.high
    });
    fitQuerySet = (points, outputToInputWeight = 8) => {
      const columns = ["intercept", "input", "output"];
      const valueOf = (column, point) => column === "intercept" ? 1 : column === "input" ? point.inputTokens : point.outputTokens;
      const solveFor = (active2) => {
        const n = active2.length;
        const ata = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => {
          let total = i === j ? 1e-12 : 0;
          for (const point of points) {
            const ai = active2[i];
            const aj = active2[j];
            if (ai === void 0 || aj === void 0)
              continue;
            total += valueOf(ai, point) * valueOf(aj, point);
          }
          return total;
        }));
        const atb = Array.from({ length: n }, (_, i) => {
          let total = 0;
          for (const point of points) {
            const ai = active2[i];
            if (ai === void 0)
              continue;
            total += valueOf(ai, point) * point.energyWh;
          }
          return total;
        });
        for (let col = 0; col < n; col += 1) {
          let pivot = col;
          for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(ata[row]?.[col] ?? 0) > Math.abs(ata[pivot]?.[col] ?? 0))
              pivot = row;
          }
          if (Math.abs(ata[pivot]?.[col] ?? 0) < 1e-15)
            return null;
          [ata[col], ata[pivot]] = [ata[pivot], ata[col]];
          [atb[col], atb[pivot]] = [atb[pivot], atb[col]];
          for (let row = col + 1; row < n; row += 1) {
            const factor = (ata[row]?.[col] ?? 0) / (ata[col]?.[col] ?? 1);
            if (factor === 0)
              continue;
            for (let k = col; k < n; k += 1) {
              ata[row][k] = (ata[row]?.[k] ?? 0) - factor * (ata[col]?.[k] ?? 0);
            }
            atb[row] = (atb[row] ?? 0) - factor * (atb[col] ?? 0);
          }
        }
        const solution = new Array(n).fill(0);
        for (let row = n - 1; row >= 0; row -= 1) {
          let value = atb[row] ?? 0;
          for (let col = row + 1; col < n; col += 1) {
            value -= (ata[row]?.[col] ?? 0) * (solution[col] ?? 0);
          }
          solution[row] = value / (ata[row]?.[row] ?? 1);
        }
        const result3 = { intercept: 0, input: 0, output: 0 };
        active2.forEach((column, index) => {
          result3[column] = solution[index] ?? 0;
        });
        return result3;
      };
      const constantColumn = ["input", "output"].find((column) => {
        const values = points.map((point) => valueOf(column, point));
        const first = values[0] ?? 0;
        return first > 0 && values.every((value) => value === first);
      });
      const varyingColumn = ["input", "output"].find((column) => {
        const values = points.map((point) => valueOf(column, point));
        return new Set(values).size > 1;
      });
      if (constantColumn && varyingColumn) {
        const solvedPair = solveFor(["intercept", varyingColumn]);
        if (solvedPair) {
          const constantValue = valueOf(constantColumn, points[0]);
          const varyingRate = Math.max(0, solvedPair[varyingColumn]);
          let perConstantToken = Math.max(0, solvedPair.intercept) / constantValue;
          if (perConstantToken <= 0) {
            perConstantToken = constantColumn === "output" ? varyingRate * outputToInputWeight : varyingRate / outputToInputWeight;
          }
          const result3 = { intercept: 0, inputWh: 0, outputWh: 0 };
          result3[varyingColumn === "input" ? "inputWh" : "outputWh"] = varyingRate;
          result3[constantColumn === "input" ? "inputWh" : "outputWh"] = perConstantToken;
          return result3;
        }
      }
      let active = [...columns];
      let solved = solveFor(active);
      for (let pass = 0; pass < 2 && solved; pass += 1) {
        const offender = active.find((column) => solved[column] < 0);
        if (!offender)
          break;
        active = active.filter((column) => column !== offender);
        if (active.length === 0)
          break;
        solved = solveFor(active);
      }
      if (!solved)
        return { intercept: 0, inputWh: 0, outputWh: 0 };
      return {
        intercept: Math.max(0, solved.intercept),
        inputWh: Math.max(0, solved.input),
        outputWh: Math.max(0, solved.output)
      };
    };
    ecologitsWhPerOutputToken = (coefficients, activeParamsB) => {
      const { alphaKwhPerTokenPerB: alpha, betaPerB: beta, gammaKwhPerToken: gamma } = coefficients;
      const kwhPerThousandTokens = alpha * Math.exp(beta * activeParamsB) * activeParamsB + gamma;
      return kwhPerThousandTokens * 1e3 / 1e3;
    };
    normalizeToPerToken = (row, context, seen = /* @__PURE__ */ new Set()) => {
      const { calibration, model, dataset: dataset2 } = context;
      const flags = [];
      if (seen.has(row.id))
        return null;
      seen.add(row.id);
      switch (row.shape) {
        case "per-token": {
          if (!row.perToken)
            return null;
          return {
            interceptWh: ZERO,
            inputWh: row.perToken.energyWhPerInputToken,
            outputWh: row.perToken.energyWhPerOutputToken,
            flags,
            rootRowId: row.id
          };
        }
        case "per-prompt": {
          const perPrompt = row.perPrompt;
          if (!perPrompt)
            return null;
          if (!perPrompt.energyWh) {
            return null;
          }
          const k = calibration.outputToInputEnergyWeight;
          const referenceInput = perPrompt.referenceInputTokens.central;
          const referenceOutput = perPrompt.referenceOutputTokens.central;
          const denominator = referenceInput + k.central * referenceOutput;
          if (denominator <= 0)
            return null;
          const inputRate = {
            low: perPrompt.energyWh.low / denominator,
            central: perPrompt.energyWh.central / denominator,
            high: perPrompt.energyWh.high / denominator
          };
          const outputRate = scale(inputRate, k.central);
          flags.push("derived-rate");
          let widening = calibration.derivedRowWidening;
          if (!perPrompt.tokenCountsPublished) {
            flags.push("assumed-token-counts");
            const extra = calibration.assumedTokenCountWidening;
            if (extra) {
              widening = {
                low: widening.low * extra.low,
                central: widening.central * extra.central,
                high: widening.high * extra.high
              };
            }
          }
          return {
            interceptWh: ZERO,
            inputWh: widen(inputRate, widening),
            outputWh: widen(outputRate, widening),
            flags,
            rootRowId: row.id
          };
        }
        case "per-query-set": {
          const set = row.perQuerySet;
          if (!set || set.points.length < 2)
            return null;
          const fit = fitQuerySet(set.points, calibration.outputToInputEnergyWeight.central);
          const uncertainty = set.relativeUncertainty ?? calibration.derivedRowWidening;
          return {
            interceptWh: widen(exact(fit.intercept), uncertainty),
            inputWh: widen(exact(fit.inputWh), uncertainty),
            outputWh: widen(exact(fit.outputWh), uncertainty),
            flags,
            rootRowId: row.id
          };
        }
        case "parametric": {
          const parametric = row.parametric;
          const params = model.activeParamsB;
          if (!parametric || !params)
            return null;
          const perOutput = {
            low: ecologitsWhPerOutputToken(parametric.coefficients, params.low),
            central: ecologitsWhPerOutputToken(parametric.coefficients, params.central),
            high: ecologitsWhPerOutputToken(parametric.coefficients, params.high)
          };
          const widening = calibration.parametricWidening ?? calibration.derivedRowWidening;
          const output = widen(order(perOutput), widening);
          const k = calibration.outputToInputEnergyWeight;
          const input = order({
            low: output.low / k.high,
            central: output.central / k.central,
            high: output.high / k.low
          });
          flags.push("parametric-rate");
          return { interceptWh: ZERO, inputWh: input, outputWh: output, flags, rootRowId: row.id };
        }
        case "proxy": {
          if (!row.proxyOf || !row.proxyFactor)
            return null;
          const parent = dataset2.benchmarks.find((candidate) => candidate.id === row.proxyOf);
          if (!parent)
            return null;
          const parentModel = dataset2.models.find((candidate) => parent.modelIds.includes(candidate.id)) ?? model;
          const base = normalizeToPerToken(parent, { ...context, model: parentModel }, seen);
          if (!base)
            return null;
          return {
            interceptWh: clampNonNegative(mul(base.interceptWh, row.proxyFactor)),
            inputWh: clampNonNegative(mul(base.inputWh, row.proxyFactor)),
            outputWh: clampNonNegative(mul(base.outputWh, row.proxyFactor)),
            flags: [...base.flags, "proxy-row"],
            rootRowId: base.rootRowId
          };
        }
        default:
          return null;
      }
    };
  }
});

// ../../packages/core/dist/estimate.js
var unknownEstimate, thinkingTokensFor, collectSources, estimate;
var init_estimate = __esm({
  "../../packages/core/dist/estimate.js"() {
    "use strict";
    init_normalize();
    init_range();
    init_resolve();
    unknownEstimate = (event, datasetVersion, regionCode, flags, thinkingHandling, modelId = null) => ({
      eventId: event.id,
      modelId,
      datasetVersion,
      energyWh: null,
      waterMl: null,
      carbonG: null,
      basis: {
        benchmarkRowId: null,
        benchmarkParentId: null,
        methodology: null,
        boundary: null,
        regionCode,
        tokens: event.tokens,
        thinkingHandling,
        thinkingTokens: null,
        waterScope: "on-site + off-site",
        carbonBasis: "location-based",
        qualityScore: null,
        flags,
        sources: []
      }
    });
    thinkingTokensFor = (tokens, model, visibleOutput) => {
      if (typeof tokens.thinking === "number") {
        return { range: exact(tokens.thinking), handling: "reported", flag: null };
      }
      if (tokens.thinking === null && model.reasoning && model.thinkingRatio) {
        return {
          range: {
            low: 0,
            central: visibleOutput * model.thinkingRatio.central,
            high: visibleOutput * model.thinkingRatio.high
          },
          handling: "estimated",
          flag: "thinking-unknown"
        };
      }
      if (tokens.thinking === null && model.reasoning) {
        return { range: exact(0), handling: "unknown-model", flag: "thinking-unknown" };
      }
      return { range: ZERO, handling: "not-applicable", flag: null };
    };
    collectSources = (row, parent, region) => {
      const sources = [row.source];
      if (parent && parent.source.url !== row.source.url)
        sources.push(parent.source);
      sources.push(region.source);
      if (region.waterSource && region.waterSource.url !== region.source.url) {
        sources.push(region.waterSource);
      }
      return sources;
    };
    estimate = (event, options) => {
      const { dataset: dataset2 } = options;
      const calibration = dataset2.calibration;
      const waterScope = options.waterScope ?? "on-site + off-site";
      const carbonBasis = options.carbonBasis ?? "location-based";
      const at = options.at ?? event.timestamp.slice(0, 10);
      const flags = [];
      const requestedRegion = options.regionCode ?? event.regionHint;
      let region = getRegion(dataset2, requestedRegion);
      if (!region) {
        region = getRegion(dataset2, dataset2.defaultRegion);
        flags.push("region-default");
      }
      if (!region)
        throw new Error(`Dataset has no default region "${dataset2.defaultRegion}"`);
      const regionCode = region.code;
      const model = getModel(event.modelId, dataset2) ?? resolveModel(event.modelRaw, dataset2);
      if (!model) {
        return unknownEstimate(event, dataset2.version, regionCode, [...flags, "model-unknown"], "unknown-model");
      }
      const row = selectBenchmark(model, dataset2, { at, hosting: event.hosting });
      if (!row) {
        return unknownEstimate(event, dataset2.version, regionCode, [...flags, "no-benchmark"], "unknown-model", model.id);
      }
      if (event.hosting === "local" && row.pue.high > 1)
        flags.push("local-row-missing");
      const parent = row.proxyOf ? dataset2.benchmarks.find((candidate) => candidate.id === row.proxyOf) ?? null : null;
      if (event.tokens.estimated)
        flags.push("tokens-estimated");
      const visibleOutput = (event.tokens.output ?? 0) + (event.tokens.tool ?? 0);
      const thinking = thinkingTokensFor(event.tokens, model, event.tokens.output ?? 0);
      if (thinking.flag)
        flags.push(thinking.flag);
      const outputTokens = order(add(exact(visibleOutput), thinking.range));
      const hidden = calibration.hiddenContextFactor[event.surface] ?? exact(1);
      if (hidden.high > 1)
        flags.push("input-partial");
      if (event.tokens.input === void 0 && event.tokens.output !== void 0) {
        if (!flags.includes("input-partial"))
          flags.push("input-partial");
      }
      const countedInput = event.tokens.input ?? 0;
      const cachedRead = event.tokens.cachedRead ?? 0;
      const cachedWrite = event.tokens.cachedWrite ?? 0;
      const cacheShare = calibration.cachedReadShareOfInput;
      const writeShare = calibration.cacheWriteShareOfInput;
      const inputTokens = order(add(add(mul(exact(countedInput), hidden), scale(cacheShare, cachedRead)), scale(writeShare, cachedWrite)));
      const rates = normalizeToPerToken(row, { dataset: dataset2, model, calibration });
      let energyWh = null;
      if (rates) {
        for (const flag of rates.flags)
          if (!flags.includes(flag))
            flags.push(flag);
        const raw = add(add(rates.interceptWh, mul(rates.inputWh, inputTokens)), mul(rates.outputWh, outputTokens));
        const withOverhead = row.energyIncludesPue ? raw : mul(raw, row.pue);
        energyWh = clampNonNegative(order(withOverhead));
      } else {
        flags.push("no-energy-figure");
      }
      const energyKwh = energyWh ? scale(energyWh, 1 / 1e3) : null;
      const directScale = () => {
        const perPrompt = row.perPrompt;
        if (!perPrompt)
          return exact(1);
        const k = calibration.outputToInputEnergyWeight.central;
        const referenceWork = perPrompt.referenceInputTokens.central + k * perPrompt.referenceOutputTokens.central;
        if (referenceWork <= 0)
          return exact(1);
        const work = order({
          low: inputTokens.low + k * outputTokens.low,
          central: inputTokens.central + k * outputTokens.central,
          high: inputTokens.high + k * outputTokens.high
        });
        return scale(work, 1 / referenceWork);
      };
      let waterMl = null;
      const directWater = row.perPrompt?.directWaterMl;
      if (directWater) {
        waterMl = clampNonNegative(order(mul(directWater, directScale())));
        if (!flags.includes("scaled-direct-figure"))
          flags.push("scaled-direct-figure");
      } else if (energyKwh) {
        const onsite = row.waterOnsiteLPerKwh ?? ZERO;
        let litres = mul(energyKwh, onsite);
        if (waterScope !== "on-site") {
          litres = add(litres, mul(energyKwh, region.waterOffsiteLPerKwh));
        }
        waterMl = clampNonNegative(order(scale(litres, 1e3)));
        if (waterScope === "lifecycle" && row.embodiedShareOfTotal && options.includeEmbodied !== false) {
          const uplift = {
            low: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.low),
            central: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.central),
            high: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.high)
          };
          waterMl = order(mul(waterMl, uplift));
        }
      }
      let carbonG = null;
      const directCarbon = row.perPrompt?.directCarbonG;
      if (directCarbon) {
        carbonG = clampNonNegative(order(mul(directCarbon, directScale())));
        if (!flags.includes("scaled-direct-figure"))
          flags.push("scaled-direct-figure");
      } else if (energyKwh) {
        const intensity = carbonBasis === "provider-reported" && row.carbonGPerKwh ? row.carbonGPerKwh : region.gridGco2PerKwh;
        carbonG = clampNonNegative(order(mul(energyKwh, intensity)));
        if (waterScope === "lifecycle" && row.embodiedShareOfTotal && options.includeEmbodied !== false) {
          const uplift = {
            low: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.low),
            central: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.central),
            high: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.high)
          };
          carbonG = order(mul(carbonG, uplift));
        }
      }
      return {
        eventId: event.id,
        modelId: model.id,
        datasetVersion: dataset2.version,
        energyWh,
        waterMl,
        carbonG,
        basis: {
          benchmarkRowId: row.id,
          benchmarkParentId: parent?.id ?? null,
          methodology: row.methodology,
          boundary: row.boundary,
          regionCode,
          tokens: event.tokens,
          thinkingHandling: thinking.handling,
          thinkingTokens: thinking.handling === "not-applicable" ? null : thinking.range,
          waterScope,
          carbonBasis,
          qualityScore: row.qualityScore,
          flags,
          sources: collectSources(row, parent, region)
        }
      };
    };
  }
});

// ../../packages/core/dist/aggregate.js
var isoDay, isoWeekStart, keyFor, bump, aggregate;
var init_aggregate = __esm({
  "../../packages/core/dist/aggregate.js"() {
    "use strict";
    init_range();
    isoDay = (timestamp) => timestamp.slice(0, 10);
    isoWeekStart = (timestamp) => {
      const date = /* @__PURE__ */ new Date(`${isoDay(timestamp)}T00:00:00Z`);
      const weekday = date.getUTCDay();
      const shift = weekday === 0 ? 6 : weekday - 1;
      date.setUTCDate(date.getUTCDate() - shift);
      return date.toISOString().slice(0, 10);
    };
    keyFor = (bucket, input) => {
      const { event, estimate: estimate2 } = input;
      switch (bucket) {
        case "day":
          return isoDay(event.timestamp);
        case "week":
          return isoWeekStart(event.timestamp);
        case "model":
          return estimate2.modelId ?? "unknown";
        case "surface":
          return event.surface;
        case "session":
          return event.sessionId ?? event.conversationId ?? "no-session";
        case "hosting":
          return event.hosting;
        case "all":
          return "all";
      }
    };
    bump = (counts, key) => {
      counts[key] = (counts[key] ?? 0) + 1;
    };
    aggregate = (inputs, bucket = "all") => {
      const buckets = /* @__PURE__ */ new Map();
      for (const input of inputs) {
        const key = keyFor(bucket, input);
        const existing = buckets.get(key);
        if (existing)
          existing.push(input);
        else
          buckets.set(key, [input]);
      }
      const result3 = [];
      for (const [key, group] of buckets) {
        const timestamps = group.map((item) => item.event.timestamp).sort();
        let energyWh = null;
        let waterMl = null;
        let carbonG = null;
        let unknownModelCount = 0;
        let noBenchmarkCount = 0;
        const bySurface = {};
        const byHosting = {};
        const byModel = {};
        const flags = /* @__PURE__ */ new Set();
        for (const { event, estimate: estimate2 } of group) {
          bump(bySurface, event.surface);
          bump(byHosting, event.hosting);
          bump(byModel, estimate2.modelId ?? "unknown");
          for (const flag of estimate2.basis.flags)
            flags.add(flag);
          if (estimate2.basis.flags.includes("model-unknown"))
            unknownModelCount += 1;
          if (estimate2.basis.flags.includes("no-benchmark"))
            noBenchmarkCount += 1;
          if (estimate2.energyWh)
            energyWh = energyWh ? add(energyWh, estimate2.energyWh) : estimate2.energyWh;
          if (estimate2.waterMl)
            waterMl = waterMl ? add(waterMl, estimate2.waterMl) : estimate2.waterMl;
          if (estimate2.carbonG)
            carbonG = carbonG ? add(carbonG, estimate2.carbonG) : estimate2.carbonG;
        }
        result3.push({
          key,
          bucket,
          from: timestamps[0] ?? "",
          to: timestamps[timestamps.length - 1] ?? "",
          count: group.length,
          energyWh,
          waterMl,
          carbonG,
          bySurface,
          byHosting,
          byModel,
          unknownModelCount,
          noBenchmarkCount,
          flags: [...flags].sort()
        });
      }
      return result3.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    };
  }
});

// ../../packages/core/dist/equivalents.js
var tier, distance, equivalents;
var init_equivalents = __esm({
  "../../packages/core/dist/equivalents.js"() {
    "use strict";
    tier = (count, stale) => (stale ? 2 : 0) + (count < 1 ? 1 : 0);
    distance = (count) => Math.abs(Math.log10(count));
    equivalents = (value, quantity, dataset2, limit = 2) => {
      if (value === null || !Number.isFinite(value) || value <= 0)
        return [];
      const candidates = dataset2.equivalents.filter((entry) => entry.quantity === quantity).map((entry) => ({ entry, count: value / entry.amount })).filter(({ count }) => count >= 0.1 && count <= 100).sort((a, b) => {
        const byTier = tier(a.count, a.entry.stale === true) - tier(b.count, b.entry.stale === true);
        if (byTier !== 0)
          return byTier;
        const byDistance = distance(a.count) - distance(b.count);
        if (byDistance !== 0)
          return byDistance;
        return a.entry.id < b.entry.id ? -1 : 1;
      });
      return candidates.slice(0, limit).map(({ entry, count }) => ({
        id: entry.id,
        count,
        label: count >= 0.995 && count < 1.005 ? entry.singular : entry.plural,
        stale: entry.stale === true,
        source: entry.source,
        ...entry.notes ? { notes: entry.notes } : {}
      }));
    };
  }
});

// ../../packages/core/dist/saving.js
var SAVING_BASELINE, plus, minus, saving;
var init_saving = __esm({
  "../../packages/core/dist/saving.js"() {
    "use strict";
    init_estimate();
    SAVING_BASELINE = "the largest model in each family";
    plus = (a, b) => {
      if (!a)
        return b;
      if (!b)
        return a;
      return { low: a.low + b.low, central: a.central + b.central, high: a.high + b.high };
    };
    minus = (a, b) => {
      if (!a || !b)
        return null;
      return {
        low: Math.max(0, a.low - b.high),
        central: Math.max(0, a.central - b.central),
        high: Math.max(0, a.high - b.low)
      };
    };
    saving = (inputs, dataset2, options = {}) => {
      let energy = null;
      let water = null;
      let carbon = null;
      let skipped = 0;
      const days = /* @__PURE__ */ new Map();
      for (const { event, estimate: actual } of inputs) {
        const day = event.timestamp.slice(0, 10);
        const model = actual.modelId ? dataset2.models.find((one) => one.id === actual.modelId) : void 0;
        if (!model || !actual.energyWh) {
          skipped += 1;
          continue;
        }
        if (model.ordinal === 0) {
          if (!days.has(day))
            days.set(day, null);
          continue;
        }
        const top = dataset2.models.find((one) => one.family === model.family && one.ordinal === 0);
        if (!top) {
          skipped += 1;
          continue;
        }
        const counterfactual = estimate({ ...event, modelId: top.id, modelRaw: top.id }, { dataset: dataset2, ...options });
        const saved = minus(counterfactual.energyWh, actual.energyWh);
        energy = plus(energy, saved);
        water = plus(water, minus(counterfactual.waterMl, actual.waterMl));
        carbon = plus(carbon, minus(counterfactual.carbonG, actual.carbonG));
        days.set(day, plus(days.get(day) ?? null, saved));
      }
      return {
        baseline: SAVING_BASELINE,
        energyWh: energy,
        waterMl: water,
        carbonG: carbon,
        byDay: [...days.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([day, energyWh]) => ({ day, energyWh })),
        skipped
      };
    };
  }
});

// ../../packages/core/dist/format.js
var SIGNIFICANT_DIGITS, roundSignificant, canonicalNumber, displayNumber, SCALES, scaleUnit, formatRange, explainFlags;
var init_format = __esm({
  "../../packages/core/dist/format.js"() {
    "use strict";
    SIGNIFICANT_DIGITS = 6;
    roundSignificant = (value, digits = SIGNIFICANT_DIGITS) => {
      if (!Number.isFinite(value))
        return value;
      if (value === 0)
        return 0;
      return Number.parseFloat(value.toPrecision(digits));
    };
    canonicalNumber = (value, digits = SIGNIFICANT_DIGITS) => {
      if (Number.isNaN(value))
        return "NaN";
      if (!Number.isFinite(value))
        return value > 0 ? "Infinity" : "-Infinity";
      if (value === 0)
        return "0";
      const rounded = roundSignificant(value, digits);
      const text = String(rounded);
      return text.replace(/\.0$/, "").replace(/e([+-])0+(\d)/, "e$1$2");
    };
    displayNumber = (value) => {
      const magnitude = Math.abs(value);
      if (magnitude === 0)
        return "0";
      if (magnitude >= 100)
        return String(Math.round(value));
      if (magnitude >= 10)
        return value.toFixed(1);
      if (magnitude >= 1)
        return value.toFixed(2);
      if (magnitude >= 0.01)
        return value.toFixed(3);
      return value.toPrecision(2);
    };
    SCALES = {
      Wh: [{ at: 1e3, unit: "kWh", divide: 1e3 }],
      mL: [{ at: 1e3, unit: "L", divide: 1e3 }],
      g: [{ at: 1e3, unit: "kg", divide: 1e3 }]
    };
    scaleUnit = (value, unit) => {
      for (const step of SCALES[unit] ?? []) {
        if (Math.abs(value) >= step.at)
          return { value: value / step.divide, unit: step.unit };
      }
      return { value, unit };
    };
    formatRange = (range, options = {}) => {
      const { unit, flags = [], bounds = true, ascii = false } = options;
      if (range === null || range === void 0)
        return "unknown";
      const lowerBound = flags.includes("thinking-unknown");
      const estimated = flags.includes("tokens-estimated") || flags.includes("derived-rate");
      const prefix = lowerBound ? ascii ? ">= " : "\u2265 " : estimated ? "~" : "";
      const scaled = unit ? scaleUnit(range.central, unit) : { value: range.central, unit: "" };
      const divisor = unit && scaled.unit !== unit ? range.central / scaled.value : 1;
      const suffix = scaled.unit ? ` ${scaled.unit}` : "";
      const central = `${prefix}${displayNumber(scaled.value)}${suffix}`;
      if (!bounds)
        return central;
      const low = displayNumber(range.low / divisor);
      const high = displayNumber(range.high / divisor);
      return `${central} [ ${low} to ${high} ]`;
    };
    explainFlags = (flags) => {
      const lines = [];
      for (const flag of flags) {
        switch (flag) {
          case "model-unknown":
            lines.push("We do not recognise this model, so there is no figure to show.");
            break;
          case "no-benchmark":
            lines.push("We know this model but nobody has published a measurement for it.");
            break;
          case "tokens-estimated":
            lines.push("Token counts come from our own tokenizer, not from the provider.");
            break;
          case "thinking-unknown":
            lines.push("This model thinks before it answers and did not say how much, so the figure is a lower bound.");
            break;
          case "proxy-row":
            lines.push("Scaled from a different model, because nobody has measured this one.");
            break;
          case "region-default":
            lines.push("No region was given, so this uses the world average grid.");
            break;
          case "input-partial":
            lines.push("The app hides its system prompt, so the input count is a lower bound.");
            break;
          case "derived-rate":
            lines.push("The rate was worked out from a single published figure for one exchange.");
            break;
          case "assumed-token-counts":
            lines.push("The source did not say how long its reference exchange was, so we assumed it.");
            break;
          case "parametric-rate":
            lines.push("The rate comes from a formula rather than a measurement.");
            break;
          case "no-energy-figure":
            lines.push("The source published water and carbon but no energy, so energy is unknown.");
            break;
          case "scaled-direct-figure":
            lines.push("Water and carbon were published per exchange and scaled to this one.");
            break;
          case "local-row-missing":
            lines.push("No measurement exists for this model on your own machine, so a hosted row was used.");
            break;
        }
      }
      return lines;
    };
  }
});

// ../../packages/core/dist/recommender/features.js
var evaluateExpression, formatAnswer, ARITHMETIC, readArithmetic, UNITS, CONVERSION, readUnitConversion, CODE_SIGNALS, IMPERATIVES, REASONING_CUES, DATE_MATH, extractFeatures;
var init_features = __esm({
  "../../packages/core/dist/recommender/features.js"() {
    "use strict";
    evaluateExpression = (text) => {
      let index = 0;
      const source = text.replace(/\s+/g, "");
      if (source === "" || source.length > 120)
        return null;
      const peek = () => source[index];
      const number = () => {
        const start = index;
        while (index < source.length && /[0-9.]/.test(source[index]))
          index += 1;
        if (index === start)
          return null;
        const value = Number.parseFloat(source.slice(start, index));
        return Number.isFinite(value) ? value : null;
      };
      const factor = () => {
        if (peek() === "-") {
          index += 1;
          const inner = factor();
          return inner === null ? null : -inner;
        }
        if (peek() === "(") {
          index += 1;
          const inner = expression();
          if (peek() !== ")")
            return null;
          index += 1;
          return inner;
        }
        return number();
      };
      const term = () => {
        let left = factor();
        if (left === null)
          return null;
        while (peek() === "*" || peek() === "/" || peek() === "%") {
          const operator = peek();
          index += 1;
          const right = factor();
          if (right === null)
            return null;
          if ((operator === "/" || operator === "%") && right === 0)
            return null;
          left = operator === "*" ? left * right : operator === "/" ? left / right : left % right;
        }
        return left;
      };
      function expression() {
        let left = term();
        if (left === null)
          return null;
        while (peek() === "+" || peek() === "-") {
          const operator = peek();
          index += 1;
          const right = term();
          if (right === null)
            return null;
          left = operator === "+" ? left + right : left - right;
        }
        return left;
      }
      const result3 = expression();
      return index === source.length && result3 !== null && Number.isFinite(result3) ? result3 : null;
    };
    formatAnswer = (value) => {
      if (Number.isInteger(value))
        return String(value);
      const rounded = Number.parseFloat(value.toPrecision(10));
      return String(rounded);
    };
    ARITHMETIC = /^(?:what(?:'s| is)|calculate|compute|work out|how much is)?\s*([0-9()+\-*/%.\s]{3,120}?)\s*(?:=|\?)?$/i;
    readArithmetic = (prompt) => {
      const text = prompt.trim();
      if (!/[0-9]/.test(text) || !/[+\-*/%]/.test(text))
        return null;
      const match = ARITHMETIC.exec(text);
      if (!match?.[1])
        return null;
      const expression = match[1].trim();
      if (!/[+\-*/%]/.test(expression))
        return null;
      const value = evaluateExpression(expression);
      if (value === null)
        return null;
      return { expression: expression.replace(/\s+/g, " "), answer: formatAnswer(value) };
    };
    UNITS = {
      km: { base: "m", factor: 1e3 },
      m: { base: "m", factor: 1 },
      cm: { base: "m", factor: 0.01 },
      mm: { base: "m", factor: 1e-3 },
      mile: { base: "m", factor: 1609.344 },
      miles: { base: "m", factor: 1609.344 },
      foot: { base: "m", factor: 0.3048 },
      feet: { base: "m", factor: 0.3048 },
      ft: { base: "m", factor: 0.3048 },
      inch: { base: "m", factor: 0.0254 },
      inches: { base: "m", factor: 0.0254 },
      kg: { base: "g", factor: 1e3 },
      g: { base: "g", factor: 1 },
      lb: { base: "g", factor: 453.59237 },
      lbs: { base: "g", factor: 453.59237 },
      pound: { base: "g", factor: 453.59237 },
      pounds: { base: "g", factor: 453.59237 },
      oz: { base: "g", factor: 28.349523125 },
      litre: { base: "l", factor: 1 },
      litres: { base: "l", factor: 1 },
      liter: { base: "l", factor: 1 },
      liters: { base: "l", factor: 1 },
      l: { base: "l", factor: 1 },
      ml: { base: "l", factor: 1e-3 },
      gallon: { base: "l", factor: 3.785411784 },
      gallons: { base: "l", factor: 3.785411784 }
    };
    CONVERSION = /(-?[0-9][0-9,.]*)\s*([a-z]+)\s*(?:in|to|into|as)\s+([a-z]+)/i;
    readUnitConversion = (prompt) => {
      const match = CONVERSION.exec(prompt.trim());
      if (!match)
        return null;
      const value = Number.parseFloat(match[1].replace(/,/g, ""));
      const from = match[2].toLowerCase();
      const to = match[3].toLowerCase();
      if (!Number.isFinite(value))
        return null;
      const source = UNITS[from];
      const target = UNITS[to];
      if (!source || !target || source.base !== target.base)
        return null;
      const answer = formatAnswer(Number.parseFloat((value * source.factor / target.factor).toPrecision(8)));
      return { value, from, to, answer: `${answer} ${to}` };
    };
    CODE_SIGNALS = [
      /```/,
      /\bfunction\s+\w+\s*\(/,
      /\b(?:const|let|var)\s+\w+\s*=/,
      /\bdef\s+\w+\s*\(/,
      /\bclass\s+\w+/,
      /\bimport\s+[\w{*]/,
      /\breturn\b/,
      /[;{}]\s*$/m,
      /^\s*(?:#include|package |using )/m,
      /\bSELECT\b.+\bFROM\b/i,
      /=>/,
      /\$\{/
    ];
    IMPERATIVES = [
      "rewrite",
      "reword",
      "rephrase",
      "summarise",
      "summarize",
      "shorten",
      "expand",
      "translate",
      "proofread",
      "correct",
      "fix the grammar",
      "fix grammar",
      "spellcheck",
      "extract",
      "classify",
      "categorise",
      "categorize",
      "label",
      "tag",
      "list",
      "format",
      "reformat",
      "convert",
      "capitalise",
      "capitalize",
      "tidy",
      "clean up"
    ];
    REASONING_CUES = [
      "why",
      "prove",
      "derive",
      "explain how",
      "explain why",
      "work out",
      "trade-off",
      "tradeoff",
      "compare",
      "design",
      "architect",
      "debug",
      "root cause",
      "step by step",
      "reason about",
      "implications",
      "strategy",
      "edge case",
      "race condition",
      "optimise",
      "optimize",
      "refactor"
    ];
    DATE_MATH = /\b(?:how many (?:days|weeks|months|years)|days? (?:between|until|since|from now)|what day (?:is|was)|add \d+ days)\b/i;
    extractFeatures = (input) => {
      const prompt = input.prompt ?? "";
      const trimmed = prompt.trim();
      const words2 = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
      const lines = trimmed === "" ? 0 : trimmed.split("\n").length;
      const hasCodeFence = /```/.test(prompt);
      const hits = CODE_SIGNALS.reduce((total, pattern) => total + (pattern.test(prompt) ? 1 : 0), 0);
      const codeLikelihood = Math.min(1, hits / 3);
      const lower = trimmed.toLowerCase();
      const imperativeVerb = IMPERATIVES.find((verb) => lower.startsWith(verb) || lower.startsWith(`please ${verb}`)) ?? null;
      const allCues = REASONING_CUES.filter((cue) => lower.includes(cue));
      const reasoningCues = allCues.filter((cue) => !allCues.some((other) => other !== cue && other.includes(cue)));
      const bullets = (prompt.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) ?? []).length;
      const joins = (lower.match(/\b(?:and also|as well as|then also|additionally)\b/g) ?? []).length;
      const constraintCount = bullets + joins;
      const questionCount = (prompt.match(/\?/g) ?? []).length;
      const nonLatin = (prompt.match(/[^\u0000-ɏ\s]/g) ?? []).length;
      const nonLatinShare = prompt.length === 0 ? 0 : nonLatin / prompt.length;
      return {
        words: words2,
        chars: trimmed.length,
        lines,
        codeLikelihood,
        hasCodeFence,
        arithmetic: readArithmetic(trimmed),
        unitConversion: readUnitConversion(trimmed),
        dateMath: DATE_MATH.test(trimmed),
        imperativeVerb,
        reasoningCues: [...reasoningCues],
        constraintCount,
        questionCount,
        conversationDepth: input.conversationDepth ?? 0,
        nonLatinShare
      };
    };
  }
});

// ../../packages/core/dist/recommender/rules.js
var result, looksLikeCode, arithmetic, unitConversion, dateMath, rewriteTask, summarise, translate, classifyExtract, shortSimple, noReasoningCues, smallTask, deepReasoning, longCode, multiStep, deepConversation, DEFAULT_RULES;
var init_rules = __esm({
  "../../packages/core/dist/recommender/rules.js"() {
    "use strict";
    result = (ruleId, kind, confidence, reasons, answer) => ({ ruleId, kind, confidence, reasons, ...answer ? { answer } : {} });
    looksLikeCode = (features) => features.hasCodeFence || features.codeLikelihood >= 0.34;
    arithmetic = {
      id: "no-llm.arithmetic",
      version: 1,
      kind: "no-llm",
      evaluate({ features }) {
        if (!features.arithmetic)
          return null;
        if (features.words > 20)
          return null;
        return result("no-llm.arithmetic", "no-llm", 0.95, [`the whole prompt is the sum ${features.arithmetic.expression}`], features.arithmetic.answer);
      }
    };
    unitConversion = {
      id: "no-llm.unit-conversion",
      version: 1,
      kind: "no-llm",
      evaluate({ features }) {
        const conversion = features.unitConversion;
        if (!conversion?.answer)
          return null;
        if (features.words > 15)
          return null;
        return result("no-llm.unit-conversion", "no-llm", 0.9, [`converts ${conversion.from} to ${conversion.to}`], conversion.answer);
      }
    };
    dateMath = {
      id: "no-llm.date-math",
      version: 1,
      kind: "no-llm",
      evaluate({ features }) {
        if (!features.dateMath || features.words > 20)
          return null;
        return result("no-llm.date-math", "no-llm", 0.8, [
          "asks for date arithmetic, which a calendar does better"
        ]);
      }
    };
    rewriteTask = {
      id: "downgrade.rewrite-task",
      version: 1,
      kind: "downgrade",
      evaluate({ features }) {
        const verb = features.imperativeVerb;
        if (!verb)
          return null;
        if (!["rewrite", "reword", "rephrase", "proofread", "correct", "spellcheck", "tidy"].some((one) => verb.startsWith(one)) && !verb.includes("grammar")) {
          return null;
        }
        if (features.words > 400)
          return null;
        return result("downgrade.rewrite-task", "downgrade", 0.8, [
          `starts with "${verb}"`,
          `${features.words} words`,
          features.codeLikelihood > 0 ? "some code" : "no code"
        ]);
      }
    };
    summarise = {
      id: "downgrade.summarise",
      version: 1,
      kind: "downgrade",
      evaluate({ features }) {
        const verb = features.imperativeVerb;
        if (!verb || !["summarise", "summarize", "shorten"].includes(verb))
          return null;
        return result("downgrade.summarise", "downgrade", 0.75, [
          `starts with "${verb}"`,
          `${features.words} words`
        ]);
      }
    };
    translate = {
      id: "downgrade.translate",
      version: 1,
      kind: "downgrade",
      evaluate({ features }) {
        if (features.imperativeVerb !== "translate")
          return null;
        return result("downgrade.translate", "downgrade", 0.8, [
          'starts with "translate"',
          `${features.words} words`
        ]);
      }
    };
    classifyExtract = {
      id: "downgrade.classify-extract",
      version: 1,
      kind: "downgrade",
      evaluate({ features }) {
        const verb = features.imperativeVerb;
        if (!verb || !["extract", "classify", "categorise", "categorize", "label", "tag", "format", "reformat"].includes(verb)) {
          return null;
        }
        return result("downgrade.classify-extract", "downgrade", 0.7, [
          `starts with "${verb}"`,
          "a shaped output task rather than an open one"
        ]);
      }
    };
    shortSimple = {
      id: "downgrade.short-simple",
      version: 1,
      kind: "downgrade",
      evaluate({ features }) {
        if (features.words > 25 || features.words < 3)
          return null;
        if (looksLikeCode(features))
          return null;
        if (features.reasoningCues.length > 0)
          return null;
        if (features.constraintCount > 0)
          return null;
        return result("downgrade.short-simple", "downgrade", 0.7, [
          `${features.words} words`,
          "no code",
          "nothing that needs working out"
        ]);
      }
    };
    noReasoningCues = {
      id: "downgrade.no-reasoning-cues",
      version: 1,
      kind: "downgrade",
      // Weak on its own. It belongs in the report afterwards, not in an
      // interruption before you press send.
      reportOnly: true,
      evaluate({ features }) {
        if (features.reasoningCues.length > 0)
          return null;
        if (features.words > 120)
          return null;
        if (features.hasCodeFence)
          return null;
        return result("downgrade.no-reasoning-cues", "downgrade", 0.55, [
          "nothing in the wording suggests the answer needs working out"
        ]);
      }
    };
    smallTask = {
      id: "local.small-task",
      version: 1,
      kind: "local",
      evaluate({ features, hasLocalModel }) {
        if (!hasLocalModel)
          return null;
        if (features.words > 60 || features.hasCodeFence)
          return null;
        if (features.reasoningCues.length > 0)
          return null;
        const tiny = features.words <= 25 && features.constraintCount === 0;
        return result("local.small-task", "local", tiny ? 0.75 : 0.6, [
          `${features.words} words`,
          tiny ? "small enough to run on your own machine instead of in a data centre" : "probably small enough for a model on your own machine"
        ]);
      }
    };
    deepReasoning = {
      id: "keep.deep-reasoning",
      version: 1,
      kind: "keep",
      evaluate({ features }) {
        if (features.reasoningCues.length === 0)
          return null;
        const confidence = Math.min(0.95, 0.6 + 0.15 * features.reasoningCues.length);
        const named = features.reasoningCues.slice(0, 3);
        const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
        return result("keep.deep-reasoning", "keep", confidence, [
          `the wording asks for reasoning: ${list}`
        ]);
      }
    };
    longCode = {
      id: "keep.long-code",
      version: 1,
      kind: "keep",
      evaluate({ features }) {
        if (!features.hasCodeFence && features.codeLikelihood < 0.67)
          return null;
        if (features.words < 40 && !features.hasCodeFence)
          return null;
        return result("keep.long-code", "keep", 0.85, [
          features.hasCodeFence ? "contains a code block" : "reads mostly as code",
          `${features.words} words`
        ]);
      }
    };
    multiStep = {
      id: "keep.multi-step",
      version: 1,
      kind: "keep",
      evaluate({ features }) {
        if (features.constraintCount < 3)
          return null;
        return result("keep.multi-step", "keep", 0.8, [
          `${features.constraintCount} separate requirements`
        ]);
      }
    };
    deepConversation = {
      id: "keep.deep-conversation",
      version: 1,
      kind: "keep",
      evaluate({ features }) {
        if (features.conversationDepth < 8)
          return null;
        return result("keep.deep-conversation", "keep", 0.75, [
          `${features.conversationDepth} turns into this conversation already`
        ]);
      }
    };
    DEFAULT_RULES = [
      arithmetic,
      unitConversion,
      dateMath,
      rewriteTask,
      summarise,
      translate,
      classifyExtract,
      shortSimple,
      noReasoningCues,
      smallTask,
      deepReasoning,
      longCode,
      multiStep,
      deepConversation
    ];
  }
});

// ../../packages/core/dist/recommender/types.js
var init_types2 = __esm({
  "../../packages/core/dist/recommender/types.js"() {
    "use strict";
  }
});

// ../../packages/core/dist/recommender/index.js
var DEFAULT_HINT_THRESHOLD, DEFAULT_REPORT_THRESHOLD, VETO_THRESHOLD, nothing, subtract, explain, createRecommender, priceSwap;
var init_recommender = __esm({
  "../../packages/core/dist/recommender/index.js"() {
    "use strict";
    init_estimate();
    init_resolve();
    init_features();
    init_rules();
    init_features();
    init_types2();
    DEFAULT_HINT_THRESHOLD = 0.6;
    DEFAULT_REPORT_THRESHOLD = 0.45;
    VETO_THRESHOLD = 0.7;
    nothing = (reason) => ({
      kind: "keep",
      ruleId: "keep.default",
      confidence: 0,
      reasons: [reason],
      target: null,
      estimatedSavings: null,
      vetoedBy: [],
      answer: null,
      explanation: reason,
      showAsHint: false,
      showInReport: false
    });
    subtract = (before, after) => {
      if (before === null || after === null)
        return null;
      return {
        low: Math.max(0, before.low - after.high),
        central: Math.max(0, before.central - after.central),
        high: Math.max(0, before.high - after.low)
      };
    };
    explain = (winner, target, vetoedBy) => {
      const seen = winner.reasons.join("; ");
      if (vetoedBy.length > 0) {
        return `Rule ${winner.ruleId} fired (${seen}), but ${vetoedBy.join(" and ")} held it back.`;
      }
      switch (winner.kind) {
        case "no-llm":
          return winner.answer ? `Rule ${winner.ruleId} fired: ${seen}. The answer is ${winner.answer}.` : `Rule ${winner.ruleId} fired: ${seen}.`;
        case "downgrade":
          return target ? `Rule ${winner.ruleId} fired: ${seen}. ${target.displayName} would probably do.` : `Rule ${winner.ruleId} fired: ${seen}.`;
        case "local":
          return `Rule ${winner.ruleId} fired: ${seen}. A model on your own machine would probably do.`;
        default:
          return `Rule ${winner.ruleId} fired: ${seen}.`;
      }
    };
    createRecommender = (options) => {
      const muted = new Set(options.muted ?? []);
      const rules = [...DEFAULT_RULES, ...options.rules ?? []].filter((rule) => !muted.has(rule.id));
      const hintThreshold = options.hintThreshold ?? DEFAULT_HINT_THRESHOLD;
      const reportThreshold = options.reportThreshold ?? DEFAULT_REPORT_THRESHOLD;
      const dataset2 = options.dataset;
      const recommend2 = (input) => {
        const features = extractFeatures({
          prompt: input.prompt,
          ...input.conversationDepth !== void 0 ? { conversationDepth: input.conversationDepth } : {}
        });
        if (features.words === 0)
          return nothing("Nothing to look at yet.");
        const model = getModel(input.modelId ?? null, dataset2) ?? resolveModel(input.modelRaw ?? null, dataset2);
        const context = {
          features,
          model,
          surface: input.surface ?? "api",
          dataset: dataset2,
          hasLocalModel: options.hasLocalModel === true
        };
        const fired = [];
        for (const rule of rules) {
          const outcome = rule.evaluate(context);
          if (outcome !== null)
            fired.push({ rule, result: outcome });
        }
        const vetoes = fired.filter(({ result: result3 }) => result3.kind === "keep");
        const blocking = vetoes.filter(({ result: result3 }) => result3.confidence >= VETO_THRESHOLD).map(({ result: result3 }) => result3.ruleId).sort();
        const suggestions = fired.filter(({ result: result3 }) => result3.kind !== "keep").filter(({ result: result3 }) => result3.kind === "no-llm" || blocking.length === 0).sort((a, b) => {
          if (a.result.confidence !== b.result.confidence) {
            return b.result.confidence - a.result.confidence;
          }
          return a.result.ruleId < b.result.ruleId ? -1 : 1;
        });
        const chosen = suggestions[0];
        if (!chosen) {
          if (blocking.length > 0) {
            const held = vetoes.find(({ result: result3 }) => result3.ruleId === blocking[0]);
            return {
              ...nothing(held ? `Stay where you are: ${held.result.reasons.join("; ")}.` : "Stay where you are."),
              vetoedBy: blocking,
              ruleId: blocking[0],
              confidence: held?.result.confidence ?? 0
            };
          }
          return nothing("No rule fired, so no suggestion.");
        }
        const winner = chosen.result;
        const target = winner.kind === "downgrade" && model ? downgradeTarget(model, dataset2) : null;
        if (winner.kind === "downgrade" && model && target === null) {
          return nothing(`${model.displayName} is already the smallest model we know on its ladder.`);
        }
        const savings = target && model ? priceSwap(input, features, model, target, dataset2) : null;
        return {
          kind: winner.kind,
          ruleId: winner.ruleId,
          confidence: winner.confidence,
          reasons: winner.reasons,
          target: target ? { id: target.id, displayName: target.displayName } : null,
          estimatedSavings: savings,
          vetoedBy: blocking,
          answer: winner.answer ?? null,
          explanation: explain(winner, target, blocking),
          showAsHint: chosen.rule.reportOnly !== true && winner.confidence >= hintThreshold,
          showInReport: winner.confidence >= reportThreshold
        };
      };
      return { recommend: recommend2, rules };
    };
    priceSwap = (input, features, from, to, dataset2) => {
      const inputTokens = Math.max(1, Math.round(features.words * 1.4));
      const outputTokens = input.expectedOutputTokens ?? Math.max(50, inputTokens * 3);
      const shape = (modelId) => ({
        id: "recommendation",
        surface: input.surface ?? "api",
        hosting: "cloud",
        modelRaw: modelId,
        modelId,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          thinking: null,
          estimated: true,
          estimator: "words"
        },
        timestamp: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      const before = estimate(shape(from.id), { dataset: dataset2, at: "2026-09-10" });
      const after = estimate(shape(to.id), { dataset: dataset2, at: "2026-09-10" });
      if (before.energyWh === null && after.energyWh === null)
        return null;
      return {
        energyWh: subtract(before.energyWh, after.energyWh),
        waterMl: subtract(before.waterMl, after.waterMl),
        carbonG: subtract(before.carbonG, after.carbonG)
      };
    };
  }
});

// ../../packages/core/dist/index.js
var init_dist = __esm({
  "../../packages/core/dist/index.js"() {
    "use strict";
    init_types();
    init_range();
    init_resolve();
    init_estimate();
    init_aggregate();
    init_equivalents();
    init_saving();
    init_format();
    init_recommender();
  }
});

// ../../packages/dataset/dist/index.js
var dataset, dist_default;
var init_dist2 = __esm({
  "../../packages/dataset/dist/index.js"() {
    "use strict";
    dataset = { "version": "1.0.0", "sha256": "e290e8bcf18a4f08e19a3398023b5b3a025d2e4aa5afbe3473a20d7dfc911d01", "models": [{ "id": "claude-opus-5", "aliases": ["claude-opus-5", "opus-5", "opus 5", "claude opus 5", "claude-opus-5-latest"], "provider": "anthropic", "family": "claude-5", "tier": "frontier", "ordinal": 0, "displayName": "Claude Opus 5", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Identifier taken from the Claude Code environment description. Release date not recorded." } }, { "id": "claude-sonnet-5", "aliases": ["claude-sonnet-5", "sonnet-5", "sonnet 5", "claude sonnet 5", "claude-sonnet-5-latest"], "provider": "anthropic", "family": "claude-5", "tier": "mid", "ordinal": 1, "displayName": "Claude Sonnet 5", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "claude-haiku-4.5", "aliases": ["claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-haiku-4.5", "haiku-4.5", "haiku 4.5", "claude haiku 4.5"], "provider": "anthropic", "family": "claude-5", "tier": "small", "ordinal": 2, "displayName": "Claude Haiku 4.5", "reasoning": true, "thinkingRatio": { "low": 0.2, "central": 1, "high": 4 }, "hosting": "cloud", "released": "2025-10-01", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Sits on the current ladder alongside the Claude 5 models even though its own version number is 4.5." } }, { "id": "claude-fable-5.1", "aliases": ["claude-fable-5-1", "claude-fable-5.1", "fable-5.1", "fable 5.1", "claude fable 5.1"], "provider": "anthropic", "family": "claude-fable", "tier": "frontier", "ordinal": 0, "displayName": "Claude Fable 5.1", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Kept on its own ladder because its position relative to Opus and Sonnet is not confirmed. That means no downgrade target, which is the safe default." } }, { "id": "claude-opus-4.8", "aliases": ["claude-opus-4-8", "claude-opus-4.8", "opus-4.8", "opus 4.8", "claude opus 4.8"], "provider": "anthropic", "family": "claude-4", "tier": "frontier", "ordinal": 0, "displayName": "Claude Opus 4.8", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "fetched", "recorded": "2026-09-10", "note": "Found by running the doctor command against real transcripts on the author's machine, which reported 58 turns on an unrecognised claude-opus-4-8." } }, { "id": "claude-opus-4.1", "aliases": ["claude-opus-4-1", "claude-opus-4.1", "opus-4.1", "claude-opus-4-1-20250805"], "provider": "anthropic", "family": "claude-4", "tier": "frontier", "ordinal": 0, "displayName": "Claude Opus 4.1", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "claude-sonnet-4", "aliases": ["claude-sonnet-4", "claude-sonnet-4-20250514", "sonnet-4", "sonnet 4"], "provider": "anthropic", "family": "claude-4", "tier": "mid", "ordinal": 1, "displayName": "Claude Sonnet 4", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "claude-3.7-sonnet", "aliases": ["claude-3-7-sonnet-20250219", "claude-3-7-sonnet", "claude-3.7-sonnet", "claude 3.7 sonnet"], "provider": "anthropic", "family": "claude-3.x", "tier": "frontier", "ordinal": 0, "displayName": "Claude 3.7 Sonnet", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "released": "2025-02-19", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Measured directly by Jegham and colleagues, so this is one of the few Anthropic models with a real row." } }, { "id": "claude-3.5-sonnet", "aliases": ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20240620", "claude-3-5-sonnet", "claude-3.5-sonnet"], "provider": "anthropic", "family": "claude-3.x", "tier": "mid", "ordinal": 1, "displayName": "Claude 3.5 Sonnet", "reasoning": false, "hosting": "cloud", "released": "2024-10-22", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "claude-3.5-haiku", "aliases": ["claude-3-5-haiku-20241022", "claude-3-5-haiku", "claude-3.5-haiku"], "provider": "anthropic", "family": "claude-3.x", "tier": "small", "ordinal": 2, "displayName": "Claude 3.5 Haiku", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gpt-5.6", "aliases": ["gpt-5.6", "gpt-5-6", "gpt 5.6"], "provider": "openai", "family": "gpt-5", "tier": "frontier", "ordinal": 0, "displayName": "GPT-5.6", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Named in the Codex CLI cache-write issue referenced in the plan. No published energy figure of its own." } }, { "id": "gpt-5", "aliases": ["gpt-5", "gpt5", "gpt 5", "gpt-5-latest"], "provider": "openai", "family": "gpt-5", "tier": "frontier", "ordinal": 0, "displayName": "GPT-5", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" }, "deprecated": "2026-06-11", "notes": "Deprecated 2026-06-11, per Modelfax (github.com/bytebrujo/modelfax, CC BY 4.0), read 2026-09-13." }, { "id": "o3", "aliases": ["o3", "o3-2025-04-16", "openai-o3"], "provider": "openai", "family": "o-series", "tier": "frontier", "ordinal": 0, "displayName": "o3", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "o4-mini", "aliases": ["o4-mini", "o4-mini-high", "o4 mini"], "provider": "openai", "family": "o-series", "tier": "mid", "ordinal": 1, "displayName": "o4-mini", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4.1", "aliases": ["gpt-4.1", "gpt-4-1", "gpt-4.1-2025-04-14"], "provider": "openai", "family": "gpt-4.1", "tier": "frontier", "ordinal": 0, "displayName": "GPT-4.1", "reasoning": false, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4.1-mini", "aliases": ["gpt-4.1-mini", "gpt-4-1-mini"], "provider": "openai", "family": "gpt-4.1", "tier": "mid", "ordinal": 1, "displayName": "GPT-4.1 mini", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gpt-4.1-nano", "aliases": ["gpt-4.1-nano", "gpt-4-1-nano"], "provider": "openai", "family": "gpt-4.1", "tier": "nano", "ordinal": 2, "displayName": "GPT-4.1 nano", "reasoning": false, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4o", "aliases": ["gpt-4o", "gpt-4o-2024-08-06", "gpt-4o-latest", "chatgpt-4o-latest"], "provider": "openai", "family": "gpt-4o", "tier": "frontier", "ordinal": 0, "displayName": "GPT-4o", "reasoning": false, "hosting": "cloud", "released": "2024-05-13", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4o-mini", "aliases": ["gpt-4o-mini", "gpt-4o-mini-2024-07-18"], "provider": "openai", "family": "gpt-4o", "tier": "mid", "ordinal": 1, "displayName": "GPT-4o mini", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gemini-2.5-pro", "aliases": ["gemini-2.5-pro", "gemini-2-5-pro", "gemini 2.5 pro", "models/gemini-2.5-pro"], "provider": "google", "family": "gemini-2.5", "tier": "frontier", "ordinal": 0, "displayName": "Gemini 2.5 Pro", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gemini-2.5-flash", "aliases": ["gemini-2.5-flash", "gemini-2-5-flash", "gemini 2.5 flash", "models/gemini-2.5-flash", "gemini-apps-default"], "provider": "google", "family": "gemini-2.5", "tier": "mid", "ordinal": 1, "displayName": "Gemini 2.5 Flash", "reasoning": true, "thinkingRatio": { "low": 0.2, "central": 1, "high": 4 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Treated as the model behind the median Gemini Apps prompt that Google measured." } }, { "id": "gemini-2.5-flash-lite", "aliases": ["gemini-2.5-flash-lite", "gemini-2-5-flash-lite", "models/gemini-2.5-flash-lite"], "provider": "google", "family": "gemini-2.5", "tier": "small", "ordinal": 2, "displayName": "Gemini 2.5 Flash-Lite", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "mistral-large-2", "aliases": ["mistral-large-2", "mistral-large-2407", "mistral-large-latest", "mistral large 2"], "provider": "mistral", "family": "mistral-large", "tier": "frontier", "ordinal": 0, "displayName": "Mistral Large 2", "reasoning": false, "activeParamsB": { "low": 123, "central": 123, "high": 123 }, "hosting": "both", "released": "2024-07-24", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "deepseek-r1", "aliases": ["deepseek-r1", "deepseek-reasoner", "DeepSeek-R1"], "provider": "deepseek", "family": "deepseek-r1", "tier": "frontier", "ordinal": 0, "displayName": "DeepSeek-R1", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "activeParamsB": { "low": 37, "central": 37, "high": 37 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Mixture of experts. Active parameters, not the 671 billion total." } }, { "id": "deepseek-r1-distill-llama-70b", "aliases": ["deepseek-r1-distill-llama-70b", "DeepSeek-R1-Distill-Llama-70B"], "provider": "deepseek", "family": "deepseek-r1", "tier": "mid", "ordinal": 1, "displayName": "DeepSeek-R1 Distill Llama 70B", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "activeParamsB": { "low": 70, "central": 70, "high": 70 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "llama-3.3-70b", "aliases": ["llama-3.3-70b", "llama3.3:70b", "Llama-3.3-70B-Instruct", "meta-llama/Llama-3.3-70B-Instruct"], "provider": "meta", "family": "llama-3.x", "tier": "frontier", "ordinal": 0, "displayName": "Llama 3.3 70B", "reasoning": false, "activeParamsB": { "low": 70, "central": 70, "high": 70 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "llama-3.1-8b", "aliases": ["llama-3.1-8b", "llama3.1:8b", "Llama-3.1-8B-Instruct", "meta-llama/Llama-3.1-8B-Instruct"], "provider": "meta", "family": "llama-3.x", "tier": "small", "ordinal": 1, "displayName": "Llama 3.1 8B", "reasoning": false, "activeParamsB": { "low": 8, "central": 8, "high": 8 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "llama-3.2-3b", "aliases": ["llama-3.2-3b", "llama3.2:3b", "Llama-3.2-3B-Instruct"], "provider": "meta", "family": "llama-3.x", "tier": "nano", "ordinal": 2, "displayName": "Llama 3.2 3B", "reasoning": false, "activeParamsB": { "low": 3.2, "central": 3.2, "high": 3.2 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "qwen-2.5-7b", "aliases": ["qwen-2.5-7b", "qwen2.5:7b", "Qwen2.5-7B-Instruct"], "provider": "alibaba", "family": "qwen-2.5", "tier": "small", "ordinal": 0, "displayName": "Qwen 2.5 7B", "reasoning": false, "activeParamsB": { "low": 7, "central": 7, "high": 7 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "mistral-7b", "aliases": ["mistral-7b", "mistral:7b", "Mistral-7B-Instruct-v0.3"], "provider": "mistral", "family": "mistral-7b", "tier": "small", "ordinal": 0, "displayName": "Mistral 7B", "reasoning": false, "activeParamsB": { "low": 7.2, "central": 7.2, "high": 7.2 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gemma-2-9b", "aliases": ["gemma-2-9b", "gemma2:9b", "google/gemma-2-9b-it"], "provider": "google", "family": "gemma-2", "tier": "small", "ordinal": 0, "displayName": "Gemma 2 9B", "reasoning": false, "activeParamsB": { "low": 9, "central": 9, "high": 9 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "phi-3-mini", "aliases": ["phi-3-mini", "phi3:mini", "Phi-3-mini-4k-instruct"], "provider": "microsoft", "family": "phi-3", "tier": "nano", "ordinal": 0, "displayName": "Phi-3 mini", "reasoning": false, "activeParamsB": { "low": 3.8, "central": 3.8, "high": 3.8 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }], "benchmarks": [{ "id": "google.gemini-apps.2025-median", "modelIds": ["gemini-2.5-flash"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.1, "central": 0.24, "high": 0.72 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 60, "central": 300, "high": 1e3 }, "tokenCountsPublished": false }, "pue": { "low": 1.09, "central": 1.09, "high": 1.09 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 1.15, "central": 1.15, "high": 1.15 }, "carbonGPerKwh": { "low": 94, "central": 94, "high": 94 }, "carbonBasis": "market-based", "methodology": "provider-measured", "boundary": "datacenter", "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-08-21", "qualityScore": 4, "notes": "Median text prompt across the Gemini Apps fleet: 0.24 Wh, 0.26 mL, 0.03 gCO2e. The low bound is Google's own narrow accelerator-only figure of 0.10 Wh; the high bound is three times the median, because a fleet median says nothing about the tail. Breakdown: TPU 0.14, host CPU and DRAM 0.06, idle 0.02, overhead 0.02 Wh. Water follows from the energy and a WUE of 1.15 L/kWh, which reproduces the published 0.26 mL. The 94 gCO2e/kWh is market-based and flatters the result by roughly three and a half times against the location-based 345, so it is only used when the reader asks for provider-reported carbon. Google did not publish the token counts behind the median prompt, so the reference counts here are ours.", "hosting": "cloud" }, { "id": "openai.altman-statement.2025", "modelIds": ["gpt-5"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.1, "central": 0.34, "high": 3 }, "directWaterMl": { "low": 0.1, "central": 0.32, "high": 3 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 60, "central": 300, "high": 1e3 }, "tokenCountsPublished": false }, "pue": { "low": 1, "central": 1.12, "high": 1.2 }, "energyIncludesPue": true, "methodology": "provider-statement", "boundary": "datacenter", "source": { "title": "The Gentle Singularity", "url": "https://blog.samaltman.com/the-gentle-singularity", "publisher": "Sam Altman", "date": "2025-06", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-06-01", "qualityScore": 2, "notes": "A blog sentence, not a measurement. No model, no boundary, no date, no method, and no audit. The range is wide on purpose and the quality score is low on purpose. We keep the row because it is the only first-party OpenAI number that exists, and because readers will have seen it quoted. The boundary is recorded as datacenter only so the engine has something to work with; the source did not say.", "hosting": "cloud" }, { "id": "mistral.large-2.lca.2025", "modelIds": ["mistral-large-2"], "shape": "per-prompt", "perPrompt": { "directCarbonG": { "low": 0.8, "central": 1.14, "high": 1.6 }, "directWaterMl": { "low": 32, "central": 45, "high": 63 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 400, "central": 400, "high": 400 }, "tokenCountsPublished": false }, "pue": { "low": 1, "central": 1, "high": 1 }, "energyIncludesPue": true, "methodology": "provider-measured", "boundary": "lifecycle", "source": { "title": "Our contribution to a global environmental standard for AI", "url": "https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai", "publisher": "Mistral AI, with Carbone 4 and ADEME", "date": "2025-07-22", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-07-22", "qualityScore": 5, "notes": "The most complete assessment anyone has published, reviewed by Resilio and Hubblo. One 400-token Le Chat reply: 1.14 gCO2e, 45 mL, 0.16 mg Sb-eq. Training cost 20,400 tCO2e and 281,000 cubic metres. The water figure is about 170 times Google's because it counts manufacturing and the water used generating the electricity, not just on-site cooling. Carbon and water are published directly and already include the embodied share, so the engine uses them as they are rather than deriving them from energy. Mistral did not publish an energy figure per reply, and only the output token count was given, so the input reference is ours. The plus or minus 40 per cent on the direct values is our uncertainty, not the study's.", "hosting": "cloud" }, { "id": "jegham.gpt-4o", "modelIds": ["gpt-4o"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.423 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 1.215 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 2.875 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Version 6 of the preprint." }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Inferred from latency times rated DGX power times an assumed utilisation, on Azure infrastructure. Sizes of the closed models are guesses, so this is much better for ranking models against each other than for absolute values. The quoted energy is at server level and the engine applies the PUE of 1.12 on top. The uncertainty multipliers of one half and two are ours.", "hosting": "cloud" }, { "id": "jegham.gpt-4.1", "modelIds": ["gpt-4.1"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.871 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 3.161 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 4.833 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "hosting": "cloud" }, { "id": "jegham.gpt-4.1-nano", "modelIds": ["gpt-4.1-nano"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.207 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 0.575 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 0.827 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "The cheapest model measured, and about four times lighter than GPT-4.1 on a short prompt. This row is what most downgrade recommendations point at.", "hosting": "cloud" }, { "id": "jegham.o3", "modelIds": ["o3"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 1.177 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 5.153 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 12.222 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Between two point eight and four point three times GPT-4o for the same prompt, which is the clearest published measurement of what hidden reasoning costs. The thinking tokens are already inside these numbers.", "hosting": "cloud" }, { "id": "jegham.o4-mini", "modelIds": ["o4-mini"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 3.649 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 7.38 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 7.237 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Measured on the high reasoning effort setting. A mini model that costs more than o3 on a short prompt, because the reasoning budget dominates. It is a useful warning that smaller is not automatically lighter once thinking is switched on. The long-prompt figure sits slightly below the medium one, which the fit will smooth over.", "hosting": "cloud" }, { "id": "jegham.claude-3.7-sonnet", "modelIds": ["claude-3.7-sonnet"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.95 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 2.989 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 5.671 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "carbonGPerKwh": { "low": 287, "central": 287, "high": 287 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Measured on AWS, so the multipliers differ from the OpenAI rows. Anthropic has published nothing first-party, so this row is the anchor for every Claude proxy in this file.", "hosting": "cloud" }, { "id": "jegham.claude-3.5-sonnet", "modelIds": ["claude-3.5-sonnet"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.973 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 3.638 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 7.772 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "carbonGPerKwh": { "low": 287, "central": 287, "high": 287 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "hosting": "cloud" }, { "id": "jegham.deepseek-r1", "modelIds": ["deepseek-r1"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 2.353 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 4.331 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 7.41 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Served on Azure. An open model run in somebody else's data centre, so it counts as cloud here even though the weights are downloadable.", "hosting": "cloud" }, { "id": "jegham.llama-3.3-70b", "modelIds": ["llama-3.3-70b"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.237 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 0.76 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 1.447 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "carbonGPerKwh": { "low": 287, "central": 287, "high": 287 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "hosting": "cloud" }, { "id": "epoch.gpt-4o.2025", "modelIds": ["gpt-4o"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "typical", "inputTokens": 100, "outputTokens": 500, "energyWh": 0.3 }, { "label": "long context", "inputTokens": 1e4, "outputTokens": 500, "energyWh": 2.5 }, { "label": "very long context", "inputTokens": 1e5, "outputTokens": 500, "energyWh": 40 }], "relativeUncertainty": { "low": 0.4, "central": 1, "high": 2.5 } }, "pue": { "low": 1.1, "central": 1.12, "high": 1.2 }, "energyIncludesPue": true, "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How much energy does ChatGPT use?", "url": "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use", "publisher": "Epoch AI", "date": "2025-02-07", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-02-07", "qualityScore": 3, "notes": "A bottom-up estimate assuming an H100 at 1,500 W including overhead and 10 per cent utilisation. The value of this row is the shape rather than the level: a hundred thousand token context costs over a hundred times a short prompt, which is the single most useful thing to know about long-context habits. The stated overhead means we do not apply PUE again.", "hosting": "cloud" }, { "id": "microsoft.oviedo.2026", "modelIds": ["gpt-4o"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.16, "central": 0.31, "high": 0.6 }, "directWaterMl": { "low": 0, "central": 0.03, "high": 0.067 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 100, "central": 300, "high": 700 }, "tokenCountsPublished": false }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": true, "methodology": "independent-benchmark", "boundary": "datacenter", "source": { "title": "Energy and water footprint of large language model inference", "url": "https://arxiv.org/abs/2509.20241", "publisher": "Oviedo and colleagues, Microsoft Research, in Joule", "date": "2026-04", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2509.20241" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-09-24", "qualityScore": 3, "notes": "Median 0.31 Wh per query with an interquartile range of 0.16 to 0.60. Simulation rather than fleet telemetry, and written by people at the vendor whose cloud is being measured, so it is corroboration rather than independent evidence. The same paper puts test-time scaling with fifteen times longer output at 3.91 Wh, which is the number to reach for when a reasoning model is in play.", "hosting": "cloud" }, { "id": "huggingface.energy-score.v2.r1-distill-70b", "modelIds": ["deepseek-r1-distill-llama-70b"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.0495, "central": 0.5, "high": 7.627 }, "referenceInputTokens": { "low": 100, "central": 100, "high": 100 }, "referenceOutputTokens": { "low": 200, "central": 500, "high": 4e3 }, "tokenCountsPublished": false }, "pue": { "low": 1, "central": 1.15, "high": 1.4 }, "energyIncludesPue": false, "methodology": "independent-benchmark", "boundary": "accelerator-only", "source": { "title": "AI Energy Score, version 2", "url": "https://huggingface.co/spaces/AIEnergyScore/Leaderboard", "publisher": "Hugging Face", "date": "2025-12-04", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-12-04", "qualityScore": 4, "notes": "Measured on an H100 at batch size one in FP16, GPU only, so no idle draw and no facility overhead. The spread here is real rather than sloppy: with reasoning switched off this model draws 49.5 Wh per thousand queries, and with reasoning on it draws 7,627, a factor of over one hundred and fifty. Any single central value for a reasoning model is a fiction, which is why the low and high are the two measured modes.", "hosting": "cloud" }, { "id": "ecologits.parametric.cloud", "modelIds": ["llama-3.3-70b", "llama-3.1-8b", "llama-3.2-3b", "qwen-2.5-7b", "mistral-7b", "gemma-2-9b", "phi-3-mini", "mistral-large-2", "deepseek-r1", "deepseek-r1-distill-llama-70b"], "shape": "parametric", "parametric": { "model": "ecologits", "coefficients": { "alphaKwhPerTokenPerB": 117e-8, "betaPerB": -0.0112, "gammaKwhPerToken": 405e-7 }, "serverBaseW": { "low": 1e3, "central": 1200, "high": 1400 }, "gpuCount": 8 }, "pue": { "low": 1.09, "central": 1.15, "high": 1.2 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.09, "central": 0.5, "high": 0.99 }, "methodology": "parametric-model", "boundary": "server", "source": { "title": "EcoLogits: Evaluating the environmental impacts of generative AI", "url": "https://joss.theoj.org/papers/10.21105/joss.07471", "publisher": "Journal of Open Source Software", "date": "2025", "retrieved": "2026-09-10", "doi": "10.21105/joss.07471", "licence": "MPL-2.0 for the code, paper CC BY 4.0" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-01-01", "qualityScore": 3, "notes": "Energy per output token as alpha times e to the beta B times active parameters, plus gamma, where B is active parameters in billions. The fallback for any open-weight model with no measurement of its own. We follow the EcoLogits method and cite it; none of their code is copied into this repository.", "hosting": "cloud" }, { "id": "ecologits.parametric.local", "modelIds": ["llama-3.3-70b", "llama-3.1-8b", "llama-3.2-3b", "qwen-2.5-7b", "mistral-7b", "gemma-2-9b", "phi-3-mini", "deepseek-r1-distill-llama-70b"], "shape": "parametric", "parametric": { "model": "ecologits", "coefficients": { "alphaKwhPerTokenPerB": 117e-8, "betaPerB": -0.0112, "gammaKwhPerToken": 405e-7 }, "serverBaseW": { "low": 10, "central": 120, "high": 410 }, "gpuCount": 1 }, "pue": { "low": 1, "central": 1, "high": 1 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 0, "central": 0, "high": 0 }, "methodology": "parametric-model", "boundary": "server", "source": { "title": "GreenBench: energy measurements of local LLM inference on Apple silicon", "url": "https://arxiv.org/abs/2608.28667", "publisher": "GreenBench", "date": "2026", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2608.28667" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Coefficients are EcoLogits. The base power range is set from the GreenBench Apple silicon measurements at the low end and desktop GPU draw at the high end." }, "validFrom": "2026-01-01", "qualityScore": 3, "notes": "The same formula for a model on your own machine. There is no data centre, so the PUE is one and the on-site cooling water is zero; the water that remains comes from generating the electricity, which the region factor supplies. The base power spans an M4 Pro laptop at around 10 W to a desktop with an RTX 4090 pulling 280 to 410 W, which is the widest honest range we can give without knowing the machine. Reference points: Llama 3.2 3B at 0.09 J per token and Qwen 2.5 7B at 0.20 J per token on an M4 Pro, and Llama 3.1 8B at about 0.29 J per token on a 4090. Corroboration: the formula puts a 400 token reply from an 8 billion parameter model at about 0.023 Wh, against roughly 0.032 Wh implied by the measured 0.29 J per token on an RTX 4090. That agreement is the main reason we read the published coefficients as kilowatt hours per thousand output tokens.", "hosting": "local" }, { "id": "proxy.claude-opus", "modelIds": ["claude-opus-5", "claude-opus-4.8", "claude-opus-4.1", "claude-fable-5.1"], "shape": "proxy", "proxyOf": "jegham.claude-3.7-sonnet", "proxyFactor": { "low": 1, "central": 2, "high": 4.5 }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "The scaling factor is ours, not the paper's." }, "validFrom": "2025-05-14", "qualityScore": 2, "notes": "Anthropic publishes no per-query figures at all, so every current Claude model is scaled from the one measured Sonnet. Opus-class models are assumed to cost between one and four and a half times a 3.7 Sonnet query, centred on two. That is a guess with a shape, and any estimate built on it carries the proxy-row flag so it can never be mistaken for a measurement.", "hosting": "cloud" }, { "id": "proxy.claude-sonnet", "modelIds": ["claude-sonnet-5", "claude-sonnet-4"], "shape": "proxy", "proxyOf": "jegham.claude-3.7-sonnet", "proxyFactor": { "low": 0.7, "central": 1.1, "high": 2 }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 2, "hosting": "cloud" }, { "id": "proxy.claude-haiku", "modelIds": ["claude-haiku-4.5", "claude-3.5-haiku"], "shape": "proxy", "proxyOf": "jegham.claude-3.7-sonnet", "proxyFactor": { "low": 0.1, "central": 0.3, "high": 0.7 }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 2, "hosting": "cloud" }, { "id": "proxy.gpt-5.6", "modelIds": ["gpt-5.6"], "shape": "proxy", "proxyOf": "jegham.o3", "proxyFactor": { "low": 0.3, "central": 0.8, "high": 2 }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2026-01-01", "qualityScore": 2, "notes": "Scaled from o3 because both are reasoning models on the same infrastructure. The central factor below one assumes some efficiency gain per generation, which is the kind of assumption that should be replaced by a measurement as soon as one exists.", "hosting": "cloud" }, { "id": "proxy.gpt-4.1-mini", "modelIds": ["gpt-4.1-mini", "gpt-4o-mini"], "shape": "proxy", "proxyOf": "jegham.gpt-4.1-nano", "proxyFactor": { "low": 1.2, "central": 2, "high": 3.5 }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 2, "notes": "Interpolated between the measured nano and full rows, closer to nano.", "hosting": "cloud" }, { "id": "proxy.gemini-2.5-pro", "modelIds": ["gemini-2.5-pro"], "shape": "proxy", "proxyOf": "google.gemini-apps.2025-median", "proxyFactor": { "low": 2, "central": 6, "high": 20 }, "pue": { "low": 1.09, "central": 1.09, "high": 1.09 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 1.15, "central": 1.15, "high": 1.15 }, "methodology": "proxy", "boundary": "datacenter", "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-08-21", "qualityScore": 2, "notes": "Google measured a fleet median dominated by its smallest, fastest model. A Pro query with thinking on is a different animal, and the factor here is wide because we have nothing better. The high end of twenty is set by the ratio between a Flash-class and a reasoning-frontier query in the independent benchmarks.", "hosting": "cloud" }, { "id": "proxy.gemini-2.5-flash-lite", "modelIds": ["gemini-2.5-flash-lite"], "shape": "proxy", "proxyOf": "google.gemini-apps.2025-median", "proxyFactor": { "low": 0.2, "central": 0.4, "high": 0.8 }, "pue": { "low": 1.09, "central": 1.09, "high": 1.09 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 1.15, "central": 1.15, "high": 1.15 }, "methodology": "proxy", "boundary": "datacenter", "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-08-21", "qualityScore": 2, "hosting": "cloud" }], "regions": [{ "code": "WORLD", "name": "World average", "kind": "world", "continent": "Global", "gridGco2PerKwh": { "low": 435.6, "central": 458.5, "high": 483.2 }, "waterOffsiteLPerKwh": { "low": 3.37, "central": 4.81, "high": 7.21 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 483.2, 2024: 471.5, 2025: 458.5), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 1.27 US gal/kWh from Table 4, the generation-weighted global average of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14." }, { "code": "US", "name": "United States", "kind": "country", "continent": "North America", "gridGco2PerKwh": { "low": 298.3, "central": 349.7, "high": 396.2 }, "waterOffsiteLPerKwh": { "low": 2.2, "central": 3.14, "high": 4.71 }, "year": 2023, "source": { "title": "eGRID2023 Summary Tables, revision 2, Table 1: subregion output emission rates", "url": "https://www.epa.gov/system/files/documents/2025-06/summary_tables_rev2.xlsx", "publisher": "United States Environmental Protection Agency", "date": "2025-06", "retrieved": "2026-09-13", "licence": "public domain" }, "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "CO2e output emission rate from the U.S. total line of Table 1, 770.884 lb/MWh, converted at 0.45359237 g/kWh per lb/MWh. The range mirrors the national row's band, about six per cent under and seven over, which covers a typical year's movement between eGRID releases. Read from the spreadsheet on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.83 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone US (8760 intervals), taken as a fraction of that year's mean (0.853 and 1.133) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 352.7 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "IN", "name": "India", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 680, "central": 710, "high": 745 }, "waterOffsiteLPerKwh": { "low": 2.41, "central": 3.44, "high": 5.16 }, "year": 2025, "source": { "title": "CO2 Baseline Database for the Indian Power Sector, version 21.0", "url": "https://cea.nic.in/cdm-co2-baseline-database/", "publisher": "Central Electricity Authority, Government of India", "date": "2025-12", "retrieved": "2026-09-10" }, "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "0.710 tCO2 per MWh weighted average." }, "notes": "Off-site water is the water consumed generating the electricity: 0.91 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14." }, { "code": "GB", "name": "United Kingdom (Ember, as generated)", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 97.6, "central": 217.4, "high": 355.2 }, "waterOffsiteLPerKwh": { "low": 1.65, "central": 2.35, "high": 3.53 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 235.6, 2024: 216.5, 2025: 217.4), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.62 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone GB (17520 intervals), taken as a fraction of that year's mean (0.449 and 1.634) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 129.2 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "GB-NESO", "name": "Great Britain (NESO, as consumed)", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 55.7, "central": 124, "high": 202.6 }, "waterOffsiteLPerKwh": { "low": 1.65, "central": 2.35, "high": 3.53 }, "year": 2026, "source": { "title": "Carbon Intensity API, monthly statistics", "url": "https://api.carbonintensity.org.uk/", "publisher": "National Energy System Operator", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Carbon intensity of the electricity consumed in Great Britain, including imports, on NESO's own factors. Central is the mean of the twelve monthly averages from 2025-09 to 2026-08; the range is the lowest and highest month (112, 138, 126, 120, 145, 137, 117, 94, 122, 132, 121, 124). Ember's United Kingdom row counts power sector CO2 per kWh generated and comes out higher; the two are official figures for different things, and the dataset keeps both. Read from the API on 2026-09-13. Off-site water is the WRI factor for Great Britain, as on the Ember row. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone GB (17520 intervals), taken as a fraction of that year's mean (0.449 and 1.634) and applied to the central figure above. The snapshot republishes NESO's own operational figure for Great Britain, so its level and this row's agree. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "FR", "name": "France", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 27.3, "central": 41.5, "high": 65.6 }, "waterOffsiteLPerKwh": { "low": 2.57, "central": 3.67, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 53.3, 2024: 40.5, 2025: 41.5), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.97 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone FR (8756 intervals), taken as a fraction of that year's mean (0.659 and 1.58) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 35.1 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "DE", "name": "Germany", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 147.7, "central": 329.6, "high": 517.1 }, "waterOffsiteLPerKwh": { "low": 1.35, "central": 1.93, "high": 2.9 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 363.6, 2024: 337.1, 2025: 329.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.51 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone DE (8760 intervals), taken as a fraction of that year's mean (0.448 and 1.569) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 316.8 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "IE", "name": "Ireland", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 102.4, "central": 255.9, "high": 422.7 }, "waterOffsiteLPerKwh": { "low": 1.04, "central": 1.48, "high": 2.22 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 282.5, 2024: 270.9, 2025: 255.9), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.39 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone IE (8556 intervals), taken as a fraction of that year's mean (0.4 and 1.652) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 278.0 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "NL", "name": "Netherlands", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 178.5, "central": 253.6, "high": 315 }, "waterOffsiteLPerKwh": { "low": 2.41, "central": 3.44, "high": 5.16 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 268.2, 2024: 250.7, 2025: 253.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.91 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone NL (8733 intervals), taken as a fraction of that year's mean (0.704 and 1.242) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 478.5 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "SE", "name": "Sweden", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 12.5, "central": 35.4, "high": 80.3 }, "waterOffsiteLPerKwh": { "low": 4.21, "central": 6.02, "high": 9.03 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 38.4, 2024: 34.9, 2025: 35.4), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 1.59 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone SE-1, SE-2, SE-3 and SE-4 pooled with equal weight, since no load data was available to weight them (35040 intervals), taken as a fraction of that year's mean (0.353 and 2.269) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 60.9 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "ES", "name": "Spain", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 97.5, "central": 153.6, "high": 229.5 }, "waterOffsiteLPerKwh": { "low": 4.35, "central": 6.21, "high": 9.31 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 169.7, 2024: 146.2, 2025: 153.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 1.64 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone ES (8725 intervals), taken as a fraction of that year's mean (0.635 and 1.494) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 136.2 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "PL", "name": "Poland", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 413.6, "central": 590.8, "high": 728.5 }, "waterOffsiteLPerKwh": { "low": 1.75, "central": 2.5, "high": 3.75 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 650.9, 2024: 608.4, 2025: 590.8), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.66 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone PL (8760 intervals), taken as a fraction of that year's mean (0.7 and 1.233) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 545.5 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "CA", "name": "Canada", "kind": "country", "continent": "North America", "gridGco2PerKwh": { "low": 174.4, "central": 190.7, "high": 200.2 }, "waterOffsiteLPerKwh": { "low": 5.73, "central": 8.18, "high": 12.27 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 174.4, 2024: 185.4, 2025: 190.7), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 2.16 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "BR", "name": "Brazil", "kind": "country", "continent": "South America", "gridGco2PerKwh": { "low": 96.3, "central": 110, "high": 115.5 }, "waterOffsiteLPerKwh": { "low": 13.01, "central": 18.58, "high": 27.87 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 96.3, 2024: 106.1, 2025: 110.0), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 4.91 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "JP", "name": "Japan", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 453.5, "central": 477.4, "high": 492.6 }, "waterOffsiteLPerKwh": { "low": 1.62, "central": 2.31, "high": 3.46 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 492.6, 2024: 483.6, 2025: 477.4), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 0.61 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "SG", "name": "Singapore", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 472.2, "central": 497.1, "high": 500.9 }, "waterOffsiteLPerKwh": { "low": 2.4, "central": 4.81, "high": 9.62 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 500.9, 2024: 498.7, 2025: 497.1), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water: the WRI guidance lists no factor for this country, so the generation-weighted global average of 1.27 US gal/kWh is used, with a range of half to double to say how little that is worth. A national factor would replace it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "CN", "name": "China", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 499.9, "central": 526.2, "high": 583.2 }, "waterOffsiteLPerKwh": { "low": 4.21, "central": 6.02, "high": 9.03 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 583.2, 2024: 556.3, 2025: 526.2), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 1.59 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "AU", "name": "Australia", "kind": "country", "continent": "Oceania", "gridGco2PerKwh": { "low": 498.4, "central": 524.6, "high": 556.9 }, "waterOffsiteLPerKwh": { "low": 3.31, "central": 4.73, "high": 7.1 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 556.9, 2024: 554.0, 2025: 524.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water is the water consumed generating the electricity: 1.25 US gal/kWh from Appendix 2 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "ZA", "name": "South Africa", "kind": "country", "continent": "Africa", "gridGco2PerKwh": { "low": 664, "central": 699, "high": 717.7 }, "waterOffsiteLPerKwh": { "low": 2.4, "central": 4.81, "high": 9.62 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 714.4, 2024: 717.7, 2025: 699.0), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13. Off-site water: the WRI guidance lists no factor for this country, so the generation-weighted global average of 1.27 US gal/kWh is used, with a range of half to double to say how little that is worth. A national factor would replace it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "US-CAMX", "name": "California, WECC (eGRID CAMX)", "kind": "subregion", "continent": "North America", "gridGco2PerKwh": { "low": 129.5, "central": 195, "high": 273.2 }, "waterOffsiteLPerKwh": { "low": 3.63, "central": 5.19, "high": 7.79 }, "year": 2023, "source": { "title": "eGRID2023 Summary Tables, revision 2, Table 1: subregion output emission rates", "url": "https://www.epa.gov/system/files/documents/2025-06/summary_tables_rev2.xlsx", "publisher": "United States Environmental Protection Agency", "date": "2025-06", "retrieved": "2026-09-13", "licence": "public domain" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "CO2e output emission rate from the CAMX line of Table 1, 429.983 lb/MWh, converted at 0.45359237 g/kWh per lb/MWh. The range mirrors the national row's band, about six per cent under and seven over, which covers a typical year's movement between eGRID releases. Read from the spreadsheet on 2026-09-13. Off-site water is the water consumed generating the electricity: 1.37 US gal/kWh from Appendix 1 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14. The range is the real hourly spread of 2025: the 10th and 90th percentiles of hourly intensity in the gridcarbon snapshot for zone US-CAISO (8688 intervals), taken as a fraction of that year's mean (0.664 and 1.401) and applied to the central figure above. The snapshot's own levels use lifecycle emission factors, so they are not used directly; only the shape of the year is taken. Its 2025 mean for this zone was 230.6 gCO2eq/kWh. Attribution the data licence asks for: gridcarbon hourly carbon intensity, CC BY 4.0, derived from the ENTSO-E Transparency Platform, the U.S. Energy Information Administration (EIA-930) and the NESO Carbon Intensity API, none of which endorse it.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "rangeSource": { "title": "gridcarbon, hourly grid carbon intensity for 45 zones (Europe, US, Great Britain), snapshot 2026-09-04", "url": "https://doi.org/10.5281/zenodo.22299989", "publisher": "gupeng, via Zenodo", "date": "2026-09-04", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "US-SRVC", "name": "Virginia and the Carolinas, SERC (eGRID SRVC)", "kind": "subregion", "continent": "North America", "gridGco2PerKwh": { "low": 255.3, "central": 270.5, "high": 290.1 }, "waterOffsiteLPerKwh": { "low": 1.67, "central": 2.38, "high": 3.57 }, "year": 2023, "source": { "title": "eGRID2023 Summary Tables, revision 2, Table 1: subregion output emission rates", "url": "https://www.epa.gov/system/files/documents/2025-06/summary_tables_rev2.xlsx", "publisher": "United States Environmental Protection Agency", "date": "2025-06", "retrieved": "2026-09-13", "licence": "public domain" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "CO2e output emission rate from the SRVC line of Table 1, 596.326 lb/MWh, converted at 0.45359237 g/kWh per lb/MWh. The range mirrors the national row's band, about six per cent under and seven over, which covers a typical year's movement between eGRID releases. Read from the spreadsheet on 2026-09-13. Northern Virginia carries more data centre load than anywhere else on earth, which is why this subregion is here. Off-site water is the water consumed generating the electricity: 0.63 US gal/kWh from Appendix 1 of the WRI guidance, at 3.785 L per gallon. The factor is a single modelled value from 2018 generation mixes, so the range takes 0.7 and 1.5 times it, to cover the shift in mix since and the gap between modelling approaches: Li and colleagues put the United States at 3.1 L/kWh where this method gives 3.14.", "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" } }, { "code": "GOOGLE-FLEET", "name": "Google data centre fleet", "kind": "provider-fleet", "continent": "Global", "gridGco2PerKwh": { "low": 345, "central": 345, "high": 345 }, "waterOffsiteLPerKwh": { "low": 2.4, "central": 4.81, "high": 9.62 }, "year": 2024, "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Google's own location-based fleet average. Their market-based figure of 94 lives on the benchmark row instead, because it is a claim about procurement rather than about a grid." }, "waterSource": { "title": "Guidance for Calculating Water Use Embedded in Purchased Electricity, Appendices 1 and 2 and Table 4", "url": "https://files.wri.org/d8/s3fs-public/guidance-calculating-water-use-embedded-purchased-electricity_0.pdf", "publisher": "World Resources Institute and WSP", "date": "2020-01", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "notes": "Off-site water: a provider fleet spans many grids, so the generation-weighted global average of 1.27 US gal/kWh from the WRI guidance is used, half to double. This is an assumption, not a figure Google has published." }], "defaultRegion": "WORLD", "equivalents": [{ "id": "led-bulb-second", "quantity": "energy", "unitPer": "Wh", "amount": 25e-4, "singular": "second of a 9 W LED bulb", "plural": "seconds of a 9 W LED bulb", "source": { "title": "LED lamp product data, typical 9 W A60 replacement for a 60 W incandescent", "url": "https://www.ledvance.com/", "publisher": "LEDVANCE", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "notes": "9 W for one second is 0.0025 Wh." }, { "id": "phone-charge", "quantity": "energy", "unitPer": "Wh", "amount": 19, "singular": "full smartphone charge", "plural": "full smartphone charges", "source": { "title": "Greenhouse Gas Equivalencies Calculator", "url": "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator", "publisher": "United States Environmental Protection Agency", "date": "2026-08", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "notes": "0.019 kWh per charge." }, { "id": "kettle-boil", "quantity": "energy", "unitPer": "Wh", "amount": 100, "singular": "mug of water boiled in a kettle", "plural": "mugs of water boiled in a kettle", "source": { "title": "Energy use of domestic kettles", "url": "https://energysavingtrust.org.uk/", "publisher": "Energy Saving Trust", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Roughly 0.1 kWh to bring 300 mL from tap temperature to boiling, allowing for kettle losses. Worth replacing with a cited figure." } }, { "id": "google-search", "quantity": "energy", "unitPer": "Wh", "amount": 0.3, "singular": "web search", "plural": "web searches", "stale": true, "source": { "title": "Powering a Google search", "url": "https://googleblog.blogspot.com/2009/01/powering-google-search.html", "publisher": "Google", "date": "2009-01", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "notes": "Seventeen years old and quoted constantly. We keep it because the comparison is the one people reach for, and we mark it stale wherever it appears." }, { "id": "teaspoon", "quantity": "water", "unitPer": "mL", "amount": 4.9, "singular": "teaspoon of water", "plural": "teaspoons of water", "source": { "title": "Metric teaspoon, standard measure", "url": "https://www.bipm.org/en/measurement-units", "publisher": "International Bureau of Weights and Measures", "date": "2019", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "glass-of-water", "quantity": "water", "unitPer": "mL", "amount": 237, "singular": "glass of water", "plural": "glasses of water", "source": { "title": "United States customary cup, 8 fluid ounces", "url": "https://www.nist.gov/pml/owm", "publisher": "National Institute of Standards and Technology", "date": "2024", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "water-bottle", "quantity": "water", "unitPer": "mL", "amount": 500, "singular": "500 mL bottle of water", "plural": "500 mL bottles of water", "source": { "title": "Standard retail bottled water volume", "url": "https://www.bipm.org/en/measurement-units", "publisher": "International Bureau of Weights and Measures", "date": "2019", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "car-metre", "quantity": "carbon", "unitPer": "g", "amount": 0.244, "singular": "metre driven in an average petrol car", "plural": "metres driven in an average petrol car", "source": { "title": "Greenhouse gas reporting: conversion factors 2025 to 2026, average car, petrol", "url": "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting", "publisher": "Department for Energy Security and Net Zero", "date": "2025", "retrieved": "2026-09-10", "licence": "Open Government Licence v3.0" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "244 g per km, cross-checked against the EPA figure of 393 g per mile. Copy the exact cell out of the DEFRA spreadsheet before launch." } }, { "id": "phone-charge-carbon", "quantity": "carbon", "unitPer": "g", "amount": 12.4, "singular": "smartphone charged from empty", "plural": "smartphones charged from empty", "source": { "title": "Greenhouse Gas Equivalencies Calculator", "url": "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator", "publisher": "United States Environmental Protection Agency", "date": "2026-08", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "search-carbon", "quantity": "carbon", "unitPer": "g", "amount": 0.2, "singular": "web search", "plural": "web searches", "stale": true, "source": { "title": "Powering a Google search", "url": "https://googleblog.blogspot.com/2009/01/powering-google-search.html", "publisher": "Google", "date": "2009-01", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "household-day", "quantity": "energy", "unitPer": "Wh", "amount": 7400, "singular": "day of electricity for an average home", "plural": "days of electricity for an average home", "source": { "title": "Typical Domestic Consumption Values, medium electricity user", "url": "https://www.ofgem.gov.uk/information-consumers/energy-advice-households/average-gas-and-electricity-use-explained", "publisher": "Ofgem", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "2,700 kWh a year works out at 7.4 kWh a day. Check the current TDCV figure before launch." }, "notes": "The comparison that lands in range for a week of agent sessions, where a phone charge does not." }, { "id": "washing-cycle", "quantity": "energy", "unitPer": "Wh", "amount": 700, "singular": "load of washing", "plural": "loads of washing", "source": { "title": "Energy use of domestic appliances", "url": "https://energysavingtrust.org.uk/", "publisher": "Energy Saving Trust", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "About 0.7 kWh for a 40 degree cycle. Worth replacing with a cited figure." } }, { "id": "shower-minute", "quantity": "water", "unitPer": "mL", "amount": 1e4, "singular": "minute in the shower", "plural": "minutes in the shower", "source": { "title": "Water use at home", "url": "https://waterwise.org.uk/save-water/", "publisher": "Waterwise", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Around 10 litres a minute for a mixer shower." } }, { "id": "bath", "quantity": "water", "unitPer": "mL", "amount": 8e4, "singular": "bath", "plural": "baths", "source": { "title": "Water use at home", "url": "https://waterwise.org.uk/save-water/", "publisher": "Waterwise", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Around 80 litres for a full bath." } }, { "id": "car-kilometre", "quantity": "carbon", "unitPer": "g", "amount": 244, "singular": "kilometre driven in an average petrol car", "plural": "kilometres driven in an average petrol car", "source": { "title": "Greenhouse gas reporting: conversion factors 2025 to 2026, average car, petrol", "url": "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting", "publisher": "Department for Energy Security and Net Zero", "date": "2025", "retrieved": "2026-09-10", "licence": "Open Government Licence v3.0" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "The same factor as car-metre, a thousand times over, so the pair covers both a single prompt and a week of sessions." } }], "calibration": { "version": "1.0.0", "notes": "Constants the engine needs that are not benchmark rows. Several are honest guesses with a shape rather than measurements, and each says which it is. The tokenizer ratios in particular have not yet been measured against the providers' own counting endpoints.", "tokenizer": { "baseEncoding": "o200k_base", "charsPerTokenFallback": { "prose": { "low": 4.2, "central": 5.2, "high": 6.3 }, "code": { "low": 2.9, "central": 3.81, "high": 5 }, "maths": { "low": 1.5, "central": 2.21, "high": 3.3 }, "non-latin": { "low": 1, "central": 2.49, "high": 5.5 } }, "providers": { "openai": { "exact": true, "contentClasses": { "prose": { "low": 1, "central": 1, "high": 1 }, "maths": { "low": 1, "central": 1, "high": 1 }, "code": { "low": 1, "central": 1, "high": 1 }, "non-latin": { "low": 1, "central": 1, "high": 1 } }, "source": { "title": "tiktoken, o200k_base encoding", "url": "https://github.com/openai/tiktoken", "publisher": "OpenAI", "date": "2024", "retrieved": "2026-09-10", "licence": "MIT" } }, "anthropic": { "exact": false, "contentClasses": { "prose": { "low": 1.08, "central": 1.16, "high": 1.26 }, "maths": { "low": 1.12, "central": 1.21, "high": 1.34 }, "code": { "low": 1.18, "central": 1.3, "high": 1.45 }, "non-latin": { "low": 1.02, "central": 1.1, "high": 1.22 } }, "source": { "title": "Ratio of Claude tokens to o200k tokens, recorded during project research", "url": "https://docs.claude.com/en/docs/build-with-claude/token-counting", "publisher": "Better Use of AI research notes, against the documented count-tokens endpoint", "date": "2026-09", "retrieved": "2026-09-10" }, "notes": "Roughly 16 per cent more tokens than o200k on English prose, 21 per cent on maths and 30 per cent on Python. These came out of the project research rather than a run of scripts/calibrate.ts, which does not exist yet. The spread around each central value is ours. Replace these with measured factors before the extension ships." }, "google": { "exact": false, "contentClasses": { "prose": { "low": 0.95, "central": 1, "high": 1.1 }, "maths": { "low": 0.95, "central": 1, "high": 1.12 }, "code": { "low": 0.95, "central": 1.02, "high": 1.15 }, "non-latin": { "low": 0.9, "central": 1, "high": 1.15 } }, "source": { "title": "Ratio of Gemini tokens to o200k tokens, recorded during project research", "url": "https://ai.google.dev/gemini-api/docs/tokens", "publisher": "Better Use of AI research notes, against the documented count-tokens endpoint", "date": "2026-09", "retrieved": "2026-09-10" }, "notes": "Gemini counts come out close to o200k, so the central values sit at or near one. Same caveat as the Anthropic row: recorded during research, not yet measured by a calibration run." } }, "charsPerTokenNotes": "Measured against the o200k encoder over a small set of samples per class, not guessed. The central values are the pooled chars-per-token; the bounds are the per-sample spread padded by about a fifth, because the sample is small. The first version of this file carried one global range of 3 to 5, which was 43 per cent out on English prose and did not even bracket the real count." }, "cachedReadShareOfInput": { "low": 0, "central": 0.1, "high": 0.5 }, "cacheWriteShareOfInput": { "low": 1, "central": 1, "high": 1.25 }, "outputToInputEnergyWeight": { "low": 4, "central": 8, "high": 15 }, "derivedRowWidening": { "low": 0.5, "central": 1, "high": 2 }, "assumedTokenCountWidening": { "low": 0.7, "central": 1, "high": 1.5 }, "hiddenContextFactor": { "api": { "low": 1, "central": 1, "high": 1 }, "claude-code": { "low": 1, "central": 1, "high": 1.05 }, "codex-cli": { "low": 1, "central": 1, "high": 1.05 }, "claude-web": { "low": 1, "central": 1.4, "high": 2.5 }, "chatgpt-web": { "low": 1, "central": 1.5, "high": 3 }, "gemini-web": { "low": 1, "central": 1.4, "high": 2.5 }, "local-webui": { "low": 1, "central": 1, "high": 1.1 } }, "localPue": { "low": 1, "central": 1, "high": 1 }, "parametricWidening": { "low": 0.4, "central": 1, "high": 5 } } };
    dist_default = dataset;
  }
});

// ../../packages/readers/dist/types.js
var emptyIncrementalState;
var init_types3 = __esm({
  "../../packages/readers/dist/types.js"() {
    "use strict";
    emptyIncrementalState = () => ({ offset: 0, seen: {} });
  }
});

// ../../packages/readers/dist/jsonl.js
import { createReadStream } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
async function* readJsonl(path) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let number = 0;
  for await (const raw of lines) {
    number += 1;
    const text = raw.trim();
    if (text === "")
      continue;
    try {
      yield { line: number, value: JSON.parse(text) };
    } catch (cause) {
      yield { line: number, value: null, error: cause instanceof Error ? cause.message : "unparseable" };
    }
  }
}
var readJsonlSince, walk, exists;
var init_jsonl = __esm({
  "../../packages/readers/dist/jsonl.js"() {
    "use strict";
    readJsonlSince = async (path, offset) => {
      const info = await stat(path);
      let start = offset;
      let restarted = false;
      if (info.size < offset) {
        start = 0;
        restarted = true;
      }
      if (info.size === start)
        return { lines: [], offset: start, restarted };
      const handle = await open(path, "r");
      try {
        const length = info.size - start;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, start);
        const text = buffer.toString("utf8");
        const lastBreak = text.lastIndexOf("\n");
        const complete = lastBreak === -1 ? "" : text.slice(0, lastBreak);
        const consumed = lastBreak === -1 ? 0 : Buffer.byteLength(text.slice(0, lastBreak + 1), "utf8");
        const lines = [];
        let number = 0;
        for (const raw of complete.split("\n")) {
          number += 1;
          const trimmed = raw.trim();
          if (trimmed === "")
            continue;
          try {
            lines.push({ line: number, value: JSON.parse(trimmed) });
          } catch (cause) {
            lines.push({
              line: number,
              value: null,
              error: cause instanceof Error ? cause.message : "unparseable"
            });
          }
        }
        return { lines, offset: start + consumed, restarted };
      } finally {
        await handle.close();
      }
    };
    walk = async (dir, matches) => {
      const found = [];
      const visit = async (current) => {
        let entries;
        try {
          entries = await readdir(current, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : 1)) {
          const path = join(current, entry.name);
          if (entry.isDirectory())
            await visit(path);
          else if (entry.isFile() && matches(entry.name))
            found.push(path);
        }
      };
      await visit(dir);
      return found.sort();
    };
    exists = async (path) => {
      try {
        await stat(path);
        return true;
      } catch {
        return false;
      }
    };
  }
});

// ../../packages/readers/dist/claude-code.js
import { homedir } from "node:os";
import { join as join2 } from "node:path";
var CLAUDE_CODE_SURFACE, NOT_A_REGION, defaultClaudeDir, classify, toEvent, keyOf, withinWindow, readClaudeCode, readClaudeCodeIncremental;
var init_claude_code = __esm({
  "../../packages/readers/dist/claude-code.js"() {
    "use strict";
    init_jsonl();
    init_types3();
    CLAUDE_CODE_SURFACE = "claude-code";
    NOT_A_REGION = /* @__PURE__ */ new Set(["not_available", "unknown", ""]);
    defaultClaudeDir = () => process.env["BUAI_CLAUDE_DIR"] ?? join2(process.env["CLAUDE_CONFIG_DIR"] ?? join2(homedir(), ".claude"), "projects");
    classify = (value) => {
      if (typeof value !== "object" || value === null)
        return null;
      const line = value;
      if (line.type !== "assistant")
        return null;
      const model = line.message?.model;
      if (model === void 0)
        return { kind: "skip", reason: "noUsage" };
      if (model === "<synthetic>")
        return { kind: "skip", reason: "synthetic" };
      if (line.isApiErrorMessage === true)
        return { kind: "skip", reason: "apiError" };
      if (!line.message?.usage)
        return { kind: "skip", reason: "noUsage" };
      return { kind: "count", line };
    };
    toEvent = (line, file) => {
      const usage = line.message?.usage ?? {};
      const details = usage.output_tokens_details;
      const thinking = details === null ? null : details?.thinking_tokens === null ? null : typeof details?.thinking_tokens === "number" ? details.thinking_tokens : null;
      const serverTools = usage.server_tool_use ?? {};
      const toolCalls = Object.values(serverTools).reduce((total, count) => total + (count ?? 0), 0);
      const tokens = {
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
        cachedRead: usage.cache_read_input_tokens ?? 0,
        cachedWrite: usage.cache_creation_input_tokens ?? 0,
        thinking,
        estimated: false,
        estimator: "provider"
      };
      const geo = usage.inference_geo;
      const regionHint = geo && !NOT_A_REGION.has(geo) ? geo.toUpperCase() : void 0;
      return {
        id: `${line.message?.id ?? "unknown"}:${line.requestId ?? "no-request"}`,
        surface: CLAUDE_CODE_SURFACE,
        hosting: "cloud",
        modelRaw: line.message?.model ?? "",
        modelId: null,
        tokens,
        timestamp: line.timestamp ?? "",
        sessionId: line.sessionId,
        ...regionHint ? { regionHint } : {},
        meta: {
          file,
          ...toolCalls > 0 ? { serverToolCalls: toolCalls } : {},
          ...line.isSidechain ? { sidechain: true } : {},
          ...line.cwd ? { project: line.cwd } : {},
          ...line.gitBranch ? { branch: line.gitBranch } : {}
        }
      };
    };
    keyOf = (line) => `${line.message?.id ?? "no-id"}:${line.requestId ?? "no-request"}`;
    withinWindow = (event, options) => {
      if (options.since && event.timestamp < options.since)
        return false;
      if (options.until && event.timestamp > options.until)
        return false;
      if (options.sessionId && event.sessionId !== options.sessionId)
        return false;
      return true;
    };
    readClaudeCode = async (options = {}) => {
      const dir = options.dir ?? defaultClaudeDir();
      const warnings = [];
      const skipped = { synthetic: 0, apiError: 0, duplicate: 0, noUsage: 0 };
      if (!await exists(dir)) {
        return {
          events: [],
          warnings: [{ file: dir, message: "No Claude Code transcripts here. Nothing to report." }],
          files: [],
          skipped
        };
      }
      const files = await walk(dir, (name) => name.endsWith(".jsonl"));
      const byKey = /* @__PURE__ */ new Map();
      for (const file of files) {
        for await (const { line, value, error } of readJsonl(file)) {
          if (error) {
            warnings.push({ file, line, message: `Could not parse this line, so it was skipped: ${error}` });
            continue;
          }
          const verdict = classify(value);
          if (verdict === null)
            continue;
          if (verdict.kind === "skip") {
            skipped[verdict.reason] += 1;
            continue;
          }
          const key = keyOf(verdict.line);
          if (byKey.has(key))
            skipped.duplicate += 1;
          byKey.set(key, toEvent(verdict.line, file));
        }
      }
      const events = [...byKey.values()].filter((event) => withinWindow(event, options)).sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1);
      return { events, warnings, files, skipped };
    };
    readClaudeCodeIncremental = async (path, state = emptyIncrementalState()) => {
      const { lines, offset, restarted } = await readJsonlSince(path, state.offset);
      const seen = restarted ? {} : { ...state.seen };
      const added = [];
      const superseded = [];
      for (const { value } of lines) {
        const verdict = classify(value);
        if (verdict === null || verdict.kind === "skip")
          continue;
        const key = keyOf(verdict.line);
        if (seen[key] !== void 0)
          superseded.push(key);
        seen[key] = (seen[key] ?? 0) + 1;
        added.push(toEvent(verdict.line, path));
      }
      return { added, superseded, state: { offset, seen } };
    };
  }
});

// ../../packages/readers/dist/codex.js
import { homedir as homedir2 } from "node:os";
import { basename, join as join3 } from "node:path";
var CODEX_SURFACE, defaultCodexDir, difference, isEmpty, toTokens, withinWindow2, readCodexRollout, readCodex;
var init_codex = __esm({
  "../../packages/readers/dist/codex.js"() {
    "use strict";
    init_jsonl();
    CODEX_SURFACE = "codex-cli";
    defaultCodexDir = () => process.env["CODEX_HOME"] ?? join3(homedir2(), ".codex");
    difference = (current, previous) => {
      const at = (usage, key) => usage[key] ?? 0;
      const keys = [
        "input_tokens",
        "cached_input_tokens",
        "cache_write_input_tokens",
        "output_tokens",
        "reasoning_output_tokens"
      ];
      const result3 = {};
      for (const key of keys) {
        result3[key] = Math.max(0, at(current, key) - at(previous, key));
      }
      return result3;
    };
    isEmpty = (usage) => (usage.input_tokens ?? 0) === 0 && (usage.output_tokens ?? 0) === 0 && (usage.cached_input_tokens ?? 0) === 0 && (usage.cache_write_input_tokens ?? 0) === 0;
    toTokens = (usage) => {
      const cachedRead = usage.cached_input_tokens ?? 0;
      const reasoning = usage.reasoning_output_tokens ?? 0;
      return {
        // Both of these are subsets of the figure they sit inside, so they come out
        // of it rather than being added on top.
        input: Math.max(0, (usage.input_tokens ?? 0) - cachedRead),
        output: Math.max(0, (usage.output_tokens ?? 0) - reasoning),
        cachedRead,
        cachedWrite: usage.cache_write_input_tokens ?? 0,
        thinking: reasoning,
        estimated: false,
        estimator: "provider"
      };
    };
    withinWindow2 = (event, options) => {
      if (options.since && event.timestamp < options.since)
        return false;
      if (options.until && event.timestamp > options.until)
        return false;
      if (options.sessionId && event.sessionId !== options.sessionId)
        return false;
      return true;
    };
    readCodexRollout = async (file, warnings, skipped) => {
      const events = [];
      const sessionId = basename(file).replace(/^rollout-/, "").replace(/\.jsonl$/, "");
      let model = null;
      let previousTotal = {};
      let turn = 0;
      for await (const { line, value, error } of readJsonl(file)) {
        if (error) {
          warnings.push({ file, line, message: `Could not parse this line, so it was skipped: ${error}` });
          continue;
        }
        if (typeof value !== "object" || value === null)
          continue;
        const entry = value;
        const payload2 = entry.payload;
        if (!payload2)
          continue;
        if (entry.type === "turn_context" || payload2.type === "turn_context") {
          if (typeof payload2.model === "string")
            model = payload2.model;
          continue;
        }
        const isTokenCount = payload2.type === "token_count" || entry.type === "token_count";
        if (!isTokenCount)
          continue;
        const info = payload2.info ?? payload2;
        const last = info.last_token_usage;
        const total = info.total_token_usage;
        let usage = null;
        let basis = "per-turn";
        if (last && !isEmpty(last)) {
          usage = last;
        } else if (total) {
          usage = difference(total, previousTotal);
          basis = "differenced";
        }
        if (total)
          previousTotal = total;
        if (!usage || isEmpty(usage)) {
          skipped.noUsage += 1;
          continue;
        }
        turn += 1;
        events.push({
          id: `${sessionId}:${turn}`,
          surface: CODEX_SURFACE,
          hosting: "cloud",
          modelRaw: model ?? "",
          modelId: null,
          tokens: toTokens(usage),
          timestamp: entry.timestamp ?? "",
          sessionId,
          meta: { file, basis, turn }
        });
      }
      return events;
    };
    readCodex = async (options = {}) => {
      const home = options.dir ?? defaultCodexDir();
      const warnings = [];
      const skipped = { synthetic: 0, apiError: 0, duplicate: 0, noUsage: 0 };
      const roots = [join3(home, "sessions"), join3(home, "archived_sessions")];
      const files = [];
      for (const root of roots) {
        if (await exists(root))
          files.push(...await walk(root, (name) => name.endsWith(".jsonl")));
      }
      if (files.length === 0) {
        return {
          events: [],
          warnings: [
            {
              file: home,
              message: "No Codex CLI rollouts here. Note that rollouts written before 6 September 2025 carry no token counts at all."
            }
          ],
          files: [],
          skipped
        };
      }
      const events = [];
      for (const file of files)
        events.push(...await readCodexRollout(file, warnings, skipped));
      const filtered = events.filter((event) => withinWindow2(event, options)).sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1);
      return { events: filtered, warnings, files, skipped };
    };
  }
});

// ../../packages/readers/dist/index.js
var init_dist3 = __esm({
  "../../packages/readers/dist/index.js"() {
    "use strict";
    init_types3();
    init_jsonl();
    init_claude_code();
    init_codex();
  }
});

// ../cli-ts/src/log.ts
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { join as join4 } from "node:path";
var LOG_VERSION, defaultLogDir, defaultOutDir, monthOf, sortKeys, toLine, serialise, fromLine, isLine, monthFiles, readLog, appendLog, logSize, LOG_WARN_BYTES, pruneLog;
var init_log = __esm({
  "../cli-ts/src/log.ts"() {
    "use strict";
    LOG_VERSION = 1;
    defaultLogDir = () => process.env["BUAI_LOG_DIR"] ?? join4(process.env["CLAUDE_CONFIG_DIR"] ?? join4(homedir3(), ".claude"), "betteruseofai", "log");
    defaultOutDir = (logDir) => join4(logDir, "..");
    monthOf = (timestamp) => timestamp.slice(0, 7);
    sortKeys = (value) => {
      if (Array.isArray(value)) return value.map(sortKeys);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).filter(([, item]) => item !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sortKeys(item)])
        );
      }
      return value;
    };
    toLine = (event, recorded) => {
      const tokens = event.tokens;
      const line = {
        v: LOG_VERSION,
        id: event.id,
        ts: event.timestamp,
        recorded,
        surface: event.surface,
        hosting: event.hosting,
        model: event.modelRaw,
        tokens: {
          input: tokens.input ?? 0,
          output: tokens.output ?? 0,
          cachedRead: tokens.cachedRead ?? 0,
          cachedWrite: tokens.cachedWrite ?? 0
        }
      };
      if (tokens.thinking !== void 0) line.tokens.thinking = tokens.thinking;
      if (tokens.tool) line.tokens.tool = tokens.tool;
      if (tokens.estimated) {
        line.tokens.estimated = true;
        line.tokens.estimator = tokens.estimator;
      }
      if (event.sessionId) line.session = event.sessionId;
      if (event.regionHint) line.region = event.regionHint;
      const project = event.meta?.["project"];
      if (typeof project === "string" && project) line.project = project;
      const branch = event.meta?.["branch"];
      if (typeof branch === "string" && branch) line.branch = branch;
      return line;
    };
    serialise = (line) => JSON.stringify(sortKeys(line));
    fromLine = (line, file) => {
      const tokens = {
        input: line.tokens.input,
        output: line.tokens.output,
        cachedRead: line.tokens.cachedRead,
        cachedWrite: line.tokens.cachedWrite,
        estimated: line.tokens.estimated === true,
        estimator: line.tokens.estimator ?? "provider"
      };
      if ("thinking" in line.tokens) tokens.thinking = line.tokens.thinking;
      if (line.tokens.tool) tokens.tool = line.tokens.tool;
      return {
        id: line.id,
        surface: line.surface,
        hosting: line.hosting,
        modelRaw: line.model,
        modelId: null,
        tokens,
        timestamp: line.ts,
        ...line.session ? { sessionId: line.session } : {},
        ...line.region ? { regionHint: line.region } : {},
        meta: {
          file,
          fromLog: true,
          ...line.project ? { project: line.project } : {},
          ...line.branch ? { branch: line.branch } : {}
        }
      };
    };
    isLine = (value) => typeof value === "object" && value !== null && value.v === LOG_VERSION && typeof value.id === "string" && typeof value.ts === "string" && typeof value.tokens === "object";
    monthFiles = (dir) => {
      if (!existsSync(dir)) return [];
      return readdirSync(dir).filter((name) => /^\d{4}-\d{2}\.jsonl$/.test(name)).sort().map((name) => join4(dir, name));
    };
    readLog = (dir) => {
      const byId = /* @__PURE__ */ new Map();
      let duplicates = 0;
      let skipped = 0;
      let bytes = 0;
      const files = monthFiles(dir);
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        bytes += Buffer.byteLength(text, "utf8");
        for (const raw of text.split("\n")) {
          const trimmed = raw.trim();
          if (trimmed === "") continue;
          let value;
          try {
            value = JSON.parse(trimmed);
          } catch {
            skipped += 1;
            continue;
          }
          if (!isLine(value)) {
            skipped += 1;
            continue;
          }
          if (byId.has(value.id)) duplicates += 1;
          byId.set(value.id, fromLine(value, file));
        }
      }
      const events = [...byId.values()].sort(
        (a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1
      );
      return { events, duplicates, skipped, files: files.length, bytes };
    };
    appendLog = (dir, events, recorded) => {
      if (events.length === 0) return 0;
      mkdirSync(dir, { recursive: true });
      const byMonth = /* @__PURE__ */ new Map();
      for (const event of events) {
        const month = monthOf(event.timestamp);
        if (!/^\d{4}-\d{2}$/.test(month)) continue;
        const lines = byMonth.get(month) ?? [];
        lines.push(serialise(toLine(event, recorded)));
        byMonth.set(month, lines);
      }
      let written = 0;
      for (const [month, lines] of [...byMonth.entries()].sort()) {
        appendFileSync(join4(dir, `${month}.jsonl`), `${lines.join("\n")}
`, "utf8");
        written += lines.length;
      }
      return written;
    };
    logSize = (dir) => {
      const files = monthFiles(dir);
      return { files: files.length, bytes: files.reduce((total, file) => total + statSync(file).size, 0) };
    };
    LOG_WARN_BYTES = 200 * 1024 * 1024;
    pruneLog = (dir, before, dryRun) => {
      const files = monthFiles(dir);
      const before_ = before ?? "";
      let removed = 0;
      let duplicates = 0;
      let kept = 0;
      let bytesBefore = 0;
      let bytesAfter = 0;
      let filesAfter = 0;
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        bytesBefore += Buffer.byteLength(text, "utf8");
        const last = /* @__PURE__ */ new Map();
        for (const raw of text.split("\n")) {
          const trimmed = raw.trim();
          if (trimmed === "") continue;
          let value;
          try {
            value = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (!isLine(value)) continue;
          if (last.has(value.id)) duplicates += 1;
          last.set(value.id, value);
        }
        const survivors = [...last.values()].filter((line) => {
          const keep = before_ === "" || line.ts >= before_;
          if (!keep) removed += 1;
          return keep;
        });
        kept += survivors.length;
        if (survivors.length > 0) {
          const out2 = `${survivors.map(serialise).join("\n")}
`;
          bytesAfter += Buffer.byteLength(out2, "utf8");
          filesAfter += 1;
          if (!dryRun) writeFileSync(file, out2, "utf8");
        } else if (!dryRun) {
          rmSync(file);
        }
      }
      return { removed, duplicates, kept, filesBefore: files.length, filesAfter, bytesBefore, bytesAfter };
    };
  }
});

// ../cli-ts/src/context.ts
var context_exports = {};
__export(context_exports, {
  buildContext: () => buildContext,
  loadDataset: () => loadDataset,
  loadEvents: () => loadEvents
});
import { join as join5 } from "node:path";
var loadDataset, WATER_SCOPES, buildContext, SURFACE_OF, loadEvents;
var init_context = __esm({
  "../cli-ts/src/context.ts"() {
    "use strict";
    init_dist2();
    init_dist();
    init_dist3();
    init_args();
    init_log();
    loadDataset = () => dist_default;
    WATER_SCOPES = ["on-site", "on-site + off-site", "lifecycle"];
    buildContext = (args) => {
      const errors = [];
      const nowFlag = flagString(args.flags, "now");
      const now = nowFlag ? new Date(nowFlag) : /* @__PURE__ */ new Date();
      if (Number.isNaN(now.getTime())) errors.push(`--now is not a date I can read: ${nowFlag}`);
      const scopeFlag = flagString(args.flags, "water-scope");
      if (scopeFlag && !WATER_SCOPES.includes(scopeFlag)) {
        errors.push(`--water-scope must be one of: ${WATER_SCOPES.join(", ")}`);
      }
      const basisFlag = flagString(args.flags, "carbon-basis");
      if (basisFlag && basisFlag !== "location-based" && basisFlag !== "provider-reported") {
        errors.push("--carbon-basis must be location-based or provider-reported.");
      }
      const requested = flagString(args.flags, "source");
      const sources = requested ? requested.split(",").map((one) => one.trim()) : ["claude-code", "codex"];
      for (const source of sources) {
        if (source !== "claude-code" && source !== "codex") {
          errors.push(`--source must be claude-code or codex, or both separated by a comma. Got: ${source}`);
        }
      }
      const dataset2 = loadDataset();
      const regionCode = flagString(args.flags, "region");
      if (regionCode && !dataset2.regions.some((region) => region.code === regionCode)) {
        errors.push(
          `We have no grid figures for the region "${regionCode}". Run "betteruseofai models --all" to see the list.`
        );
      }
      const logFlag = flagString(args.flags, "log");
      const logOn = !flagBool(args.flags, "no-log") && (logFlag !== void 0 || Boolean(process.env["BUAI_LOG_DIR"]) || flagString(args.flags, "dir") === void 0);
      return {
        context: {
          dataset: dataset2,
          now,
          regionCode,
          waterScope: scopeFlag ?? "on-site + off-site",
          carbonBasis: basisFlag ?? "location-based",
          since: resolveSince(flagString(args.flags, "since"), now),
          until: flagString(args.flags, "until"),
          json: flagBool(args.flags, "json") || flagString(args.flags, "format") === "json",
          // NO_COLOR is the convention (no-color.org): any value at all switches
          // colour off, and so does a pipe, and so does the flag.
          colour: !flagBool(args.flags, "no-color") && !(process.env["NO_COLOR"] ?? "") && process.stdout.isTTY === true,
          ascii: flagBool(args.flags, "ascii"),
          sources,
          logDir: logOn ? logFlag ?? defaultLogDir() : null
        },
        errors
      };
    };
    SURFACE_OF = { "claude-code": "claude-code", codex: "codex-cli" };
    loadEvents = async (context, args) => {
      const dir = flagString(args.flags, "dir");
      const options = {
        ...context.since ? { since: context.since } : {},
        ...context.until ? { until: context.until } : {}
      };
      const results = [];
      if (context.sources.includes("claude-code")) {
        results.push(await readClaudeCode({ ...options, ...dir ? { dir: join5(dir, "projects") } : {} }));
      }
      if (context.sources.includes("codex")) {
        results.push(await readCodex({ ...options, ...dir ? { dir } : {} }));
      }
      const fromTranscripts = results.flatMap((result3) => result3.events);
      const log = { enabled: context.logDir !== null, fromLogOnly: 0, appended: 0, files: 0, bytes: 0 };
      let logOnly = [];
      if (context.logDir) {
        const stored = readLog(context.logDir);
        const known = new Set(stored.events.map((event) => event.id));
        const missing = fromTranscripts.filter((event) => !known.has(event.id));
        log.appended = appendLog(context.logDir, missing, context.now.toISOString());
        const seen = new Set(fromTranscripts.map((event) => event.id));
        const surfaces = new Set(context.sources.map((source) => SURFACE_OF[source] ?? source));
        logOnly = stored.events.filter(
          (event) => !seen.has(event.id) && surfaces.has(event.surface) && (!context.since || event.timestamp >= context.since) && (!context.until || event.timestamp <= context.until)
        );
        log.fromLogOnly = logOnly.length;
        const size = logSize(context.logDir);
        log.files = size.files;
        log.bytes = size.bytes;
      }
      const events = [...fromTranscripts, ...logOnly].sort(
        (a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1
      );
      const estimates = events.map(
        (event) => estimate(event, {
          dataset: context.dataset,
          ...context.regionCode ? { regionCode: context.regionCode } : {},
          waterScope: context.waterScope,
          carbonBasis: context.carbonBasis
        })
      );
      return {
        events,
        estimates,
        pairs: events.map((event, index) => ({ event, estimate: estimates[index] })),
        readers: results,
        log
      };
    };
  }
});

// ../cli-ts/src/commands/statusline.ts
var statusline_exports = {};
__export(statusline_exports, {
  hook: () => hook,
  linePath: () => linePath,
  parseStdinJson: () => parseStdinJson,
  readCheapLine: () => readCheapLine,
  readStdin: () => readStdin,
  refreshSession: () => refreshSession,
  stateDir: () => stateDir,
  statusline: () => statusline
});
import { mkdirSync as mkdirSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { homedir as homedir4 } from "node:os";
import { dirname as dirname2, join as join7 } from "node:path";
var stateDir, safeName, cachePath, linePath, readCheapLine, writeLine, readCache, writeCache, refreshSession, readStdin, parseStdinJson, statusline, hook;
var init_statusline = __esm({
  "../cli-ts/src/commands/statusline.ts"() {
    "use strict";
    init_dist();
    init_dist3();
    init_args();
    init_log();
    stateDir = () => process.env["BUAI_STATE_DIR"] ?? join7(process.env["CLAUDE_PLUGIN_DATA"] ?? join7(homedir4(), ".claude"), "betteruseofai", "state");
    safeName = (sessionId) => sessionId.replace(/[^A-Za-z0-9_-]/g, "_");
    cachePath = (sessionId) => join7(stateDir(), `${safeName(sessionId)}.json`);
    linePath = (sessionId) => join7(stateDir(), `${safeName(sessionId)}.line`);
    readCheapLine = (sessionId) => {
      try {
        return readFileSync2(linePath(sessionId), "utf8").trimEnd();
      } catch {
        return null;
      }
    };
    writeLine = (sessionId, line) => {
      try {
        mkdirSync3(stateDir(), { recursive: true });
        writeFileSync3(linePath(sessionId), `${line}
`, "utf8");
      } catch {
      }
    };
    readCache = (sessionId) => {
      try {
        return JSON.parse(readFileSync2(cachePath(sessionId), "utf8"));
      } catch {
        return { state: { offset: 0, seen: {} }, events: {}, updated: "" };
      }
    };
    writeCache = (sessionId, cached) => {
      const path = cachePath(sessionId);
      mkdirSync3(dirname2(path), { recursive: true });
      writeFileSync3(path, JSON.stringify(cached), "utf8");
    };
    refreshSession = async (context, sessionId, transcriptPath) => {
      const cached = readCache(sessionId);
      const { added, state } = await readClaudeCodeIncremental(transcriptPath, cached.state);
      const events = { ...cached.events };
      for (const event of added) events[event.id] = event;
      writeCache(sessionId, { state, events, updated: context.now.toISOString() });
      try {
        appendLog(defaultLogDir(), added, context.now.toISOString());
      } catch {
      }
      const list = Object.values(events).sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
      return {
        turns: list.length,
        events: list,
        estimates: list.map(
          (event) => estimate(event, {
            dataset: context.dataset,
            ...context.regionCode ? { regionCode: context.regionCode } : {},
            waterScope: context.waterScope,
            carbonBasis: context.carbonBasis
          })
        )
      };
    };
    readStdin = async () => {
      if (process.stdin.isTTY) return "";
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      return Buffer.concat(chunks).toString("utf8");
    };
    parseStdinJson = (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return null;
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    };
    statusline = async (context, args) => {
      const input = parseStdinJson(await readStdin());
      if (!input?.session_id || !input.transcript_path) {
        return "";
      }
      const ascii = context.ascii || flagBool(args.flags, "ascii");
      const totals = await refreshSession(context, input.session_id, input.transcript_path);
      if (totals.turns === 0) return "";
      const [rolled] = aggregate(
        totals.events.map((event, index) => ({ event, estimate: totals.estimates[index] })),
        "all"
      );
      if (!rolled) return "";
      const parts = [];
      parts.push(
        formatRange(rolled.energyWh, { unit: "Wh", bounds: false, flags: rolled.flags, ascii })
      );
      for (const [value, unit] of [
        [rolled.waterMl, "mL"],
        [rolled.carbonG, "g"]
      ]) {
        if (!value) continue;
        const scaled = scaleUnit(value.central, unit);
        parts.push(`${displayNumber(scaled.value)} ${scaled.unit}`);
      }
      const byModel = Object.entries(rolled.byModel).sort((a, b) => b[1] - a[1]);
      const top = byModel[0];
      if (top && byModel.length > 0) {
        const name = getModel(top[0], context.dataset)?.displayName ?? top[0];
        parts.push(`${name} ${Math.round(top[1] / rolled.count * 100)}%`);
      }
      const window = input.context_window;
      if (window?.used_tokens && window.max_tokens) {
        parts.push(`ctx ${Math.round(window.used_tokens / window.max_tokens * 100)}%`);
      }
      const line = parts.join(" \xB7 ");
      writeLine(input.session_id, line);
      return line;
    };
    hook = async (context, args) => {
      const event = args.positional[0] ?? "";
      const input = parseStdinJson(await readStdin());
      const say = (message) => JSON.stringify(message === null ? {} : { systemMessage: message });
      if (!input?.session_id || !input.transcript_path) return say(null);
      if (event === "Stop") {
        const totals = await refreshSession(context, input.session_id, input.transcript_path);
        if (totals.turns === 0) return say(null);
        const [rolled] = aggregate(
          totals.events.map((one, index) => ({ event: one, estimate: totals.estimates[index] })),
          "all"
        );
        if (!rolled) return say(null);
        const cached = [
          formatRange(rolled.energyWh, { unit: "Wh", bounds: false, flags: rolled.flags, ascii: true })
        ];
        for (const [value, unit] of [
          [rolled.waterMl, "mL"],
          [rolled.carbonG, "g"]
        ]) {
          if (!value) continue;
          const scaled = scaleUnit(value.central, unit);
          cached.push(`${displayNumber(scaled.value)} ${scaled.unit}`);
        }
        writeLine(input.session_id, cached.join(" \xB7 "));
        if (rolled.count % 10 !== 0) return say(null);
        const byModel = Object.entries(rolled.byModel).sort((a, b) => b[1] - a[1]);
        const top = byModel[0];
        const share = top ? ` \xB7 ${Math.round(top[1] / rolled.count * 100)}% ${getModel(top[0], context.dataset)?.displayName ?? top[0]}` : "";
        return say(
          `Session so far: ${cached.join(", ")} across ${rolled.count} turns${share}`
        );
      }
      if (event === "UserPromptSubmit") {
        const prompt = input.prompt ?? "";
        if (prompt.trim() === "") return say(null);
        const recommender = createRecommender({
          dataset: context.dataset,
          hintThreshold: 0.75,
          muted: ["no-llm.arithmetic", "no-llm.unit-conversion", "downgrade.short-simple"]
        });
        const advice = recommender.recommend({
          prompt,
          modelId: input.model?.id ?? null,
          surface: "claude-code"
        });
        if (!advice.showAsHint) return say(null);
        const saving2 = advice.estimatedSavings?.energyWh;
        if (!saving2) return say(advice.explanation);
        return say(`${advice.explanation} That would save roughly ${displayNumber(saving2.central)} Wh.`);
      }
      if (event === "PostModelSwitch" || event === "SessionStart") {
        return say(null);
      }
      return say(null);
    };
  }
});

// ../cli-ts/src/run.ts
init_args();

// ../cli-ts/src/commands/dashboard.ts
init_dist();
init_args();
init_context();
import { spawn } from "node:child_process";
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname, isAbsolute, join as join6, resolve } from "node:path";

// ../cli-ts/src/generated/dashboard-template.ts
var DASHBOARD_TEMPLATE = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="referrer" content="no-referrer" />
    <title>What your sessions have cost</title>
    <!--
      A single file, written by the betteruseofai command line tool on your own
      machine. The styles, the fonts and the script are all inside it, and the
      data is in the JSON block near the bottom. Opening it fetches nothing from
      anywhere. Run "betteruseofai dashboard" again to bring it up to date.
    -->
    <style>
/*
 * Design tokens. Generated from tokens.json by scripts/build-tokens.mjs.
 * Edit the JSON, not this file; the test fails when the two disagree.
 *
 * Light first. The ground is a warm off-white rather than pure white, so the
 * page reads as paper and the hairlines have something to sit on. One accent,
 * a dark green, carries links, buttons and the central mark on every readout.
 * Nothing is rounded. There are no colour gradients; the hatching, the ruled
 * paper grid and the landing scrim are structure and legibility, and each one
 * is named in tokens.json under "gradients" so the test can count them. The
 * register we are after is an instrument panel, not a launch page.
 *
 * Every contrast pair below is asserted by test/contrast.test.ts. If a colour
 * drifts, that test fails rather than a comment going stale.
 */

:root {
  color-scheme: light;

  /* ground, text, the one accent, states, structure */
  --bg: #eeece9;
  --bg-raised: #f6f5f2;
  --bg-sunken: #e4e1dc;
  --ink: #14201a;
  --ink-2: #1b2a21;
  --muted: #5a655e;
  --accent: #0f6b3a;
  --accent-strong: #0a5c31;
  --accent-tint: #d3e3d8;
  --hazard: #9a4b00;
  --danger: #a3251c;
  --hairline: #cfcbc4;
  --border-ui: #6b756f;

  /* nothing is rounded */
  --radius: 0;

  /* type */
  --font-display: 'Big Shoulders', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif;
  --font-body: 'Schibsted Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;

  /* fluid scale, 320px to 1440px */
  --step--2: clamp(0.6875rem, 0.67rem + 0.09vw, 0.75rem);
  --step--1: clamp(0.8125rem, 0.79rem + 0.11vw, 0.875rem);
  --step-0: clamp(1rem, 0.97rem + 0.15vw, 1.0625rem);
  --step-1: clamp(1.1875rem, 1.13rem + 0.28vw, 1.375rem);
  --step-2: clamp(1.4375rem, 1.33rem + 0.53vw, 1.8125rem);
  --step-3: clamp(1.75rem, 1.55rem + 1vw, 2.4375rem);
  --step-4: clamp(2.125rem, 1.75rem + 1.86vw, 3.375rem);
  --step-5: clamp(3.5rem, 1.9rem + 8vw, 8.5rem);

  /* rhythm */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4.5rem;
  --space-9: 7rem;

  --measure: 62ch;
  --gutter: clamp(1rem, 4vw, 3rem);
  --rule: 1px;

  /* motion, all of it short */
  --tempo-fast: 120ms;
  --tempo: 200ms;
  --tempo-slow: 320ms;
  --ease: cubic-bezier(0.2, 0, 0.1, 1);
}

/* Dark is the secondary theme, so it inverts the roles rather than restating them. */
:root[data-theme='dark'] {
  color-scheme: dark;

  --bg: #121412;
  --bg-raised: #1a1d1a;
  --bg-sunken: #0c0e0c;
  --ink: #e6e3dc;
  --ink-2: #d9d6cf;
  --muted: #9aa39d;
  --accent: #3ddc84;
  --accent-strong: #6fe3a0;
  --accent-tint: #183824;
  --hazard: #f5a524;
  --danger: #ff6b61;
  --hairline: #2a2f2b;
  --border-ui: #8f9892;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;

    --bg: #121412;
    --bg-raised: #1a1d1a;
    --bg-sunken: #0c0e0c;
    --ink: #e6e3dc;
    --ink-2: #d9d6cf;
    --muted: #9aa39d;
    --accent: #3ddc84;
    --accent-strong: #6fe3a0;
    --accent-tint: #183824;
    --hazard: #f5a524;
    --danger: #ff6b61;
    --hairline: #2a2f2b;
    --border-ui: #8f9892;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --tempo-fast: 0ms;
    --tempo: 0ms;
    --tempo-slow: 0ms;
  }
}

/*
 * Self-hosted faces. Nothing here reaches a font CDN, which is why the privacy
 * page can say the site makes no third-party requests beyond the one analytics
 * beacon.
 *
 * Six faces, 116 kB, latin subset. Fewer weights than we first planned; see the
 * note in scripts/copy-fonts.mjs for what was dropped and why.
 */

@font-face {
  font-family: 'Big Shoulders';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('data:font/woff2;base64,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') format('woff2');
}

@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('data:font/woff2;base64,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') format('woff2');
}

@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url('data:font/woff2;base64,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') format('woff2');
}

@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('data:font/woff2;base64,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') format('woff2');
}

@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('data:font/woff2;base64,d09GMgABAAAAADl0ABEAAAAAoSAAADkQAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGkwbhlIchlYGYACEWAhACYJzERAKgookgetwC4QyAAE2AiQDiGAEIAWDOgeJaQyDNBuPjiXK7ZMCdAeAD68sLSjYNundjkTR3nNoNDKCjQOAInu97P+/JVdjCJwDXssGi7RT4d0UwZnUNdUwngYdnIhTjm3xpqZBorepuK3epk0zfJa4FPNnVGS4lHCoehdRll7Qn31wcTmIpZXxTzgcttddaS+/XhLlMX94Qqag4o209rojNPZJLpfgeZvavL8yHtMqgCg7SFKAHQCujzvAkiql0xE0bYCrQ/L+PJ7+n5t0GaAMctdBzig8UXmwi48BmtN/2iRYMI0TURKifhdRIhchSAhBtIJJ9ZfKK9Xt14RuVAUY20p9UhGZeW1av9T17kr2/z9vpbkqqVOlBKq4Ipbh7COfM+NMPOmB7FYqmhBU4RJbxitd/dsD0oxmNCNYrWAk3mXt3fLx3gfA6NsOEuCIIzt65SDyy174HRKGnyo3hc7sIPIjnv5i+/4Bn9nR6elBSTNNYUVxoE1gTRSIvQYEyBJ4pUv3Uu7Od0aEA88rJAOpTJcUndOaQW8ixADPLlR4ySq0QQpjlgGyMASuRk75f+sv5fn/7vlt+BBO1loBBgcs4WQE5glGlEFwll/BGX5/qXYIcWtbWhJDo0Jbq2ft+yA90P9aOnv/Hp+SvlR9jlKF+zdrTspNcqmbZGfiKF3VZktXwWg04zMIiVCRKKzl53Waq75dHcNWoP1uWApIW28vPH0psawvGVi2dXbCjg9kCINTYnIIz3VKhCPBMAFPU9eReOqwzvX/W+oX7ftKrZ7Z3JK9wn1qUwJQznQmUxPYfnpW/VapVP4+PZO1KWlzcKlaPrIke2KiG9EClNjCxQvYEraYDBzi6cdaXlwSyU5KxGrC/9w9LNp0onfzTmnUQkgM/ULOTAf6r101d7eyGYRW3t8EjajxZb90LyB43KGNTGlUZP2a/4nT2qfgQmg8NTRVZPqVZZQMIbzjtNdbxvS/z+3l81a3xUFLBGQlDGl/IIC7AUiEIOusCBvIkFPIpELmFLJcITsUcvK/ogDUBnj4kQmHgHYsyfBK5/zljC89h/Ygb5Ej+8hgAIp3MWwp0QrIcv6BzEuxSAR/icXfEBhAEIDiYWRA8RER1omBf7z0s3deeOQO2h0XnXbUfu/c6XV/ZKfN1lpuzkRiQEMTPR5ttmlAjL07qpS8luZ5BMXP0rj6aYLjVbsU6gckrEzGNXa4wBZDvIiZXUrbrwAGJ6x5VVCKPrsQ7DnDNWrKA4wItANKuKUEAk6AoBIlcyDHhlhlrWmDwgzmsIDl11oRBSZZ4TGrCBTTQkG+xwNQE0C0IAeIzvFasOFU5wvFDYvGqgybF5vHeHexkQzs2oXteVlus58KDRIHmH0sT4bpW/uJlcXZnVC8AF7+0wkdydhiiFt8ggW+hylcrPAMXsUBRxiscUKtNspxMyyB8AO9kBQXIUGQNKNhKRM29ILmECAhmB9Q2BvT1Ej7tfYrpouik/MRICzsOMLAT+itgAxBkMiWLXsPSHyZw3Xf/r2iq36eijUIncPj6N5D/NkCEhxaDDE4byAifTW+lcybPTGowXvHSCFMmktapEdGZJK6JEQ4LMQQR863kyMyVnFvnDALg9hyAx0o8E0E2gwtRzh9UjBiCD/AZHB1ENURgyYlUoR8DySfQZx5mkIUJ6v9SJwYogYi2DKlS40cMd/kpQ8E8pYRxyCaoilEVclYek/WviYOPE0h6u6QMGdMnzZ1yuShxAvnj8WRJUOafkopbr5mr/2iuPhUFemdculNcaRXmZCXDrGXpSmaoimaoimaoilEBRCCHdp24MiJCwLImniiCBypdS0FBNAEYTRqXxgGFTbARTsp7WJkFaeXoCocyPgQw5GCCAchTVrqEBhsh8JSmgiBgp3FcTLEigUHLChibiJBjoCoIwL3mz6MFfhAej4FgXnsX0Ws5xxRawKWlmNhAlj2I7AdGACAOeuCfMpJ0GOmU/7/PSgFGmyMQa8BUgn/BsjhQAIy4GE4BDyMkZ4FOjHxIYB7mHHAFC9NnSb/T9mGN02kc+leepBNIZQ4ZJRHjWmqpmumzb65aZ4l7C0T25+XV/fI6IaP30W4B8mcI3cJKPWWhxee9JGKJWLwjPClBk3aFBu6a65fMeJIBNAMivug2AYoqkH3jG5Rd9dtwP//x8T8f+PqcMDV01XiVc1V9FXClTtX5l2JXqm6XHvZBQHMANYDO4BDakCMAkAMsc4fYlBwjf9zi4fFCVKhSxamQImSlKvmj8UHxU+ARg2aJHCXLF2KSt64pkiVLU1VssVq16lNtxy52JoUidbKQ4G/Zqh1xVUcX8jT7P+Yz4rFeOOlt+Jttclm222xzQ477bfHXvscdsBBh+x2xAlHHXPKcXVOuuCsc8676IxV+vXoNajPgCHDJowaM27WlGkzRsxbZsGiFZbUW269NdZaZ4PVTPVR37mrFFmkaPK6RZZabIllHjNJxWirzXDMIR2er485llqJuwupu2OO5titORZpjoOaU4mbPnF3usk0GLQ1tC2uXox4udaIYgFQeeZjbciG9YMbYlCed+ys1GPj4IY0qCEGlAc3ZIPyznrWu3NptWctfz73c7Y+n+/Md2zaWi/1dpjTFrqerw3N65ZVd/aFl1fL9Wm1p15LdNVqEwY3lFRoS1AIZM93SWt3MVb9PxtNg+YhwazP4uqSav3Cs0/Vp1VqT5XLeUf9K9cH9ZVcrtUKjM2FZEQ5u/Px4qIWc/MAK7Yq4Jc5fprNVHv+ec7fs1y/4LJz33M4ObSGrwZrGuhp1gZlkVnvjkZcWOzPX4DwVA/e4E21p9Z4lcENbYPmLat2VBKoHq3BAsEJvqbiHQ8Qj0MaRvTnoTtS6R+gvwD/C554A7wgO/TiiSdM4d2Rw6S1KLiJhCdRYk0IRY7MJZoxtHg0Z9lMbYWvl+0KgAaKzS+TaVhUmTC7MJfKGe4q8kx0QInOnzccYeSv4GFjY0XFZslGlK3AzrxISxYhQURn3nFV9NV1g6HhT1Wf287w29FZV0itxWQxDnqgJvfxoukPh01Ow6YYNYQrlm037tpBO5q2hJl2xapumuGwLaIpqHabG0kXlXZA6cC13GnqkNZQP2O2rlAZliSc392JNldbanoThlGc224V50ErXR251HNdbib8A0t/93OutV3onC/O5oxFF9q5m2ohC8fRTj8KQp/eK22UCoQSuSx6V2uZ9ZK2qXaM1rFe8XieUWpmURhRuJIeSibA6Ap3vmSeTaTmNjbWdzxwnqEXrJck3BP0LKwi2L27o8BhQvMw3Vti3BWAunUDaK2EN2GJkIZqWGZv7G6GB/gvUQKZg2eh7yBkQQ68ILm0PY9wfWdD9+IzAeGLIkeXRa4nzvaX/fmDGyo8ZmS5xVJZaV1dAcyHgMy7RWtyvB1mFA5vlQcs5ZMJxJTymlNd8rndRDZtTBQUdpNCT/yFEDOecL8M+nufaMahMzXZC8okgfMeIN4DTBSU1kCZycwIFK54xjVzb8twDugyB4bWK09mqhT+LbnW3Ai2AG86kdiwjTqGOBeOlcTLMnJDLBxg9gSBeQy2UyG51qXQdqcRmAVVaNpyuRi1FaEGjeGKwSzK2tE13QpowxXKmjvAihecsT0k9wZYZIiv6uVnVLY5BVk0MD0dIDOT21OjKYbz9CqPsnsZrxv+qQ1/kR7fnABmKRdYMvODyljqLbzGZW17HQODojpOGeMWkicTSRKDRYymNJTSUo1QIMdGUn9Wm6o0ReeMVn1ZM9cRfEGKSUvCjWFLxy3Z27KYyvgk5jI1gzsOLuzs53c0rTkAKgOMCEiVKcrzhxNnHjB2d00Aqnxzb8lV+Hr374k4EbLRkcSWDFm6JVFlQ9e1K3OfPJBs22BRaIxCLMpWm3D7MBO8uY3+JW6eMJn16baN2JR2Nw7GWANUDhghUXjDyAukJLCmAPIU0T5xLHEdWooVno0KnD6iXx3nR4pn4Oxa1gb4K87/vvJb+cPDiQYSBri7g0tNAndXb86xkzbjJzK9/EJcNYon+/Bih82FRXLR6lfGoRgRYvCApqrjKzcUlmtfLcTC3pH2+cl0u/hwSGWJPZJMpGwgDtqFgmXRUny51a95amC4bR0H0gmrlVi1ObPNM9MdVbRgYDj7ttZlRMngcAMQXn4UOH5O4s6mz+2K2U7A3HRg7V/7wdT8YAXq1/946FLpR+xccFSYlrBsuOmYQHOr0ZpcnkK11enDNk7uV0Hyp0L+VLp/r31e9kv5ae55B5FHrSGYgbGaV3cpf7S52jvMIrp5R6zGCX8M5k/Cp6/Z4utw+OESEd/MGctpogjJl1x7S10UO4vo+c6CMw+ArW53/oWFYPFGt6QnAS6H5jAnYUtxO3VvqKwdKprDoMDAuNzaxBaWbX32lBmTU5GkocsU1UG9vL7GlqyA5gElIle+k8FbYQb70hK1XFeueIPkaLSoVrClqeOmLFvH35SSsWID58hKGdJP1efcUDCh3IlGXV/zExnR761NmvQVIVfDe+cq/mdKxUtGuxnXPPsSBwpFrfHRPqcFfzruillsqSt0hBMBkjNo56ZfsWgJC0LtgmFZBBskKjow5zgXbIvctj4Y0q30D2cwQQhD1J1tOkB5dIGBFtSrQUJt6mGhXtPO9JXDJrQvyAvu+u8byhfBA7jfcJk1TLK0kN++st4MHTAZg5NzdLr6S2eMidzeSt8W/TIM2UEaNKHUErnyqnR9URYaRz9id91Zh/5+REru/5wCZD0o2PvZ2tFL7rDlT85SFo5aZa7z93y0/g9nh8uelOyd3jd7ABfvmdqbGza071xZwCJ4t+qtiLMm6BegqwFJFXT+Orwo0CgiJKqma7HGWs6FxxGbD/FBD1nJyPi/PIrGlsNbZIXmKd3tg0wDLY43hnlzyOEAhuNIGIFESwC8VgqcwaWYUItXXLB3hZ4gQ4jBmlNGj0oosKompr6GAdmf3Mi6qF8crrK+eHSXwS4Ley8lJ1C8BDYBraQ8q1BSCSaUJVyU/VLI/j6rjNCKE0IvaArM92o0rDtAxOKW9PCdX/JoZaFNz6RvPntveA6OIrB2Wu2/mllrrkbJWqGquai6FOusMtb6H/wZvh2Eqt806aRqNueKfteWAgkiFEX4swA1sGGran/J79Ur61/SSrFnDxfqjr+Ax6RMbntDq85rP0Ox0Cc7vCwCEr5twchyjXGydjxfv34nFRLHsDF/qIWb+NUmCzogk5sGxoZHen/y3JkAVzbE5k07sFD19zPn2AHP16tCqW56fK1SQP6BtFtOOOmw4NfPTT2RdPVAEChJgRPEfH6nSfIGajCi5TbS3POswylweCDjkEpk5+Zci33aPqYpGYOjLCc050ZSCrSy6C1AYMe7u4xcIJ2vtJ8B+1rJmevoGw6ZXf8UsqxXEgKU9XgNZ/uyuo9/6+GOqyKD36qGSKGpur/6hX43FQX3bcqMofmD1Q3XOVAHTwj/uSdjR+t8jnHM3br2BzdDw9/8sFCIwMgiWIbmyUZr8qCx2ICd4qREseTsHzs5XSxXMqMSqrojcoxXiVUH+/upT3LSLQLdA3EQVteyU9fAohGrm4Tw2MHuXYWM5t5l5V9EW7u4s6Ys8I90OhSVcKn7n1u0pMrylDTGNzhVSZ3ESYweT5bEojpiLzHmT+oQBWks2q1WdiXUGM4eBmmqkdFyKgn6JjxORBK3t6F5FDst6xz8Idjyg401hBEgJLOvThf3zQbvhYpUgdVAWXlPMtNLwZ3l0oQndaPMsD+v9FSORLe/GeojCI0HLuNyM7OpC3eT+yBjzjLwEibCVDuzBZz5poVghrsr5WEycnYFH77Pek0dm7Altl88Owokc7U/72Q/0DxlrHjKPKirG7yCQjma7JYKlDoOSjepQS7nHHNQ9y+GRmrfvnwdemten5MHfGYdf3NVXr4JHao+ta/skKpdGg5UHVxvtxx+dVBqibuuZYfMsRNb0NmKrNccpXJFtqPcFuWW535kc6Oj4TBdQZ+yy8jr37V1+6kyhaxjem/rlyUzxZJJGHuV+KVEkSGS5GuK+utoEKMwc26PQp1eHVMzt2OWfen+icMUmVRbf2925xaI33QFRjjng3S6PJAYMxUK794gHXnhe+3+NkNRWzc5Jknsvj4t7JE+DaC+VaWvaW/pvs995XliEZLyku4rtr63Vf5L0WwAkWTla9xhr8Vc7+iYJpC9VQh1dH5gdTbmV1ppY6kHYzaSxXhOUJ/lm2bW0ajZ9EVLdnrhvHBLuHFozhyGDfarC4dccNd8OfpfuRE1jjLK/0Ub7ZAxGE5jbsVzl5DouC4PbWJ8x+fOXBVS6qcqDLioSoWPKow+isRWroN+u61lcUm1JQxikMgo6SQLgSLZYLQSAPKwcYSuF08gIVIapKiNBVUqNTGqMvopIiFEUejxpRLqrDxiyeIPyUJbkWwk2qh33y3oWlxPjKMjiSazockD7O8fBUcbhWKdYh94eeNlZtIn/fFWrtw51zpvoFmnZn7cmxSaiaKbeuAvhW4JDa1zWvLZ8qMJuBPEsLGddAKrY9AwOrU1n50889ChtRXXk3MfUVqrS6xWPT5LfUTII7o0TqODOeFRLuRgOYNKZefk7joX0dstb21lvCO4I7UVNpfKpAKVefclvvxaV5OtgzSRk5YzQUJScN54/ziYeHI/OBqtmf8XCAO9/vwe804GSR3rIQ/UP3ddh5dAezZV3fzsZ1n0AjLo+sgVLQaOlh0F4VuPgqMmMdyqhH88xmJPALBrKo6GGfDUWkv028mEbmafO4FEWHR6RqrgLihv3TSxkGI/RWnEV6lV+KjALor5JaMqNb6qiAgE3MWQFQpGwD3WCpgLaszjxLiuT20ntbY/6suVnPqksQNr+teA38xD/BMEDWZXxAAV6x5fAA+08pDudvFQhTHAUCvtTE7W91veZriQwz+pSUzat522DLaxlmXkLvmwSkFUaRn03Ij4qSOPPEzU0eltMijEOqF1LzgHBaIWOo7/AP7Qz4dZ/YFXI91CqFoX3NXw5yjMbbld/C28Zd5xR2EgFmaSf5wQ+DgIPmF74A1OWL37QLz3QH2v6lPE+L+VjmaVD67w2ZvLJv6ZjK30d8vdcKnb2911DeZ6177AdWM91g52y4Yu/+nx37afhqNY0Oewt+rBdY06AHqfys+9wozAzbHpD3RCZULEdbE6MPZTqCbi0ShN/8H22ewWJtpCAXF05G9muU4gZoh0Qvnmf5frRJ9wadxPRSu+btEj5/SPHTjACc3hGvLROV+YCIPdKZMEr2ugobWhStBLmEzpHjQRvsxGG/KBirHTcwYO7NuHOHNOf2KGoLbG5kY8eaEmui00vt8S+sFpcb4MWQKh8VFL9Q9Gi1Hl+KgMMb/DziO3Tjux92jP2GyeKZ+Vs8dEGKxPuYqHnAMNzaJUf/F2Fmhz68yrgaclzs4jyjQVNA4J04TVLHMgYL9wP3Dwgbc9HkMUYk0RG4rtqvOkWovTQPjnW7Aytdaw7x+LJskX7XgCjUPNsNK2i29qXlL+Xl0V7R6HZtosonPlD+NX1Y5F4x9WOMabewWxVbv1446Z221xdvt41092NxEWUlvKVZSiF/h96EGBnWh5gMnn15j1pjEzV5SmQaJWYZqvdAVzvDyfsFWUBhUFQuP/RWoawmHuPbKbPnOnaAdPyNsh2un7frijHV1aitEu5oVyZzmT3ek2RcYbkgNrPtnojeyHBp37AjXeuEPsil2M6SPGxP+3OGYGA1nRBdZMzgvxNPZig0aw1oR0JNFB0ipMQeVApAlqlRC3n3UX6Uw2hbJoiSXJmkQ3kLZhiZFZLVHfjJnQzO8sVItqeGxYgChe28LjtaxFFAuGoeXOlDaOw081mfxUjiOlzbnc+MelsZKqMmscwhpXVea/NAaGxGM2zPKUa/GleytK98anXMMst4jHeqCt8dDWLk3Ys6R0DbxiTWBJ2fPoLV/YNehfCvct9Q6W3Ya6pmb8OlIZPQZthvs3R49V/DqSEaK/tS2h9Fpu2f5H2eStiUkHbekz0n22g8wBAxRQWcYL0p6snKw9JPsPXthnuSCIOzAMH907f+aopTT/mv/bq2xdpThJowN1WlCLsKI3M8vtaIHQha3BWArpOYblS9mndvV5k1dazFpBnNQokUlBbuCXM8EifSaL7cjZSNAxiQYT+jj8bGj9UhqbaH0RxIo5xszI4te/3Lhajy2wOgFNvNoOOLzmSO/ioJX9de+P9Yb6xWUXk/fAwy9nSDMT41a9lXLsmC68UyDAQw8CBdJCMFPX8/qXG5PBfwlmu8MQb3A4LPxIvTEhb3Z/oBApCZCVICGqdnIWmWeU+Hc3Lwo6AIhd+aNuiVuq49iwXbhinqAA+tJfIDKanQ5TvMkZzJM7pG5f2kz+PNvn16zI6SYWUlWKO4uzsMwO76/xrVpI6eqoaGxkk0s5Jd8a/6vDa2bhLDdDOKXR6tUpc5Qenc3mYTC0bvGBRpk4RWyW6fVmAC5pTu6Yk7PIMiOYo5HrXS3YsXU4J19AgB78pOR+P37YnbOf9DtIjhELzzfQUSduxHiOkG1s6sUkXS6loGrT2SpdwSUpjW1kxacNxHxAK5lmLkHUwqL4IcBGK+laO9izPOyvRVz3qTlGlo5UtO/qA4qZlSo2aY6fnd5nr+Wra1Hr6ttxGxXhIF2hhCgiXV5I2G6SIdbdK1SZaqdPN9WpcpBtb+yIPJ8x4iqxL1ozV55azbRamco+5zh5hLqOOkJm7gRUwM7B9QiICOUqEq1PrLlIa9CarNj5Cm00YwoqAzWFYUeSG2GkiRzsnhlj927mkq2OWTi3NQvIRlzKtmfjRM8BYdZcXOZzUcL553ZJLu5zra5Fqzdad/a5GTZZJKiz3x37Ao0gmEN+wZKmLvPR357ogzf7TP3N99MMMCe5dpQLa2AVFRjdII5SU7zJB4vowRSpXiJXmnTXrOgV8iZrPgaUORzKn29RmuMmtU/SY5ag+0uxhTAobbOVbXEftPvltQWdWr82wAaH3IPuzbbyc7izZy+JsYPyze6tDjDBre4ttjJ0+GTxvDz19djrakbnG+/pQFEvZm4madAj75KWwL5MoxqIoFPtBA1EatqXsCXS/3aiNaTNzIPqTx2MvpeIRwTmMBVOHWYSHiFe9jEcn6pNeW9k13rnf+vo3UhIyeLs0/PM7Mw+xkr8O2bewjLviUxU3p1RvSc4A0t6p6xORJ7k8rmT5P7euvExD8BGZL+HsfjF84zzsuNX1BnrDKjwJZHy9VTyZxZLNpsTzGd/03aLKvuPQW1m/+bJsbgEXJkFQtSRAXp4Z8z7rNVXnsBiX4hJbrze5FdFroL7RA+Px/z9mGDR98Xm1FCqWchK1zSzXT5Oj8PO6RUYiIYHmOwOjVm8rwV+ilpPKhEoBQE2ODQrWLkDJRGLq9LtcYfN3C9g9hE0hradIWOuYuBUd3BTtewWVglVj8aj9TQa8/iopyYjUzFAfCreUBA7lVeMy8IV86Zix78IMfQxH+ZnFM3OtrGpBqwSlReXhyJLfqrZ/p2f84Tj/25Ork67AKZdoM7lzo7xwJ0bnBvgMZ7ZvXurCz7Kg39YUyRewBY7eWYLxukg/fjhyuZFmR9htGadajdVeuA95oncRJ6KfhjHWM8qs3vDPggK22xQGPJBYauQfYulYN1i2137WNPJd3/aTCZv/uku2YvUcFrY7BbODxXwfZ9EZa27y9pvWty365wuS3dOc8d6xzMbr/tIbHH/nvTVt/9PvyJnwXz9csptS++YhW9iKBPVpm9xEz44Zjy62hdKFLfyDNU6ubIjE9uSar+YVmqIKqiyg0fSIcRQrJcuZjeaIAtCdfUCeOGqfdYCTZUCPgBzEWvO99bzdpgz13yqANa77dtjxuojUkTc50/39qn7JM5/KwOqtrz5/vkQhwHFu/a99VZdiHeZvmyoygXFNIfMZn2/W2gnlzUGNBViCpsAO8HsM47JheCXiFxWp3A12HHKMlDe0FBu+VP7vq8WCiECvVir1S8Ordh1zcyZmflMTaoemjGjZqgsqUFdp4W7tZrfTsmrV+zYhxgs9ukAeN1uk0LiCS0JSTyKtuPfCQb8wm6eEszF5YmuF4Zvyr4xvCA4lDITnqZ0LzTgj4N/WAZtDSvIQFEyDR0xOLdlAUwO3nHejxO76tVTfxy1Fsr0dp2DkaE78JnhOCkT/6z74h3EHFc0J9EDb9HzJpXFPBARlRrIq3BEX3NlRWytuhaEV0s9Pw6DrKxXN+gG0nY8KdjcUBNXq+7t5i3UJ/947C/5gPi8AfnX14BuxAqOjY8ZhiY7yk90wFe+1FiGDMIT9lTnUqTMYrM6Q86ARgTsoFL3XNO2feCYgmPfRsDkWiLNWdzZIZ6ab+KWFGX+XJ/qWt+5N0rBCywKA+yeXpycx+0/mg0JJec5qYx/ucMcHmgmniSa+8N3UZl6qX4vVZXqrVNWEClZ2AghG/+8J4fx/b7gkis5mcvSUt57/0gyUJpcPTT9nP850fr5ab/yZ7mjsBw1Q7e0b3GTNEBSAvgKhQJfIQUcpCJVsaSLN6QPr6kylJVqEkxsaFaiWVOu7T4BuG1Oo9NtA1xfuAG4KF6hyaT5Kma35ofEF6fRhab8c2r7pA97jqqD9fLvv86O/+R7nE6zcll0y4EieqHR3+gPBrpbpO810cwBCwv5oTQTy/hMHaseRoO89PepxowqtSojSjW+Ty/UcnAwL8Bg2qydHeK3+WZukJPxifmxa33tUgFiX+203N1riw17NgSK9z6pjW0Ph4XkYkBUiVbqQX3IrzHlA2XS2jTwwPOUk0M3V+p/zuySXFi7flyhi2NOw87fNho2/rXT8BY3UDt9cMZSff/Z3Pn3BSJRj7oyp7nObRLQmFJ3bNtZYYXWmmKX1sWcOAdc3cSJ61T9dEg7FDedhSydzik+oqjZlDfbfdzuDM1eTZm1c6+IGOp+s5ViIp3n2NcHL31S/NRbCub0Hdi3j51zUstS5A3IzfT5OppHCHF9daFxaOXuSE1jWRkPPbJ7w4vdomGukDss2h2NnP/SpVralfcFDbwof2FC8PlVCZdwtiPwWO/GeQfM/JaEBvH/BrSgpopfesycJptbfz4FHYtKIZAKurzu4vhHOLVOyS0UardUWi8G8guo9lx4PhOH7bqxLf40X2bmscl3X8Oy0XSeXa6X3GY8vdlHok7HxkocbME0VrVBHfJ6oDfICI+3LMijPGWpWE8p/dnJFekfJyYkfpz+Sz1vYmPF18HCviYJiPXyfy09vGNGSagIkbkbhfpxnWHbKZFsEZ1ZbLfLj/JfB8jVwvV/PznOJmATc+NyxQUkPonwTXpc1m1U0aKV+eFC8X/0gsEz8JcnSGxQ1G3cPawYuu55XMQt0qpm7IbN3NXEqOb33Js8m4zFF6BhKBUm91C3KWniimBrfDvigz8JnJt8AaDzFlYrAZOSPF04Vh54RQtsCLqGl5PYI1wBqDuAVaORaDX22x0WaFgwVytpfyUeyNNqWNVqrZhJ7HoDHxVhqVdlsqtUrGgU/qaLyLwqqzqP/TY7LvtbLGbHrMGjchNyUfiza7vV+L3DfjgNoyL1fU79ILMjL8xC6HZDwhO8lS1b9RAroVnliFUHMRy1GalYiD3ldv8T+9frX33+lQRE5U/gT4hKwkqf/9dLl4rKTgW8lfYoyv2mPzE5fdOPcdevkN7kzt1yMg9cyl5qwK/LSslah7djN3Dx2HyzBNplJpLGv+lhKyYhlf8zbdml9pnfL6F6liZv68/58P28Nc8rMwP9IyoH9SPa/hg4Mv+IV6EnWkh/UVWxE3VqyaXd18kyKvmprp3bWxd6/2mhvsvNWd08cEtW1xnZW5AZycjzscc0FNxJ94sd4fzMuGjdPTw53LH+1v7lGn9algfm0bdMHR4/bq43xXDHtz7pjyytTQnwf/cij6waHCz7+chgk8lY3x0jigBGNHECVTGnn7JvQ0NcdTplWEXPe9PPOhYLLJD68AFaXszxYrKeYf/BwL8pSQQe28HvX4ngF0IQ0g7/kYNwo6Ad+e2pSJ3n+opqP9Jg1Hm1GTIibam6ROkhgXRwflpKnmRLrvwHf0BEOEnyJBtcTEY4ueRJNrgN8Wz8rE/iFUieZEsu/kAuwumWPMkGt6WECsD2VaLhSi2lVNIjsdoMuwSQHa4FqaWEgnbEBamlhIIBBAylK7WUUkHAXLpSSwnlrHu3+qLbBGjK+KzFQ1MjfqS/Hqb5sf5GmOYn+uv6G/qbYZqf6m+Faf0zfq6/ob+lvxOm6UXBGfnTfZP/Mps5xK3Mf+H+/XoMAwn+O33FVCzv9avguf7qrRjeSiz6fYS86JvoTMlwuW0xD0u35nLsSS+E0xuvKJEyTc7gth7+7EdOoOYBSu0uBVJnGjee/jgrs1l9magZMp3+fedGUDqjqjs8KLuIdPrX3cBxHkg9kE7/uhvwqN34L91R1cxR3czJ0s+52zMlXuJgvI6dPGK4G0HHNpWOhDyuqoM0ITsGHnlvFviKmkcuyNO4+FprLmb8yP2AUaQrgR+5H8CGUib/hH1fJkKJ8YjB3V4eFErxscOP3A/YniRIs1BqKoNo/7InezQnxrsnoypw4r27eJTKR1F6UJSkahvGnaIjDRgck0VTajQ9bhQ3kkXZhHz8Knkr55xe/gbFOe/DD+gCfOFX4LkfwPrTAPT3D2gAmRoFoS025+1X/3/phY0tFpmiPM8ZWSHWYzRBC/4dW9bhNylMrupMRatFQXUWv/wHmjnyQoRlBKDmQujAyBhBRkj1K3KWnRUiPUKT3/JnzrIiJRAEpSuQQlDGQgoUkdQzSaiHVGT1WyT7JXktD5ZKM7lNpFC7pcNUSby2YPQN4QMNHqQg/SBoldGb0SUzZoJBT6ArvRUqiMWq8YQlyUKoqgrUuKpAkjO/TCZJFeT9uJr5ULxC5ckqoj3KUDSOslMA6kmpnCvyWsAllmwrkPOgmRXEe/wSjGdB/AslpKw/o3ZNa2Dyq9bYpqq6R2SP9YnMf66Hnqj4MpavY8E7nRB9dHL6Lyp+4eRjJ/hEyRdO0LZLsovjmTKiVy8gw+uCPGOadW3i/ZyS/oTclut5hy6wQPIj/8CZpzP1pKW66rVFCjcJlX9OuAyA3S8x9r0+aaGlH/hBdHCmFyJ1aEfGwHldulp5Evcq+KBWToeQeRaU5s3xoo0dADn9DilSLJfcok7swK/wzwUiyHnCrq5GizDRSGX/aWFiupbzvbZhxhFE7NAwKvoLGrQGnplsRWQMq50QVkh5qZIPCYliLPRgfWhwjV06gYJQZMNcuIAslGkKgM6I9WNx35NFyBvHAYL7CGDI7/l8kvuUGU712zASbuQ78QxSN+JZm9nSZTCI31XkTTa1VokdsD8cOTjORmYTow0zs2y09MI3AhIEHSMbuY+VUfcY8/3KSP9gvcjQqMcXjOxN7Hlhw+JewkRmiWzF7wXaHoOKhstDRna/TWkrha28AsAjeEHipl63IK2K+H64tWA/rvgCAoLY2sc5GroT03px/ee4MYFd1jC+8qzHtdCA8DWx4PFI9NPJgoElPcG5/Qyx6B+ArJgy84L7IzPMFUFiBxz+/AsuHtnEoe8D7212cl5kzpHHk30gmsqPcBo3wF/FqtwOimCeOD5nb5xbKH/B0q3l1VnrLHlWmJpdqApdo3Y+nIegHyig4AnLN/V0Akg/JspMmUlgtoDalPRAcUOTX18wZafSpcNnzEDEwDZ0RBSFCZ8MwNPQObKds3WaCAIEygrZouCO2AjnHZ4PsiDlxz/dWOoN1bCY26BFawHXJerZTtgiV9uc+hDARHOiMRUzvmeXikh2VRF34vbPhq0ow/C7UfIAgs4HtvojP0N8bqPt8fjtkDGLFBPG3eqp04slxu/uWjCfd/MwdJEQThLBZiCQs5cTZ95mlQ2F/krCxkxFmCMiaSIQRpdgZozZQjzFc8pDs4+pyZBpZ2U44treMVIfhpWKE821CKoDI4/Rtv0UqezWpHYNxXDBFwOTHypHgEWTDfxyIOV7UyOBgRdGvKwgq2XdTstLMcsSdVLzVKbyop8I3EtlmSbcjwltguxLJzA0S2LKAWtHQgGn8XFm5YziDWIJvxtDjLJ0WisB9K+rppEYO8DIjePg6+Yc2yVMOLBaCwOPDxg5ZZTF/V+Yn1xwH9eiHpjYJswlWyqE83FCs/tJQi6etZyDz5UdwBYC41gBOGzlOzpl3K7jekcMLKInzGvqQQQ/dzAhFRkVAr7Ksm7C+8YEKwB78UoLhfAW3vJEDVFdCJfK3ANXzrqaU1wMCkw8xfaVawH1xpceo3R6qQZ/+zK2ZQcf4vvnKRcHT8jkCkEw0kSjDTS3iSRQ8fVuUBGbDZaJw6IkIDHRu964Jb/fp0lnQls/T4LEFSYl3XEVdV0Z8VdUQG1Ef+CLob5Q3ZgsyLsFX4m5EvJ2XBbTUOp4bmFJM8yiYaqeLbC/mzo+bq27bHp5MuRSjeytnF0bTINRUk8AgKoQmKrkQDJpVHAOsahExKQVLigAzGFUjLl74zatshV5e3sSR7APBN2e2I8mZOuJf5tQK7cimfnKpIxpHAGKstD1xmOcy2IYD93KWLeSeBcouKhS77sTzzJo16vhuijY2I3SoX1gbQXXY6FrhDY/nJ7kaaAWxk5uestj6SwCEm6lWPXZUe9MHd0dY4G19CQdJJ2e66kEgOqpzDkaQ+lJT92R1O7mKEoJ+XWUEb47sGNt7l7b3SFXPsOBuhu8AKCsH9FvIfLfm30dm3d5EzTMYNto2LfOjF6jMquJoHRvrK7iXbygONh9+iqGzd7cCC1sU9ZojRvNM8VL1dELBG04HGym+pCF4RU5UbALUrazC0gSsNfh8tz/xWzONYLdm1cDvYtnIlYNTy0PrRVbDnVrRuPxeEJVwn05wD354L46WPcGefzFqamkkq8bBmKUdswXhdDVPJGOFeptKJMleQSBspcsHGgRoKLPoCJe18KX6FVgD+NUD8GcfcWHrtw5uXYktG5ckdkag0nqwziHJ/Ok10sTHrhFh1t1o0M3OoTwTrKm4Fic84QSxo0OASlYB0cMABLxVhG7iZM45p0zwHpXJhl9hEZ840Rrp13qpSVq42Sj9RZTaV1ZtK0yTd24W5AGaNk1rFtmgnEwKEnPGV09D2D2/CLmODaRTqyFLWfOaW59wkI81Sz0KscVCOl5WIF4kyLAeldlalGEFqzvprWuNOifPNTG2pP+pQtfuPCSkl2Ax0Wv52KIoYHchr/fGULzZwCeY8SnVjwv26UnKJT7UXT2S4NazjbTqksscf9YOih7z+vskCR7yj1lcK98wpMTuWO37pLy8HxW7D2WMo5a80n/S9HwUO+XjD/hi6fR3ZC8WrswIsWbrY1+/L+PvAL41m/hkyIZPyEOI5APPCkrOTmAcKtpv4hVtDrpeyc97tWF3rl3MesXDqB63vQDhxVWG1AsWhGpyVKWJXjMCWIKAAfUfqsgiO1gVq8QEhS1z97Ehn4iSh5qQJl88dH2qanOn07XnTd5XmvKSDNZjWRWGjCeccuok1hTyASB6rZIBXmVOzc0hFtdBPrgYwAYiAgQz/gFF9nIQ47dRrszIpEK/+XhgUZbwyJZs5AJSSUmChA+KX8gyRzim/K037BYK5khHXOidSeiwNNDULASTrckXFDtcqHq3bBR26iQMfD/DLmgqsLGqdMA/zN//4TD3u9SjnGS34kpg1VOYubyIQCXAlYEpGZtGysRIj3F5djUF6z9yTkIcBmh4PL5LqaeG9ajxguu8b1k8dZ3bbTSPT3sogTAczmhHvYInT1JkMUcfjCsjLBAQwTx3d9gcCS4go6Ahmi2+i1WOhRXbstAiq4GKv5sJOoqV/ulpLwO/VMMmssOl0c97KV2XTphYMClynz4GHhzL0ydNOvqjYwJhVBHi3/S+BhPV4sSJNRiwBVKVKXCKbKuNvPYb8HCchcGFZtuXgn4i1+KirXYE/zTeNsQLxf+iwy9QfxL5mis9zE1QwJ05sz5ovmfDbkNBcBSgkBrOU5bTsgOuO1g1cyFS7C6b7fJnvzGC58ITNJ8ymxgxNxJsMXK55y5odaN7AGYAM5nE26nAZZl+jzxdjw3aKYKEpuIeidAWghu4OmCNgioc71a6im/SL3G+RhSqm/bvcqL1dJPTKP3Agn6gdatNaKphJSVX0DaJl2c2UmyxK4JPN+GXD2ra2PPotZ7FyRsdUKNl/hB3I4KR3ex47UDsJOLk5iGYiE4/J1ygvGUasb6Y8jGbr67GptERj11cLw6jVjUrG9e5eFMP284rLwv2NnbGGpaxM5Mm74hdJhGOyT3cl+NkrDcO7eui3avNqneQIkH3wJxJAyXeEfnVJ281ztzOXgpxXcX8pGC+6x3K8ZL072nAehB0GcxzfpndL7uXNRY/stQAGFmWY9zFSLBJWtlN3R5xz42PixyALOSvrvElAt1pZOftw7xd+9CC1/np2GyRmBsJdtcV5KqXi7VBWMbryr4DbQvOb3zqk/9ynv1EHgbhgVl0tCRxhE/wpZFX0kbGHaZ2ZZsSMWhoQSjCaX/w969J5RCe7+f34SlAav3y91KPHKsfxKxw0CMWMXoMUEl17izVqrLcQHkKvXmYgTvnibePcpVBNQO53ckTXHgxJy718hTefBTkzYQzStZNQm5UGhZgV2A1lm9+FA7u6A9ysyHn+nSjNKVFmQbt2Wyw9rLFQoWpyQYCM2q1O7h3XMvSII1vdUS10IihbgBvTtMxJRgvi8BIGNSapk0Vp31FM3exyKZyrhuEyyDbdGQholPy1xPIlbqkHjsoaeWIYweO/sFdjlHIcsRopglqdEWAYO6nCOY3fF92TdaKNtWFFozsMZtXfUbkP7suNZbkVY6pBxJyOWlLS1n0vmxT6J7Ez15cgACLTmzHgKYM6LwXUKbzy2EEAGuZ0wtiebmxqyxWzbg2kb+BtQ/jIr/Mh4zcDHk4z1GzVzI0z1STnOiJzNmoLAmMME6Z+nnADCW433OGErHKV81rIAKRBsGwH0hwvz0quozqjapIJKhU60CpqUppdzoTTxqM6xjoEJa0nfHAnpOT3YdQTJFZD0Bi1mPEFZzHOFOiq+TGrOAByWgvb5WZ9bxx9O5AebySYaBVvh5eK9udVrOiPNUqQ5xKUJbH3Y9NbO/lnGI13Aoquna4BfInId0yBnT33weBgxzc4PfVualVusRK54OvnKDfk5hSsfGJi5ew8WmksGu5O1KPbKMXIEUVKy8DGveNd6H3gYYLGbturprDH30do2PXMc18PaHdM6YsYTtTXenoAdw4+UzeBCYQTxJgwc4xXeNd+iEm5hhvFgGD/acap7WXNxXgNJc+Q3be/z+VzSurHnxC4PwWuzo+0WzH504icGerN32522P3sRRm9eCfeUW9tcV617D3csKHweOyFqUfx1skCEIY+jiTwNmfcwMwDK+lgolZBIMb1hyunKt2rNr00uQGsGKdcWixaG1hGfEPOIeUWx56Od/hOpFUYvXQtEPCGj0z92IAkC8Blxj5Dqfk8ELjw4Y14bCmvAWaqHJ19z2G+0HSstdHHMS+x0/iM7bECFS0R2qYBO4jzHiWWx9gdu1O/jTeOAJx771Q4ipJh5l8rFAUD2P8QX9e3xujEuTj7WxWLgyPqcJygvI4Aa7tIvnlZV0SOQ09QjVbEimW+HzQXk/9UEZ4D3w1MEaE23tkhX/EUgAwNynMsyss/InBS9vvTggvT+6bUb0Da7bGKgFB9spk2XmhHp76IRJ2RQ2kXl7qESNVQ27HKVIohCAQNjWTsui6KBKk+XudVJb3mUnsDce16rILd5J/4eAgOT0887er+l9yt95AvkP4NKSvUNc+biNdf/z3/YtKoWBNhhAgH9c+naqZpJ/DPoMmZ+Kx1MQyQ6vpxQOtATE4qjSqFwDV8RB9AnT46CiKaOFoyLigxeMUSYhi5QLFCtNd8CgphSbDnbyg5GRoKSHSyGKjkdkiVaMZCmfOhssysQ4nnUWNr9Ez5TY3pj9TnvMY1q+hN3OswLyDEIcLmr0VLizoTM0L2NgSkJvjBtbjA5pllhqrh+sxkoajfCpGk+Dy/jgWQ6L7CBGQnw5b9FDYiC8BGCpRuWvValIEZOiVvilMtYpWg5eFmNnzmKhxSCuxaQpQij0l1xMuirrbbPGTrvtM2JH8zC/6XzUHsp7Mqz3pkanHLrADstN+d8h/fb76ej0bVCU6NDkhhX2Ot9VvabqFjVrtOsUcAw43x8gHo+3mHIREEA7SPD34RDQKgsOlRwAq3GXFUTJswpGzI0Kzt5chcFQSYWPnPgKQZd1EXMnYIeKZbqEI7PT5dKVyU1LhRk1VV4K5PcUK5PNTAhvgfywBAlVIFONIMWKFDMRLlO2SgXSlImWqUy5XMWKkCyZspLbIUc75Ggxco264zT6CKcsr3N3zap40GGJ2qo2sk2wUryr5izYIWVWCaXMt2qK5K5AAZLcKOdKpsgsVe44g+nh5WtFO2dwUNkc/TigkqngxZsPX378BQgUJFiIUGHCRYgUJVqMWHHiJUiURJsOXXr0GTBkxJgJU2YFbsGSFWs2bD09QnH2F6XJkCX322zWbrX/ownSIhEY7LQLi6RNVIlTI4TPXvvstsdpZxx1zAYbrcKwkiZhIlwxJUslxc3hwEFAine69OjXZ8CiJe1BIBtEEdylEfPVuG9GkdRpOKXbakd0JA468ZuSK1+BPEUKLVfsgxJlypW6q0KVapWJhxq16jWos0KjHXp90aRFq2afHHTBOZQt0m01IiMJ8F6m8y665LIrrromC+26bDeN2ma7z265LccdH0377neP/4MwLdtxn6LijxEZiiVSGSNXKHupUveq1xqtzsjYxNTM3MJSb+Wsu91rmSGA/z3Ese4Rrq2dvYOjC5euXLtx687JvSc8SUcPSPti/4i8qtbNR4bxWMe+ncO4T4HO1Aj+9jjJ3e/29/RZilfe1A/j7y9tcMvBpiNt/4031jxNxt86fV+X+7QfF872D8ju6Gj77Gx6785jlK1t54l6Uhh/1sd+8ec2bec+1eepNgLdIBA1EfFEENQP4UQEIl5V7+Md9w4HjlxwyRXXPMWGp3mGZ3lubOfra6/T92k9OrALNnsOXLFlM65PP8fdXlXv7PraDhZu2nL0SBdX/cvcGNd1r7T3q4sOa2/fuWdr1/85ho7CgrTLcVM85RB732eOTf1q11heaPs4N6wn3Z09O4t9cFrDapWEmnkoH6yY0vZErhO9eXYUDHSDtAQ2MMaJwFz06c3xZMeIOmmgdeCXRDHZMKBGSuBVHSGJAjgxJBejI0wYD9Z0KbAALkeUV4ypIcDgyrJcIcmgMp9QLFZ0VAQIZvSKFXki6IifBV1aZEkIAQHBmINRW6IjQYY0KZEmLHQkZFS1JCz6QmFhAVyZs3YdJEYQ/8AG+IgMRcYxSUFHJbZJTEdwg0kJy28J6u2Gj0lGRrCM5VyjZC0mt6RSOA7zXaGJt6OiLwMAAAA=') format('woff2');
}

@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('data:font/woff2;base64,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') format('woff2');
}

/*
 * Component CSS shared by the website and the extension.
 *
 * The class names are the contract. The extension popup re-implements these
 * components in Preact against the same names, so the two read as one system
 * without sharing a component library.
 *
 * Rules that hold everywhere: no rounded corners, no gradients apart from the
 * hazard stripe, every number in mono with tabular figures, and no band ever
 * distinguished by colour alone.
 */

/* ------------------------------------------------------------------ base */

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--step-0);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 0.92;
  text-transform: uppercase;
  margin: 0 0 var(--space-4);
  text-wrap: balance;
}

h1 {
  font-size: var(--step-5);
  line-height: 0.9;
}
h2 {
  font-size: var(--step-4);
}
h3 {
  font-size: var(--step-2);
}

p {
  margin: 0 0 var(--space-4);
  max-width: var(--measure);
}

a {
  color: var(--accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

a:hover {
  color: var(--accent-strong);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.buai-mono,
code,
kbd,
samp {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums slashed-zero;
}

/* ------------------------------------------------------------- hairlines */

.buai-hairline {
  border: 0;
  border-top: var(--rule) solid var(--hairline);
  margin: 0;
  height: 0;
}

/*
 * The paper grid. Twelve columns of visible rule with a crosshair at each
 * intersection, so the page shows its own structure rather than floating.
 */
.buai-grid-paper {
  position: relative;
  /* The rules have to reach the bottom of whatever they wrap, so this goes on
     a container with content in it rather than on an empty element. */
  background-repeat: repeat-y;
  background-size: 100% 100%;
  background-image:
    repeating-linear-gradient(
      to right,
      var(--hairline) 0,
      var(--hairline) var(--rule),
      transparent var(--rule),
      transparent calc(100% / 12)
    );
  background-position: left top;
}

.buai-crosshair {
  position: relative;
}

.buai-crosshair::before,
.buai-crosshair::after {
  content: '+';
  position: absolute;
  left: -0.32em;
  color: var(--border-ui);
  font-family: var(--font-mono);
  font-size: var(--step-0);
  line-height: 0;
  pointer-events: none;
}

.buai-crosshair::before {
  top: 0;
}

.buai-crosshair::after {
  bottom: 0;
}

/* -------------------------------------------------------------- readout */

.buai-readout {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  border-top: var(--rule) solid var(--hairline);
}

.buai-readout__label {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.buai-readout__figure {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums slashed-zero;
  font-weight: 500;
  font-size: var(--step-4);
  line-height: 1;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 0.35em;
}

.buai-readout__unit {
  font-size: var(--step-1);
  color: var(--muted);
}

.buai-readout__bounds {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  color: var(--muted);
  font-variant-numeric: tabular-nums slashed-zero;
}

/* A figure we cannot give is a word, never a nought. */
.buai-readout--unknown .buai-readout__figure {
  color: var(--muted);
  font-size: var(--step-2);
  text-transform: lowercase;
}

/* -------------------------------------------------------------- rangebar */

.buai-rangebar {
  --buai-low: 0%;
  --buai-central: 50%;
  --buai-high: 100%;
  position: relative;
  height: 1.25rem;
  background: var(--bg-sunken);
  border: var(--rule) solid var(--hairline);
  margin-top: var(--space-3);
}

.buai-rangebar__band {
  position: absolute;
  inset-block: 0;
  left: var(--buai-low);
  width: calc(var(--buai-high) - var(--buai-low));
  background: var(--accent-tint);
  border-inline: var(--rule) solid var(--accent);
}

/*
 * The upper band is hatched as well as tinted, so it still reads as the
 * uncertain end for anyone who cannot separate the two colours.
 */
.buai-rangebar__hazard {
  position: absolute;
  inset-block: 0;
  left: var(--buai-central);
  width: calc(var(--buai-high) - var(--buai-central));
  background-image: repeating-linear-gradient(
    45deg,
    var(--hazard) 0,
    var(--hazard) 1.5px,
    transparent 1.5px,
    transparent 5px
  );
  opacity: 0.7;
}

/* The central mark runs past the bar on both sides, so it reads at a glance. */
.buai-rangebar__tick {
  position: absolute;
  inset-block: -6px;
  left: var(--buai-central);
  width: 3px;
  margin-left: -1px;
  background: var(--accent);
}

.buai-rangebar__scale {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--muted);
  margin-top: var(--space-2);
  font-variant-numeric: tabular-nums slashed-zero;
}

/*
 * A figure we do not have gets no bar. An empty trough still reads as a value
 * of nothing, which is the one impression this project must never give.
 */
.buai-readout--unknown + .buai-rangebar,
.buai-rangebar--absent {
  display: none;
}

/* ------------------------------------------------------------- metastrip */

.buai-metastrip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  border-top: var(--rule) solid var(--hairline);
  padding-top: var(--space-2);
}

.buai-metastrip__item::after {
  content: '\xB7';
  margin-left: var(--space-3);
  color: var(--hairline);
}

.buai-metastrip__item:last-child::after {
  content: '';
  margin: 0;
}

/* ------------------------------------------------------------------ tape */

/* A strip of repeated text that says what the numbers are and are not. */
.buai-tape {
  overflow: hidden;
  white-space: nowrap;
  border-block: var(--rule) solid var(--hairline);
  padding: var(--space-2) 0;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--muted);
  user-select: none;
}

/* --------------------------------------------------------------- index */

.buai-index {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.14em;
  color: var(--muted);
}

.buai-index__current {
  color: var(--accent);
}

/* ------------------------------------------------------------- redacted */

/*
 * An ink block over text we deliberately do not have, or do not collect. It
 * reveals on hover, on focus and on tap, and it is a button so a keyboard can
 * reach it.
 */
.buai-redacted {
  appearance: none;
  border: 0;
  padding: 0 0.25em;
  font: inherit;
  color: transparent;
  background: var(--ink);
  cursor: pointer;
  transition: color var(--tempo) var(--ease), background var(--tempo) var(--ease);
}

.buai-redacted:hover,
.buai-redacted:focus-visible,
.buai-redacted[aria-expanded='true'] {
  color: var(--ink);
  background: var(--accent-tint);
}

/* --------------------------------------------------------------- hazard */

.buai-hazard {
  border: var(--rule) solid var(--hazard);
  padding: var(--space-4);
  background: var(--bg-raised);
  position: relative;
}

.buai-hazard::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 2px;
  background-image: repeating-linear-gradient(
    45deg,
    var(--hazard) 0,
    var(--hazard) 6px,
    transparent 6px,
    transparent 12px
  );
}

.buai-hazard__label {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--hazard);
  display: block;
  margin-bottom: var(--space-2);
}

/* ------------------------------------------------------------ sourcechip */

.buai-source {
  display: inline;
}

/*
 * A closed details still generates a box for its content, and that box forces
 * a line break in the middle of a sentence. Chrome and Safari expose it as
 * ::details-content; Firefox does not need this because it does not create the
 * box. Without it the chip drops its own paragraph, which is how this was
 * found.
 */
.buai-source::details-content {
  display: none;
}

.buai-source[open]::details-content {
  display: block;
}

.buai-source > summary {
  display: inline;
  list-style: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--accent);
  vertical-align: super;
}

.buai-source > summary::-webkit-details-marker {
  display: none;
}

.buai-source__body {
  display: block;
  margin: var(--space-2) 0;
  padding: var(--space-3);
  border-left: 2px solid var(--accent);
  background: var(--bg-raised);
  font-size: var(--step--1);
  max-width: var(--measure);
}

.buai-source__meta {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ------------------------------------------------------------------ faq */

.buai-faq > details {
  border-top: var(--rule) solid var(--hairline);
}

.buai-faq > details > summary {
  cursor: pointer;
  padding: var(--space-4) 0;
  font-weight: 700;
  list-style: none;
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.buai-faq > details > summary::-webkit-details-marker {
  display: none;
}

.buai-faq > details > summary::after {
  content: '+';
  font-family: var(--font-mono);
  color: var(--accent);
}

.buai-faq > details[open] > summary::after {
  content: '\u2013';
}

/* ----------------------------------------------------------------- table */

.buai-scroll-x {
  overflow-x: auto;
  max-width: 100%;
}

.buai-table {
  width: 100%;
  min-width: 30rem;
  border-collapse: collapse;
  font-size: var(--step--1);
}

.buai-table th,
.buai-table td {
  text-align: left;
  padding: var(--space-3) var(--space-4) var(--space-3) 0;
  border-top: var(--rule) solid var(--hairline);
  vertical-align: top;
}

.buai-table th {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.buai-table td.buai-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums slashed-zero;
  text-align: right;
  padding-right: 0;
}

/* --------------------------------------------------------------- buttons */

/*
 * A button is a mono uppercase verb with an object. Never "Get started".
 */
.buai-button {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: var(--step--1);
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: var(--space-3) var(--space-5);
  border: var(--rule) solid var(--accent);
  background: var(--accent);
  color: var(--bg);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--tempo-fast) var(--ease);
}

.buai-button:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: var(--bg);
}

.buai-button--quiet {
  background: transparent;
  color: var(--accent);
}

.buai-button--quiet:hover {
  background: var(--accent-tint);
  color: var(--accent-strong);
}

/* ------------------------------------------------------------- standby */

/* The no-script fallback and the 404. */
.buai-standby {
  border: var(--rule) solid var(--border-ui);
  padding: var(--space-6);
  font-family: var(--font-mono);
  font-size: var(--step--1);
  color: var(--ink-2);
  background: var(--bg-sunken);
}

.buai-standby__code {
  display: block;
  font-size: var(--step-3);
  color: var(--muted);
  letter-spacing: 0.2em;
  margin-bottom: var(--space-3);
}

/* ------------------------------------------------------------ reviewgate */

/* Every page carries this until a human has read the copy on it. */
.buai-reviewgate {
  border: var(--rule) solid var(--hazard);
  border-left-width: 4px;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hazard);
  background: var(--bg-raised);
}

/* -------------------------------------------------------------- nav, foot */

.buai-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-5);
  padding: var(--space-4) 0;
  border-bottom: var(--rule) solid var(--hairline);
  font-family: var(--font-mono);
  font-size: var(--step--1);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.buai-nav__mark {
  width: 1.15em;
  height: 1.15em;
  vertical-align: -0.2em;
  margin-right: 0.45em;
}

.buai-nav__brand {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 800;
  letter-spacing: 0.02em;
  text-decoration: none;
  color: var(--ink);
  margin-right: auto;
}

/*
 * Below the point where the bar wraps, the brand takes a row of its own and the
 * links sit under it. Letting flex-wrap decide put the brand, one link and the
 * theme toggle on three different rows in an order nobody would choose.
 */
@media (max-width: 34rem) {
  .buai-nav {
    gap: var(--space-3) var(--space-4);
  }

  .buai-nav__brand {
    flex: 1 0 100%;
    margin-right: 0;
    margin-bottom: var(--space-2);
  }

  .buai-themetoggle {
    margin-left: auto;
  }
}

.buai-nav a {
  text-decoration: none;
  color: var(--ink-2);
}

.buai-nav a:hover,
.buai-nav a[aria-current='page'] {
  color: var(--accent);
}

.buai-footer {
  border-top: var(--rule) solid var(--hairline);
  padding: var(--space-6) 0;
  font-size: var(--step--1);
  color: var(--muted);
}

/* ---------------------------------------------------------- themetoggle */

.buai-themetoggle {
  appearance: none;
  border: var(--rule) solid var(--border-ui);
  background: transparent;
  color: var(--ink-2);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
}

.buai-themetoggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* -------------------------------------------------------------- motion */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

/*
 * Layout for the dashboard file the command line tools write. Everything else,
 * the colours, the type, the readouts and the tables, comes from tokens.css and
 * components.css, which the build inlines above this.
 *
 * The bars are divs and the rings are one SVG. There is no chart library
 * because the shape of a week and the share of a model are things three
 * rectangles already show, and because this file has to stand on its own
 * with nothing to fetch.
 */

html {
  background: var(--bg);
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--step-0);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;
}

.buai-dash {
  max-width: 64rem;
  margin: 0 auto;
  padding: var(--space-7) var(--gutter) var(--space-9);
}

.buai-dash h1 {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--step-5);
  line-height: 0.9;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  margin: 0 0 var(--space-5);
  max-width: 14ch;
}

.buai-dash h2 {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--step-2);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 var(--space-4);
}

.buai-dash__lede {
  max-width: var(--measure);
  font-size: var(--step-1);
  color: var(--ink-2);
  margin: 0 0 var(--space-5);
}

.buai-dash__note {
  max-width: var(--measure);
  font-size: var(--step--1);
  color: var(--ink-2);
  margin: var(--space-4) 0 0;
}

.buai-dash section {
  padding-block: var(--space-6);
  border-top: var(--rule) solid var(--hairline);
}

.buai-dash__readouts {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  margin-bottom: var(--space-4);
}

.buai-dash__readouts > .buai-readout-group {
  display: block;
}

/* One bar per period. */
.buai-dash__bars {
  display: flex;
  gap: var(--space-2);
  align-items: end;
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.buai-dash__period {
  display: grid;
  gap: var(--space-1);
  justify-items: center;
  min-width: 3.5rem;
  flex: 1 0 3.5rem;
}

.buai-dash__bar-track {
  height: 8rem;
  width: 100%;
  display: flex;
  align-items: end;
  border-bottom: var(--rule) solid var(--hairline);
}

.buai-dash__bar {
  width: 100%;
  background: var(--accent-tint);
  border: var(--rule) solid var(--accent);
  border-bottom: 0;
  min-height: 2px;
}

.buai-dash__bar--unknown {
  background: transparent;
  border-style: dashed;
  border-color: var(--muted);
}

.buai-dash__periodlabel,
.buai-dash__periodvalue {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--muted);
  font-variant-numeric: tabular-nums slashed-zero;
  white-space: nowrap;
}

/* A right-aligned number followed by a text cell needs air between them, or
   the turn count reads as the first digit of the model's name. */
.buai-dash .buai-table td.buai-num + td {
  padding-left: var(--space-5);
}

/* A share of a whole, as a ten cell meter. */
.buai-dash__meter {
  display: inline-grid;
  grid-template-columns: repeat(10, 0.5rem);
  gap: 1px;
  vertical-align: middle;
  margin-right: var(--space-2);
}

.buai-dash__cell {
  height: 0.75rem;
  background: var(--bg-sunken);
  border: var(--rule) solid var(--hairline);
}

.buai-dash__cell--on {
  background: var(--accent-tint);
  border-color: var(--accent);
}

.buai-dash__equivalents {
  margin: 0;
  padding-left: var(--space-5);
  max-width: var(--measure);
}

.buai-dash__equivalents li {
  margin-bottom: var(--space-2);
}

.buai-dash__quantity {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-right: var(--space-2);
}

.buai-dash .buai-metastrip {
  margin-top: var(--space-4);
}

.buai-dash__foot {
  margin-top: var(--space-7);
  padding-top: var(--space-5);
  border-top: var(--rule) solid var(--hairline);
  font-size: var(--step--1);
  color: var(--muted);
  max-width: var(--measure);
}

/* The saving as rings, beside its figure. */
.buai-dash__saving-row {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  align-items: start;
}

@media (max-width: 40rem) {
  .buai-dash__saving-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.buai-dash__rings {
  display: block;
  width: 100%;
  max-width: 240px;
  height: auto;
}

.buai-dash__ring {
  fill: none;
  stroke: var(--hairline);
  stroke-width: 1;
}

.buai-dash__ring--grew {
  stroke: var(--accent);
  stroke-width: 1.5;
}

.buai-dash__ring--core {
  fill: var(--accent-tint);
  stroke: var(--accent);
}

.buai-dash__caveats {
  margin: 0;
  padding-left: var(--space-5);
  max-width: var(--measure);
  color: var(--hazard);
}

.buai-dash__caveats li {
  margin-bottom: var(--space-2);
}

.buai-dash__muted {
  color: var(--muted);
}

@media print {
  .buai-dash {
    padding: 0;
  }
}

    </style>
  </head>
  <body>
    <main class="buai-dash" id="app">
      <p class="buai-readout__label">Reading the data in this file</p>
    </main>
    <script id="buai-data" type="application/json">__BUAI_DATA__</script>
    <script>
/*
 * Renders the dashboard from the JSON block the command line tool wrote into
 * this file. Plain script, no build, no library: it has to run from a file on
 * disk with nothing to fetch, in whatever browser opens it.
 *
 * Every number in the data arrives already formatted by the tool, because the
 * tool is where the rounding rules live and where the two implementations are
 * held to the same bytes. This script lays things out and draws bars from the
 * central values; it never rounds a figure itself.
 */
(function () {
  'use strict';

  var raw = document.getElementById('buai-data');
  var app = document.getElementById('app');
  var data;
  try {
    data = JSON.parse(raw.textContent);
  } catch (cause) {
    app.textContent = 'The data block in this file could not be read. Run "betteruseofai dashboard" again.';
    return;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        if (name === 'class') node.className = attrs[name];
        else if (name === 'style') node.setAttribute('style', attrs[name]);
        else node.setAttribute(name, attrs[name]);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (name) {
      node.setAttribute(name, attrs[name]);
    });
    return node;
  }

  function num(value) {
    var parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  /* ------------------------------------------------------------ readouts */

  function rangeBar(range) {
    var low = Math.max(num(range.low), 1e-9);
    var high = Math.max(num(range.high), 1e-9);
    var central = Math.max(num(range.central), 1e-9);
    var span = Math.log10(high) - Math.log10(low);
    var at = span <= 0 ? 50 : ((Math.log10(central) - Math.log10(low)) / span) * 100;
    var bar = el('div', {
      class: 'buai-rangebar',
      style: '--buai-low:0%;--buai-central:' + at.toFixed(1) + '%;--buai-high:100%',
      role: 'img',
      'aria-label': 'central figure ' + range.central + ', between ' + range.low + ' and ' + range.high,
    });
    bar.appendChild(el('div', { class: 'buai-rangebar__band' }));
    bar.appendChild(el('div', { class: 'buai-rangebar__hazard' }));
    bar.appendChild(el('div', { class: 'buai-rangebar__tick' }));
    return bar;
  }

  function readout(label, figure, range) {
    var group = el('div', { class: 'buai-readout-group' });
    if (!figure || !range) {
      group.appendChild(
        el('div', { class: 'buai-readout buai-readout--unknown' }, [
          el('span', { class: 'buai-readout__label' }, [label]),
          el('span', { class: 'buai-readout__figure' }, ['unknown']),
          el('span', { class: 'buai-readout__bounds' }, ['nothing we can stand behind']),
        ])
      );
      return group;
    }
    group.appendChild(
      el('div', { class: 'buai-readout' }, [
        el('span', { class: 'buai-readout__label' }, [label]),
        el('span', { class: 'buai-readout__figure' }, [
          figure.prefix + figure.value + ' ',
          el('span', { class: 'buai-readout__unit' }, [figure.unit]),
        ]),
        el('span', { class: 'buai-readout__bounds' }, ['[ ' + figure.low + ' to ' + figure.high + ' ]']),
      ])
    );
    group.appendChild(rangeBar(range));
    return group;
  }

  function metastrip(items) {
    return el(
      'div',
      { class: 'buai-metastrip' },
      items.map(function (item) {
        return el('span', { class: 'buai-metastrip__item' }, [item]);
      })
    );
  }

  /* ---------------------------------------------------------------- bars */

  function bars(rows, labelOf) {
    var peak = rows.reduce(function (top, row) {
      return Math.max(top, row.energyWh ? num(row.energyWh.central) : 0);
    }, 0);
    return el(
      'div',
      { class: 'buai-dash__bars' },
      rows.map(function (row) {
        var value = row.energyWh ? num(row.energyWh.central) : 0;
        var height = peak > 0 ? (value / peak) * 100 : 0;
        return el('div', { class: 'buai-dash__period' }, [
          el('div', { class: 'buai-dash__bar-track' }, [
            el('div', {
              class: row.energyWh ? 'buai-dash__bar' : 'buai-dash__bar buai-dash__bar--unknown',
              style: 'height:' + (row.energyWh ? height.toFixed(1) : '100') + '%',
              title: row.count + ' ' + plural(row.count, 'turn', 'turns') + ', ' + row.text.energy,
            }),
          ]),
          el('span', { class: 'buai-dash__periodlabel' }, [labelOf(row)]),
          el('span', { class: 'buai-dash__periodvalue' }, [row.text.energy]),
        ]);
      })
    );
  }

  function meter(share) {
    var cells = Math.max(0, Math.min(10, Math.floor(num(share) * 10 + 0.5)));
    var box = el('span', { class: 'buai-dash__meter', role: 'img', 'aria-label': Math.round(num(share) * 100) + ' per cent' });
    for (var index = 0; index < 10; index += 1) {
      box.appendChild(el('span', { class: index < cells ? 'buai-dash__cell buai-dash__cell--on' : 'buai-dash__cell' }));
    }
    return box;
  }

  function table(headers, rows) {
    var head = el('tr', null, headers.map(function (header) {
      return el('th', { scope: 'col', style: header.right ? 'text-align:right' : '' }, [header.text]);
    }));
    var body = el('tbody', null, rows.map(function (cells) {
      return el('tr', null, cells.map(function (cell) {
        return el('td', { class: cell.num ? 'buai-num' : '' }, cell.nodes || [cell.text]);
      }));
    }));
    return el('div', { class: 'buai-scroll-x' }, [
      el('table', { class: 'buai-table' }, [el('thead', null, [head]), body]),
    ]);
  }

  function section(title, children) {
    return el('section', null, [el('h2', null, [title])].concat(children));
  }

  /* --------------------------------------------------------------- rings */

  function rings(saving) {
    var total = saving.energyWh ? num(saving.energyWh.central) : 0;
    var inner = 14;
    var room = 78;
    var radius = inner;
    var picture = svg('svg', {
      class: 'buai-dash__rings',
      viewBox: '0 0 200 200',
      role: 'img',
      'aria-label': saving.byDay.length + ' rings, one per day, growing with the energy saved that day',
    });
    picture.appendChild(svg('circle', { cx: 100, cy: 100, r: inner, class: 'buai-dash__ring buai-dash__ring--core' }));
    saving.byDay.forEach(function (day) {
      var share = total > 0 && day.energyWh ? num(day.energyWh.central) / total : 0;
      var grow = share * room;
      radius += Math.max(1.5, grow);
      picture.appendChild(
        svg('circle', {
          cx: 100,
          cy: 100,
          r: radius.toFixed(2),
          class: grow > 1.5 ? 'buai-dash__ring buai-dash__ring--grew' : 'buai-dash__ring',
        })
      );
    });

    var note =
      'Against ' +
      saving.baseline +
      ', priced on the same rows, region and boundary as everything else here. A turn that was already on the largest model saved nothing.';
    if (saving.skipped > 0) {
      note +=
        ' ' +
        saving.skipped +
        ' ' +
        plural(saving.skipped, 'turn', 'turns') +
        ' could not be re-priced and ' +
        plural(saving.skipped, 'is', 'are') +
        ' not in the figure.';
    }

    return section('What smaller models saved', [
      el('div', { class: 'buai-dash__saving-row' }, [
        picture,
        el('div', null, [
          readout('Energy not drawn', saving.readout.energy, saving.energyWh),
          el('p', { class: 'buai-dash__note' }, [note]),
        ]),
      ]),
    ]);
  }

  /* ---------------------------------------------------------------- page */

  var coverage = data.coverage;
  var totals = data.totals;
  var settings = data.settings;

  app.textContent = '';

  app.appendChild(el('h1', null, ['What your sessions have cost']));
  app.appendChild(
    el('p', { class: 'buai-dash__lede' }, [
      'Every turn of your coding sessions, priced on your own machine from the dataset the tool shipped with. Nothing in this file was fetched from anywhere, and nothing about it left your machine.',
    ])
  );

  if (!totals || totals.count === 0) {
    app.appendChild(
      el('div', { class: 'buai-standby' }, [
        el('span', { class: 'buai-standby__code' }, ['empty']),
        'No turns were found. Run a session in Claude Code or Codex, then "betteruseofai dashboard" again.',
      ])
    );
    return;
  }

  app.appendChild(
    metastrip([
      coverage.turns + ' ' + plural(coverage.turns, 'turn', 'turns'),
      coverage.sessions + ' ' + plural(coverage.sessions, 'session', 'sessions'),
      coverage.from.slice(0, 10) + ' to ' + coverage.to.slice(0, 10),
      'dataset ' + data.header.datasetVersion,
      'region ' + settings.region,
      'water ' + settings.waterScope,
      'telemetry: none',
    ])
  );

  app.appendChild(
    el('div', { class: 'buai-dash__readouts', style: 'margin-top:var(--space-6)' }, [
      readout('Energy', totals.readout.energy, totals.energyWh),
      readout('Water', totals.readout.water, totals.waterMl),
      readout('Carbon', totals.readout.carbon, totals.carbonG),
    ])
  );

  var coverageText =
    coverage.fromTranscripts +
    ' ' +
    plural(coverage.fromTranscripts, 'turn was', 'turns were') +
    ' read from transcripts still on disk';
  if (coverage.fromLogOnly > 0) {
    coverageText +=
      ', and ' +
      coverage.fromLogOnly +
      ' ' +
      plural(coverage.fromLogOnly, 'is', 'are') +
      ' known only from the log, because the transcript has since been deleted.';
  } else {
    coverageText += '. Nothing yet rests on the log alone.';
  }
  if (coverage.logWarn) {
    coverageText +=
      ' The log has grown to ' +
      coverage.logMb +
      ' MB. Run "betteruseofai prune --before <date>" to trim it.';
  }
  app.appendChild(el('p', { class: 'buai-dash__note' }, [coverageText]));

  if (data.caveats && data.caveats.length > 0) {
    app.appendChild(
      el('ul', { class: 'buai-dash__caveats' }, data.caveats.map(function (line) {
        return el('li', null, [line]);
      }))
    );
  }

  if (data.byWeek.length > 0) {
    app.appendChild(
      section('Every week', [
        bars(data.byWeek, function (row) {
          return row.key.slice(5);
        }),
        el('p', { class: 'buai-dash__note' }, ['One bar per week, labelled by the Monday it starts on. The height is the central energy figure; a dashed bar is a week where nothing could be priced.']),
      ])
    );
  }

  var recentDays = data.byDay.slice(-30);
  if (recentDays.length > 0) {
    app.appendChild(
      section(recentDays.length < data.byDay.length ? 'The last thirty days with sessions' : 'Every day', [
        bars(recentDays, function (row) {
          return row.key.slice(5);
        }),
      ])
    );
  }

  if (data.saving) app.appendChild(rings(data.saving));

  app.appendChild(
    section('Which models', [
      table(
        [{ text: 'Model' }, { text: 'Turns', right: true }, { text: 'Share' }, { text: 'Energy', right: true }, { text: 'Water', right: true }, { text: 'Carbon', right: true }],
        data.byModel.map(function (row) {
          return [
            { text: row.key === 'unknown' ? 'a model we do not recognise' : row.name },
            { text: String(row.count), num: true },
            { nodes: [meter(row.share), el('span', { class: 'buai-mono buai-dash__muted' }, [Math.round(num(row.share) * 100) + '%'])] },
            { text: row.text.energy, num: true },
            { text: row.text.water, num: true },
            { text: row.text.carbon, num: true },
          ];
        })
      ),
    ])
  );

  if (data.bySurface.length > 1) {
    app.appendChild(
      section('By tool', [
        table(
          [{ text: 'Tool' }, { text: 'Turns', right: true }, { text: 'Energy', right: true }, { text: 'Water', right: true }, { text: 'Carbon', right: true }],
          data.bySurface.map(function (row) {
            return [
              { text: row.key },
              { text: String(row.count), num: true },
              { text: row.text.energy, num: true },
              { text: row.text.water, num: true },
              { text: row.text.carbon, num: true },
            ];
          })
        ),
      ])
    );
  }

  if (data.sessions.length > 0) {
    app.appendChild(
      section('Heaviest sessions', [
        table(
          [{ text: 'Session' }, { text: 'First turn' }, { text: 'Turns', right: true }, { text: 'Most used' }, { text: 'Energy', right: true }],
          data.sessions.map(function (row) {
            return [
              { nodes: [el('span', { class: 'buai-mono' }, [row.key])] },
              { text: row.from.slice(0, 10) },
              { text: String(row.count), num: true },
              { text: row.topModel === 'unknown' ? 'a model we do not recognise' : row.topModel },
              { text: row.text.energy, num: true },
            ];
          })
        ),
        el('p', { class: 'buai-dash__note' }, ['Run "betteruseofai session <id>" for one session in full, with its heaviest turns and the sources each figure rests on.']),
      ])
    );
  }

  if (data.projects === null) {
    app.appendChild(
      section('Projects and branches', [
        el('p', { class: 'buai-dash__note' }, [
          'Left out. Directory names and branch names are the sort of thing a screenshot carries further than intended, so they stay out unless asked for: run "betteruseofai dashboard --with-projects".',
        ]),
      ])
    );
  } else {
    app.appendChild(
      section('Projects and branches', [
        table(
          [{ text: 'Project' }, { text: 'Branch' }, { text: 'Turns', right: true }, { text: 'Energy', right: true }],
          data.projects.map(function (row) {
            return [
              { nodes: [el('span', { class: 'buai-mono' }, [row.project])] },
              { nodes: [el('span', { class: 'buai-mono' }, [row.branch === null ? 'no branch recorded' : row.branch])] },
              { text: String(row.count), num: true },
              { text: row.text.energy, num: true },
            ];
          })
        ),
        el('p', { class: 'buai-dash__note' }, ['The last part of the working directory, and the branch the transcript recorded. Older turns carry no branch.']),
      ])
    );
  }

  var comparisons = [];
  ['energy', 'water', 'carbon'].forEach(function (quantity) {
    (data.equivalents[quantity] || []).forEach(function (one) {
      comparisons.push(
        el('li', null, [
          el('span', { class: 'buai-dash__quantity' }, [quantity]),
          one.text + ' ' + one.label + (one.stale ? ', from a figure marked stale' : ''),
        ])
      );
    });
  });
  if (comparisons.length > 0) {
    app.appendChild(section('Put another way', [el('ul', { class: 'buai-dash__equivalents' }, comparisons)]));
  }

  app.appendChild(
    el('p', { class: 'buai-dash__foot' }, [
      'An estimate, not a measurement. Every figure is a range because the published measurements disagree, and every range rests on sources the tool can show you: "betteruseofai session <id>" lists them. How the figures are worked out is at ',
      el('a', { href: 'https://betteruseofai.org/methodology', rel: 'external noreferrer' }, ['betteruseofai.org/methodology']),
      '. Written ' + data.header.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC.',
    ])
  );
})();

    </script>
  </body>
</html>
`;

// ../cli-ts/src/commands/dashboard.ts
init_log();

// ../cli-ts/src/canonical.ts
init_dist();
var SCHEMA_VERSION = 1;
var escapeString = (value) => JSON.stringify(value);
var write = (value, indent) => {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return canonicalNumber(value);
    case "string":
      return escapeString(value);
    case "undefined":
      return "null";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = indent + "  ";
    const items = value.map((item) => `${inner}${write(item, inner)}`);
    return `[
${items.join(",\n")}
${indent}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    if (entries.length === 0) return "{}";
    const inner = indent + "  ";
    const parts = entries.map(([key, item]) => `${inner}${escapeString(key)}: ${write(item, inner)}`);
    return `{
${parts.join(",\n")}
${indent}}`;
  }
  return "null";
};
var canonicalJson = (value) => `${write(value, "")}
`;

// ../cli-ts/src/output.ts
init_dist();

// ../../packages/tokens/tokens.json
var tokens_default = {
  $comment: "The single source for the design tokens. tokens.css is generated from this file by scripts/build-tokens.mjs, the composer hint's palette by ../ui-hint/scripts/palette.mjs, and both command line tools read the terminal block. test/contrast.test.ts asserts that the generated CSS is what this file says and that every colour pair holds its contrast.",
  version: "0.2.0",
  colour: {
    $comment: "Light first. One accent hue, green, and one warm state colour. The brief's palette words map onto these: quartz and sand are the three grounds, pine and moss are the accent and its tint, the warm tone is hazard. There is no deep water and no iridescence, because a second hue and a gradient are both ruled out below.",
    light: {
      bg: "#eeece9",
      "bg-raised": "#f6f5f2",
      "bg-sunken": "#e4e1dc",
      ink: "#14201a",
      "ink-2": "#1b2a21",
      muted: "#5a655e",
      accent: "#0f6b3a",
      "accent-strong": "#0a5c31",
      "accent-tint": "#d3e3d8",
      hazard: "#9a4b00",
      danger: "#a3251c",
      hairline: "#cfcbc4",
      "border-ui": "#6b756f"
    },
    dark: {
      bg: "#121412",
      "bg-raised": "#1a1d1a",
      "bg-sunken": "#0c0e0c",
      ink: "#e6e3dc",
      "ink-2": "#d9d6cf",
      muted: "#9aa39d",
      accent: "#3ddc84",
      "accent-strong": "#6fe3a0",
      "accent-tint": "#183824",
      hazard: "#f5a524",
      danger: "#ff6b61",
      hairline: "#2a2f2b",
      "border-ui": "#8f9892"
    }
  },
  radius: "0",
  font: {
    display: "'Big Shoulders', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif",
    body: "'Schibsted Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: "'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace"
  },
  scale: {
    $comment: "Fluid, 320px to 1440px.",
    "step--2": "clamp(0.6875rem, 0.67rem + 0.09vw, 0.75rem)",
    "step--1": "clamp(0.8125rem, 0.79rem + 0.11vw, 0.875rem)",
    "step-0": "clamp(1rem, 0.97rem + 0.15vw, 1.0625rem)",
    "step-1": "clamp(1.1875rem, 1.13rem + 0.28vw, 1.375rem)",
    "step-2": "clamp(1.4375rem, 1.33rem + 0.53vw, 1.8125rem)",
    "step-3": "clamp(1.75rem, 1.55rem + 1vw, 2.4375rem)",
    "step-4": "clamp(2.125rem, 1.75rem + 1.86vw, 3.375rem)",
    "step-5": "clamp(3.5rem, 1.9rem + 8vw, 8.5rem)"
  },
  space: {
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.5rem",
    "6": "2rem",
    "7": "3rem",
    "8": "4.5rem",
    "9": "7rem"
  },
  layout: {
    measure: "62ch",
    gutter: "clamp(1rem, 4vw, 3rem)",
    rule: "1px"
  },
  tempo: {
    $comment: "All of it short. The landing backdrop is the one exception and has its own rules in docs/design/MOTION.md.",
    fast: "120ms",
    base: "200ms",
    slow: "320ms",
    ease: "cubic-bezier(0.2, 0, 0.1, 1)"
  },
  gradients: {
    $comment: "No colour gradients anywhere. What is allowed is structure and legibility: hatching on the hazard stripe and the upper band, the ruled paper grid, and the scrim and mask that keep the landing headline readable over its backdrop. Each one is named here and the test counts them.",
    allowed: [
      {
        file: "components.css",
        count: 3,
        why: "hazard stripe, upper-band hatching, paper grid rules"
      },
      {
        file: "apps/site/src/styles/global.css",
        count: 3,
        why: "the headline scrim and the two vendor spellings of the backdrop mask"
      }
    ]
  },
  icon: {
    $comment: "The mark's colours where it cannot inherit one. A manifest icon is a fixed PNG, and Chrome shows it on a light toolbar (#f1f3f4) or a dark one (#202124) with no way to tell which. This tone clears three to one on both, and on both of our grounds; the test asserts it. Firefox gets ink and paper variants through theme_icons.",
    toolbar: "#717c75",
    chromeToolbars: {
      light: "#f1f3f4",
      dark: "#202124"
    }
  },
  terminal: {
    $comment: "The ANSI codes the two command line tools use, and what each is for. Figures are green and caveats are yellow, never red against green, so the two states stay apart for anyone who cannot separate red from green. Dim is for labels and metadata, bold for one heading. Under NO_COLOR, --no-color or a pipe none of these are written.",
    codes: {
      dim: 2,
      bold: 1,
      green: 32,
      yellow: 33,
      reset: 0
    },
    roles: {
      figure: "green",
      caveat: "yellow",
      label: "dim",
      heading: "bold"
    },
    meter: {
      filled: "\u2593",
      empty: "\u2591",
      asciiFilled: "#",
      asciiEmpty: "."
    }
  }
};

// ../cli-ts/src/output.ts
var CODES = tokens_default.terminal.codes;
var ANSI = Object.fromEntries(
  Object.entries(CODES).map(([name, code]) => [name, `\x1B[${code}m`])
);
var paint = (context, colour, text) => context.colour ? `${ANSI[colour]}${text}${ANSI.reset}` : text;
var meter = (share, ascii) => {
  const cells = Math.max(0, Math.min(10, Math.floor(share * 10 + 0.5)));
  const glyphs = tokens_default.terminal.meter;
  const on = ascii ? glyphs.asciiFilled : glyphs.filled;
  const off = ascii ? glyphs.asciiEmpty : glyphs.empty;
  return on.repeat(cells) + off.repeat(10 - cells);
};
var words = (value) => {
  const table2 = [
    "nought",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty"
  ];
  return table2[value] ?? String(value);
};
var staleNote = (source, now) => {
  const year = Number.parseInt((source?.date ?? "").slice(0, 4), 10);
  if (!Number.isFinite(year)) return ", from a figure marked stale";
  const age = now.getUTCFullYear() - year;
  return `, from a figure now ${words(age)} years old`;
};
var rangeOut = (range) => range === null ? null : {
  low: canonicalNumber(range.low),
  central: canonicalNumber(range.central),
  high: canonicalNumber(range.high)
};
var payload = (context, body) => ({
  header: {
    schemaVersion: SCHEMA_VERSION,
    datasetVersion: context.dataset.version,
    datasetSha256: context.dataset.sha256,
    generatedWith: "betteruseofai typescript",
    generatedAt: context.now.toISOString()
  },
  ...body
});
var emitJson = (context, body) => canonicalJson(payload(context, body));
var table = (context, headers, rows, align = []) => {
  const widths = headers.map(
    (header, column) => Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length))
  );
  const pad = (text, column) => align[column] === "right" ? text.padStart(widths[column] ?? 0) : text.padEnd(widths[column] ?? 0);
  const lines = [
    paint(context, "dim", headers.map((header, column) => pad(header.toUpperCase(), column)).join("  ")),
    paint(context, "dim", widths.map((width) => "-".repeat(width)).join("  ")),
    ...rows.map((row) => row.map((cell, column) => pad(cell, column)).join("  "))
  ];
  return lines.join("\n");
};
var readout = (context, totals) => {
  const options = { flags: totals.flags, ascii: context.ascii };
  return [
    `  energy  ${formatRange(totals.energyWh, { ...options, unit: "Wh" })}`,
    `  water   ${formatRange(totals.waterMl, { ...options, unit: "mL" })}`,
    `  carbon  ${formatRange(totals.carbonG, { ...options, unit: "g" })}`
  ];
};
var caveats = (context, totals) => {
  const lines = [];
  if (totals.unknownModelCount > 0) {
    lines.push(
      paint(
        context,
        "yellow",
        `  ${totals.unknownModelCount} of ${totals.count} turns used a model we do not recognise. They are not in the figures above.`
      )
    );
  }
  if (totals.noBenchmarkCount > 0) {
    lines.push(
      paint(
        context,
        "yellow",
        `  ${totals.noBenchmarkCount} turns used a model nobody has measured. They are not in the figures above.`
      )
    );
  }
  if (totals.flags.includes("thinking-unknown")) {
    lines.push("  Some turns hid their reasoning tokens, so the figures are a lower bound.");
  }
  if (totals.flags.includes("proxy-row")) {
    lines.push("  Some models have never been measured, so their share is scaled from one that has.");
  }
  if (totals.flags.includes("region-default")) {
    lines.push("  No region given, so this uses the world average grid. Pass --region to change it.");
  }
  return lines;
};
var short = (range, unit) => {
  if (range === null) return "unknown";
  const scaled = scaleUnit(range.central, unit);
  return `${displayNumber(scaled.value)} ${scaled.unit}`;
};

// ../cli-ts/src/commands/dashboard.ts
var DATA_PLACEHOLDER = "__BUAI_DATA__";
var figure = (range, unit, flags) => {
  if (range === null) return null;
  const lowerBound = flags.includes("thinking-unknown");
  const estimated = flags.includes("tokens-estimated") || flags.includes("derived-rate");
  const scaled = scaleUnit(range.central, unit);
  const divisor = scaled.unit !== unit && scaled.value !== 0 ? range.central / scaled.value : 1;
  return {
    prefix: lowerBound ? "\u2265 " : estimated ? "~" : "",
    value: displayNumber(scaled.value),
    unit: scaled.unit,
    low: displayNumber(range.low / divisor),
    high: displayNumber(range.high / divisor)
  };
};
var texts = (one) => ({
  energy: short(one.energyWh, "Wh"),
  water: short(one.waterMl, "mL"),
  carbon: short(one.carbonG, "g")
});
var bucketOut = (one) => ({
  key: one.key,
  count: one.count,
  energyWh: rangeOut(one.energyWh),
  waterMl: rangeOut(one.waterMl),
  carbonG: rangeOut(one.carbonG),
  unknownModelCount: one.unknownModelCount,
  text: texts(one)
});
var projectName = (path) => {
  if (!path) return "unknown project";
  const parts = path.split(/[\\/]+/).filter((part) => part !== "");
  return parts[parts.length - 1] ?? "unknown project";
};
var byCountThenKey = (a, b) => b.count !== a.count ? b.count - a.count : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var dashboardPayload = async (context, args) => {
  const withProjects = flagBool(args.flags, "with-projects");
  const loaded = await loadEvents(context, args);
  const { pairs } = loaded;
  const [totals] = aggregate(pairs, "all");
  const models2 = aggregate(pairs, "model").sort(byCountThenKey);
  const surfaces = aggregate(pairs, "surface").sort(byCountThenKey);
  const sessions2 = aggregate(pairs, "session").sort((a, b) => {
    const left = a.energyWh?.central ?? -1;
    const right = b.energyWh?.central ?? -1;
    if (left !== right) return right - left;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  }).slice(0, 10);
  const options = {
    ...context.regionCode ? { regionCode: context.regionCode } : {},
    waterScope: context.waterScope,
    carbonBasis: context.carbonBasis
  };
  const saved = totals ? saving(pairs, context.dataset, options) : null;
  const projects = withProjects ? (() => {
    const groups = /* @__PURE__ */ new Map();
    for (const { event, estimate: estimate2 } of pairs) {
      const project = projectName(typeof event.meta?.["project"] === "string" ? event.meta["project"] : void 0);
      const branchValue = event.meta?.["branch"];
      const branch = typeof branchValue === "string" && branchValue ? branchValue : null;
      const key = `${project}
${branch ?? ""}`;
      const group = groups.get(key) ?? { project, branch, count: 0, energyWh: null };
      group.count += 1;
      if (estimate2.energyWh) {
        group.energyWh = group.energyWh ? {
          low: group.energyWh.low + estimate2.energyWh.low,
          central: group.energyWh.central + estimate2.energyWh.central,
          high: group.energyWh.high + estimate2.energyWh.high
        } : estimate2.energyWh;
      }
      groups.set(key, group);
    }
    return [...groups.values()].sort(
      (a, b) => b.count !== a.count ? b.count - a.count : a.project !== b.project ? a.project < b.project ? -1 : 1 : (a.branch ?? "") < (b.branch ?? "") ? -1 : (a.branch ?? "") > (b.branch ?? "") ? 1 : 0
    ).map((group) => ({
      project: group.project,
      branch: group.branch,
      count: group.count,
      energyWh: rangeOut(group.energyWh),
      text: { energy: short(group.energyWh, "Wh") }
    }));
  })() : null;
  const sessionKeys = new Set(pairs.map(({ event }) => event.sessionId ?? event.conversationId ?? "no-session"));
  const timestamps = pairs.map(({ event }) => event.timestamp).sort();
  const logMb = Math.round(loaded.log.bytes / (1024 * 1024));
  const quiet = { ...context, colour: false };
  const equivalentsOut = (value, quantity) => equivalents(value ?? null, quantity, context.dataset, 2).map((one) => ({
    id: one.id,
    count: canonicalNumber(one.count),
    text: one.count.toFixed(1),
    label: one.label,
    stale: one.stale
  }));
  return {
    command: "dashboard",
    window: { since: context.since ?? null, until: context.until ?? null },
    settings: {
      region: context.regionCode ?? context.dataset.defaultRegion,
      waterScope: context.waterScope,
      carbonBasis: context.carbonBasis
    },
    withProjects,
    coverage: {
      turns: pairs.length,
      sessions: sessionKeys.size,
      from: timestamps[0] ?? null,
      to: timestamps[timestamps.length - 1] ?? null,
      fromTranscripts: pairs.length - loaded.log.fromLogOnly,
      fromLogOnly: loaded.log.fromLogOnly,
      appended: loaded.log.appended,
      logEnabled: loaded.log.enabled,
      logFiles: loaded.log.files,
      logBytes: loaded.log.bytes,
      logMb,
      logWarn: loaded.log.bytes > LOG_WARN_BYTES
    },
    totals: totals ? {
      count: totals.count,
      energyWh: rangeOut(totals.energyWh),
      waterMl: rangeOut(totals.waterMl),
      carbonG: rangeOut(totals.carbonG),
      unknownModelCount: totals.unknownModelCount,
      noBenchmarkCount: totals.noBenchmarkCount,
      flags: totals.flags,
      readout: {
        energy: figure(totals.energyWh, "Wh", totals.flags),
        water: figure(totals.waterMl, "mL", totals.flags),
        carbon: figure(totals.carbonG, "g", totals.flags)
      }
    } : null,
    byWeek: aggregate(pairs, "week").map(bucketOut),
    byDay: aggregate(pairs, "day").map(bucketOut),
    byModel: models2.map((one) => ({
      ...bucketOut(one),
      name: one.key === "unknown" ? "unknown" : getModel(one.key, context.dataset)?.displayName ?? one.key,
      share: canonicalNumber(totals ? one.count / totals.count : 0)
    })),
    bySurface: surfaces.map(bucketOut),
    sessions: sessions2.map((one) => {
      const top = Object.entries(one.byModel).sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1)[0];
      const topModel = top ? top[0] === "unknown" ? "unknown" : getModel(top[0], context.dataset)?.displayName ?? top[0] : "unknown";
      return { ...bucketOut(one), from: one.from, to: one.to, topModel };
    }),
    saving: saved ? {
      baseline: saved.baseline,
      energyWh: rangeOut(saved.energyWh),
      waterMl: rangeOut(saved.waterMl),
      carbonG: rangeOut(saved.carbonG),
      skipped: saved.skipped,
      byDay: saved.byDay.map((day) => ({ day: day.day, energyWh: rangeOut(day.energyWh) })),
      readout: { energy: figure(saved.energyWh, "Wh", []) }
    } : null,
    projects,
    equivalents: {
      energy: equivalentsOut(totals?.energyWh?.central, "energy"),
      water: equivalentsOut(totals?.waterMl?.central, "water"),
      carbon: equivalentsOut(totals?.carbonG?.central, "carbon")
    },
    caveats: totals ? caveats(quiet, totals).map((line) => line.trim()) : []
  };
};
var renderDashboard = (json) => DASHBOARD_TEMPLATE.replace(DATA_PLACEHOLDER, () => json.replace(/<\//g, "<\\/"));
var openInBrowser = (path) => {
  const [command, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", path]] : process.platform === "darwin" ? ["open", [path]] : ["xdg-open", [path]];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => void 0);
    child.unref();
  } catch {
  }
};
var dashboard = async (context, args) => {
  const body = await dashboardPayload(context, args);
  if (context.json) return emitJson(context, body);
  const json = canonicalJson(payload(context, body));
  const html = renderDashboard(json);
  const outFlag = flagString(args.flags, "out");
  if (outFlag === "-") return html;
  const defaultOut = context.logDir ? join6(defaultOutDir(context.logDir), "dashboard.html") : join6(process.cwd(), "dashboard.html");
  const outPath = outFlag ? isAbsolute(outFlag) ? outFlag : resolve(process.cwd(), outFlag) : defaultOut;
  mkdirSync2(dirname(outPath), { recursive: true });
  writeFileSync2(outPath, html, "utf8");
  if (!flagBool(args.flags, "no-open")) openInBrowser(outPath);
  const lines = [`Written to ${outPath}`];
  const { coverage } = body;
  if (coverage.turns === 0) {
    lines.push("No turns were found, so the page says so rather than showing noughts.");
  } else {
    lines.push(
      `${coverage.turns} turns across ${coverage.sessions} ${coverage.sessions === 1 ? "session" : "sessions"}, ${coverage.from?.slice(0, 10)} to ${coverage.to?.slice(0, 10)}.`
    );
    if (coverage.fromLogOnly > 0) {
      lines.push(
        paint(context, "dim", `  ${coverage.fromLogOnly} of those are known only from the log; their transcripts have gone.`)
      );
    }
  }
  if (!body.withProjects) {
    lines.push(paint(context, "dim", "  Projects and branches are left out. Add --with-projects to include them."));
  }
  if (coverage.logWarn) {
    lines.push(
      paint(context, "yellow", `  The log has grown to ${coverage.logMb} MB. Run "betteruseofai prune --before <date>" to trim it.`)
    );
  }
  return lines.join("\n");
};
var prune = async (context, args) => {
  if (!context.logDir) {
    throw new Error("There is no log for this run to prune. Without --dir the log is on, or pass --log <path>.");
  }
  const beforeFlag = flagString(args.flags, "before");
  if (!beforeFlag) {
    throw new Error("prune needs --before, for example --before 365d or --before 2026-01-01.");
  }
  const before = resolveSince(beforeFlag, context.now) ?? beforeFlag;
  if (Number.isNaN(new Date(before).getTime())) {
    throw new Error(`--before is not a date I can read: ${beforeFlag}`);
  }
  const dryRun = flagBool(args.flags, "dry-run");
  const result3 = pruneLog(context.logDir, before, dryRun);
  if (context.json) {
    return emitJson(context, {
      command: "prune",
      before,
      dryRun,
      removed: result3.removed,
      duplicates: result3.duplicates,
      kept: result3.kept,
      filesBefore: result3.filesBefore,
      filesAfter: result3.filesAfter,
      bytesBefore: result3.bytesBefore,
      bytesAfter: result3.bytesAfter
    });
  }
  const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
  const verb = dryRun ? "Would remove" : "Removed";
  const lines = [
    `${verb} ${result3.removed} ${result3.removed === 1 ? "turn" : "turns"} before ${before.slice(0, 10)} and ${dryRun ? "would compact" : "compacted"} ${result3.duplicates} superseded ${result3.duplicates === 1 ? "line" : "lines"}.`,
    `${result3.kept} ${result3.kept === 1 ? "turn remains" : "turns remain"} in ${result3.filesAfter} ${result3.filesAfter === 1 ? "file" : "files"}, ${kb(result3.bytesAfter)}, was ${kb(result3.bytesBefore)}.`
  ];
  if (dryRun) lines.push(paint(context, "dim", "  Nothing was written. Run again without --dry-run to do it."));
  return lines.join("\n");
};

// ../cli-ts/src/commands/misc.ts
init_dist();
init_dist3();
init_args();
init_context();
init_log();
var models = (context, args) => {
  const showAll = flagBool(args.flags, "all");
  const at = context.now.toISOString().slice(0, 10);
  const rows = context.dataset.models.map((model) => {
    const row = selectBenchmark(model, context.dataset, { at });
    const target = downgradeTarget(model, context.dataset);
    return { model, row, target };
  });
  if (context.json) {
    return emitJson(context, {
      command: "models",
      models: rows.map(({ model, row, target }) => ({
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        family: model.family,
        tier: model.tier,
        ordinal: model.ordinal,
        reasoning: model.reasoning,
        aliases: [...model.aliases].sort(),
        benchmarkRowId: row?.id ?? null,
        methodology: row?.methodology ?? null,
        boundary: row?.boundary ?? null,
        qualityScore: row?.qualityScore ?? null,
        sourceUrl: row?.source.url ?? null,
        downgradeTarget: target?.id ?? null
      })),
      ...showAll ? {
        regions: context.dataset.regions.map((region) => ({
          code: region.code,
          name: region.name,
          gridGco2PerKwh: canonicalNumber(region.gridGco2PerKwh.central),
          year: region.year
        }))
      } : {}
    });
  }
  const lines = [
    table(
      context,
      ["model", "tier", "thinks", "measured by", "quality", "one rung down"],
      rows.map(({ model, row, target }) => [
        model.displayName,
        model.tier,
        model.reasoning ? "yes" : "no",
        row?.methodology ?? "nothing",
        row ? `${row.qualityScore} of 5` : "unknown",
        target?.displayName ?? "nothing smaller"
      ])
    )
  ];
  if (showAll) {
    lines.push("");
    lines.push(paint(context, "dim", "REGIONS"));
    lines.push(
      table(
        context,
        ["code", "name", "gCO2e per kWh", "year"],
        context.dataset.regions.map((region) => [
          region.code,
          region.name,
          String(Math.round(region.gridGco2PerKwh.central)),
          String(region.year)
        ]),
        ["left", "left", "right", "right"]
      )
    );
  }
  lines.push("");
  lines.push(
    paint(
      context,
      "dim",
      "  A quality of 2 means the figure is scaled from a different model, because nobody has measured this one."
    )
  );
  return lines.join("\n");
};
var exportEvents = async (context, args) => {
  const format = flagString(args.flags, "format") ?? (context.json ? "json" : "csv");
  const { pairs } = await loadEvents(context, args);
  if (format === "json") {
    return emitJson(context, {
      command: "export",
      events: pairs.map(({ event, estimate: estimate2 }) => ({
        id: event.id,
        timestamp: event.timestamp,
        surface: event.surface,
        sessionId: event.sessionId ?? null,
        modelRaw: event.modelRaw,
        modelId: estimate2.modelId,
        inputTokens: event.tokens.input ?? 0,
        outputTokens: event.tokens.output ?? 0,
        cachedReadTokens: event.tokens.cachedRead ?? 0,
        cachedWriteTokens: event.tokens.cachedWrite ?? 0,
        thinkingTokens: event.tokens.thinking,
        energyWhCentral: estimate2.energyWh ? canonicalNumber(estimate2.energyWh.central) : null,
        waterMlCentral: estimate2.waterMl ? canonicalNumber(estimate2.waterMl.central) : null,
        carbonGCentral: estimate2.carbonG ? canonicalNumber(estimate2.carbonG.central) : null,
        benchmarkRowId: estimate2.basis.benchmarkRowId,
        flags: [...estimate2.basis.flags].sort()
      }))
    });
  }
  if (format !== "csv") throw new Error("--format must be csv or json.");
  const cell = (value) => value === null || value === void 0 ? "" : canonicalNumber(value);
  const header = [
    "timestamp",
    "surface",
    "session",
    "model",
    "model_raw",
    "input_tokens",
    "cached_read_tokens",
    "cached_write_tokens",
    "output_tokens",
    "thinking_tokens",
    "energy_wh_low",
    "energy_wh_central",
    "energy_wh_high",
    "water_ml_central",
    "carbon_g_central",
    "benchmark_row",
    "flags"
  ].join(",");
  const escape = (text) => /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  const rows = pairs.map(
    ({ event, estimate: estimate2 }) => [
      event.timestamp,
      event.surface,
      event.sessionId ?? "",
      estimate2.modelId ?? "",
      event.modelRaw,
      String(event.tokens.input ?? 0),
      String(event.tokens.cachedRead ?? 0),
      String(event.tokens.cachedWrite ?? 0),
      String(event.tokens.output ?? 0),
      event.tokens.thinking === null ? "" : String(event.tokens.thinking ?? 0),
      cell(estimate2.energyWh?.low),
      cell(estimate2.energyWh?.central),
      cell(estimate2.energyWh?.high),
      cell(estimate2.waterMl?.central),
      cell(estimate2.carbonG?.central),
      estimate2.basis.benchmarkRowId ?? "",
      [...estimate2.basis.flags].sort().join(" ")
    ].map(escape).join(",")
  );
  return [header, ...rows].join("\n");
};
var doctor = async (context, args) => {
  const checks = [];
  const claudeDir = defaultClaudeDir();
  const codexDir = defaultCodexDir();
  const claudeThere = await exists(claudeDir);
  const codexThere = await exists(codexDir);
  checks.push({
    name: "Claude Code transcripts",
    ok: claudeThere,
    detail: claudeThere ? claudeDir : `Nothing at ${claudeDir}. Set BUAI_CLAUDE_DIR if yours lives somewhere else.`
  });
  checks.push({
    name: "Codex CLI rollouts",
    ok: codexThere,
    detail: codexThere ? codexDir : `Nothing at ${codexDir}. Set CODEX_HOME if yours lives somewhere else. Rollouts written before 6 September 2025 carry no token counts.`
  });
  const nodeOk = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10) >= 20;
  checks.push({
    name: "Node version",
    ok: nodeOk,
    detail: nodeOk ? process.versions.node : `${process.versions.node}, and we need 20 or newer.`
  });
  checks.push({
    name: "Dataset",
    ok: true,
    detail: `${context.dataset.version}, ${context.dataset.benchmarks.length} benchmark rows, sha ${context.dataset.sha256.slice(0, 12)}`
  });
  const { pairs, readers, log: loadedLog } = await loadEvents(context, args);
  const warnings = readers.flatMap((result3) => result3.warnings);
  const unknown = pairs.filter((pair) => pair.estimate.basis.flags.includes("model-unknown"));
  checks.push({
    name: "Turns found",
    ok: pairs.length > 0,
    detail: pairs.length > 0 ? `${pairs.length} in the window` : "none in the window; try --since 30d"
  });
  checks.push({
    name: "Models recognised",
    ok: unknown.length === 0,
    detail: unknown.length === 0 ? "all of them" : `${unknown.length} turns used: ${[...new Set(unknown.map((p) => p.event.modelRaw))].join(", ")}. Adding them to the dataset would fix that.`
  });
  const mb = Math.round(loadedLog.bytes / (1024 * 1024));
  checks.push({
    name: "Event log",
    ok: loadedLog.enabled && loadedLog.bytes <= LOG_WARN_BYTES,
    detail: !loadedLog.enabled ? "off for this run, because --dir points elsewhere. Pass --log <path> to use one." : `${context.logDir}: ${loadedLog.files} ${loadedLog.files === 1 ? "file" : "files"}, ${mb} MB, ${loadedLog.fromLogOnly} turns known only from here` + (loadedLog.bytes > LOG_WARN_BYTES ? '. Run "betteruseofai prune --before <date>" to trim it.' : "")
  });
  checks.push({
    name: "Lines we could not parse",
    ok: warnings.length === 0,
    detail: warnings.length === 0 ? "none" : `${warnings.length}, which were skipped`
  });
  if (context.json) {
    return emitJson(context, {
      command: "doctor",
      checks: checks.map((check) => ({ name: check.name, ok: check.ok, detail: check.detail }))
    });
  }
  const lines = checks.map(
    (check) => `  ${check.ok ? paint(context, "green", "ok  ") : paint(context, "yellow", "note")}  ${check.name.padEnd(26)}  ${check.detail}`
  );
  lines.push("");
  lines.push(paint(context, "dim", "  Nothing here contacts a network. Every figure is worked out on this machine."));
  return lines.join("\n");
};

// ../cli-ts/src/commands/recommend.ts
init_dist();
init_args();
var out = (range) => range === null ? null : {
  low: canonicalNumber(range.low),
  central: canonicalNumber(range.central),
  high: canonicalNumber(range.high)
};
var recommend = (context, args) => {
  const prompt = args.positional.join(" ");
  if (prompt.trim() === "") {
    throw new Error('Give me a prompt to look at. For example: betteruseofai recommend "17 * 23"');
  }
  const depth = flagString(args.flags, "depth");
  const recommender = createRecommender({
    dataset: context.dataset,
    // Only offered when the user has said they run models locally.
    hasLocalModel: flagBool(args.flags, "local")
  });
  const result3 = recommender.recommend({
    prompt,
    modelId: flagString(args.flags, "model") ?? "claude-opus-5",
    surface: "api",
    ...depth ? { conversationDepth: Number.parseInt(depth, 10) } : {}
  });
  if (context.json) {
    return emitJson(context, {
      command: "recommend",
      recommendation: {
        kind: result3.kind,
        ruleId: result3.ruleId,
        confidence: canonicalNumber(result3.confidence),
        reasons: result3.reasons,
        target: result3.target,
        answer: result3.answer,
        vetoedBy: result3.vetoedBy,
        explanation: result3.explanation,
        showAsHint: result3.showAsHint,
        showInReport: result3.showInReport,
        estimatedSavings: result3.estimatedSavings ? {
          energyWh: out(result3.estimatedSavings.energyWh),
          waterMl: out(result3.estimatedSavings.waterMl),
          carbonG: out(result3.estimatedSavings.carbonG)
        } : null
      }
    });
  }
  const lines = [result3.explanation];
  if (result3.estimatedSavings?.energyWh) {
    const saving2 = result3.estimatedSavings;
    lines.push("");
    lines.push(
      paint(
        context,
        "dim",
        `  That swap would save roughly ${saving2.energyWh?.central.toFixed(2)} Wh, ${saving2.waterMl?.central.toFixed(1)} mL and ${saving2.carbonG?.central.toFixed(2)} g on a turn of this shape. The reply length is a guess, so treat it as a rough figure.`
      )
    );
  }
  if (!result3.showAsHint && result3.showInReport) {
    lines.push("");
    lines.push(paint(context, "dim", "  Not confident enough to interrupt you before you send."));
  }
  return lines.join("\n");
};

// ../cli-ts/src/commands/sessions.ts
init_dist();
init_args();
init_context();
var sessions = async (context, args) => {
  const { pairs } = await loadEvents(context, args);
  const buckets = aggregate(pairs, "session").sort((a, b) => a.from < b.from ? -1 : 1);
  if (context.json) {
    return emitJson(context, {
      command: "sessions",
      sessions: buckets.map((one) => ({
        id: one.key,
        from: one.from,
        to: one.to,
        turns: one.count,
        energyWh: rangeOut(one.energyWh),
        waterMl: rangeOut(one.waterMl),
        carbonG: rangeOut(one.carbonG),
        surfaces: one.bySurface,
        models: one.byModel,
        unknownModelCount: one.unknownModelCount,
        flags: one.flags
      }))
    });
  }
  if (buckets.length === 0) return "No sessions found in that window.";
  return table(
    context,
    ["session", "started", "turns", "energy", "water", "carbon"],
    buckets.map((one) => [
      one.key.length > 20 ? `${one.key.slice(0, 19)}\u2026` : one.key,
      one.from.slice(0, 16).replace("T", " "),
      String(one.count),
      short(one.energyWh, "Wh"),
      short(one.waterMl, "mL"),
      short(one.carbonG, "g")
    ]),
    ["left", "left", "right", "right", "right", "right"]
  );
};
var session = async (context, args) => {
  const wanted = args.positional[0];
  if (!wanted) throw new Error('Which session? Run "betteruseofai sessions" to see the list.');
  const { pairs } = await loadEvents(context, args);
  const mine = pairs.filter(
    (pair) => pair.event.sessionId === wanted || pair.event.sessionId?.startsWith(wanted)
  );
  if (mine.length === 0) throw new Error(`No session here matches "${wanted}".`);
  const [totals] = aggregate(mine, "all");
  const byModel = aggregate(mine, "model");
  if (!totals) throw new Error(`No session here matches "${wanted}".`);
  const heaviest = [...mine].filter((pair) => pair.estimate.energyWh !== null).sort((a, b) => (b.estimate.energyWh?.central ?? 0) - (a.estimate.energyWh?.central ?? 0)).slice(0, 5);
  if (context.json) {
    return emitJson(context, {
      command: "session",
      session: {
        id: mine[0]?.event.sessionId ?? wanted,
        from: totals.from,
        to: totals.to,
        turns: totals.count,
        energyWh: rangeOut(totals.energyWh),
        waterMl: rangeOut(totals.waterMl),
        carbonG: rangeOut(totals.carbonG),
        unknownModelCount: totals.unknownModelCount,
        noBenchmarkCount: totals.noBenchmarkCount,
        flags: totals.flags,
        byModel: byModel.map((one) => ({
          model: one.key,
          turns: one.count,
          energyWh: rangeOut(one.energyWh)
        })),
        heaviestTurns: heaviest.map((pair) => ({
          id: pair.event.id,
          timestamp: pair.event.timestamp,
          model: pair.estimate.modelId,
          energyWh: rangeOut(pair.estimate.energyWh),
          inputTokens: pair.event.tokens.input ?? 0,
          outputTokens: pair.event.tokens.output ?? 0,
          cachedReadTokens: pair.event.tokens.cachedRead ?? 0,
          cachedWriteTokens: pair.event.tokens.cachedWrite ?? 0,
          thinkingTokens: pair.event.tokens.thinking
        }))
      }
    });
  }
  const id = mine[0]?.event.sessionId ?? wanted;
  const notes = caveats(context, totals);
  if (flagBool(args.flags, "brief")) {
    const brief = [
      paint(
        context,
        "bold",
        `Session ${id} \xB7 ${totals.count} turns \xB7 ${totals.from.slice(0, 16).replace("T", " ")} to ${totals.to.slice(11, 16)} UTC`
      ),
      ...readout(context, totals)
    ];
    const top = [...byModel].filter((one) => one.energyWh !== null).sort((a, b) => (b.energyWh?.central ?? 0) - (a.energyWh?.central ?? 0))[0];
    if (top && totals.energyWh && totals.energyWh.central > 0) {
      const share = (top.energyWh?.central ?? 0) / totals.energyWh.central;
      const name = getModel(top.key, context.dataset)?.displayName ?? top.key;
      brief.push(
        `  ${name}  ${meter(share, context.ascii)}  ${Math.floor(share * 100 + 0.5)}% of the energy`
      );
    }
    brief.push(
      paint(
        context,
        "dim",
        notes.length === 0 ? `  No caveats. Run "betteruseofai session ${id}" for the whole report.` : `  ${notes.length} ${notes.length === 1 ? "caveat" : "caveats"}. Run "betteruseofai session ${id}" for the whole report.`
      )
    );
    return brief.join("\n");
  }
  const lines = [];
  lines.push(paint(context, "bold", `Session ${id}`));
  lines.push(
    paint(
      context,
      "dim",
      `${totals.count} turns, ${totals.from.slice(0, 16).replace("T", " ")} to ${totals.to.slice(11, 16)} UTC`
    )
  );
  lines.push("");
  lines.push(...readout(context, totals));
  const found = equivalents(totals.energyWh?.central ?? null, "energy", context.dataset, 2);
  if (found.length > 0) {
    lines.push(
      paint(
        context,
        "dim",
        `          about ${found.map((one) => `${one.count.toFixed(1)} ${one.label}`).join(", or ")}`
      )
    );
  }
  lines.push("");
  lines.push(
    table(
      context,
      ["model", "turns", "energy", "share"],
      byModel.map((one) => {
        const share = (one.energyWh?.central ?? 0) / (totals.energyWh?.central || 1);
        return [
          getModel(one.key, context.dataset)?.displayName ?? one.key,
          String(one.count),
          short(one.energyWh, "Wh"),
          one.energyWh === null ? "unknown" : `${Math.round(share * 100)}%`
        ];
      }),
      ["left", "right", "right", "right"]
    )
  );
  if (heaviest.length > 0) {
    lines.push("");
    lines.push(paint(context, "dim", "HEAVIEST TURNS"));
    lines.push(
      table(
        context,
        // Cache writes are charged at the full input rate and routinely dwarf
        // everything else, so the column has to be here. Without it a turn with
        // 134 output tokens and a 351,000 token cache write looks inexplicable.
        ["at", "model", "in", "cache read", "cache write", "out", "thinking", "energy"],
        heaviest.map((pair) => [
          pair.event.timestamp.slice(11, 19),
          pair.estimate.modelId ?? "unknown",
          String(pair.event.tokens.input ?? 0),
          String(pair.event.tokens.cachedRead ?? 0),
          String(pair.event.tokens.cachedWrite ?? 0),
          String(pair.event.tokens.output ?? 0),
          pair.event.tokens.thinking === null ? "not said" : String(pair.event.tokens.thinking ?? 0),
          formatRange(pair.estimate.energyWh, {
            unit: "Wh",
            bounds: false,
            flags: pair.estimate.basis.flags,
            ascii: context.ascii
          })
        ]),
        ["left", "left", "right", "right", "right", "right", "right", "right"]
      )
    );
  }
  if (notes.length > 0) {
    lines.push("");
    lines.push(...notes);
  }
  const why = explainFlags(totals.flags);
  if (why.length > 0) {
    lines.push("");
    lines.push(paint(context, "dim", "WHY THE FIGURES ARE UNCERTAIN"));
    for (const line of why) lines.push(`  ${line}`);
  }
  return lines.join("\n");
};

// ../cli-ts/src/run.ts
init_statusline();

// ../cli-ts/src/commands/summary.ts
init_dist();
init_args();
init_context();
var BUCKETS = ["day", "week", "model", "surface", "session", "hosting", "all"];
var summary = async (context, args) => {
  const bucketFlag = flagString(args.flags, "by");
  if (bucketFlag && !BUCKETS.includes(bucketFlag)) {
    throw new Error(`--by must be one of: ${BUCKETS.join(", ")}`);
  }
  const bucket = bucketFlag ?? "day";
  const { pairs } = await loadEvents(context, args);
  const buckets = aggregate(pairs, bucket);
  const [totals] = aggregate(pairs, "all");
  if (context.json) {
    return emitJson(context, {
      command: "summary",
      by: bucket,
      window: { since: context.since ?? null, until: context.until ?? null },
      settings: {
        region: context.regionCode ?? context.dataset.defaultRegion,
        waterScope: context.waterScope,
        carbonBasis: context.carbonBasis
      },
      totals: totals ? {
        count: totals.count,
        energyWh: rangeOut(totals.energyWh),
        waterMl: rangeOut(totals.waterMl),
        carbonG: rangeOut(totals.carbonG),
        unknownModelCount: totals.unknownModelCount,
        noBenchmarkCount: totals.noBenchmarkCount,
        flags: totals.flags
      } : null,
      buckets: buckets.map((one) => ({
        key: one.key,
        from: one.from,
        to: one.to,
        count: one.count,
        energyWh: rangeOut(one.energyWh),
        waterMl: rangeOut(one.waterMl),
        carbonG: rangeOut(one.carbonG),
        byModel: one.byModel,
        bySurface: one.bySurface,
        unknownModelCount: one.unknownModelCount,
        noBenchmarkCount: one.noBenchmarkCount,
        flags: one.flags
      }))
    });
  }
  if (!totals || totals.count === 0) {
    return "No sessions found in that window. Try a longer one with --since, or check --source.";
  }
  const lines = [];
  const window = context.since ? `since ${context.since.slice(0, 10)}` : "all time";
  lines.push(paint(context, "bold", `${totals.count} turns, ${window}`));
  lines.push("");
  lines.push(...readout(context, totals));
  for (const [quantity, value] of [
    ["energy", totals.energyWh?.central],
    ["water", totals.waterMl?.central],
    ["carbon", totals.carbonG?.central]
  ]) {
    const found = equivalents(value ?? null, quantity, context.dataset, 1)[0];
    if (found) {
      lines.push(
        paint(
          context,
          "dim",
          `          ${quantity}: about ${found.count.toFixed(1)} ${found.label}${found.stale ? staleNote(found.source, context.now) : ""}`
        )
      );
    }
  }
  lines.push("");
  lines.push(
    table(
      context,
      [bucket, "turns", "energy", "water", "carbon"],
      buckets.map((one) => [
        one.key,
        String(one.count),
        short(one.energyWh, "Wh"),
        short(one.waterMl, "mL"),
        short(one.carbonG, "g")
      ]),
      ["left", "right", "right", "right", "right"]
    )
  );
  const notes = caveats(context, totals);
  if (notes.length > 0) {
    lines.push("");
    lines.push(...notes);
  }
  lines.push("");
  lines.push(
    paint(
      context,
      "dim",
      `  dataset ${context.dataset.version} \xB7 region ${context.regionCode ?? context.dataset.defaultRegion} \xB7 water ${context.waterScope} \xB7 estimate, not a measurement`
    )
  );
  return lines.join("\n");
};

// ../cli-ts/src/run.ts
init_context();

// ../cli-ts/src/help.ts
var VERSION = "0.0.0";
var USAGE = `betteruseofai

  See the energy, water and carbon behind your own agent sessions. Everything is
  worked out on this machine. Nothing is sent anywhere.

USAGE
  betteruseofai <command> [options]

COMMANDS
  summary          What your sessions cost, grouped by day, week, model or session
  sessions         Every session, with its total
  session <id>     The report for one session, including its heaviest turns
  export           Every turn as a row, for a spreadsheet
  dashboard        Every session on this machine as one page, written to a file and opened
  prune            Drop turns before a date from the event log and compact it
  models           Which models we know, what measures them, and how good that measure is
  recommend <text> Ask what a prompt needs, without sending it anywhere
  statusline       Read a status line payload on stdin and print one line
  hook <event>     Read a hook payload on stdin and print hook JSON
  doctor           Check the things that go wrong, and say what to do about each

OPTIONS
  --since <when>          7d, 24h, 2w, or an ISO timestamp
  --until <when>          An ISO timestamp
  --by <bucket>           day, week, model, surface, session, hosting or all
  --source <names>        claude-code, codex, or both separated by a comma
  --dir <path>            Read transcripts from here instead of the usual place
  --region <code>         Grid to price the carbon against. Run "models --all" for the list
  --water-scope <scope>   on-site, "on-site + off-site" (the default), or lifecycle
  --carbon-basis <basis>  location-based (the default) or provider-reported
  --format <format>       table, json or csv, depending on the command
  --log <path>            Read and write the event log here instead of the usual place
  --no-log                Leave the event log alone for this run
  --out <path>            Where the dashboard writes its file; - for standard output
  --with-projects         Put directory and branch names on the dashboard
  --no-open               Write the dashboard without opening it
  --before <when>         On prune, drop turns older than this: 365d, or an ISO date
  --dry-run               On prune, say what would go and write nothing
  --json                  Same as --format json
  --now <iso>             Pretend it is this moment, so a fixture run is repeatable
  --ascii                 Avoid characters a plain terminal cannot draw
  --no-color              No escape codes
  --all                   Show the regions as well, on the models command
  --model <id>            The model a recommendation is measured against
  --depth <n>             How many turns into the conversation a prompt sits
  --local                 Say that you run models locally, so that can be suggested
  --cheap                 On the status line, read the cached total and parse nothing
  --brief                 On the session report, six lines and no tables
  -h, --help              This text
  -v, --version           The version and the dataset it ships with

THE EVENT LOG
  Claude Code deletes its transcripts after a while, thirty days by default, and
  a total that only reads transcripts forgets everything older. So every run of
  this tool, and the plugin's Stop hook, appends the turns it reads to a log of
  its own under ~/.claude/betteruseofai/log, one JSON line per turn, tokens and
  model only. Nothing is priced until it is read back, so a dataset update
  re-prices all of it. Nothing leaves the machine. "prune" trims it.

A NOTE ON THE FIGURES
  Every figure is a range, because the published measurements of AI energy use
  disagree by an order of magnitude. Where we do not know something we say so: an
  unrecognised model reads "unknown", and a model that hid its reasoning tokens
  gives a lower bound rather than a total. Run "session <id>" to see which
  sources a figure rests on.
`;
var COMMAND_HELP = {
  dashboard: `betteruseofai dashboard

  Every session on this machine as one page: totals, every week and day, the
  saving against the largest model in each family, which models, which tool,
  the heaviest sessions, and what could not be priced. One file, with its
  fonts and its data inside it, so it opens with nothing to fetch.

  betteruseofai dashboard
  betteruseofai dashboard --since 90d --region GB
  betteruseofai dashboard --with-projects --out ~/Desktop/sessions.html
  betteruseofai dashboard --json

  Directory and branch names are left out unless --with-projects is given.
`,
  prune: `betteruseofai prune --before <when>

  Drops every turn older than a moment from the event log and compacts what
  remains, so each turn appears once. The log is never pruned on its own.

  betteruseofai prune --before 365d
  betteruseofai prune --before 2026-01-01 --dry-run
`,
  summary: `betteruseofai summary

  What your sessions cost. Defaults to grouping by day.

  betteruseofai summary --since 7d
  betteruseofai summary --since 30d --by model
  betteruseofai summary --by session --region GB --json
`,
  session: `betteruseofai session <id>

  The report for one session: what it cost, which model did most of it, its
  heaviest turns, and why the figures are uncertain. A partial id is enough.
  With --brief it is six lines: the three figures, the model that did most of
  the work, and how many caveats the full report carries.

  betteruseofai sessions
  betteruseofai session ba71e9d8
  betteruseofai session ba71e9d8 --brief
`,
  export: `betteruseofai export

  Every turn as a row. An unknown figure is an empty cell, never a zero, because
  a spreadsheet will happily sum a column of zeroes into a total that is a lie.

  betteruseofai export --since 30d > turns.csv
  betteruseofai export --format json
`,
  recommend: `betteruseofai recommend <text>

  Ask what a prompt needs. The prompt is read, measured, and dropped: it is
  never stored and never sent anywhere.

  betteruseofai recommend "17 * 23"
  betteruseofai recommend "rewrite this so it is shorter"
  betteruseofai recommend --model claude-opus-5 "explain why this deadlock happens"
`,
  doctor: `betteruseofai doctor

  Checks where your transcripts are, whether we recognise the models in them,
  and whether any lines could not be read.

  betteruseofai doctor
  betteruseofai doctor --json
`
};

// ../cli-ts/src/run.ts
var ok = (stdout) => ({ stdout, stderr: "", code: 0 });
var fail = (stderr, code = 1) => ({ stdout: "", stderr, code });
var run = async (argv) => {
  const args = parseArgs(argv);
  if (args.errors.length > 0) {
    return fail(`${args.errors.join("\n")}

Run "betteruseofai --help" for the options.`, 2);
  }
  if (args.flags["version"] === true) {
    const { loadDataset: loadDataset2 } = await Promise.resolve().then(() => (init_context(), context_exports));
    const dataset2 = loadDataset2();
    return ok(`betteruseofai ${VERSION}, dataset ${dataset2.version} (${dataset2.sha256.slice(0, 12)})`);
  }
  if (args.command === "" || args.command === "help" || args.flags["help"] === true && args.command === "") {
    return ok(USAGE.trimEnd());
  }
  if (args.flags["help"] === true) {
    return ok((COMMAND_HELP[args.command] ?? USAGE).trimEnd());
  }
  if (args.command === "statusline" && args.flags["cheap"] === true) {
    const { readCheapLine: readCheapLine2, parseStdinJson: parseStdinJson2, readStdin: readStdin2 } = await Promise.resolve().then(() => (init_statusline(), statusline_exports));
    const input = parseStdinJson2(await readStdin2());
    if (!input?.session_id) return ok("");
    return ok(readCheapLine2(input.session_id) ?? "");
  }
  const { context, errors } = buildContext(args);
  if (errors.length > 0) return fail(errors.join("\n"), 2);
  try {
    switch (args.command) {
      case "summary":
        return ok(await summary(context, args));
      case "sessions":
        return ok(await sessions(context, args));
      case "session":
        return ok(await session(context, args));
      case "export":
        return ok(await exportEvents(context, args));
      case "dashboard":
        return ok(await dashboard(context, args));
      case "prune":
        return ok(await prune(context, args));
      case "models":
        return ok(models(context, args));
      case "doctor":
        return ok(await doctor(context, args));
      case "recommend":
        return ok(recommend(context, args));
      case "statusline":
        try {
          return ok(await statusline(context, args));
        } catch {
          return ok("");
        }
      case "hook":
        try {
          return ok(await hook(context, args));
        } catch {
          return ok("{}");
        }
      case "watch":
        return fail(
          'The watch command lands with the extension. For now, run "summary" again after a session.',
          3
        );
      default:
        return fail(
          `No such command: ${args.command}

Run "betteruseofai --help" for the list.`,
          2
        );
    }
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause), 1);
  }
};

// ../cli-ts/src/cli.ts
var result2 = await run(process.argv.slice(2));
if (result2.stdout !== "") process.stdout.write(`${result2.stdout}
`);
if (result2.stderr !== "") process.stderr.write(`${result2.stderr}
`);
process.exitCode = result2.code;
