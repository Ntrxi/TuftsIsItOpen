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
      [r('10am', '9pm')], // Sun
      [r('9am', '9pm')],
      [r('9am', '9pm')],
      [r('9am', '9pm')],
      [r('9am', '9pm')],
      [r('9am', '5pm')], // Fri
      [r('10am', '5pm')], // Sat
    ],
    holidays: 'closed',
    breaks: 'unknown',
    overrides: [
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed with Tisch Library this weekend' },
    ],
    links: {
      source: 'https://access.tufts.edu/tts-walk-help-desk-returns-tisch-library-beginning-august-10',
      schedule: 'https://it.tufts.edu/walk-support-locations',
    },
    sourceConflict: 'Official TTS sources disagree on walk-up hours; confirm with TTS at 617-627-3376.',
    note: 'The Aug 6, 2026 announcement lists Mon–Thu 9 AM–9 PM, Fri 9 AM–5 PM, Sat 10 AM–5 PM, Sun 10 AM–9 PM. The IT locations page instead lists Sun–Thu 9 AM–11 PM and Fri–Sat 9 AM–5 PM.',
    verified: '2026-09-07',
    confidence: 'medium',
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
    note: 'The hours page still lists summer hours ending Aug 7. It mentions an 11 PM semester close except Saturday, but does not publish a complete fall schedule. Confirm with Nolop.',
    verified: '2026-09-07',
    confidence: 'low',
  },
  {
    id: 'bray-machine-shop',
    name: 'Bray Lab Machine Shop',
    category: 'tech',
    building: 'Bray Laboratory room 114, 504 Boston Ave',
    description:
      'Mechanical engineering shop with the laser cutter (Trotec Speedy 400), hand tools, power tools, mills, and lathes. Safety quiz and zone training required; book machine time at least a day ahead.',
    access: 'appointment',
    hours: 'unknown',
    links: {
      source: 'https://sites.tufts.edu/bray/',
      schedule: 'https://sites.tufts.edu/bray/appointment-request-information/',
    },
    note: 'Fall 2026 open-shop hours are not posted yet (summer was Mon–Fri 10 AM – 5 PM). Open hours and heat closures are posted on the Bray Lab calendar.',
    verified: '2026-09-07',
    confidence: 'low',
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
    note: 'Hours describe room access, not staffed assistance. Training and help follow the Bray shop calendar; Fall 2026 staffed hours are not yet published.',
    verified: '2026-09-07',
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
    hours: 'unknown',
    links: { source: 'https://engineering.tufts.edu/computing/other-facilities' },
    note: 'No public hours; access outside scheduled lab sessions varies by course. Contact staff@eecs.tufts.edu.',
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'crafts-center',
    name: 'Tufts Crafts Center',
    category: 'tech',
    building: 'Lewis Hall basement, 75 Packard Ave',
    description: 'Student-run studio with pottery, screen printing, and general craft supplies. Free for all Tufts students; drop in during open hours.',
    hours: [
      [r('1pm', '5pm')], // Sun
      [r('5pm', '11pm')],
      [r('5pm', '11pm')],
      [r('5pm', '11pm')],
      [r('5pm', '11pm')],
      [r('1pm', '5pm')], // Fri
      [], // Sat
    ],
    holidays: 'closed',
    breaks: 'closed',
    overrides: [{ from: '2026-09-01', to: '2026-09-13', hours: 'unknown', note: 'Fall opening date is announced on Instagram @tuftscrafts' }],
    links: { source: 'https://tufts.presence.io/organization/crafts-center' },
    note: 'Hours are announced on Instagram each semester and vary; the posted pattern is unverified for fall 2026.',
    verified: '2026-09-03',
    confidence: 'low',
  },
];
