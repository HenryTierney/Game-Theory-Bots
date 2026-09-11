export default function bot({ history, memory }) {
    memory = memory ?? { mode: "profiling" }
    let move = "C"

    const currentRound = history.length
    const lastOpponentMove = history.at(-1)?.opponent
    const secondLastOpponentMove = history.at(-2)?.opponent

    // 1. The Endgame Percentile Betrayal
    if (currentRound >= 145) {
        return ["D", memory]
    }

    // Phase 1: Gather stable baseline records for the first 30 rounds
    if (currentRound < 30) {
        // Strict Tit for Two Tats (T42T)
        if (lastOpponentMove === "D" && secondLastOpponentMove === "D") {
            move = "D"
        } else {
            move = "C"
        }
    } 
    // Phase 2: Analyze historical trends after round 30
    else {
        if (memory.mode === "profiling") {
            let defectionCount = 0
            for (let i = 0; i < currentRound; i++) {
                if (history[i].opponent === "D") {
                    defectionCount++
                }
            }
            
            const defectionRate = defectionCount / currentRound
            
            if (defectionRate < 0.12) {
                memory.mode = "exploit"   // Blind cooperator -> Continuous defection
            } else if (defectionRate > 0.55) {
                memory.mode = "lockdown"  // Hard defecting bot -> Shield defense
            } else {
                memory.mode = "standard"  // Dynamic matcher -> Win-Win cooperation
            }
        }

        // Phase 3: Strategy Execution Paths
        if (memory.mode === "exploit" || memory.mode === "lockdown") {
            move = "D"
        } 
        else if (memory.mode === "standard") {
            // YOUR IDEA: Every 8 rounds, break the loop and test the opponent
            if (currentRound % 8 === 0) {
                // If the normal loop would cooperate, steal a defection point.
                // If the normal loop would defect, offer a cooperation handshake to see if they follow.
                if (lastOpponentMove === "C") {
                    move = "D" // Calculated strike for 3 points
                } else {
                    move = "C" // Peace offering to break a deadlock
                }
            } else {
                // Default back to standard Tit for Two Tats rhythm
                if (lastOpponentMove === "D" && secondLastOpponentMove === "D") {
                    move = "D"
                } else {
                    move = "C"
                }
            }
        }
    }

    return [move, memory]
}
