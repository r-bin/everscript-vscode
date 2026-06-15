import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 63,
    "instructionAddress": 9671091,
    "expectedSize": 6,
    "text": "WRITE boy+x68=0x200, boy+x66=0x17b2 (set script): Unnamed NPC Kill script 0x17b2"
  },
  {
    "opcode": 63,
    "instructionAddress": 9687706,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17be (set script): Unnamed NPC Kill script 0x17be"
  },
  {
    "opcode": 63,
    "instructionAddress": 9744814,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9672227,
    "expectedSize": 6,
    "text": "WRITE $0ea2+4=0x01, $0eac+4=0x17b5 (unknown): Unnamed Short script 0x17b5?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9679302,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9736324,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17e8 (set script): Unnamed NPC Kill script 0x17e8"
  },
  {
    "opcode": 63,
    "instructionAddress": 9680860,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9687716,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x17cd (set script): Thraxx damage/kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9687785,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17bb (set script): Unnamed NPC Kill script 0x17bb"
  },
  {
    "opcode": 63,
    "instructionAddress": 10195867,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1b45 (set script): Unnamed NPC Kill script 0x1b45"
  },
  {
    "opcode": 63,
    "instructionAddress": 9742614,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1818 (set script): Cave raptors kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9810086,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x100, last entity ($0341)+x66=0x18b4 (set script): Unnamed NPC Damage script 0x18b4"
  },
  {
    "opcode": 63,
    "instructionAddress": 9688058,
    "expectedSize": 8,
    "text": "WRITE $2855+x68=0x200, $2855+x66=0x17c1 (set script): Unnamed NPC Kill script 0x17c1"
  },
  {
    "opcode": 63,
    "instructionAddress": 10006667,
    "expectedSize": 6,
    "text": "WRITE dog+x68=0x200, dog+x66=0x19c5 (set script): Doggo dies in prison?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10076878,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9736418,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17f1 (set script): Unnamed NPC Kill script 0x17f1"
  },
  {
    "opcode": 63,
    "instructionAddress": 9937587,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x1794 (unknown): Halls Wings?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9810063,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x100, last entity ($0341)+x66=0x18b1 (set script): Unnamed NPC Damage script 0x18b1"
  },
  {
    "opcode": 63,
    "instructionAddress": 10077085,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x179d (unknown): Unnamed Short script 0x179d?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10069915,
    "expectedSize": 13,
    "text": "WRITE $283d+x68=0x100, $283d+x66=0x1a52 (set script): Sterling"
  },
  {
    "opcode": 63,
    "instructionAddress": 10129091,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x1a85 (set script): Mungola? damage/kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9804315,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x1884 (unknown): Unnamed Short script 0x1884?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9671043,
    "expectedSize": 8,
    "text": "WRITE $2839+x68=0x200, $2839+x66=0x17af (set script): Raptors kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 10069732,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x17a0 (unknown): Unnamed Short script 0x17a0?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9938987,
    "expectedSize": 8,
    "text": "WRITE $2834+x68=0x200, $2834+x66=0x1998 (set script): Megataur kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9932929,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9687809,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x17d0 (set script): Unnamed NPC script 0x17d0"
  },
  {
    "opcode": 63,
    "instructionAddress": 9740193,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x178b (unknown): Unnamed Short script 0x178b?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9747994,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x181e (set script): Magmar damage"
  },
  {
    "opcode": 63,
    "instructionAddress": 9935499,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x1794 (unknown): Halls Wings?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9809994,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x100, last entity ($0341)+x66=0x18a8 (set script): Unnamed NPC Damage script 0x18a8"
  },
  {
    "opcode": 63,
    "instructionAddress": 9940666,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x1794 (unknown): Halls Wings?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9743607,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x178b (unknown): Unnamed Short script 0x178b?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9808612,
    "expectedSize": 6,
    "text": "WRITE $0ea2+4=0x01, $0eac+4=0x188a (unknown): Unnamed Short script 0x188a?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9688104,
    "expectedSize": 8,
    "text": "WRITE $2859+x68=0x200, $2859+x66=0x17c7 (set script): Unnamed NPC Kill script 0x17c7"
  },
  {
    "opcode": 63,
    "instructionAddress": 9687692,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17bb (set script): Unnamed NPC Kill script 0x17bb"
  },
  {
    "opcode": 63,
    "instructionAddress": 9683674,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10205752,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x17a9 (unknown): Unnamed Short script 0x17a9?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9816892,
    "expectedSize": 6,
    "text": "WRITE $0ea2+4=0x01, $0eac+4=0x18f0 (unknown): Unnamed Short script 0x18f0?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9883615,
    "expectedSize": 6,
    "text": "WRITE $0ea2+6=0x01, $0eac+6=0x195c (unknown): Unnamed Short script 0x195c?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10128699,
    "expectedSize": 11,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x1a82 (set script): Puppet damage/kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9934215,
    "expectedSize": 6,
    "text": "WRITE $0ea2+2=0x01, $0eac+2=0x1983 (unknown): Unnamed Short script 0x1983?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9684466,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x178e (unknown): BBM Wings?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9802700,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10195791,
    "expectedSize": 8,
    "text": "WRITE $2835+x68=0x40, $2835+x66=0x1b42 (set script): Unnamed NPC Talk script 0x1b42"
  },
  {
    "opcode": 63,
    "instructionAddress": 9952865,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9935536,
    "expectedSize": 6,
    "text": "WRITE $0ea2+2=0x01, $0eac+2=0x1989 (unknown): Unnamed Short script 0x1989?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10198916,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x40, last entity ($0341)+x66=0x1b57 (set script): Unnamed NPC Talk script 0x1b57"
  },
  {
    "opcode": 63,
    "instructionAddress": 9878762,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9804512,
    "expectedSize": 6,
    "text": "WRITE $0ea2+6=0x01, $0eac+6=0x1881 (unknown): Unnamed Short script 0x1881?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9688127,
    "expectedSize": 20,
    "text": "WRITE $285b+x68=0x200, $285b+x66=0x17ca (set script): Unnamed NPC Kill script 0x17ca"
  },
  {
    "opcode": 63,
    "instructionAddress": 10077076,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x179a (unknown): Unnamed Short script 0x179a?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9808606,
    "expectedSize": 6,
    "text": "WRITE $0ea2+6=0x01, $0eac+6=0x1887 (unknown): Unnamed Short script 0x1887?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9736170,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x1791 (unknown): Unnamed Short script 0x1791?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10087985,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9736502,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17ee (set script): Unnamed NPC Kill script 0x17ee"
  },
  {
    "opcode": 63,
    "instructionAddress": 9736176,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9742634,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1818 (set script): Cave raptors kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 10079745,
    "expectedSize": 8,
    "text": "WRITE $2835+x68=0x200, $2835+x66=0x1a6d (set script): Timberdrake Kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9738652,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9937801,
    "expectedSize": 6,
    "text": "WRITE $0ea2+2=0x01, $0eac+2=0x198f (unknown): Unknown script in Halls NE?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9802694,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x187e (unknown): 'mids [2]?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9738690,
    "expectedSize": 6,
    "text": "WRITE $0ea2+4=0x01, $0eac+4=0x17f7 (unknown): Unnamed Short script 0x17f7?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9955555,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x19b0 (set script): Aquagoth"
  },
  {
    "opcode": 63,
    "instructionAddress": 10128641,
    "expectedSize": 11,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x1a82 (set script): Puppet damage/kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9935562,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10192412,
    "expectedSize": 8,
    "text": "WRITE $2837+x68=0x100, $2837+x66=0x1b0f (set script): Unnamed NPC Damage script 0x1b0f"
  },
  {
    "opcode": 63,
    "instructionAddress": 10125991,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10129053,
    "expectedSize": 11,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x1a82 (set script): Puppet damage/kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 10007422,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10082573,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9742624,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1818 (set script): Cave raptors kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 10195886,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1b48 (set script): Unnamed NPC Kill script 0x1b48"
  },
  {
    "opcode": 63,
    "instructionAddress": 9936108,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x1794 (unknown): Halls Wings?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9671024,
    "expectedSize": 8,
    "text": "WRITE $2837+x68=0x200, $2837+x66=0x17af (set script): Raptors kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 10069860,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9684472,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9802836,
    "expectedSize": 6,
    "text": "WRITE $0ea2+6=0x01, $0eac+6=0x1878 (unknown): Unnamed Short script 0x1878?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9810017,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x100, last entity ($0341)+x66=0x18ab (set script): Unnamed NPC Damage script 0x18ab"
  },
  {
    "opcode": 63,
    "instructionAddress": 9804359,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9667844,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10192444,
    "expectedSize": 8,
    "text": "WRITE $283b+x68=0x100, $283b+x66=0x1b15 (set script): Unnamed NPC Damage script 0x1b15"
  },
  {
    "opcode": 63,
    "instructionAddress": 9952634,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10009434,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10194243,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1b24 (set script): Unnamed NPC Kill script 0x1b24"
  },
  {
    "opcode": 63,
    "instructionAddress": 10125757,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9738646,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x178b (unknown): Unnamed Short script 0x178b?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10193176,
    "expectedSize": 8,
    "text": "WRITE $2835+x68=0x200, $2835+x66=0x1b1b (set script): Unnamed NPC Kill script 0x1b1b"
  },
  {
    "opcode": 63,
    "instructionAddress": 9683668,
    "expectedSize": 6,
    "text": "WRITE $0ea2+8=0x01, $0eac+8=0x178e (unknown): BBM Wings?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10006733,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9810040,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x100, last entity ($0341)+x66=0x18ae (set script): Unnamed NPC Damage script 0x18ae"
  },
  {
    "opcode": 63,
    "instructionAddress": 10083223,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10140789,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10198903,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x40, last entity ($0341)+x66=0x1b54 (set script): Unnamed NPC Talk script 0x1b54"
  },
  {
    "opcode": 63,
    "instructionAddress": 10194257,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x1b27 (set script): Unnamed NPC Kill script 0x1b27"
  },
  {
    "opcode": 63,
    "instructionAddress": 10126338,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9823580,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 9739114,
    "expectedSize": 6,
    "text": "WRITE last entity ($0341)+x68=0x200, last entity ($0341)+x66=0x17f4 (set script): Viper commander kill"
  },
  {
    "opcode": 63,
    "instructionAddress": 9734311,
    "expectedSize": 6,
    "text": "WRITE $0ea2+0=0x40, $0eac+0=0x172b (unknown): Unknown 0eac+0 (set in lots of places)?"
  },
  {
    "opcode": 63,
    "instructionAddress": 10128622,
    "expectedSize": 11,
    "text": "WRITE last entity ($0341)+x68=0x300, last entity ($0341)+x66=0x1a82 (set script): Puppet damage/kill"
  }
];

test('opcode corpus 0x3f', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
