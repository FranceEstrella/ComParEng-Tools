// Configuration constants for the application

// Feedback form
export const MESSAGE_MIN = 10;

// Academic planner credit recommendations
export const RECOMMENDED_UNITS_MIN = 12; // lower bound per term
export const RECOMMENDED_UNITS_MAX = 24; // upper bound per term
export const ALLOW_OVERFLOW_UNITS = 2;   // permitted overflow to align prerequisites

// Priority weighting for scheduling (higher = earlier placement)
export const PRIORITY_WEIGHTS = {
	high: 3,
	medium: 2,
	low: 1,
};

