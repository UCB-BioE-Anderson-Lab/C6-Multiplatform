/**
 * PG4K55
 *
 * PrimeSTAR GXL standard PCR program
 * Target size: ~4 kb
 * Annealing temperature: 55 C
 * Extension time: 1 min/kb
 *
 * Reference: Takara PrimeSTAR GXL manual (Standard Protocol, <=10 kb)
 */

const PG4K55 = {
  name: 'PG4K55',
  steps: [
    {
      kind: 'hold',
      temp_c: 98,
      time_s: 10
    },
    {
      kind: 'cycle',
      count: 30,
      steps: [
        {
          kind: 'hold',
          temp_c: 98,
          time_s: 10
        },
        {
          kind: 'hold',
          temp_c: 55,
          time_s: 15
        },
        {
          kind: 'hold',
          temp_c: 68,
          time_s: 240
        }
      ]
    },
    {
      kind: 'hold',
      temp_c: 16,
      time_s: 0
    }
  ]
};

export default PG4K55;
