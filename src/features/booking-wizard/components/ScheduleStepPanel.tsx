"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildScheduleDateOptions,
  formatTimeSlotLabel,
  isScheduleTimeSlotDisabled,
  resolveAdjacentScheduleDateValue,
  resolveScheduleDateArrowNavigationState,
  resolveScheduleDateScrollButtonsState,
  resolveScheduleDateScrollStepPx,
  resolveScheduleTimeSlots,
  scheduleDateScrollerHasOverflow,
  type ScheduleDateOption,
} from "../scheduleStepDisplay";
import {
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
  wizardCardClass,
} from "../wizardSelection";
import { WizardStepHeading } from "./WizardStepHeading";

type Props = {
  date: string;
  time: string;
  minDate: string;
  dateError?: string;
  timeError?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

type DateCardProps = {
  option: ReturnType<typeof buildScheduleDateOptions>[number];
  selected: boolean;
  onSelect: (value: string) => void;
};

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M12.5 5 7.5 10l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="m7.5 5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type DateScrollRowProps = {
  children: ReactNode;
  selectedDate: string;
  dateOptions: ScheduleDateOption[];
  onDateChange: (value: string) => void;
};

function DateScrollRow({
  children,
  selectedDate,
  dateOptions,
  onDateChange,
}: DateScrollRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const dateNavigation = useMemo(
    () => resolveScheduleDateArrowNavigationState(dateOptions, selectedDate),
    [dateOptions, selectedDate],
  );

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const overflow = scheduleDateScrollerHasOverflow(el.scrollWidth, el.clientWidth);
    setHasOverflow(overflow);

    const { canScrollLeft: left, canScrollRight: right } =
      resolveScheduleDateScrollButtonsState(
        el.scrollLeft,
        el.scrollWidth,
        el.clientWidth,
      );
    setCanScrollLeft(left);
    setCanScrollRight(right);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const runUpdate = () => {
      updateScrollState();
    };

    runUpdate();
    const frame = requestAnimationFrame(runUpdate);

    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(() => updateScrollState());
    observer.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [updateScrollState, children]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !selectedDate) return;

    const card = root.querySelector<HTMLElement>(
      `[data-date-value="${selectedDate}"]`,
    );
    card?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [selectedDate, children]);

  const scrollByStep = (direction: -1 | 1) => {
    const root = scrollerRef.current;
    if (!root) return;

    const card = root.querySelector<HTMLElement>("[data-date-card]");
    const step = resolveScheduleDateScrollStepPx(card?.offsetWidth ?? 0);
    root.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const selectAdjacentDate = (direction: -1 | 1) => {
    const nextValue = resolveAdjacentScheduleDateValue(
      dateOptions,
      selectedDate,
      direction,
    );
    if (nextValue) onDateChange(nextValue);
  };

  const handlePrevious = () => {
    if (hasOverflow) {
      scrollByStep(-1);
      return;
    }
    selectAdjacentDate(-1);
  };

  const handleNext = () => {
    if (hasOverflow) {
      scrollByStep(1);
      return;
    }
    selectAdjacentDate(1);
  };

  const previousDisabled = hasOverflow ? !canScrollLeft : !dateNavigation.canGoPrevious;
  const nextDisabled = hasOverflow ? !canScrollRight : !dateNavigation.canGoNext;
  const previousLabel = hasOverflow ? "Scroll dates backward" : "Previous available date";
  const nextLabel = hasOverflow ? "Scroll dates forward" : "Next available date";

  const scrollButtonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-[border-color,background-color,color,opacity] hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none md:h-9 md:w-9";

  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5 md:gap-3">
      <button
        type="button"
        className={`${scrollButtonClass} self-center`}
        aria-label={previousLabel}
        disabled={previousDisabled}
        onClick={handlePrevious}
      >
        <ChevronLeftIcon className="h-4 w-4 md:h-5 md:w-5" />
      </button>

      <div
        ref={scrollerRef}
        className="flex min-w-0 max-w-full flex-1 items-center overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] max-md:snap-x max-md:snap-mandatory max-md:scroll-px-3 md:snap-none [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max items-center justify-start gap-1.5 py-0.5 md:gap-2 md:px-0.5">
          {children}
        </div>
      </div>

      <button
        type="button"
        className={`${scrollButtonClass} self-center`}
        aria-label={nextLabel}
        disabled={nextDisabled}
        onClick={handleNext}
      >
        <ChevronRightIcon className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    </div>
  );
}

