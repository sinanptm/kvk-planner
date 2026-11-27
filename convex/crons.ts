import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh our alliances' member lists from the game once a day (8 API calls), so sign-up
// checks and name search can use them instead of calling the API for every player.
crons.cron("refresh alliance member lists", "0 2 * * *", internal.kvk.lookup.refreshRostersDaily, {});

export default crons;
