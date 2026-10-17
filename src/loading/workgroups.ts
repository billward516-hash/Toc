// The workgroups the loading lab's lot rounds can be played on, from one to eight tools. A workgroup
// generally dedicates its whole fleet to one order, to keep orders from mixing; some can also be
// divided into single tools. Speeds are wafers an hour at full loads: generally faster than 25.
export interface Workgroup {
  id: string
  name: string
  speeds: number[]
  // Whether the group can be run with one tool to an order.
  divisible: boolean
}

export const WORKGROUPS: Workgroup[] = [
  { id: 'eight', name: '8 tools, can be divided', speeds: [25, 25, 40, 40, 40, 40, 40, 40], divisible: true },
  { id: 'six', name: '6 tools, whole fleet only', speeds: [25, 40, 40, 40, 40, 40], divisible: false },
  { id: 'four', name: '4 tools, can be divided', speeds: [25, 40, 40, 40], divisible: true },
  { id: 'two', name: '2 tools, whole fleet only', speeds: [40, 40], divisible: false },
]

export const DEFAULT_WORKGROUP = WORKGROUPS[0]
