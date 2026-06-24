const fs = require('fs');

// In-memory state
// Structure: { "phonenumber": { state: "NEW"|"AWAITING_OPTION"|"CHATTING_WITH_JUNE"|"WAITING_FOR_JAZI", timestamp: Date.now() } }
const userStates = {};

// Reset states if they are older than 24 hours
const RESET_TIME = 24 * 60 * 60 * 1000;

function getUserState(from) {
    const user = userStates[from];
    if (!user) return "NEW";
    
    // Check if state has expired
    if (Date.now() - user.timestamp > RESET_TIME) {
        delete userStates[from];
        return "NEW";
    }
    
    return user.state;
}

function setUserState(from, state) {
    userStates[from] = {
        state: state,
        timestamp: Date.now()
    };
}

module.exports = {
    getUserState,
    setUserState
};
