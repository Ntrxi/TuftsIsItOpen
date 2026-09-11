import type { Location } from '../engine/types';
import { r } from '../engine/format';

export const tech: Location[] = [
  {
    id: 'tts-walkup',
    name: 'TTS Walk-Up Help Desk',
    category: 'tech',
    building: 'Tisch Library',
    description:
      'In-person tech support and the Repair Center (drop-off and pickup Mon–Fri 9 AM – 5 PM). 24/7 phone support at 617-627-3376.',
    hours: [
      [r('9am', '11pm')], // Sun
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '5pm')], // Fri
      [r('9am', '5pm')], // Sat
    ],
    // The IT locations page says only that holiday and special hours may vary.
    holidays: 'unknown',
    breaks: 'unknown',
    overrides: [
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed with Tisch Library this weekend' },
    ],
    links: {
      source: 'https://it.tufts.edu/walk-support-locations',
      schedule: 'https://access.tufts.edu/tts-walk-help-desk-returns-tisch-library-beginning-august-10',
    },
    note: 'Hours follow the TTS walk-up locations page (Sun–Thu 9 AM–11 PM, Fri–Sat 9 AM–5 PM), which notes that holiday and special hours may vary. The Aug 6, 2026 return-to-Tisch announcement listed shorter hours; the locations page is treated as the canonical schedule.',
    verified: '2026-09-11',
    confidence: 'high',
  },
  {
    id: 'nolop',
    name: 'Nolop FAST Facility (makerspace)',
    category: 'tech',
    building: 'Science & Engineering Complex, 200 College Ave (under the main stairs)',
    description:
      'Open makerspace for anyone with a Tufts ID. Tool-specific safety training is required for the laser cutter, 3D printers, soldering, and the supervised woodshop "red zone".',
    hours: 'unknown',
    holidays: 'regular',
    breaks: 'unknown',
    links: { source: 'https://nolop.org/hours/' },
    note: 'The hours page (last edited May 26, 2026) still lists summer hours ending Aug 7 and says only that in fall and spring Nolop is "open until 11 PM every day except Saturday"; no opening times or Saturday hours are published. Confirm with Nolop.',
    verified: '2026-09-11',
    confidence: 'low',
  },
  {
    id: 'bray-machine-shop',
    name: 'Bray Lab Machine Shop',
    category: 'tech',
    building: 'Bray Laboratory room 114, 504 Boston Ave',
    description:
      'Mechanical engineering shop with the laser cutter (Trotec Speedy 400), hand tools, power tools, mills, and lathes. Safety quiz and zone training required; machine time is booked at least a day ahead, and you can stop by during open shop hours to talk to staff.',
    access: 'appointment',
    hours: 'unknown',
    links: {
      source: 'https://sites.tufts.edu/bray/',
      schedule: 'https://sites.tufts.edu/bray/appointment-request-information/',
    },
    note: 'Open shop hours and closures come live from the "Open Hours" and "In-Shop Labs" Google calendars embedded on the Bray home page (the Fall 2026 calendar currently shows Mon–Thu 10 AM–8 PM, Fri 10 AM–5 PM, Sat–Sun 12–5 PM through Dec 14, with instance edits). Bray publishes no fixed fall schedule elsewhere, so hours are unknown whenever the calendar feed is unavailable.',
    verified: '2026-09-11',
    confidence: 'high',
  },
  {
    id: 'bray-3d-printing',
    name: 'Bray 3D Printing Space',
    category: 'tech',
    building: 'Bray Laboratory room 102, 504 Boston Ave',
    description:
      'The room is always accessible. Before self-service, beginners must book training; experienced users must first check in with staff. Prints over 12 hours on Stratasys/Markforged printers need staff approval.',
    access: 'special',
    hours: [
      [r('12am', '12am', 'Room access')], [r('12am', '12am', 'Room access')],
      [r('12am', '12am', 'Room access')], [r('12am', '12am', 'Room access')],
      [r('12am', '12am', 'Room access')], [r('12am', '12am', 'Room access')],
      [r('12am', '12am', 'Room access')],
    ],
    holidays: 'regular',
    breaks: 'regular',
    links: { source: 'https://sites.tufts.edu/bray/3dprintinglab/' },
    note: 'Hours describe room access, not staffed assistance. Training and help follow the Bray shop calendar (see the machine shop card for live open shop hours).',
    verified: '2026-09-11',
    confidence: 'high',
  },
  {
    id: 'tisch-dds',
    name: 'Tisch Digital Design Studio (DDS)',
    category: 'tech',
    building: 'Tisch Library room 303',
    description:
      'Staffed studio for design software, media, and large-format printing. 3D printing is paused this semester; a laser-engraving service runs Fridays.',
    hours: [
      [r('10am', '9pm')], // Sun
      [r('10am', '9pm')],
      [r('10am', '9pm')],
      [r('10am', '9pm')],
      [r('10am', '9pm')],
      [r('11am', '5pm')], // Fri
      [r('10am', '6pm')], // Sat
    ],
    holidays: 'closed',
    breaks: 'unknown',
    periods: [
      { period: 'thanksgiving-2026', hours: 'unknown', note: 'DDS and building calendars disagree during Thanksgiving; confirm staffed availability' },
    ],
    overrides: [
      { from: '2026-08-31', to: '2026-09-04', hours: [r('10am', '5pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
      { from: '2026-10-12', hours: 'regular', note: 'Regular DDS desk hours published in LibCal' },
      { from: '2026-11-11', hours: 'regular', note: 'Regular DDS desk hours published in LibCal' },
      { from: '2026-11-25', to: '2026-11-28', hours: 'unknown', sourceConflict: true, note: 'LibCal lists DDS service beyond Tisch building hours (Nov 25 closes 6 PM; Nov 26–28 closed). Confirm staffed availability.' },
    ],
    links: {
      source: 'https://tischlibrary.tufts.edu/our-locations/also-tisch/digital-design-studio-dds',
      schedule: 'https://tufts.libcal.com/hours',
    },
    validThrough: '2026-11-28',
    note: 'LibCal desk hours rechecked Sep 7: Sun–Thu 10 AM–9 PM, Fri 11 AM–5 PM, Sat 10 AM–6 PM. Computers and study space follow Tisch building access; these hours describe staffed services. Later building hours are not yet set.',
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'dds-laser',
    name: 'DDS Laser Engraving (drop-in)',
    category: 'tech',
    building: 'Tisch Library room 303',
    description:
      'Friday drop-in consults for the laser engraving pilot. Staff queue and run jobs (3 per student per semester) and email you for pickup.',
    hours: [[], [], [], [], [], [r('1pm', '4pm', 'Drop-in')], []],
    holidays: 'closed',
    breaks: 'closed',
    overrides: [
      { from: '2026-09-01', to: '2026-09-24', hours: 'closed', note: 'Drop-in hours start Fri Sep 25' },
      { from: '2026-12-12', to: '2027-01-19', hours: 'closed', note: 'Last Friday drop-in was Dec 11; the published date range ends Sat Dec 12' },
      { from: '2027-01-20', to: '2027-05-14', hours: 'unknown', note: 'Spring drop-in schedule not announced yet' },
    ],
    links: {
      source: 'https://tischlibrary.tufts.edu/our-locations/also-tisch/digital-design-studio-dds/3d-printing/request',
    },
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'halligan-ece-labs',
    name: 'Halligan Electronics Labs',
    category: 'tech',
    building: 'Halligan Hall rooms 223, 225, 229',
    description:
      'Circuits and electronics labs for ECE/CS students and anyone enrolled in an ECE or CS course. Eligible students have access outside scheduled lab times; contact the department to arrange access.',
    access: 'special',
    hours: 'varies',
    availability: 'Available to eligible ECE/CS students outside scheduled labs',
    holidays: 'regular',
    breaks: 'regular',
    links: { source: 'https://engineering.tufts.edu/computing/other-facilities' },
    note: 'The Engineering computing page lists hours as "Varies": access depends on course enrollment, card access, and the lab schedule, so no fixed hours exist. Contact staff@eecs.tufts.edu.',
    verified: '2026-09-11',
    confidence: 'high',
  },
  {
    id: 'crafts-center',
    name: 'Tufts Crafts Center',
    category: 'tech',
    building: 'Lewis Hall basement, 75 Packard Ave',
    description: 'Student-run studio with pottery, screen printing, and general craft supplies. Free for all Tufts students; drop in during open hours.',
    hours: 'unknown',
    holidays: 'regular',
    breaks: 'unknown',
    links: { source: 'https://tufts.presence.io/organization/crafts-center' },
    note: 'No dated Fall 2026 schedule is published. The undated JumboLife listing says 5–11 PM Mon–Thu and 1–5 PM Fri and Sun, the Tufts Maker Network page says 7–11 PM Mon–Thu and 1–5 PM Fri and Sun, and the crafts.center e-list says 7–10 PM and 1–4 PM; hours are announced each semester on Instagram @tuftscrafts.',
    verified: '2026-09-11',
    confidence: 'low',
  },
];
