export type AdminOverviewTodayCounts = {
  bookingsToday: number;
  bookingsConfirmed: number;
  bookingsDone: number;
  cleanersActive: number;
  revenueTodayCents: number;
};

export type AdminOverviewRhythmCounts = {
  recurringActive: number;
  confirmedToday: number;
  attentionNeeded: number;
  completedVisitsToday: number;
};

/** Presentation-only context for future bookings (does not affect today metrics). */
export type AdminOverviewUpcomingContext = {
  upcomingBookingsCount: number;
  nextUpcomingScheduledStart: string | null;
  /** Relative label e.g. "tomorrow" or "22 May" for the next visit. */
  nextUpcomingDayLabel: string | null;
  futurePaidBookingsCount: number;
  cleanersInSystemCount: number;
};
