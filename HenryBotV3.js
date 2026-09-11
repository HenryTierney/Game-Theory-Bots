export default function bot({ history, memory }) {
    const currentRound = history.length;
    
    // 1. Initialize our learning matrix memory structure
    memory = memory ?? {
        oppDefectionsAfterMyC: 0,
        myCTotal: 0,
        oppDefectionsAfterMyD: 0,
        myDTotal: 0,
        oppDefectionsAfterMutualC: 0,
        mutualCTotal: 0,
        currentStance: "learning"
    };

    let move = "C";

    // 2. The Endgame Betrayal (Unchanged, ensures max points before cutoff)
    if (currentRound >= 145) {
        return ["D", memory];
    }

    // 3. Update the Learning Matrix using data from the round that just finished
    if (currentRound > 0) {
        const lastRound = history[currentRound - 1];
        
        // Track reactions to your cooperation
        if (lastRound.you === "C") {
            memory.myCTotal++;
            if (lastRound.opponent === "D") memory.oppDefectionsAfterMyC++;
        }
        
        // Track reactions to your defection
        if (lastRound.you === "D") {
            memory.myDTotal++;
            if (lastRound.opponent === "D") memory.oppDefectionsAfterMyD++;
        }

        // Track reactions to mutual cooperation (vital for finding soft targets)
        if (currentRound > 1) {
            const secondLastRound = history[currentRound - 2];
            if (secondLastRound.you === "C" && secondLastRound.opponent === "C") {
                memory.mutualCTotal++;
                if (lastRound.opponent === "D") memory.oppDefectionsAfterMutualC++;
            }
        }
    }

    // 4. Learning Phase: Play a flexible probe strategy for the first 35 rounds to gather data
    if (currentRound < 35) {
        // Every 7 rounds, throw a calculated defection probe to see how they react to being hit
        if (currentRound > 0 && currentRound % 7 === 0) {
            return ["D", memory];
        }
        // Otherwise, maintain standard Tit-for-Two-Tats to preserve points during tracking
        const lastOpp = history.at(-1)?.opponent;
        const secondLastOpp = history.at(-2)?.opponent;
        move = (lastOpp === "D" && secondLastOpp === "D") ? "D" : "C";
        return [move, memory];
    }

    // 5. Brain Analysis Phase: Run once at Round 35 to classify and exploit
    if (memory.currentStance === "learning") {
        const probDAfterMyC = memory.myCTotal > 0 ? (memory.oppDefectionsAfterMyC / memory.myCTotal) : 0;
        const probDAfterMyD = memory.myDTotal > 0 ? (memory.oppDefectionsAfterMyD / memory.myDTotal) : 0;
        const probDAfterMutualC = memory.mutualCTotal > 0 ? (memory.oppDefectionsAfterMutualC / memory.mutualCTotal) : 0;

        // IDENTIFIED PROFILE 1: The Blind Cooperator / Pinata
        // They rarely defect, even when probed. 
        if (probDAfterMyC < 0.10 && probDAfterMyD < 0.20) {
            memory.currentStance = "ruthless_exploit";
        }
        // IDENTIFIED PROFILE 2: The Pure Unforgiving Grudger / Grim Trigger
        // They reacted to our round 7/14/21/28 probes by defecting continuously afterward.
        else if (probDAfterMyD > 0.85 && probDAfterMyC > 0.80) {
            memory.currentStance = "defensive_lockdown";
        }
        // IDENTIFIED PROFILE 3: The Forgiving Matcher (Tit-for-Tat / Tit-for-Two-Tats variants)
        // They cooperate when we cooperate, but reliably punish defection.
        else if (probDAfterMutualC < 0.15 && probDAfterMyD > 0.50) {
            memory.currentStance = "milking_handshake";
        }
        // IDENTIFIED PROFILE 4: Random / Noise / Chaotic Bot
        else {
            memory.currentStance = "defensive_lockdown";
        }
    }

    // 6. Execution Phase: Run the tailored exploitation counter-measures
    if (memory.currentStance === "ruthless_exploit" || memory.currentStance === "defensive_lockdown") {
        // Always Defect: Maximizes points against cooperators, shields against grudgers/chaos bots
        move = "D";
    } 
    else if (memory.currentStance === "milking_handshake") {
        // They are a smart matcher. If we copy them completely, we get 2 points per round.
        // But since we know they are forgiving, we can safely steal 3 points precisely every 6 rounds.
        if (currentRound % 6 === 0) {
            move = "D"; // Sneak attack
        } else {
            // Standard Tit-for-Two-Tats safety line
            const lastOpp = history.at(-1)?.opponent;
            const secondLastOpp = history.at(-2)?.opponent;
            move = (lastOpp === "D" && secondLastOpp === "D") ? "D" : "C";
        }
    }

    return [move, memory];
}
