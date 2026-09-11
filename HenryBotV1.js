export default function bot ({history, memory}) {
    memory = memory ?? { mode: "profiling" }

    let move = "C"

    const lastOpponentMove = history.at(-1)?.opponent
    const secondlastOpponentMove = history.at(-2)?.opponent

    if (history.length < 12) {
        if (lastOpponentMove === "D" && secondlastOpponentMove === "D") {
            move = "D"
        } else {
            move = "C"
        }
    } else {
        if (memory.mode === "profiling") {
            let defectionCount = 0

            for (let i = 0; i < history.length; i++) {
                if (history[i].opponent === "D") {
                    defectionCount++
                }
            }

            const defectionRate = defectionCount / history.length

            if (defectionRate < 0.10) {
                memory.mode = "exploit"
            } else if (defectionRate > 0.70) {
                memory.mode = "lockdown"
            } else {
                memory.mode = "standard"
            }
        }

        if (memory.mode === "exploit" || memory.mode === "lockdown") {
            move = "D"
        } else if (memory.mode === "standard") {
            if (lastOpponentMove === "D" && secondlastOpponentMove === "D") {
                move = "D"
            } else {
                move = "C"
            }
        }
    }

    return [move, memory]
}
