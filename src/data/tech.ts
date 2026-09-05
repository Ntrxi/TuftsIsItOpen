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
    note: 'Hours from the Aug 2026 announcement; the older it.tufts.edu page lists different times.',
    verified: '2026-09-03',
    confidence: 'medium',
  },
  {
    id: 'nolop',
    name: 'Nolop FAST Facility (makerspace)',
    category: 'tech',
    building: 'Science & Engineering Complex, 200 College Ave (under the main stairs)',
    description:
      'Open makerspace for anyone with a Tufts ID. Tool-specific safety training is required for the laser cutter, 3D printers, soldering, and the supervised woodshop "red zone".',
    hours: [
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
      [r('9am', '11pm')],
    ],
    holidays: 'regular',
    breaks: 'unknown',
    overrides: [{ from: '2026-09-01', to: '2026-09-07', hours: 'unknown', note: 'Fall hours begin with classes on Sep 8' }],
    links: { source: 'https://nolop.org/hours/' },
    note: 'Fall 2026 hours are not posted yet. Shown hours are the typical semester pattern (about 9 AM – 11 PM daily, closing a little earlier Friday and Saturday nights).',
    verified: '2026-09-03',
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
    verified: '2026-09-03',
    confidence: 'low',
  },
  {
    id: 'bray-3d-printing',
    name: 'Bray 3D Printing Space',
    category: 'tech',
    building: 'Bray Laboratory room 102, 504 Boston Ave',
    description:
      'Stratasys F120, Markforged Onyx, and Prusa MK4 printers. New users book a training session; prints over 12 hours need staff approval.',
    access: 'special',
    hours: 'unknown',
    links: { source: 'https://sites.tufts.edu/bray/3dprintinglab/' },
    note: 'Room access follows the Bray Lab shop schedule, which is not yet posted for fall 2026.',
    verified: '2026-09-03',
    confidence: 'low',
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
      // Sunday after the recess follows the regular schedule; LibCal overrides this once published.
      { period: 'thanksgiving-2026', hours: [[r('10am', '9pm')], [], [], [r('11am', '5pm')], [], [], []], note: 'Thanksgiving recess hours (confirm on the library calendar)' },
    ],
    overrides: [
      { from: '2026-08-31', to: '2026-09-04', hours: [r('10am', '5pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
    ],
    links: {
      source: 'https://tischlibrary.tufts.edu/our-locations/also-tisch/digital-design-studio-dds',
      schedule: 'https://tufts.libcal.com/hours',
    },
    note: 'Staffed desk hours update live from the library calendar.',
    verified: '2026-09-03',
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
      { from: '2026-12-13', to: '2027-01-31', hours: 'closed', note: 'Fall drop-ins ended Dec 12; spring schedule TBA' },
    ],
    links: {
      source: 'https://tischlibrary.tufts.edu/our-locations/also-tisch/digital-design-studio-dds/3d-printing/request',
    },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'halligan-ece-labs',
    name: 'Halligan Electronics Labs',
    category: 'tech',
    building: 'Halligan Hall rooms 223, 225, 229',
    description:
      'Circuits and electronics labs for ECE/CS students and anyone enrolled in an ECE or CS course. Doors lock at 7 PM on weekdays and all weekend; use your Tufts ID for card access.',
    access: 'special',
    hours: 'unknown',
    links: { source: 'https://engineering.tufts.edu/computing/other-facilities' },
    note: 'No public hours; access outside scheduled lab sessions varies by course. Contact staff@eecs.tufts.edu.',
    verified: '2026-09-03',
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
