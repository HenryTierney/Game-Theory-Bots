const COOPERATION_THRESHOLD = 0.6
const EXPLOIT_THRESHOLD = 0.6 // Increased threshold to avoid false-positive exploitation
const MIN_DEFECT_RESPONSE_SAMPLES = 3
const OLIVE_BRANCH_SCHEDULE = [2, 5, 10, 20]

function freshMemory() {
	return {
		seen: 0,
		opponentC: 0,
		opponentD: 0,
		mutualDStreak: 0,
		olives: 0,
		failedOlives: 0,
		isSucker: false,
		sparsePeace: false,
		pendingOliveRound: -1, // Tracks when an olive branch was explicitly offered
	}
}

function rebuildMemory(history, previous) {
	const memory = freshMemory()
	memory.olives =
		previous && Number.isFinite(previous.olives)
			? Math.max(0, Math.floor(previous.olives))
			: 0
	memory.failedOlives =
		previous && Number.isFinite(previous.failedOlives)
			? Math.max(0, Math.floor(previous.failedOlives))
			: 0
	memory.isSucker = previous ? Boolean(previous.isSucker) : false
	memory.pendingOliveRound =
		previous && Number.isFinite(previous.pendingOliveRound)
			? previous.pendingOliveRound
			: -1

	for (let i = 0; i < history.length; i++) {
		const round = history[i]
		if (round.opponent === "D") memory.opponentD++
		else memory.opponentC++

		if (round.you === "D" && round.opponent === "D")
			memory.mutualDStreak++
		else memory.mutualDStreak = 0
	}

	memory.seen = history.length
	return memory
}

function updateMemory(history, memory) {
	const n = history.length
	if (
		!memory ||
		typeof memory !== "object" ||
		memory.seen !== n - 1 ||
		!Number.isFinite(memory.opponentC) ||
		!Number.isFinite(memory.opponentD) ||
		!Number.isFinite(memory.mutualDStreak) ||
		!Number.isFinite(memory.olives) ||
		!Number.isFinite(memory.failedOlives)
	)
		return rebuildMemory(history, memory)

	const last = history[n - 1]
	if (last.opponent === "D") memory.opponentD++
	else memory.opponentC++

	if (last.you === "D" && last.opponent === "D")
		memory.mutualDStreak++
	else memory.mutualDStreak = 0

	if (typeof memory.sparsePeace !== "boolean") memory.sparsePeace = false
	if (typeof memory.isSucker !== "boolean") memory.isSucker = false
	if (!Number.isFinite(memory.pendingOliveRound)) memory.pendingOliveRound = -1
	memory.seen = n
	return memory
}

function responseRates(history) {
	let cooperateAfterC = 0
	let samplesAfterC = 0
	let cooperateAfterD = 0
	let samplesAfterD = 0
	
	const dynamicWindow = Math.max(10, Math.floor(history.length * 0.3))
	const start = Math.max(1, history.length - dynamicWindow)

	for (let i = start; i < history.length; i++) {
		const ourPreviousMove = history[i - 1].you
		const theirMove = history[i].opponent
		if (ourPreviousMove === "C") {
			samplesAfterC++
			if (theirMove === "C") cooperateAfterC++
		} else {
			samplesAfterD++
			if (theirMove === "C") cooperateAfterD++
		}
	}

	return {
		// Use raw conditional probability without smoothing distortions on small samples
		pC: samplesAfterC > 0 ? cooperateAfterC / samplesAfterC : 0.5,
		pD: samplesAfterD > 0 ? cooperateAfterD / samplesAfterD : 0,
		samplesAfterD,
	}
}

function isUnconditionalPeriodic(history) {
	const n = history.length
	if (n < 15) return false
	const start = Math.max(0, n - 30)
	let sawC = false
	let sawD = false

	for (let i = start; i < n; i++) {
		if (history[i].opponent === "C") sawC = true
		else sawD = true
	}
	if (!sawC || !sawD) return false

	for (let period = 2; period <= 12; period++) {
		let matches = true
		let comparisons = 0
		for (let i = start + period; i < n; i++) {
			comparisons++
			if (history[i].opponent !== history[i - period].opponent) {
				matches = false
				break
			}
		}
		if (!matches || comparisons < 8) continue

		let explainedByTitForTat = true
		for (let i = Math.max(1, start); i < n; i++) {
			if (history[i].opponent !== history[i - 1].you) {
				explainedByTitForTat = false
				break
			}
		}
		if (!explainedByTitForTat) return true
	}

	return false
}

function isConfirmedGrimLock(history, minRoundsSinceTrigger) {
	const n = history.length
	let firstD = -1
	for (let i = 0; i < n; i++) {
		if (history[i].opponent === "D") { firstD = i; break }
	}
	if (firstD === -1) return false
	if (n - firstD < minRoundsSinceTrigger) return false
	for (let i = firstD; i < n; i++) {
		if (history[i].opponent === "C") return false
	}
	return true
}

function decide(history, memory) {
	const n = history.length
	if (n === 0) return ["C", freshMemory()]

	memory = updateMemory(history, memory)
	const last = history[n - 1]
	const previous = n >= 2 ? history[n - 2] : null

	// 1. Resolve pending olive branch check accurately
	if (memory.pendingOliveRound === n - 1) {
		if (last.opponent === "D") {
			memory.failedOlives++
		}
		memory.pendingOliveRound = -1
	}

	// 2. Unset sucker flag if opponent retaliates to exploitation
	if (memory.isSucker && last.opponent === "D") {
		memory.isSucker = false
	}

	if (isConfirmedGrimLock(history, 4)) return ["D", memory]

	// 3. Pristine cooperation strategy (removed static round 15 probing)
	if (memory.opponentD === 0) {
		if (memory.isSucker) return ["D", memory]
		return ["C", memory]
	}

	if (isUnconditionalPeriodic(history)) return ["D", memory]

	const { pC, pD, samplesAfterD } = responseRates(history)
	if (
		samplesAfterD >= MIN_DEFECT_RESPONSE_SAMPLES &&
		pD >= EXPLOIT_THRESHOLD
	)
		return ["D", memory]

	if (pC >= COOPERATION_THRESHOLD) {
		const theirDWasProvoked =
			last.opponent === "D" &&
			previous !== null &&
			previous.you === "D"
		if (last.opponent === "D" && !theirDWasProvoked)
			return ["D", memory]
		return ["C", memory]
	}

	// 4. Offer olive branches with explicit outcome tracking
	if (
		memory.failedOlives < 2 &&
		memory.opponentC > 0 &&
		memory.olives < OLIVE_BRANCH_SCHEDULE.length &&
		memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olives]
	) {
		memory.olives++
		memory.pendingOliveRound = n // Tag round index of olive branch
		return ["C", memory]
	}

	return ["D", memory]
}

export default function bot(state) {
	let memory =
		state && state.memory && typeof state.memory === "object"
			? state.memory
			: null

	try {
		const history = state && Array.isArray(state.history) ? state.history : []
		const [move, nextMemory] = decide(history, memory)
		return [move === "C" ? "C" : "D", nextMemory]
	} catch {
		return ["D", memory || freshMemory()]
	}
}
