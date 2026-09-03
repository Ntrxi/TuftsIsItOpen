import type { Calendar } from '../engine/types';

/**
 * Tufts 2026–27 academic calendar (Medford/Somerville, AS&E) and university holidays.
 * Sources:
 *  - https://students.tufts.edu/registrar/courses-and-calendars/academic-calendar
 *  - https://access.tufts.edu/university-holiday-bonus-and-winter-break-days-calendar
 * Dates are inclusive. Verified 2026-09-03.
 */
export const calendar: Calendar = {
  holidays: [
    { date: '2026-09-07', name: 'Labor Day' },
    { date: '2026-10-12', name: "Indigenous Peoples' Day" },
    { date: '2026-11-11', name: 'Veterans Day' },
    { date: '2026-11-26', name: 'Thanksgiving' },
    { date: '2026-11-27', name: 'Day after Thanksgiving' },
    { date: '2026-12-24', name: 'Christmas Eve (university closed)' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-28', name: 'Winter break day (university closed)' },
    { date: '2026-12-29', name: 'Winter break day (university closed)' },
    { date: '2026-12-30', name: "President's bonus day (university closed)" },
    { date: '2026-12-31', name: "President's bonus day (university closed)" },
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-01-18', name: 'Martin Luther King Jr. Day' },
    { date: '2027-02-15', name: "Presidents' Day" },
    { date: '2027-04-19', name: "Patriots' Day" },
    { date: '2027-05-31', name: 'Memorial Day' },
    { date: '2027-06-18', name: 'Juneteenth (observed)' },
    { date: '2027-07-05', name: 'Independence Day (observed)' },
  ],
  periods: [
    { id: 'orientation-2026', name: 'Orientation week', from: '2026-08-28', to: '2026-09-07', kind: 'info' },
    { id: 'fall-2026', name: 'Fall semester', from: '2026-09-08', to: '2026-12-23', kind: 'term' },
    { id: 'thanksgiving-2026', name: 'Thanksgiving recess', from: '2026-11-25', to: '2026-11-29', kind: 'break' },
    { id: 'fall-exams-2026', name: 'Fall finals', from: '2026-12-15', to: '2026-12-23', kind: 'exams' },
    { id: 'winter-2026', name: 'Winter break', from: '2026-12-24', to: '2027-01-19', kind: 'break' },
    { id: 'spring-2027', name: 'Spring semester', from: '2027-01-20', to: '2027-05-14', kind: 'term' },
    { id: 'spring-break-2027', name: 'Spring break', from: '2027-03-20', to: '2027-03-28', kind: 'break' },
    { id: 'spring-exams-2027', name: 'Spring finals', from: '2027-05-04', to: '2027-05-14', kind: 'exams' },
    { id: 'summer-2027', name: 'Summer', from: '2027-05-15', to: '2027-08-31', kind: 'summer' },
  ],
};
