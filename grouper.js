/* Mouse 군 배정. 브라우저와 node 둘 다 같은 함수를 쓴다. */
(function (root, factory) {
	var api = factory();
	if (typeof module === "object" && module.exports) {
		module.exports = api;
	} else {
		root.MouseGrouper = api;
	}
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
	function mulberry32(seed) {
		var a = seed >>> 0;
		return function rand() {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			var t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function shuffleInPlace(arr, rand) {
		var i, j, tmp;
		for (i = arr.length - 1; i > 0; i--) {
			j = Math.floor(rand() * (i + 1));
			tmp = arr[i];
			arr[i] = arr[j];
			arr[j] = tmp;
		}
		return arr;
	}

	function sexOf(mouse) {
		if (mouse.sex === "M" || mouse.sex === "F") return mouse.sex;
		return "U";
	}

	function roundGap(n) {
		return Math.round(n * 10000) / 10000;
	}

	function meanOf(values) {
		if (!values.length) return 0;
		var s = 0;
		var i;
		for (i = 0; i < values.length; i++) s += values[i];
		return s / values.length;
	}

	function sdOf(values) {
		if (values.length < 2) return 0;
		var m = meanOf(values);
		var s = 0;
		var i;
		for (i = 0; i < values.length; i++) {
			var d = values[i] - m;
			s += d * d;
		}
		return Math.sqrt(s / (values.length - 1));
	}

	function systematicKeep(sorted, need, rand) {
		var n = sorted.length;
		var kept = [];
		var dropped = [];
		var used, step, start, i, idx, d, found;
		if (need >= n) return { kept: sorted.slice(), dropped: [] };
		if (need <= 0) return { kept: [], dropped: sorted.slice() };
		used = new Set();
		step = n / need;
		start = rand() * step;
		for (i = 0; i < need; i++) {
			idx = Math.floor(start + i * step);
			if (idx >= n) idx = n - 1;
			if (used.has(idx)) {
				found = -1;
				for (d = 1; d < n; d++) {
					if (idx + d < n && !used.has(idx + d)) {
						found = idx + d;
						break;
					}
					if (idx - d >= 0 && !used.has(idx - d)) {
						found = idx - d;
						break;
					}
				}
				idx = found;
			}
			used.add(idx);
			kept.push(sorted[idx]);
		}
		for (i = 0; i < n; i++) {
			if (!used.has(i)) dropped.push(sorted[i]);
		}
		return { kept: kept, dropped: dropped };
	}

	function allocateQuotas(counts, need) {
		var keys = [];
		var k, total, rows, quotas, used, exact, i;
		for (k in counts) {
			if (Object.prototype.hasOwnProperty.call(counts, k) && counts[k] > 0) keys.push(k);
		}
		total = 0;
		for (i = 0; i < keys.length; i++) total += counts[keys[i]];
		quotas = {};
		for (i = 0; i < keys.length; i++) quotas[keys[i]] = 0;
		if (need >= total) {
			for (i = 0; i < keys.length; i++) quotas[keys[i]] = counts[keys[i]];
			return quotas;
		}
		rows = [];
		used = 0;
		for (i = 0; i < keys.length; i++) {
			exact = (need * counts[keys[i]]) / total;
			rows.push({
				k: keys[i],
				floor: Math.floor(exact),
				frac: exact - Math.floor(exact)
			});
			quotas[keys[i]] = Math.floor(exact);
			used += Math.floor(exact);
		}
		rows.sort(function (a, b) {
			if (b.frac !== a.frac) return b.frac - a.frac;
			return counts[b.k] - counts[a.k];
		});
		for (i = 0; i < rows.length && used < need; i++) {
			if (quotas[rows[i].k] < counts[rows[i].k]) {
				quotas[rows[i].k] += 1;
				used += 1;
			}
		}
		return quotas;
	}

	function keepClosestToMean(mice, need, mean, rand) {
		var ranked, kept, dropped, i;
		if (need >= mice.length) return { kept: mice.slice(), dropped: [] };
		if (need <= 0) return { kept: [], dropped: mice.slice() };
		ranked = mice.map(function (m) {
			return { m: m, d: Math.abs(m.weight - mean), r: rand() };
		});
		ranked.sort(function (a, b) {
			if (a.d !== b.d) return a.d - b.d;
			return a.r - b.r;
		});
		kept = [];
		dropped = [];
		for (i = 0; i < ranked.length; i++) {
			if (i < need) kept.push(ranked[i].m);
			else dropped.push(ranked[i].m);
		}
		return { kept: kept, dropped: dropped };
	}

	function takeSubset(mice, need, useSex, useWeight, mean, rand) {
		var sorted, counts, buckets, quotas, kept, dropped, keys, i, s, k;
		if (mice.length <= need) return { kept: mice.slice(), dropped: [] };
		if (useWeight && !useSex) return keepClosestToMean(mice, need, mean, rand);
		if (!useSex) {
			sorted = mice.slice().sort(function (a, b) {
				if (a.weight !== b.weight) return a.weight - b.weight;
				return String(a.id).localeCompare(String(b.id));
			});
			return systematicKeep(sorted, need, rand);
		}
		counts = { M: 0, F: 0, U: 0 };
		buckets = { M: [], F: [], U: [] };
		for (i = 0; i < mice.length; i++) {
			k = sexOf(mice[i]);
			counts[k] += 1;
			buckets[k].push(mice[i]);
		}
		keys = ["M", "F", "U"];
		quotas = allocateQuotas(counts, need);
		kept = [];
		dropped = [];
		for (i = 0; i < keys.length; i++) {
			if (useWeight) s = keepClosestToMean(buckets[keys[i]], quotas[keys[i]] || 0, mean, rand);
			else {
				buckets[keys[i]].sort(function (a, b) {
					if (a.weight !== b.weight) return a.weight - b.weight;
					return String(a.id).localeCompare(String(b.id));
				});
				s = systematicKeep(buckets[keys[i]], quotas[keys[i]] || 0, rand);
			}
			kept = kept.concat(s.kept);
			dropped = dropped.concat(s.dropped);
		}
		return { kept: kept, dropped: dropped };
	}

	function mouseStats(mice) {
		var weights = [];
		var males = 0;
		var females = 0;
		var unknown = 0;
		var cages = [];
		var seen = {};
		var i, sx, w;
		for (i = 0; i < mice.length; i++) {
			w = mice[i].weight;
			weights.push(w);
			sx = sexOf(mice[i]);
			if (sx === "M") males += 1;
			else if (sx === "F") females += 1;
			else unknown += 1;
			if (!seen[mice[i].cageId]) {
				seen[mice[i].cageId] = true;
				cages.push(mice[i].cageName);
			}
		}
		return {
			n: mice.length,
			mean: weights.length ? meanOf(weights) : 0,
			sd: sdOf(weights),
			min: weights.length ? Math.min.apply(null, weights) : 0,
			max: weights.length ? Math.max.apply(null, weights) : 0,
			males: males,
			females: females,
			unknown: unknown,
			cages: cages
		};
	}

	function flattenUnits(units) {
		var out = [];
		var i, j;
		for (i = 0; i < units.length; i++) {
			if (units[i].mice) out = out.concat(units[i].mice);
			else out.push(units[i]);
		}
		return out;
	}

	function totalN(units) {
		return flattenUnits(units).length;
	}

	function maleN(units) {
		var mice = flattenUnits(units);
		var n = 0;
		var i;
		for (i = 0; i < mice.length; i++) if (sexOf(mice[i]) === "M") n += 1;
		return n;
	}

	function femaleN(units) {
		var mice = flattenUnits(units);
		var n = 0;
		var i;
		for (i = 0; i < mice.length; i++) if (sexOf(mice[i]) === "F") n += 1;
		return n;
	}

	function unknownN(units) {
		var mice = flattenUnits(units);
		var n = 0;
		var i;
		for (i = 0; i < mice.length; i++) if (sexOf(mice[i]) === "U") n += 1;
		return n;
	}

	function weightSum(units) {
		var mice = flattenUnits(units);
		var s = 0;
		var i;
		for (i = 0; i < mice.length; i++) s += mice[i].weight;
		return s;
	}

	function describeUnit(unit) {
		var mice, males, females, unknown, sum, i, sx;
		if (unit.mice) mice = unit.mice;
		else mice = [unit];
		males = 0;
		females = 0;
		unknown = 0;
		sum = 0;
		for (i = 0; i < mice.length; i++) {
			sum += mice[i].weight;
			sx = sexOf(mice[i]);
			if (sx === "M") males += 1;
			else if (sx === "F") females += 1;
			else unknown += 1;
		}
		return {
			addN: mice.length,
			males: males,
			females: females,
			unknown: unknown,
			weight: mice.length ? sum / mice.length : 0,
			sum: sum
		};
	}

	function groupsBalanced(groups) {
		var n0 = totalN(groups[0]);
		var m0 = maleN(groups[0]);
		var f0 = femaleN(groups[0]);
		var u0 = unknownN(groups[0]);
		var gi;
		for (gi = 1; gi < groups.length; gi++) {
			if (totalN(groups[gi]) !== n0) return false;
			if (maleN(groups[gi]) !== m0) return false;
			if (femaleN(groups[gi]) !== f0) return false;
			if (unknownN(groups[gi]) !== u0) return false;
		}
		return true;
	}

	function groupHasCage(group, cageId) {
		var i, j, item;
		if (cageId == null) return false;
		for (i = 0; i < group.length; i++) {
			item = group[i];
			if (item.mice) {
				for (j = 0; j < item.mice.length; j++) if (item.mice[j].cageId === cageId) return true;
			} else if (item.cageId === cageId) return true;
		}
		return false;
	}

	function assignCageBlock(groups, block, rand) {
		var n = block.length;
		var bestHits = -1;
		var best = [];
		var used, cur, pick, k;
		function consider(order) {
			var hits = 0;
			var i;
			for (i = 0; i < n; i++) if (groupHasCage(groups[order[i]], block[i].cageId)) hits += 1;
			if (hits > bestHits) {
				bestHits = hits;
				best = [order.slice()];
			} else if (hits === bestHits) best.push(order.slice());
		}
		function walk() {
			var i;
			if (cur.length === n) {
				consider(cur);
				return;
			}
			for (i = 0; i < n; i++) {
				if (used[i]) continue;
				used[i] = true;
				cur.push(i);
				walk();
				cur.pop();
				used[i] = false;
			}
		}
		if (n > 8) {
			var free = [];
			var choices, chosen, gi;
			for (k = 0; k < n; k++) free.push(k);
			for (k = 0; k < n; k++) {
				choices = [];
				for (gi = 0; gi < free.length; gi++) {
					if (groupHasCage(groups[free[gi]], block[k].cageId)) choices.push(free[gi]);
				}
				if (!choices.length) choices = free.slice();
				chosen = choices[Math.floor(rand() * choices.length)];
				groups[chosen].push(block[k]);
				free.splice(free.indexOf(chosen), 1);
			}
			return true;
		}
		used = [];
		cur = [];
		for (k = 0; k < n; k++) used.push(false);
		walk();
		pick = best[Math.floor(rand() * best.length)];
		for (k = 0; k < n; k++) groups[pick[k]].push(block[k]);
		return true;
	}

	function assignBlock(groups, block, opts, perGroup, rand) {
		var order, k, unit, bestGi, bestKey, gi, d, n, key, i, sameCage;
		if (block.length === groups.length && (!opts.useSex || groupsBalanced(groups)) && (function () {
			var n0 = totalN(groups[0]);
			for (i = 1; i < groups.length; i++) if (totalN(groups[i]) !== n0) return false;
			return true;
		})()) {
			if (opts.keepCage && assignCageBlock(groups, block, rand)) return true;
			order = [];
			for (k = 0; k < groups.length; k++) order.push(k);
			shuffleInPlace(order, rand);
			for (k = 0; k < block.length; k++) groups[order[k]].push(block[k]);
			return true;
		}
		for (k = 0; k < block.length; k++) {
			unit = block[k];
			d = describeUnit(unit);
			bestGi = -1;
			bestKey = null;
			for (gi = 0; gi < groups.length; gi++) {
				n = totalN(groups[gi]);
				if (n + d.addN > perGroup) continue;
				sameCage = opts.keepCage && groupHasCage(groups[gi], unit.cageId) ? 0 : 1;
				key = [
					n,
					opts.useSex ? maleN(groups[gi]) * d.males + femaleN(groups[gi]) * d.females + unknownN(groups[gi]) * d.unknown : 0,
					opts.useWeight ? (n ? Math.round((weightSum(groups[gi]) / n) / 0.05) : 0) : 0,
					sameCage,
					rand()
				];
				if (bestKey === null || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1]) || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2]) || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] === bestKey[2] && key[3] < bestKey[3]) || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] === bestKey[2] && key[3] === bestKey[3] && key[4] < bestKey[4])) {
					bestKey = key;
					bestGi = gi;
				}
			}
			if (bestGi < 0) return false;
			groups[bestGi].push(unit);
		}
		return true;
	}

	function assignUnits(units, nGroups, perGroup, opts, rand) {
		var groups = [];
		var strata, i, gi, stratum, sorted, b;
		for (gi = 0; gi < nGroups; gi++) groups.push([]);
		if (opts.useSex && !units.length) return groups;
		if (opts.useSex && units[0] && !units[0].mice) {
			strata = { M: [], F: [], U: [] };
			for (i = 0; i < units.length; i++) strata[sexOf(units[i])].push(units[i]);
			strata = [strata.M, strata.F, strata.U].filter(function (list) { return list.length > 0; });
			strata.sort(function (a, b) { return b.length - a.length; });
		} else {
			strata = [units.slice()];
		}
		for (i = 0; i < strata.length; i++) {
			stratum = strata[i];
			if (opts.useWeight) {
				sorted = stratum.slice().sort(function (a, b) {
					return describeUnit(a).weight - describeUnit(b).weight;
				});
			} else {
				sorted = stratum.slice();
				shuffleInPlace(sorted, rand);
			}
			for (b = 0; b < sorted.length; b += nGroups) {
				if (!assignBlock(groups, sorted.slice(b, b + nGroups), opts, perGroup, rand)) return null;
			}
		}
		return groups;
	}

	function keyBefore(a, b) {
		var i;
		for (i = 0; i < a.length; i++) {
			if (a[i] < b[i]) return true;
			if (a[i] > b[i]) return false;
		}
		return false;
	}

	function assignPreferCages(units, nGroups, perGroup, opts, rand) {
		var groups = [];
		var byCage = {};
		var cages = [];
		var i, id, cage, gi, n, room, take, bestGi, bestKey, key, adding, means, g, list, mean, lo, hi, sexPen;
		for (gi = 0; gi < nGroups; gi++) groups.push([]);
		for (i = 0; i < units.length; i++) {
			id = String(units[i].cageId);
			if (!byCage[id]) {
				byCage[id] = [];
				cages.push(byCage[id]);
			}
			byCage[id].push(units[i]);
		}
		shuffleInPlace(cages, rand);
		cages.sort(function (a, b) { return b.length - a.length; });
		for (i = 0; i < cages.length; i++) {
			cage = cages[i].slice();
			shuffleInPlace(cage, rand);
			while (cage.length) {
				bestGi = -1;
				bestKey = null;
				for (gi = 0; gi < nGroups; gi++) {
					n = groups[gi].length;
					room = perGroup - n;
					if (room <= 0) continue;
					take = Math.min(room, cage.length);
					adding = cage.slice(0, take);
					sexPen = 0;
					if (opts.useSex) {
						sexPen = maleN(groups[gi]) * maleN(adding) + femaleN(groups[gi]) * femaleN(adding) + unknownN(groups[gi]) * unknownN(adding);
					}
					means = [];
					for (g = 0; g < nGroups; g++) {
						list = g === gi ? groups[g].concat(adding) : groups[g];
						if (!list.length) continue;
						mean = weightSum(list) / list.length;
						means.push(mean);
					}
					lo = means.length ? Math.min.apply(null, means) : 0;
					hi = means.length ? Math.max.apply(null, means) : 0;
					key = [
						-take,
						n,
						sexPen,
						opts.useWeight ? (hi - lo) : 0,
						rand()
					];
					if (bestKey === null || keyBefore(key, bestKey)) {
						bestKey = key;
						bestGi = gi;
					}
				}
				if (bestGi < 0) return null;
				take = Math.min(perGroup - groups[bestGi].length, cage.length);
				for (g = 0; g < take; g++) groups[bestGi].push(cage[g]);
				cage = cage.slice(take);
			}
		}
		return groups;
	}

	function cageSplitCount(groupMice) {
		var tally = {};
		var split = 0;
		var i, j, mouse, id, bucket, total, bestN, g;
		for (i = 0; i < groupMice.length; i++) {
			for (j = 0; j < groupMice[i].length; j++) {
				mouse = groupMice[i][j];
				id = mouse.cageId;
				if (!tally[id]) tally[id] = {};
				tally[id][i] = (tally[id][i] || 0) + 1;
			}
		}
		for (id in tally) {
			if (!Object.prototype.hasOwnProperty.call(tally, id)) continue;
			bucket = tally[id];
			total = 0;
			bestN = 0;
			for (g in bucket) {
				if (!Object.prototype.hasOwnProperty.call(bucket, g)) continue;
				total += bucket[g];
				if (bucket[g] > bestN) bestN = bucket[g];
			}
			split += total - bestN;
		}
		return split;
	}

	function qualityOf(groupMice, useSex, keepCage, useWeight) {
		var means = [];
		var gap, sexGap, split, weightPart, i, k, keys, key, counts, c;
		for (i = 0; i < groupMice.length; i++) means.push(mouseStats(groupMice[i]).mean);
		gap = means.length ? Math.max.apply(null, means) - Math.min.apply(null, means) : 0;
		sexGap = 0;
		if (useSex) {
			keys = ["males", "females", "unknown"];
			for (k = 0; k < keys.length; k++) {
				key = keys[k];
				counts = [];
				for (i = 0; i < groupMice.length; i++) counts.push(mouseStats(groupMice[i])[key]);
				if (!counts.length) continue;
				c = Math.max.apply(null, counts) - Math.min.apply(null, counts);
				sexGap += c;
			}
		}
		split = keepCage ? cageSplitCount(groupMice) : 0;
		weightPart = useWeight ? gap : 0;
		return {
			gap: gap,
			sexGap: sexGap,
			split: split,
			score: keepCage ? split * 1000000 + sexGap * 1000 + weightPart : sexGap * 1000 + weightPart
		};
	}

	function planOnce(input, seed) {
		var rand = mulberry32(seed);
		var useWeight = !!input.useWeight;
		var useSex = !!input.useSex;
		var keepCage = !!input.keepCage;
		var nGroups = input.groupCount;
		var perGroup = input.perGroup;
		var need = nGroups * perGroup;
		var mice = input.mice.slice();
		var subset, units, groups, droppedMice, groupMice, i, st, q, flat, allMean;

		if (mice.length < need) {
			return {
				ok: false,
				error: "4번 Group 수와 5번 Group당 마리수를 곱하면 " + need + "마리가 필요합니다. 사용으로 둔 Mouse는 " + mice.length + "마리입니다."
			};
		}
		allMean = meanOf(mice.map(function (m) { return m.weight; }));
		subset = takeSubset(mice, need, useSex, useWeight, allMean, rand);
		droppedMice = subset.dropped;
		units = subset.kept;

		groups = keepCage
			? assignPreferCages(units, nGroups, perGroup, { useWeight: useWeight, useSex: useSex, keepCage: keepCage }, rand)
			: assignUnits(units, nGroups, perGroup, { useWeight: useWeight, useSex: useSex, keepCage: false }, rand);
		if (!groups) {
			return { ok: false, error: "이 마리수로는 모든 Group을 같은 마리수로 채우지 못했습니다. 4번 Group 수와 5번 Group당 마리수를 다시 확인하세요." };
		}

		groupMice = [];
		for (i = 0; i < groups.length; i++) {
			flat = flattenUnits(groups[i]);
			flat.sort(function (a, b) {
				if (a.cageName !== b.cageName) return String(a.cageName).localeCompare(String(b.cageName), "ko");
				return String(a.id).localeCompare(String(b.id), "ko");
			});
			groupMice.push(flat);
		}
		/* Group 이름만 섞는다. 어느 묶음이 1번이 되는지는 무작위다. */
		shuffleInPlace(groupMice, rand);

		q = qualityOf(groupMice, useSex, keepCage, useWeight);
		st = [];
		for (i = 0; i < groupMice.length; i++) st.push(mouseStats(groupMice[i]));
		return {
			ok: true,
			seed: seed >>> 0,
			tried: 1,
			quality: q.score,
			gap: q.gap,
			sexGap: q.sexGap,
			cageSplit: q.split,
			groups: groupMice.map(function (list, idx) {
				return {
					name: "Group " + (idx + 1),
					mice: list,
					stats: mouseStats(list)
				};
			}),
			dropped: droppedMice,
			sourceMean: allMean,
			balance: {
				gap: q.gap,
				sexGap: q.sexGap,
				means: st.map(function (s) { return s.mean; })
			}
		};
	}

	function wholeCount(n) {
		return typeof n === "number" && isFinite(n) && n >= 1 && Math.floor(n) === n;
	}

	function plan(input) {
		var nGroups, perGroup, need, useWeight, useSex, i, mouse, sx, base, attempts, best, one, seed, lastError;
		if (!input || !input.mice) return { ok: false, error: "배정할 Mouse가 없습니다. 3번에서 체중을 입력하고 사용을 켜세요." };
		useWeight = !!input.useWeight;
		useSex = !!input.useSex;
		if (!wholeCount(input.groupCount)) return { ok: false, error: "4. 나눌 Group 수는 1 이상의 정수여야 합니다." };
		if (!wholeCount(input.perGroup)) return { ok: false, error: "5. Group당 마리수는 1 이상의 정수여야 합니다." };
		nGroups = input.groupCount;
		perGroup = input.perGroup;
		if (!useWeight && !useSex) return { ok: false, error: "6번에서 체중 또는 성별을 하나 이상 켜세요." };
		for (i = 0; i < input.mice.length; i++) {
			mouse = input.mice[i];
			if (!(typeof mouse.weight === "number") || !isFinite(mouse.weight) || mouse.weight <= 0) {
				return { ok: false, error: "체중은 0보다 큰 수여야 합니다. " + mouse.cageName + "의 " + mouse.label + "을 확인하세요." };
			}
		}
		if (useSex) {
			sx = { M: 0, F: 0 };
			for (i = 0; i < input.mice.length; i++) {
				if (input.mice[i].sex === "M" || input.mice[i].sex === "F") sx[input.mice[i].sex] += 1;
			}
			if (sx.M + sx.F === 0) {
				return { ok: false, error: "6번에서 성별을 켰습니다. 수컷 또는 암컷을 한 마리 이상 지정하세요. 전부 미지정이면 성별을 맞출 수 없습니다." };
			}
		}
		need = nGroups * perGroup;
		if (input.mice.length < need) {
			return {
				ok: false,
				error: "4번 Group 수와 5번 Group당 마리수를 곱하면 " + need + "마리가 필요합니다. 사용으로 둔 Mouse는 " + input.mice.length + "마리입니다."
			};
		}
		base = (input.seed >>> 0);
		attempts = input.attempts > 0 ? input.attempts : 400;
		best = null;
		lastError = null;
		for (i = 0; i < attempts; i++) {
			seed = (base + i) >>> 0;
			one = planOnce(input, seed);
			if (!one.ok) {
				lastError = one;
				continue;
			}
			if (!best || one.quality < best.quality - 1e-12) best = one;
		}
		if (!best) return lastError || { ok: false, error: "이 마리수로는 모든 Group을 같은 마리수로 채우지 못했습니다. 4번 Group 수와 5번 Group당 마리수를 다시 확인하세요." };
		best.tried = attempts;
		best.gap = roundGap(best.gap);
		if (best.balance) best.balance.gap = best.gap;
		return best;
	}

	return {
		plan: plan,
		mouseStats: mouseStats
	};
});
