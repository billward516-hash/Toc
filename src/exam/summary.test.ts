import { describe, expect, it } from 'vitest'
import { bank } from './bank/index.ts'
import { itemsOf, planExam } from './draw.ts'
import { answered, riskLine, topics, weakest } from './summary.ts'
import { EXAM } from './config.ts'

const items = itemsOf(planExam(bank, 17), bank)!

describe('how an exam went', () => {
  it('counts each tier: how many were asked and how many were right', () => {
    // Answer the first ten right and the next ten wrong.
    const answers = items.slice(0, 20).map((item, i) => (i < 10 ? item.right : (item.right + 1) % item.options.length))
    const list = topics(items, answers)
    expect(list.reduce((sum, t) => sum + t.asked, 0)).toBe(20)
    expect(list.reduce((sum, t) => sum + t.correct, 0)).toBe(10)
    expect(list.map((t) => t.tier)).toEqual([...list.map((t) => t.tier)].sort((a, b) => a - b))
    for (const topic of list) expect(topic.correct).toBeLessThanOrEqual(topic.asked)
  })

  it('lists the questions answered, each with the answer given', () => {
    const answers = [items[0].right, (items[1].right + 1) % items[1].options.length]
    expect(answered(items, answers).map((a) => a.right)).toEqual([true, false])
    expect(answered(items, answers)[1].chosen).toBe(answers[1])
    expect(answered(items, [])).toEqual([])
  })

  it('picks out the topics with the most mistakes, and none that went well', () => {
    const list = [
      { tier: 0, asked: 3, correct: 3 },
      { tier: 1, asked: 4, correct: 2 },
      { tier: 2, asked: 3, correct: 0 },
      { tier: 3, asked: 5, correct: 3 },
      { tier: 4, asked: 4, correct: 3 },
    ]
    expect(weakest(list).map((t) => t.tier)).toEqual([2, 1, 3])
    expect(weakest(list, 1).map((t) => t.tier)).toEqual([2])
    expect(weakest([{ tier: 0, asked: 3, correct: 3 }])).toEqual([])
  })

  it('says where the player stands, in words', () => {
    expect(riskLine(10, 9)).toBe('You are on track to pass.')
    expect(riskLine(30, 18)).toBe('No mistakes to spare.')
    expect(riskLine(30, 19)).toBe('One mistake to spare.')
    expect(riskLine(30, 20)).toBe('Two mistakes to spare.')
    expect(riskLine(30, 17)).toMatch(/^Below the pass mark for now\. .* up to 15 extra questions/)
    expect(riskLine(30, 17)).toContain('24 to 27 right')
    expect(riskLine(30, 10)).toMatch(/cannot reach 70% this time, even with extra questions/)
    expect(riskLine(40, 29)).toBe('You have reached the 70% pass mark.')
    expect(riskLine(40, 27)).toBe('4 more right answers in a row would reach 70%.')
    expect(riskLine(43, 30)).toBe('1 more right answer in a row would reach 70%.')
    expect(riskLine(40, 20)).toBe('You cannot reach 70% this time.')
  })

  it('keeps its wording in step with the exam settings', () => {
    expect(riskLine(30, 17)).toContain(String(EXAM.maxExtra))
    expect(riskLine(40, 29)).toContain(`${EXAM.passPercent}%`)
  })
})
