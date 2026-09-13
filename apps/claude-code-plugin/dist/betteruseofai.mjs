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
      "depth"
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
      "brief"
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
    init_format();
    init_recommender();
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
          ...line.cwd ? { project: line.cwd } : {}
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
var init_dist2 = __esm({
  "../../packages/readers/dist/index.js"() {
    "use strict";
    init_types3();
    init_jsonl();
    init_claude_code();
    init_codex();
  }
});

// ../../packages/dataset/dist/index.js
var dataset, dist_default;
var init_dist3 = __esm({
  "../../packages/dataset/dist/index.js"() {
    "use strict";
    dataset = { "version": "0.2.0", "sha256": "4742d664fff7a777a090e004b96487ff94674cb7119ba942974e270a2d357d89", "models": [{ "id": "claude-opus-5", "aliases": ["claude-opus-5", "opus-5", "opus 5", "claude opus 5", "claude-opus-5-latest"], "provider": "anthropic", "family": "claude-5", "tier": "frontier", "ordinal": 0, "displayName": "Claude Opus 5", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Identifier taken from the Claude Code environment description. Release date not recorded." } }, { "id": "claude-sonnet-5", "aliases": ["claude-sonnet-5", "sonnet-5", "sonnet 5", "claude sonnet 5", "claude-sonnet-5-latest"], "provider": "anthropic", "family": "claude-5", "tier": "mid", "ordinal": 1, "displayName": "Claude Sonnet 5", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "claude-haiku-4.5", "aliases": ["claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-haiku-4.5", "haiku-4.5", "haiku 4.5", "claude haiku 4.5"], "provider": "anthropic", "family": "claude-5", "tier": "small", "ordinal": 2, "displayName": "Claude Haiku 4.5", "reasoning": true, "thinkingRatio": { "low": 0.2, "central": 1, "high": 4 }, "hosting": "cloud", "released": "2025-10-01", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Sits on the current ladder alongside the Claude 5 models even though its own version number is 4.5." } }, { "id": "claude-fable-5.1", "aliases": ["claude-fable-5-1", "claude-fable-5.1", "fable-5.1", "fable 5.1", "claude fable 5.1"], "provider": "anthropic", "family": "claude-fable", "tier": "frontier", "ordinal": 0, "displayName": "Claude Fable 5.1", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Kept on its own ladder because its position relative to Opus and Sonnet is not confirmed. That means no downgrade target, which is the safe default." } }, { "id": "claude-opus-4.8", "aliases": ["claude-opus-4-8", "claude-opus-4.8", "opus-4.8", "opus 4.8", "claude opus 4.8"], "provider": "anthropic", "family": "claude-4", "tier": "frontier", "ordinal": 0, "displayName": "Claude Opus 4.8", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "fetched", "recorded": "2026-09-10", "note": "Found by running the doctor command against real transcripts on the author's machine, which reported 58 turns on an unrecognised claude-opus-4-8." } }, { "id": "claude-opus-4.1", "aliases": ["claude-opus-4-1", "claude-opus-4.1", "opus-4.1", "claude-opus-4-1-20250805"], "provider": "anthropic", "family": "claude-4", "tier": "frontier", "ordinal": 0, "displayName": "Claude Opus 4.1", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "claude-sonnet-4", "aliases": ["claude-sonnet-4", "claude-sonnet-4-20250514", "sonnet-4", "sonnet 4"], "provider": "anthropic", "family": "claude-4", "tier": "mid", "ordinal": 1, "displayName": "Claude Sonnet 4", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "claude-3.7-sonnet", "aliases": ["claude-3-7-sonnet-20250219", "claude-3-7-sonnet", "claude-3.7-sonnet", "claude 3.7 sonnet"], "provider": "anthropic", "family": "claude-3.x", "tier": "frontier", "ordinal": 0, "displayName": "Claude 3.7 Sonnet", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "released": "2025-02-19", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Measured directly by Jegham and colleagues, so this is one of the few Anthropic models with a real row." } }, { "id": "claude-3.5-sonnet", "aliases": ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20240620", "claude-3-5-sonnet", "claude-3.5-sonnet"], "provider": "anthropic", "family": "claude-3.x", "tier": "mid", "ordinal": 1, "displayName": "Claude 3.5 Sonnet", "reasoning": false, "hosting": "cloud", "released": "2024-10-22", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "claude-3.5-haiku", "aliases": ["claude-3-5-haiku-20241022", "claude-3-5-haiku", "claude-3.5-haiku"], "provider": "anthropic", "family": "claude-3.x", "tier": "small", "ordinal": 2, "displayName": "Claude 3.5 Haiku", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gpt-5.6", "aliases": ["gpt-5.6", "gpt-5-6", "gpt 5.6"], "provider": "openai", "family": "gpt-5", "tier": "frontier", "ordinal": 0, "displayName": "GPT-5.6", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Named in the Codex CLI cache-write issue referenced in the plan. No published energy figure of its own." } }, { "id": "gpt-5", "aliases": ["gpt-5", "gpt5", "gpt 5", "gpt-5-latest"], "provider": "openai", "family": "gpt-5", "tier": "frontier", "ordinal": 0, "displayName": "GPT-5", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "o3", "aliases": ["o3", "o3-2025-04-16", "openai-o3"], "provider": "openai", "family": "o-series", "tier": "frontier", "ordinal": 0, "displayName": "o3", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "o4-mini", "aliases": ["o4-mini", "o4-mini-high", "o4 mini"], "provider": "openai", "family": "o-series", "tier": "mid", "ordinal": 1, "displayName": "o4-mini", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4.1", "aliases": ["gpt-4.1", "gpt-4-1", "gpt-4.1-2025-04-14"], "provider": "openai", "family": "gpt-4.1", "tier": "frontier", "ordinal": 0, "displayName": "GPT-4.1", "reasoning": false, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4.1-mini", "aliases": ["gpt-4.1-mini", "gpt-4-1-mini"], "provider": "openai", "family": "gpt-4.1", "tier": "mid", "ordinal": 1, "displayName": "GPT-4.1 mini", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gpt-4.1-nano", "aliases": ["gpt-4.1-nano", "gpt-4-1-nano"], "provider": "openai", "family": "gpt-4.1", "tier": "nano", "ordinal": 2, "displayName": "GPT-4.1 nano", "reasoning": false, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4o", "aliases": ["gpt-4o", "gpt-4o-2024-08-06", "gpt-4o-latest", "chatgpt-4o-latest"], "provider": "openai", "family": "gpt-4o", "tier": "frontier", "ordinal": 0, "displayName": "GPT-4o", "reasoning": false, "hosting": "cloud", "released": "2024-05-13", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gpt-4o-mini", "aliases": ["gpt-4o-mini", "gpt-4o-mini-2024-07-18"], "provider": "openai", "family": "gpt-4o", "tier": "mid", "ordinal": 1, "displayName": "GPT-4o mini", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gemini-2.5-pro", "aliases": ["gemini-2.5-pro", "gemini-2-5-pro", "gemini 2.5 pro", "models/gemini-2.5-pro"], "provider": "google", "family": "gemini-2.5", "tier": "frontier", "ordinal": 0, "displayName": "Gemini 2.5 Pro", "reasoning": true, "thinkingRatio": { "low": 0.3, "central": 1.5, "high": 6 }, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "gemini-2.5-flash", "aliases": ["gemini-2.5-flash", "gemini-2-5-flash", "gemini 2.5 flash", "models/gemini-2.5-flash", "gemini-apps-default"], "provider": "google", "family": "gemini-2.5", "tier": "mid", "ordinal": 1, "displayName": "Gemini 2.5 Flash", "reasoning": true, "thinkingRatio": { "low": 0.2, "central": 1, "high": 4 }, "hosting": "cloud", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Treated as the model behind the median Gemini Apps prompt that Google measured." } }, { "id": "gemini-2.5-flash-lite", "aliases": ["gemini-2.5-flash-lite", "gemini-2-5-flash-lite", "models/gemini-2.5-flash-lite"], "provider": "google", "family": "gemini-2.5", "tier": "small", "ordinal": 2, "displayName": "Gemini 2.5 Flash-Lite", "reasoning": false, "hosting": "cloud", "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10" } }, { "id": "mistral-large-2", "aliases": ["mistral-large-2", "mistral-large-2407", "mistral-large-latest", "mistral large 2"], "provider": "mistral", "family": "mistral-large", "tier": "frontier", "ordinal": 0, "displayName": "Mistral Large 2", "reasoning": false, "activeParamsB": { "low": 123, "central": 123, "high": 123 }, "hosting": "both", "released": "2024-07-24", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "deepseek-r1", "aliases": ["deepseek-r1", "deepseek-reasoner", "DeepSeek-R1"], "provider": "deepseek", "family": "deepseek-r1", "tier": "frontier", "ordinal": 0, "displayName": "DeepSeek-R1", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "activeParamsB": { "low": 37, "central": 37, "high": 37 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Mixture of experts. Active parameters, not the 671 billion total." } }, { "id": "deepseek-r1-distill-llama-70b", "aliases": ["deepseek-r1-distill-llama-70b", "DeepSeek-R1-Distill-Llama-70B"], "provider": "deepseek", "family": "deepseek-r1", "tier": "mid", "ordinal": 1, "displayName": "DeepSeek-R1 Distill Llama 70B", "reasoning": true, "thinkingRatio": { "low": 0.5, "central": 2.5, "high": 10 }, "activeParamsB": { "low": 70, "central": 70, "high": 70 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "llama-3.3-70b", "aliases": ["llama-3.3-70b", "llama3.3:70b", "Llama-3.3-70B-Instruct", "meta-llama/Llama-3.3-70B-Instruct"], "provider": "meta", "family": "llama-3.x", "tier": "frontier", "ordinal": 0, "displayName": "Llama 3.3 70B", "reasoning": false, "activeParamsB": { "low": 70, "central": 70, "high": 70 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "llama-3.1-8b", "aliases": ["llama-3.1-8b", "llama3.1:8b", "Llama-3.1-8B-Instruct", "meta-llama/Llama-3.1-8B-Instruct"], "provider": "meta", "family": "llama-3.x", "tier": "small", "ordinal": 1, "displayName": "Llama 3.1 8B", "reasoning": false, "activeParamsB": { "low": 8, "central": 8, "high": 8 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "llama-3.2-3b", "aliases": ["llama-3.2-3b", "llama3.2:3b", "Llama-3.2-3B-Instruct"], "provider": "meta", "family": "llama-3.x", "tier": "nano", "ordinal": 2, "displayName": "Llama 3.2 3B", "reasoning": false, "activeParamsB": { "low": 3.2, "central": 3.2, "high": 3.2 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "qwen-2.5-7b", "aliases": ["qwen-2.5-7b", "qwen2.5:7b", "Qwen2.5-7B-Instruct"], "provider": "alibaba", "family": "qwen-2.5", "tier": "small", "ordinal": 0, "displayName": "Qwen 2.5 7B", "reasoning": false, "activeParamsB": { "low": 7, "central": 7, "high": 7 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "mistral-7b", "aliases": ["mistral-7b", "mistral:7b", "Mistral-7B-Instruct-v0.3"], "provider": "mistral", "family": "mistral-7b", "tier": "small", "ordinal": 0, "displayName": "Mistral 7B", "reasoning": false, "activeParamsB": { "low": 7.2, "central": 7.2, "high": 7.2 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "gemma-2-9b", "aliases": ["gemma-2-9b", "gemma2:9b", "google/gemma-2-9b-it"], "provider": "google", "family": "gemma-2", "tier": "small", "ordinal": 0, "displayName": "Gemma 2 9B", "reasoning": false, "activeParamsB": { "low": 9, "central": 9, "high": 9 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "phi-3-mini", "aliases": ["phi-3-mini", "phi3:mini", "Phi-3-mini-4k-instruct"], "provider": "microsoft", "family": "phi-3", "tier": "nano", "ordinal": 0, "displayName": "Phi-3 mini", "reasoning": false, "activeParamsB": { "low": 3.8, "central": 3.8, "high": 3.8 }, "hosting": "both", "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }], "benchmarks": [{ "id": "google.gemini-apps.2025-median", "modelIds": ["gemini-2.5-flash"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.1, "central": 0.24, "high": 0.72 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 60, "central": 300, "high": 1e3 }, "tokenCountsPublished": false }, "pue": { "low": 1.09, "central": 1.09, "high": 1.09 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 1.15, "central": 1.15, "high": 1.15 }, "carbonGPerKwh": { "low": 94, "central": 94, "high": 94 }, "carbonBasis": "market-based", "methodology": "provider-measured", "boundary": "datacenter", "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-08-21", "qualityScore": 4, "notes": "Median text prompt across the Gemini Apps fleet: 0.24 Wh, 0.26 mL, 0.03 gCO2e. The low bound is Google's own narrow accelerator-only figure of 0.10 Wh; the high bound is three times the median, because a fleet median says nothing about the tail. Breakdown: TPU 0.14, host CPU and DRAM 0.06, idle 0.02, overhead 0.02 Wh. Water follows from the energy and a WUE of 1.15 L/kWh, which reproduces the published 0.26 mL. The 94 gCO2e/kWh is market-based and flatters the result by roughly three and a half times against the location-based 345, so it is only used when the reader asks for provider-reported carbon. Google did not publish the token counts behind the median prompt, so the reference counts here are ours.", "hosting": "cloud" }, { "id": "openai.altman-statement.2025", "modelIds": ["gpt-5"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.1, "central": 0.34, "high": 3 }, "directWaterMl": { "low": 0.1, "central": 0.32, "high": 3 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 60, "central": 300, "high": 1e3 }, "tokenCountsPublished": false }, "pue": { "low": 1, "central": 1.12, "high": 1.2 }, "energyIncludesPue": true, "methodology": "provider-statement", "boundary": "datacenter", "source": { "title": "The Gentle Singularity", "url": "https://blog.samaltman.com/the-gentle-singularity", "publisher": "Sam Altman", "date": "2025-06", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-06-01", "qualityScore": 2, "notes": "A blog sentence, not a measurement. No model, no boundary, no date, no method, and no audit. The range is wide on purpose and the quality score is low on purpose. We keep the row because it is the only first-party OpenAI number that exists, and because readers will have seen it quoted. The boundary is recorded as datacenter only so the engine has something to work with; the source did not say.", "hosting": "cloud" }, { "id": "mistral.large-2.lca.2025", "modelIds": ["mistral-large-2"], "shape": "per-prompt", "perPrompt": { "directCarbonG": { "low": 0.8, "central": 1.14, "high": 1.6 }, "directWaterMl": { "low": 32, "central": 45, "high": 63 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 400, "central": 400, "high": 400 }, "tokenCountsPublished": false }, "pue": { "low": 1, "central": 1, "high": 1 }, "energyIncludesPue": true, "methodology": "provider-measured", "boundary": "lifecycle", "source": { "title": "Our contribution to a global environmental standard for AI", "url": "https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai", "publisher": "Mistral AI, with Carbone 4 and ADEME", "date": "2025-07-22", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-07-22", "qualityScore": 5, "notes": "The most complete assessment anyone has published, reviewed by Resilio and Hubblo. One 400-token Le Chat reply: 1.14 gCO2e, 45 mL, 0.16 mg Sb-eq. Training cost 20,400 tCO2e and 281,000 cubic metres. The water figure is about 170 times Google's because it counts manufacturing and the water used generating the electricity, not just on-site cooling. Carbon and water are published directly and already include the embodied share, so the engine uses them as they are rather than deriving them from energy. Mistral did not publish an energy figure per reply, and only the output token count was given, so the input reference is ours. The plus or minus 40 per cent on the direct values is our uncertainty, not the study's.", "hosting": "cloud" }, { "id": "jegham.gpt-4o", "modelIds": ["gpt-4o"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.423 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 1.215 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 2.875 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Version 6 of the preprint." }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Inferred from latency times rated DGX power times an assumed utilisation, on Azure infrastructure. Sizes of the closed models are guesses, so this is much better for ranking models against each other than for absolute values. The quoted energy is at server level and the engine applies the PUE of 1.12 on top. The uncertainty multipliers of one half and two are ours.", "hosting": "cloud" }, { "id": "jegham.gpt-4.1", "modelIds": ["gpt-4.1"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.871 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 3.161 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 4.833 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "hosting": "cloud" }, { "id": "jegham.gpt-4.1-nano", "modelIds": ["gpt-4.1-nano"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.207 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 0.575 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 0.827 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "The cheapest model measured, and about four times lighter than GPT-4.1 on a short prompt. This row is what most downgrade recommendations point at.", "hosting": "cloud" }, { "id": "jegham.o3", "modelIds": ["o3"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 1.177 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 5.153 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 12.222 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Between two point eight and four point three times GPT-4o for the same prompt, which is the clearest published measurement of what hidden reasoning costs. The thinking tokens are already inside these numbers.", "hosting": "cloud" }, { "id": "jegham.o4-mini", "modelIds": ["o4-mini"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 3.649 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 7.38 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 7.237 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Measured on the high reasoning effort setting. A mini model that costs more than o3 on a short prompt, because the reasoning budget dominates. It is a useful warning that smaller is not automatically lighter once thinking is switched on. The long-prompt figure sits slightly below the medium one, which the fit will smooth over.", "hosting": "cloud" }, { "id": "jegham.claude-3.7-sonnet", "modelIds": ["claude-3.7-sonnet"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.95 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 2.989 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 5.671 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "carbonGPerKwh": { "low": 287, "central": 287, "high": 287 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Measured on AWS, so the multipliers differ from the OpenAI rows. Anthropic has published nothing first-party, so this row is the anchor for every Claude proxy in this file.", "hosting": "cloud" }, { "id": "jegham.claude-3.5-sonnet", "modelIds": ["claude-3.5-sonnet"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.973 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 3.638 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 7.772 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "carbonGPerKwh": { "low": 287, "central": 287, "high": 287 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "hosting": "cloud" }, { "id": "jegham.deepseek-r1", "modelIds": ["deepseek-r1"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 2.353 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 4.331 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 7.41 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "carbonGPerKwh": { "low": 350, "central": 350, "high": 350 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "notes": "Served on Azure. An open model run in somebody else's data centre, so it counts as cloud here even though the weights are downloadable.", "hosting": "cloud" }, { "id": "jegham.llama-3.3-70b", "modelIds": ["llama-3.3-70b"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "short", "inputTokens": 100, "outputTokens": 300, "energyWh": 0.237 }, { "label": "medium", "inputTokens": 1e3, "outputTokens": 1e3, "energyWh": 0.76 }, { "label": "long", "inputTokens": 1e4, "outputTokens": 1500, "energyWh": 1.447 }], "relativeUncertainty": { "low": 0.5, "central": 1, "high": 2 } }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "carbonGPerKwh": { "low": 287, "central": 287, "high": 287 }, "carbonBasis": "location-based", "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 3, "hosting": "cloud" }, { "id": "epoch.gpt-4o.2025", "modelIds": ["gpt-4o"], "shape": "per-query-set", "perQuerySet": { "points": [{ "label": "typical", "inputTokens": 100, "outputTokens": 500, "energyWh": 0.3 }, { "label": "long context", "inputTokens": 1e4, "outputTokens": 500, "energyWh": 2.5 }, { "label": "very long context", "inputTokens": 1e5, "outputTokens": 500, "energyWh": 40 }], "relativeUncertainty": { "low": 0.4, "central": 1, "high": 2.5 } }, "pue": { "low": 1.1, "central": 1.12, "high": 1.2 }, "energyIncludesPue": true, "methodology": "independent-benchmark", "boundary": "server", "source": { "title": "How much energy does ChatGPT use?", "url": "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use", "publisher": "Epoch AI", "date": "2025-02-07", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-02-07", "qualityScore": 3, "notes": "A bottom-up estimate assuming an H100 at 1,500 W including overhead and 10 per cent utilisation. The value of this row is the shape rather than the level: a hundred thousand token context costs over a hundred times a short prompt, which is the single most useful thing to know about long-context habits. The stated overhead means we do not apply PUE again.", "hosting": "cloud" }, { "id": "microsoft.oviedo.2026", "modelIds": ["gpt-4o"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.16, "central": 0.31, "high": 0.6 }, "directWaterMl": { "low": 0, "central": 0.03, "high": 0.067 }, "referenceInputTokens": { "low": 40, "central": 200, "high": 900 }, "referenceOutputTokens": { "low": 100, "central": 300, "high": 700 }, "tokenCountsPublished": false }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": true, "methodology": "independent-benchmark", "boundary": "datacenter", "source": { "title": "Energy and water footprint of large language model inference", "url": "https://arxiv.org/abs/2509.20241", "publisher": "Oviedo and colleagues, Microsoft Research, in Joule", "date": "2026-04", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2509.20241" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-09-24", "qualityScore": 3, "notes": "Median 0.31 Wh per query with an interquartile range of 0.16 to 0.60. Simulation rather than fleet telemetry, and written by people at the vendor whose cloud is being measured, so it is corroboration rather than independent evidence. The same paper puts test-time scaling with fifteen times longer output at 3.91 Wh, which is the number to reach for when a reasoning model is in play.", "hosting": "cloud" }, { "id": "huggingface.energy-score.v2.r1-distill-70b", "modelIds": ["deepseek-r1-distill-llama-70b"], "shape": "per-prompt", "perPrompt": { "energyWh": { "low": 0.0495, "central": 0.5, "high": 7.627 }, "referenceInputTokens": { "low": 100, "central": 100, "high": 100 }, "referenceOutputTokens": { "low": 200, "central": 500, "high": 4e3 }, "tokenCountsPublished": false }, "pue": { "low": 1, "central": 1.15, "high": 1.4 }, "energyIncludesPue": false, "methodology": "independent-benchmark", "boundary": "accelerator-only", "source": { "title": "AI Energy Score, version 2", "url": "https://huggingface.co/spaces/AIEnergyScore/Leaderboard", "publisher": "Hugging Face", "date": "2025-12-04", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-12-04", "qualityScore": 4, "notes": "Measured on an H100 at batch size one in FP16, GPU only, so no idle draw and no facility overhead. The spread here is real rather than sloppy: with reasoning switched off this model draws 49.5 Wh per thousand queries, and with reasoning on it draws 7,627, a factor of over one hundred and fifty. Any single central value for a reasoning model is a fiction, which is why the low and high are the two measured modes.", "hosting": "cloud" }, { "id": "ecologits.parametric.cloud", "modelIds": ["llama-3.3-70b", "llama-3.1-8b", "llama-3.2-3b", "qwen-2.5-7b", "mistral-7b", "gemma-2-9b", "phi-3-mini", "mistral-large-2", "deepseek-r1", "deepseek-r1-distill-llama-70b"], "shape": "parametric", "parametric": { "model": "ecologits", "coefficients": { "alphaKwhPerTokenPerB": 117e-8, "betaPerB": -0.0112, "gammaKwhPerToken": 405e-7 }, "serverBaseW": { "low": 1e3, "central": 1200, "high": 1400 }, "gpuCount": 8 }, "pue": { "low": 1.09, "central": 1.15, "high": 1.2 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.09, "central": 0.5, "high": 0.99 }, "methodology": "parametric-model", "boundary": "server", "source": { "title": "EcoLogits: Evaluating the environmental impacts of generative AI", "url": "https://joss.theoj.org/papers/10.21105/joss.07471", "publisher": "Journal of Open Source Software", "date": "2025", "retrieved": "2026-09-10", "doi": "10.21105/joss.07471", "licence": "MPL-2.0 for the code, paper CC BY 4.0" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-01-01", "qualityScore": 3, "notes": "Energy per output token as alpha times e to the beta B times active parameters, plus gamma, where B is active parameters in billions. The fallback for any open-weight model with no measurement of its own. We follow the EcoLogits method and cite it; none of their code is copied into this repository.", "hosting": "cloud" }, { "id": "ecologits.parametric.local", "modelIds": ["llama-3.3-70b", "llama-3.1-8b", "llama-3.2-3b", "qwen-2.5-7b", "mistral-7b", "gemma-2-9b", "phi-3-mini", "deepseek-r1-distill-llama-70b"], "shape": "parametric", "parametric": { "model": "ecologits", "coefficients": { "alphaKwhPerTokenPerB": 117e-8, "betaPerB": -0.0112, "gammaKwhPerToken": 405e-7 }, "serverBaseW": { "low": 10, "central": 120, "high": 410 }, "gpuCount": 1 }, "pue": { "low": 1, "central": 1, "high": 1 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 0, "central": 0, "high": 0 }, "methodology": "parametric-model", "boundary": "server", "source": { "title": "GreenBench: energy measurements of local LLM inference on Apple silicon", "url": "https://arxiv.org/abs/2608.28667", "publisher": "GreenBench", "date": "2026", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2608.28667" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Coefficients are EcoLogits. The base power range is set from the GreenBench Apple silicon measurements at the low end and desktop GPU draw at the high end." }, "validFrom": "2026-01-01", "qualityScore": 3, "notes": "The same formula for a model on your own machine. There is no data centre, so the PUE is one and the on-site cooling water is zero; the water that remains comes from generating the electricity, which the region factor supplies. The base power spans an M4 Pro laptop at around 10 W to a desktop with an RTX 4090 pulling 280 to 410 W, which is the widest honest range we can give without knowing the machine. Reference points: Llama 3.2 3B at 0.09 J per token and Qwen 2.5 7B at 0.20 J per token on an M4 Pro, and Llama 3.1 8B at about 0.29 J per token on a 4090. Corroboration: the formula puts a 400 token reply from an 8 billion parameter model at about 0.023 Wh, against roughly 0.032 Wh implied by the measured 0.29 J per token on an RTX 4090. That agreement is the main reason we read the published coefficients as kilowatt hours per thousand output tokens.", "hosting": "local" }, { "id": "proxy.claude-opus", "modelIds": ["claude-opus-5", "claude-opus-4.8", "claude-opus-4.1", "claude-fable-5.1"], "shape": "proxy", "proxyOf": "jegham.claude-3.7-sonnet", "proxyFactor": { "low": 1, "central": 2, "high": 4.5 }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "The scaling factor is ours, not the paper's." }, "validFrom": "2025-05-14", "qualityScore": 2, "notes": "Anthropic publishes no per-query figures at all, so every current Claude model is scaled from the one measured Sonnet. Opus-class models are assumed to cost between one and four and a half times a 3.7 Sonnet query, centred on two. That is a guess with a shape, and any estimate built on it carries the proxy-row flag so it can never be mistaken for a measurement.", "hosting": "cloud" }, { "id": "proxy.claude-sonnet", "modelIds": ["claude-sonnet-5", "claude-sonnet-4"], "shape": "proxy", "proxyOf": "jegham.claude-3.7-sonnet", "proxyFactor": { "low": 0.7, "central": 1.1, "high": 2 }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 2, "hosting": "cloud" }, { "id": "proxy.claude-haiku", "modelIds": ["claude-haiku-4.5", "claude-3.5-haiku"], "shape": "proxy", "proxyOf": "jegham.claude-3.7-sonnet", "proxyFactor": { "low": 0.1, "central": 0.3, "high": 0.7 }, "pue": { "low": 1.14, "central": 1.14, "high": 1.14 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.18, "central": 0.18, "high": 0.18 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 2, "hosting": "cloud" }, { "id": "proxy.gpt-5.6", "modelIds": ["gpt-5.6"], "shape": "proxy", "proxyOf": "jegham.o3", "proxyFactor": { "low": 0.3, "central": 0.8, "high": 2 }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2026-01-01", "qualityScore": 2, "notes": "Scaled from o3 because both are reasoning models on the same infrastructure. The central factor below one assumes some efficiency gain per generation, which is the kind of assumption that should be replaced by a measurement as soon as one exists.", "hosting": "cloud" }, { "id": "proxy.gpt-4.1-mini", "modelIds": ["gpt-4.1-mini", "gpt-4o-mini"], "shape": "proxy", "proxyOf": "jegham.gpt-4.1-nano", "proxyFactor": { "low": 1.2, "central": 2, "high": 3.5 }, "pue": { "low": 1.12, "central": 1.12, "high": 1.12 }, "energyIncludesPue": false, "waterOnsiteLPerKwh": { "low": 0.3, "central": 0.3, "high": 0.3 }, "methodology": "proxy", "boundary": "server", "source": { "title": "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", "url": "https://arxiv.org/abs/2505.09598", "publisher": "Jegham, Abdelatti, Elmoubarki and Hendawi", "date": "2025-11-24", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2505.09598" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-05-14", "qualityScore": 2, "notes": "Interpolated between the measured nano and full rows, closer to nano.", "hosting": "cloud" }, { "id": "proxy.gemini-2.5-pro", "modelIds": ["gemini-2.5-pro"], "shape": "proxy", "proxyOf": "google.gemini-apps.2025-median", "proxyFactor": { "low": 2, "central": 6, "high": 20 }, "pue": { "low": 1.09, "central": 1.09, "high": 1.09 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 1.15, "central": 1.15, "high": 1.15 }, "methodology": "proxy", "boundary": "datacenter", "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-08-21", "qualityScore": 2, "notes": "Google measured a fleet median dominated by its smallest, fastest model. A Pro query with thinking on is a different animal, and the factor here is wide because we have nothing better. The high end of twenty is set by the ratio between a Flash-class and a reasoning-frontier query in the independent benchmarks.", "hosting": "cloud" }, { "id": "proxy.gemini-2.5-flash-lite", "modelIds": ["gemini-2.5-flash-lite"], "shape": "proxy", "proxyOf": "google.gemini-apps.2025-median", "proxyFactor": { "low": 0.2, "central": 0.4, "high": 0.8 }, "pue": { "low": 1.09, "central": 1.09, "high": 1.09 }, "energyIncludesPue": true, "waterOnsiteLPerKwh": { "low": 1.15, "central": 1.15, "high": 1.15 }, "methodology": "proxy", "boundary": "datacenter", "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "validFrom": "2025-08-21", "qualityScore": 2, "hosting": "cloud" }], "regions": [{ "code": "WORLD", "name": "World average", "kind": "world", "continent": "Global", "gridGco2PerKwh": { "low": 435.6, "central": 458.5, "high": 483.2 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "waterSource": { "title": "Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models", "url": "https://arxiv.org/abs/2304.03271", "publisher": "Li, Yang, Islam and Ren", "date": "2025", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2304.03271" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 483.2, 2024: 471.5, 2025: 458.5), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "US", "name": "United States", "kind": "country", "continent": "North America", "gridGco2PerKwh": { "low": 330, "central": 349.7, "high": 375 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2023, "source": { "title": "eGRID2023 summary tables", "url": "https://www.epa.gov/egrid", "publisher": "United States Environmental Protection Agency", "date": "2025", "retrieved": "2026-09-10", "licence": "public domain" }, "waterSource": { "title": "Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models", "url": "https://arxiv.org/abs/2304.03271", "publisher": "Li, Yang, Islam and Ren", "date": "2025", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2304.03271" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "770.884 lb CO2e per MWh, converted to 349.7 g per kWh." } }, { "code": "IN", "name": "India", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 680, "central": 710, "high": 745 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "CO2 Baseline Database for the Indian Power Sector, version 21.0", "url": "https://cea.nic.in/cdm-co2-baseline-database/", "publisher": "Central Electricity Authority, Government of India", "date": "2025-12", "retrieved": "2026-09-10" }, "waterSource": { "title": "Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models", "url": "https://arxiv.org/abs/2304.03271", "publisher": "Li, Yang, Islam and Ren", "date": "2025", "retrieved": "2026-09-10", "doi": "10.48550/arXiv.2304.03271" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "0.710 tCO2 per MWh weighted average." } }, { "code": "GB", "name": "United Kingdom", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 216.5, "central": 217.4, "high": 235.6 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 235.6, 2024: 216.5, 2025: 217.4), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "FR", "name": "France", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 40.5, "central": 41.5, "high": 53.3 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 53.3, 2024: 40.5, 2025: 41.5), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "DE", "name": "Germany", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 313.1, "central": 329.6, "high": 363.6 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 363.6, 2024: 337.1, 2025: 329.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "IE", "name": "Ireland", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 243.1, "central": 255.9, "high": 282.5 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 282.5, 2024: 270.9, 2025: 255.9), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "NL", "name": "Netherlands", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 250.7, "central": 253.6, "high": 268.2 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 268.2, 2024: 250.7, 2025: 253.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "SE", "name": "Sweden", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 34.9, "central": 35.4, "high": 38.4 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 38.4, 2024: 34.9, 2025: 35.4), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "ES", "name": "Spain", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 146.2, "central": 153.6, "high": 169.7 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 169.7, 2024: 146.2, 2025: 153.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "PL", "name": "Poland", "kind": "country", "continent": "Europe", "gridGco2PerKwh": { "low": 561.3, "central": 590.8, "high": 650.9 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 650.9, 2024: 608.4, 2025: 590.8), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "CA", "name": "Canada", "kind": "country", "continent": "North America", "gridGco2PerKwh": { "low": 174.4, "central": 190.7, "high": 200.2 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 174.4, 2024: 185.4, 2025: 190.7), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "BR", "name": "Brazil", "kind": "country", "continent": "South America", "gridGco2PerKwh": { "low": 96.3, "central": 110, "high": 115.5 }, "waterOffsiteLPerKwh": { "low": 2, "central": 6, "high": 15 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 96.3, 2024: 106.1, 2025: 110.0), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "JP", "name": "Japan", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 453.5, "central": 477.4, "high": 492.6 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 492.6, 2024: 483.6, 2025: 477.4), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "SG", "name": "Singapore", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 472.2, "central": 497.1, "high": 500.9 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 500.9, 2024: 498.7, 2025: 497.1), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "CN", "name": "China", "kind": "country", "continent": "Asia", "gridGco2PerKwh": { "low": 499.9, "central": 526.2, "high": 583.2 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 583.2, 2024: 556.3, 2025: 526.2), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "AU", "name": "Australia", "kind": "country", "continent": "Oceania", "gridGco2PerKwh": { "low": 498.4, "central": 524.6, "high": 556.9 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 556.9, 2024: 554.0, 2025: 524.6), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "ZA", "name": "South Africa", "kind": "country", "continent": "Africa", "gridGco2PerKwh": { "low": 664, "central": 699, "high": 717.7 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2025, "source": { "title": "Yearly Electricity Data, full release, long format", "url": "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv", "publisher": "Ember", "date": "2026", "retrieved": "2026-09-13", "licence": "CC BY 4.0" }, "provenance": { "method": "fetched", "recorded": "2026-09-13" }, "notes": "Power sector CO2 intensity, gCO2/kWh, from the Ember yearly release. Central is the latest full year; the range is the spread of the last three (2023: 714.4, 2024: 717.7, 2025: 699.0), widened where the latest year sits on an edge. Read from the CSV on 2026-09-13." }, { "code": "US-CAMX", "name": "California, WECC (eGRID CAMX)", "kind": "subregion", "continent": "North America", "gridGco2PerKwh": { "low": 190, "central": 210, "high": 235 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2023, "source": { "title": "eGRID2023 subregion tables", "url": "https://www.epa.gov/egrid", "publisher": "United States Environmental Protection Agency", "date": "2025", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Subregion value not yet read out of the eGRID spreadsheet." } }, { "code": "US-SRVC", "name": "Virginia and the Carolinas, SERC (eGRID SRVC)", "kind": "subregion", "continent": "North America", "gridGco2PerKwh": { "low": 260, "central": 290, "high": 325 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2023, "source": { "title": "eGRID2023 subregion tables", "url": "https://www.epa.gov/egrid", "publisher": "United States Environmental Protection Agency", "date": "2025", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Northern Virginia carries more data centre load than anywhere else on earth, which is why this subregion is here. Value not yet read out of the spreadsheet." } }, { "code": "GOOGLE-FLEET", "name": "Google data centre fleet", "kind": "provider-fleet", "continent": "Global", "gridGco2PerKwh": { "low": 345, "central": 345, "high": 345 }, "waterOffsiteLPerKwh": { "low": 1, "central": 3.1, "high": 5.5 }, "year": 2024, "source": { "title": "Measuring the environmental impact of AI inference", "url": "https://arxiv.org/abs/2508.15734", "publisher": "Google", "date": "2025-08-21", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10", "note": "Google's own location-based fleet average. Their market-based figure of 94 lives on the benchmark row instead, because it is a claim about procurement rather than about a grid." } }], "defaultRegion": "WORLD", "equivalents": [{ "id": "led-bulb-second", "quantity": "energy", "unitPer": "Wh", "amount": 25e-4, "singular": "second of a 9 W LED bulb", "plural": "seconds of a 9 W LED bulb", "source": { "title": "LED lamp product data, typical 9 W A60 replacement for a 60 W incandescent", "url": "https://www.ledvance.com/", "publisher": "LEDVANCE", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "notes": "9 W for one second is 0.0025 Wh." }, { "id": "phone-charge", "quantity": "energy", "unitPer": "Wh", "amount": 19, "singular": "full smartphone charge", "plural": "full smartphone charges", "source": { "title": "Greenhouse Gas Equivalencies Calculator", "url": "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator", "publisher": "United States Environmental Protection Agency", "date": "2026-08", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "notes": "0.019 kWh per charge." }, { "id": "kettle-boil", "quantity": "energy", "unitPer": "Wh", "amount": 100, "singular": "mug of water boiled in a kettle", "plural": "mugs of water boiled in a kettle", "source": { "title": "Energy use of domestic kettles", "url": "https://energysavingtrust.org.uk/", "publisher": "Energy Saving Trust", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Roughly 0.1 kWh to bring 300 mL from tap temperature to boiling, allowing for kettle losses. Worth replacing with a cited figure." } }, { "id": "google-search", "quantity": "energy", "unitPer": "Wh", "amount": 0.3, "singular": "web search", "plural": "web searches", "stale": true, "source": { "title": "Powering a Google search", "url": "https://googleblog.blogspot.com/2009/01/powering-google-search.html", "publisher": "Google", "date": "2009-01", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" }, "notes": "Seventeen years old and quoted constantly. We keep it because the comparison is the one people reach for, and we mark it stale wherever it appears." }, { "id": "teaspoon", "quantity": "water", "unitPer": "mL", "amount": 4.9, "singular": "teaspoon of water", "plural": "teaspoons of water", "source": { "title": "Metric teaspoon, standard measure", "url": "https://www.bipm.org/en/measurement-units", "publisher": "International Bureau of Weights and Measures", "date": "2019", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "glass-of-water", "quantity": "water", "unitPer": "mL", "amount": 237, "singular": "glass of water", "plural": "glasses of water", "source": { "title": "United States customary cup, 8 fluid ounces", "url": "https://www.nist.gov/pml/owm", "publisher": "National Institute of Standards and Technology", "date": "2024", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "water-bottle", "quantity": "water", "unitPer": "mL", "amount": 500, "singular": "500 mL bottle of water", "plural": "500 mL bottles of water", "source": { "title": "Standard retail bottled water volume", "url": "https://www.bipm.org/en/measurement-units", "publisher": "International Bureau of Weights and Measures", "date": "2019", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "car-metre", "quantity": "carbon", "unitPer": "g", "amount": 0.244, "singular": "metre driven in an average petrol car", "plural": "metres driven in an average petrol car", "source": { "title": "Greenhouse gas reporting: conversion factors 2025 to 2026, average car, petrol", "url": "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting", "publisher": "Department for Energy Security and Net Zero", "date": "2025", "retrieved": "2026-09-10", "licence": "Open Government Licence v3.0" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "244 g per km, cross-checked against the EPA figure of 393 g per mile. Copy the exact cell out of the DEFRA spreadsheet before launch." } }, { "id": "phone-charge-carbon", "quantity": "carbon", "unitPer": "g", "amount": 12.4, "singular": "smartphone charged from empty", "plural": "smartphones charged from empty", "source": { "title": "Greenhouse Gas Equivalencies Calculator", "url": "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator", "publisher": "United States Environmental Protection Agency", "date": "2026-08", "retrieved": "2026-09-10", "licence": "public domain" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "search-carbon", "quantity": "carbon", "unitPer": "g", "amount": 0.2, "singular": "web search", "plural": "web searches", "stale": true, "source": { "title": "Powering a Google search", "url": "https://googleblog.blogspot.com/2009/01/powering-google-search.html", "publisher": "Google", "date": "2009-01", "retrieved": "2026-09-10" }, "provenance": { "method": "source-appendix", "recorded": "2026-09-10" } }, { "id": "household-day", "quantity": "energy", "unitPer": "Wh", "amount": 7400, "singular": "day of electricity for an average home", "plural": "days of electricity for an average home", "source": { "title": "Typical Domestic Consumption Values, medium electricity user", "url": "https://www.ofgem.gov.uk/information-consumers/energy-advice-households/average-gas-and-electricity-use-explained", "publisher": "Ofgem", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "2,700 kWh a year works out at 7.4 kWh a day. Check the current TDCV figure before launch." }, "notes": "The comparison that lands in range for a week of agent sessions, where a phone charge does not." }, { "id": "washing-cycle", "quantity": "energy", "unitPer": "Wh", "amount": 700, "singular": "load of washing", "plural": "loads of washing", "source": { "title": "Energy use of domestic appliances", "url": "https://energysavingtrust.org.uk/", "publisher": "Energy Saving Trust", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "About 0.7 kWh for a 40 degree cycle. Worth replacing with a cited figure." } }, { "id": "shower-minute", "quantity": "water", "unitPer": "mL", "amount": 1e4, "singular": "minute in the shower", "plural": "minutes in the shower", "source": { "title": "Water use at home", "url": "https://waterwise.org.uk/save-water/", "publisher": "Waterwise", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Around 10 litres a minute for a mixer shower." } }, { "id": "bath", "quantity": "water", "unitPer": "mL", "amount": 8e4, "singular": "bath", "plural": "baths", "source": { "title": "Water use at home", "url": "https://waterwise.org.uk/save-water/", "publisher": "Waterwise", "date": "2025", "retrieved": "2026-09-10" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "Around 80 litres for a full bath." } }, { "id": "car-kilometre", "quantity": "carbon", "unitPer": "g", "amount": 244, "singular": "kilometre driven in an average petrol car", "plural": "kilometres driven in an average petrol car", "source": { "title": "Greenhouse gas reporting: conversion factors 2025 to 2026, average car, petrol", "url": "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting", "publisher": "Department for Energy Security and Net Zero", "date": "2025", "retrieved": "2026-09-10", "licence": "Open Government Licence v3.0" }, "provenance": { "method": "recalled-pending-refetch", "recorded": "2026-09-10", "note": "The same factor as car-metre, a thousand times over, so the pair covers both a single prompt and a week of sessions." } }], "calibration": { "version": "0.2.0", "notes": "Constants the engine needs that are not benchmark rows. Several are honest guesses with a shape rather than measurements, and each says which it is. The tokenizer ratios in particular have not yet been measured against the providers' own counting endpoints.", "tokenizer": { "baseEncoding": "o200k_base", "charsPerTokenFallback": { "prose": { "low": 4.2, "central": 5.2, "high": 6.3 }, "code": { "low": 2.9, "central": 3.81, "high": 5 }, "maths": { "low": 1.5, "central": 2.21, "high": 3.3 }, "non-latin": { "low": 1, "central": 2.49, "high": 5.5 } }, "providers": { "openai": { "exact": true, "contentClasses": { "prose": { "low": 1, "central": 1, "high": 1 }, "maths": { "low": 1, "central": 1, "high": 1 }, "code": { "low": 1, "central": 1, "high": 1 }, "non-latin": { "low": 1, "central": 1, "high": 1 } }, "source": { "title": "tiktoken, o200k_base encoding", "url": "https://github.com/openai/tiktoken", "publisher": "OpenAI", "date": "2024", "retrieved": "2026-09-10", "licence": "MIT" } }, "anthropic": { "exact": false, "contentClasses": { "prose": { "low": 1.08, "central": 1.16, "high": 1.26 }, "maths": { "low": 1.12, "central": 1.21, "high": 1.34 }, "code": { "low": 1.18, "central": 1.3, "high": 1.45 }, "non-latin": { "low": 1.02, "central": 1.1, "high": 1.22 } }, "source": { "title": "Ratio of Claude tokens to o200k tokens, recorded during project research", "url": "https://docs.claude.com/en/docs/build-with-claude/token-counting", "publisher": "Better Use of AI research notes, against the documented count-tokens endpoint", "date": "2026-09", "retrieved": "2026-09-10" }, "notes": "Roughly 16 per cent more tokens than o200k on English prose, 21 per cent on maths and 30 per cent on Python. These came out of the project research rather than a run of scripts/calibrate.ts, which does not exist yet. The spread around each central value is ours. Replace these with measured factors before the extension ships." }, "google": { "exact": false, "contentClasses": { "prose": { "low": 0.95, "central": 1, "high": 1.1 }, "maths": { "low": 0.95, "central": 1, "high": 1.12 }, "code": { "low": 0.95, "central": 1.02, "high": 1.15 }, "non-latin": { "low": 0.9, "central": 1, "high": 1.15 } }, "source": { "title": "Ratio of Gemini tokens to o200k tokens, recorded during project research", "url": "https://ai.google.dev/gemini-api/docs/tokens", "publisher": "Better Use of AI research notes, against the documented count-tokens endpoint", "date": "2026-09", "retrieved": "2026-09-10" }, "notes": "Gemini counts come out close to o200k, so the central values sit at or near one. Same caveat as the Anthropic row: recorded during research, not yet measured by a calibration run." } }, "charsPerTokenNotes": "Measured against the o200k encoder over a small set of samples per class, not guessed. The central values are the pooled chars-per-token; the bounds are the per-sample spread padded by about a fifth, because the sample is small. The first version of this file carried one global range of 3 to 5, which was 43 per cent out on English prose and did not even bracket the real count." }, "cachedReadShareOfInput": { "low": 0, "central": 0.1, "high": 0.5 }, "cacheWriteShareOfInput": { "low": 1, "central": 1, "high": 1.25 }, "outputToInputEnergyWeight": { "low": 4, "central": 8, "high": 15 }, "derivedRowWidening": { "low": 0.5, "central": 1, "high": 2 }, "assumedTokenCountWidening": { "low": 0.7, "central": 1, "high": 1.5 }, "hiddenContextFactor": { "api": { "low": 1, "central": 1, "high": 1 }, "claude-code": { "low": 1, "central": 1, "high": 1.05 }, "codex-cli": { "low": 1, "central": 1, "high": 1.05 }, "claude-web": { "low": 1, "central": 1.4, "high": 2.5 }, "chatgpt-web": { "low": 1, "central": 1.5, "high": 3 }, "gemini-web": { "low": 1, "central": 1.4, "high": 2.5 }, "local-webui": { "low": 1, "central": 1, "high": 1.1 } }, "localPue": { "low": 1, "central": 1, "high": 1 }, "parametricWidening": { "low": 0.4, "central": 1, "high": 5 } } };
    dist_default = dataset;
  }
});

// ../cli-ts/src/context.ts
var context_exports = {};
__export(context_exports, {
  buildContext: () => buildContext,
  loadDataset: () => loadDataset,
  loadEvents: () => loadEvents
});
import { join as join4 } from "node:path";
var loadDataset, WATER_SCOPES, buildContext, loadEvents;
var init_context = __esm({
  "../cli-ts/src/context.ts"() {
    "use strict";
    init_dist3();
    init_dist();
    init_dist2();
    init_args();
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
          sources
        },
        errors
      };
    };
    loadEvents = async (context, args) => {
      const dir = flagString(args.flags, "dir");
      const options = {
        ...context.since ? { since: context.since } : {},
        ...context.until ? { until: context.until } : {}
      };
      const results = [];
      if (context.sources.includes("claude-code")) {
        results.push(await readClaudeCode({ ...options, ...dir ? { dir: join4(dir, "projects") } : {} }));
      }
      if (context.sources.includes("codex")) {
        results.push(await readCodex({ ...options, ...dir ? { dir } : {} }));
      }
      const events = results.flatMap((result3) => result3.events).sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1);
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
        readers: results
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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { dirname, join as join5 } from "node:path";
var stateDir, safeName, cachePath, linePath, readCheapLine, writeLine, readCache, writeCache, refreshSession, readStdin, parseStdinJson, statusline, hook;
var init_statusline = __esm({
  "../cli-ts/src/commands/statusline.ts"() {
    "use strict";
    init_dist();
    init_dist2();
    init_args();
    stateDir = () => process.env["BUAI_STATE_DIR"] ?? join5(process.env["CLAUDE_PLUGIN_DATA"] ?? join5(homedir3(), ".claude"), "betteruseofai", "state");
    safeName = (sessionId) => sessionId.replace(/[^A-Za-z0-9_-]/g, "_");
    cachePath = (sessionId) => join5(stateDir(), `${safeName(sessionId)}.json`);
    linePath = (sessionId) => join5(stateDir(), `${safeName(sessionId)}.line`);
    readCheapLine = (sessionId) => {
      try {
        return readFileSync(linePath(sessionId), "utf8").trimEnd();
      } catch {
        return null;
      }
    };
    writeLine = (sessionId, line) => {
      try {
        mkdirSync(stateDir(), { recursive: true });
        writeFileSync(linePath(sessionId), `${line}
`, "utf8");
      } catch {
      }
    };
    readCache = (sessionId) => {
      try {
        return JSON.parse(readFileSync(cachePath(sessionId), "utf8"));
      } catch {
        return { state: { offset: 0, seen: {} }, events: {}, updated: "" };
      }
    };
    writeCache = (sessionId, cached) => {
      const path = cachePath(sessionId);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(cached), "utf8");
    };
    refreshSession = async (context, sessionId, transcriptPath) => {
      const cached = readCache(sessionId);
      const { added, state } = await readClaudeCodeIncremental(transcriptPath, cached.state);
      const events = { ...cached.events };
      for (const event of added) events[event.id] = event;
      writeCache(sessionId, { state, events, updated: context.now.toISOString() });
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
        const saving = advice.estimatedSavings?.energyWh;
        if (!saving) return say(advice.explanation);
        return say(`${advice.explanation} That would save roughly ${displayNumber(saving.central)} Wh.`);
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

// ../cli-ts/src/commands/misc.ts
init_dist();
init_dist2();
init_args();
init_context();

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

// ../cli-ts/src/commands/misc.ts
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
  const { pairs, readers } = await loadEvents(context, args);
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
    const saving = result3.estimatedSavings;
    lines.push("");
    lines.push(
      paint(
        context,
        "dim",
        `  That swap would save roughly ${saving.energyWh?.central.toFixed(2)} Wh, ${saving.waterMl?.central.toFixed(1)} mL and ${saving.carbonG?.central.toFixed(2)} g on a turn of this shape. The reply length is a guess, so treat it as a rough figure.`
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

A NOTE ON THE FIGURES
  Every figure is a range, because the published measurements of AI energy use
  disagree by an order of magnitude. Where we do not know something we say so: an
  unrecognised model reads "unknown", and a model that hid its reasoning tokens
  gives a lower bound rather than a total. Run "session <id>" to see which
  sources a figure rests on.
`;
var COMMAND_HELP = {
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
process.exit(result2.code);