function DateCard({ option, selected, onSelect }: DateCardProps) {
  return (
    <button
      type="button"
      data-date-card
      data-date-value={option.value}
      disabled={option.disabled}
      aria-pressed={selected}
      onClick={() => onSelect(option.value)}
      className={`flex shrink-0 flex-col items-center justify-center border text-center disabled:cursor-not-allowed disabled:opacity-40 max-md:h-[4.25rem] max-md:w-[4.25rem] max-md:snap-center max-md:rounded-xl max-md:px-1.5 max-md:py-2 md:h-auto md:min-h-[4.5rem] md:min-w-[4.75rem] md:snap-start md:rounded-2xl md:px-3 md:py-3 ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${
        selected
          ? wizardCardClass(true)
          : `${wizardCardClass(false)} hover:shadow-[0_2px_10px_rgba(24,24,27,0.06)]`
      }`}
    >
      <span
        className={`text-[0.6875rem] font-semibold uppercase leading-none tracking-wide md:text-xs ${
          selected ? "text-zinc-900" : "text-zinc-600"
        }`}
      >
        {option.dayLabel}
      </span>
      <span
        className={`mt-1 text-[0.8125rem] font-medium leading-tight tabular-nums md:text-sm ${
          selected ? "text-zinc-900" : "text-zinc-700"
        }`}
      >
        {option.dateLabel}
      </span>
    </button>
  );
}

type TimeSlotButtonProps = {
  slot: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: string) => void;
};

function TimeSlotButton({ slot, selected, disabled, onSelect }: TimeSlotButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => onSelect(slot)}
      className={`min-h-[2.75rem] rounded-xl border px-3 py-2.5 text-sm font-medium tabular-nums text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${
        selected
          ? wizardCardClass(true)
          : `${wizardCardClass(false)} hover:bg-zinc-50/60`
      }`}
    >
      {formatTimeSlotLabel(slot)}
    </button>
  );
}

export function ScheduleStepPanel({
  date,
  time,
  minDate,
  dateError,
  timeError,
  onDateChange,
  onTimeChange,
}: Props) {
  const dateOptions = useMemo(() => buildScheduleDateOptions(minDate), [minDate]);
  const timeSlots = useMemo(() => resolveScheduleTimeSlots(time), [time]);

  const selectedDateInList = dateOptions.some((o) => o.value === date && !o.disabled);

  return (
    <div className="w-full min-w-0">
      <WizardStepHeading
        title="Schedule your clean"
        subtitle="Choose the date and start time that works best for you."
      />

      <p className="mt-3 text-xs leading-relaxed text-zinc-400">
        Times shown in South Africa time.
      </p>

      <section className="mt-6 min-w-0" aria-labelledby="schedule-date-heading">
        <h3
          id="schedule-date-heading"
          className="text-sm font-medium text-zinc-800"
        >
          Which day would you like us to come?
        </h3>

        <div className="mt-3 min-w-0" role="group" aria-label="Available dates">
          <DateScrollRow
            selectedDate={date}
            dateOptions={dateOptions}
            onDateChange={onDateChange}
          >
            {dateOptions.map((option) => (
              <DateCard
                key={option.value}
                option={option}
                selected={date === option.value}
                onSelect={onDateChange}
              />
            ))}
          </DateScrollRow>
        </div>

        {date && !selectedDateInList ? (
          <p className="mt-2 text-xs text-zinc-500">
            Selected date:{" "}
            <time dateTime={date} className="font-medium text-zinc-700">
              {date}
            </time>
          </p>
        ) : null}

        {dateError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {dateError}
          </p>
        ) : null}

        <label className="sr-only" htmlFor="schedule-date-fallback">
          Date
        </label>
        <input
          id="schedule-date-fallback"
          type="date"
          className="sr-only"
          tabIndex={-1}
          min={minDate}
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </section>

      <section
        className="mt-8 min-w-0"
        aria-labelledby="schedule-time-heading"
      >
        <h3
          id="schedule-time-heading"
          className="text-sm font-medium text-zinc-800"
        >
          What time would you like us to arrive?
        </h3>

        <div
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 md:gap-2.5 lg:grid-cols-3"
          role="group"
          aria-label="Available arrival times"
        >
          {timeSlots.map((slot) => (
            <TimeSlotButton
              key={slot}
              slot={slot}
              selected={time === slot}
              disabled={isScheduleTimeSlotDisabled(date, slot)}
              onSelect={onTimeChange}
            />
          ))}
        </div>

        {timeError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {timeError}
          </p>
        ) : null}

        <label className="sr-only" htmlFor="schedule-time-fallback">
          Start time
        </label>
        <input
          id="schedule-time-fallback"
          type="time"
          className="sr-only"
          tabIndex={-1}
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      </section>
    </div>
  );
}
